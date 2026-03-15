"""
Service layer for weekly report CRUD and permissions.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import READ_ONLY_ROLES
from app.models.organization import Department, SubTeam
from app.models.user import User
from app.models.weekly_report import WeeklyReport


@dataclass(frozen=True)
class ResolvedWeeklyReportTarget:
    scope: str
    team_scope_type: Optional[str]
    scope_id: str
    target_key: str
    owner_user_id: Optional[str]


class WeeklyReportService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def get_week_range(reference_date: Optional[date] = None, week_start: Optional[date] = None) -> tuple[date, date, str]:
        if week_start is not None:
            if week_start.weekday() != 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="week_start must be a Monday",
                )
            start = week_start
        else:
            ref = reference_date or date.today()
            start = ref - timedelta(days=ref.weekday())

        end = start + timedelta(days=6)
        week_key = f"{start.isocalendar().year}-W{start.isocalendar().week:02d}"
        return start, end, week_key

    @staticmethod
    def is_in_progress(start: date, end: date, today: Optional[date] = None) -> bool:
        current = today or date.today()
        return start <= current <= end

    def resolve_target(
        self,
        current_user: User,
        scope: str,
        team_scope_type: Optional[str],
        scope_id: Optional[str],
    ) -> ResolvedWeeklyReportTarget:
        if scope == "user":
            if team_scope_type is not None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="team_scope_type is not allowed for personal reports",
                )

            resolved_scope_id = scope_id or current_user.id
            if resolved_scope_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Personal weekly reports can only be accessed by the owner",
                )

            target_user = self.db.query(User).filter(User.id == resolved_scope_id).first()
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target user not found",
                )

            return ResolvedWeeklyReportTarget(
                scope="user",
                team_scope_type=None,
                scope_id=resolved_scope_id,
                target_key=f"user:{resolved_scope_id}",
                owner_user_id=resolved_scope_id,
            )

        if scope != "team":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="scope must be either 'user' or 'team'",
            )

        if team_scope_type not in {"department", "sub_team"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="team_scope_type must be 'department' or 'sub_team' for team reports",
            )

        if team_scope_type == "department":
            resolved_scope_id = scope_id or current_user.department_id
            if not resolved_scope_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Department context is required for department weekly reports",
                )
            department = self.db.query(Department).filter(Department.id == resolved_scope_id).first()
            if not department:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target department not found",
                )
            if current_user.role != "ADMIN" and current_user.department_id != resolved_scope_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Department weekly reports are limited to members of the target department",
                )
            return ResolvedWeeklyReportTarget(
                scope="team",
                team_scope_type="department",
                scope_id=resolved_scope_id,
                target_key=f"department:{resolved_scope_id}",
                owner_user_id=None,
            )

        resolved_scope_id = scope_id or current_user.sub_team_id
        if not resolved_scope_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sub-team context is required for sub-team weekly reports",
            )
        sub_team = self.db.query(SubTeam).filter(SubTeam.id == resolved_scope_id).first()
        if not sub_team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target sub-team not found",
            )
        if current_user.role != "ADMIN" and current_user.sub_team_id != resolved_scope_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sub-team weekly reports are limited to members of the target sub-team",
            )
        return ResolvedWeeklyReportTarget(
            scope="team",
            team_scope_type="sub_team",
            scope_id=resolved_scope_id,
            target_key=f"sub_team:{resolved_scope_id}",
            owner_user_id=None,
        )

    @staticmethod
    def ensure_write_access(current_user: User) -> None:
        if current_user.role in READ_ONLY_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Read-only access. This account does not have permission to modify data.",
            )

    def get_current(
        self,
        current_user: User,
        scope: str,
        team_scope_type: Optional[str],
        scope_id: Optional[str],
        reference_date: Optional[date],
    ) -> dict:
        target = self.resolve_target(current_user, scope, team_scope_type, scope_id)
        week_start, week_end, week_key = self.get_week_range(reference_date=reference_date)
        report = (
            self.db.query(WeeklyReport)
            .filter(
                WeeklyReport.target_key == target.target_key,
                WeeklyReport.week_start == week_start,
            )
            .first()
        )

        return {
            "scope": target.scope,
            "team_scope_type": target.team_scope_type,
            "scope_id": target.scope_id,
            "target_key": target.target_key,
            "week_start": week_start,
            "week_end": week_end,
            "week_key": week_key,
            "is_in_progress": self.is_in_progress(week_start, week_end),
            "report": self.serialize(report) if report else None,
        }

    def get_history(
        self,
        current_user: User,
        scope: str,
        team_scope_type: Optional[str],
        scope_id: Optional[str],
        limit: int,
    ) -> list[dict]:
        target = self.resolve_target(current_user, scope, team_scope_type, scope_id)
        reports = (
            self.db.query(WeeklyReport)
            .filter(WeeklyReport.target_key == target.target_key)
            .order_by(WeeklyReport.week_start.desc())
            .limit(limit)
            .all()
        )
        return [self.serialize(report) for report in reports]

    def upsert(
        self,
        current_user: User,
        *,
        scope: str,
        team_scope_type: Optional[str],
        scope_id: Optional[str],
        week_start: Optional[date],
        reference_date: Optional[date],
        status_value: str,
        title: Optional[str],
        markdown_body: str,
    ) -> dict:
        self.ensure_write_access(current_user)
        target = self.resolve_target(current_user, scope, team_scope_type, scope_id)
        resolved_week_start, week_end, week_key = self.get_week_range(
            reference_date=reference_date,
            week_start=week_start,
        )
        report = (
            self.db.query(WeeklyReport)
            .filter(
                WeeklyReport.target_key == target.target_key,
                WeeklyReport.week_start == resolved_week_start,
            )
            .first()
        )

        is_new = report is None
        if report is None:
            report = WeeklyReport(
                scope=target.scope,
                team_scope_type=target.team_scope_type,
                scope_id=target.scope_id,
                target_key=target.target_key,
                week_start=resolved_week_start,
                week_end=week_end,
                week_key=week_key,
                owner_user_id=target.owner_user_id,
                created_by_user_id=current_user.id,
                updated_by_user_id=current_user.id,
            )
            self.db.add(report)

        report.status = status_value
        report.title = title
        report.markdown_body = markdown_body
        report.week_end = week_end
        report.week_key = week_key
        report.updated_by_user_id = current_user.id

        if status_value == "published":
            report.published_at = datetime.utcnow()
            report.published_by_user_id = current_user.id
        else:
            report.published_at = None
            report.published_by_user_id = None

        self.db.commit()
        self.db.refresh(report)
        return self.serialize(report)

    def delete(self, current_user: User, report_id: str) -> None:
        self.ensure_write_access(current_user)
        report = self.db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weekly report not found",
            )

        self.resolve_target(
            current_user,
            report.scope,
            report.team_scope_type,
            report.scope_id,
        )

        self.db.delete(report)
        self.db.commit()

    def serialize(self, report: WeeklyReport) -> dict:
        return {
            "id": report.id,
            "scope": report.scope,
            "team_scope_type": report.team_scope_type,
            "scope_id": report.scope_id,
            "target_key": report.target_key,
            "week_start": report.week_start,
            "week_end": report.week_end,
            "week_key": report.week_key,
            "is_in_progress": self.is_in_progress(report.week_start, report.week_end),
            "status": report.status,
            "title": report.title,
            "markdown_body": report.markdown_body,
            "source_metadata": report.source_metadata,
            "owner_user_id": report.owner_user_id,
            "created_by_user_id": report.created_by_user_id,
            "updated_by_user_id": report.updated_by_user_id,
            "published_by_user_id": report.published_by_user_id,
            "published_at": report.published_at,
            "created_at": report.created_at,
            "updated_at": report.updated_at,
        }
