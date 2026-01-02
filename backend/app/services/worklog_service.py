"""
Service layer for worklog-related business logic
"""

from typing import List, Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date

from app.models.resource import WorkLog
from app.models.project import Project
from app.schemas.worklog import (
    WorkLogCreate,
    WorkLogUpdate,
    DailySummary,
    ProjectSummary,
)


class WorkLogService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, worklog_id: int) -> Optional[WorkLog]:
        """Get a worklog by its ID."""
        return (
            self.db.query(WorkLog)
            .options(joinedload(WorkLog.project))
            .filter(WorkLog.id == worklog_id)
            .first()
        )

    def get_multi(
        self,
        *,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        work_type_category_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[WorkLog]:
        """Retrieve multiple worklogs with filters and pagination."""
        query = self.db.query(WorkLog).options(joinedload(WorkLog.project))

        if user_id:
            query = query.filter(WorkLog.user_id == user_id)
        if project_id:
            query = query.filter(WorkLog.project_id == project_id)
        if start_date:
            query = query.filter(cast(WorkLog.date, Date) >= start_date)
        if end_date:
            query = query.filter(cast(WorkLog.date, Date) <= end_date)
        if work_type_category_id:
            query = query.filter(WorkLog.work_type_category_id == work_type_category_id)

        return query.order_by(WorkLog.date.desc()).offset(skip).limit(limit).all()

    def get_multi_with_user(
        self,
        *,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        sub_team_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        work_type_category_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 500,
    ) -> List[WorkLog]:
        """Retrieve worklogs with user info for table display."""
        from app.models.user import User

        query = (
            self.db.query(WorkLog)
            .options(
                joinedload(WorkLog.project),
                joinedload(WorkLog.user),
                joinedload(WorkLog.work_type_category),
            )
            .join(User, WorkLog.user_id == User.id)
        )

        if user_id:
            query = query.filter(WorkLog.user_id == user_id)
        if project_id:
            query = query.filter(WorkLog.project_id == project_id)
        if sub_team_id:
            query = query.filter(User.sub_team_id == sub_team_id)
        if start_date:
            query = query.filter(cast(WorkLog.date, Date) >= start_date)
        if end_date:
            query = query.filter(cast(WorkLog.date, Date) <= end_date)
        if work_type_category_id:
            query = query.filter(WorkLog.work_type_category_id == work_type_category_id)

        return query.order_by(WorkLog.date.desc()).offset(skip).limit(limit).all()

    def get_daily_total_hours(
        self, user_id: str, target_date: date, exclude_id: Optional[int] = None
    ) -> float:
        """Get total hours for a user on a specific date."""
        query = self.db.query(func.sum(WorkLog.hours)).filter(
            WorkLog.user_id == user_id,
            cast(WorkLog.date, Date) == target_date,
        )
        if exclude_id:
            query = query.filter(WorkLog.id != exclude_id)

        result = query.scalar()
        return result or 0.0

    def validate_daily_hours(
        self,
        user_id: str,
        target_date: date,
        new_hours: float,
        exclude_id: Optional[int] = None,
    ) -> None:
        """Validate that adding new_hours won't exceed 24 hours for the day."""
        existing_total = self.get_daily_total_hours(user_id, target_date, exclude_id)
        if existing_total + new_hours > 24:
            raise ValueError(
                f"Total hours cannot exceed 24. Current: {existing_total:.1f}h, "
                f"Adding: {new_hours:.1f}h, Total would be: {existing_total + new_hours:.1f}h"
            )

    def create(self, worklog_in: WorkLogCreate) -> WorkLog:
        """Create a new worklog with 24-hour validation."""
        self.validate_daily_hours(worklog_in.user_id, worklog_in.date, worklog_in.hours)

        db_worklog = WorkLog(**worklog_in.model_dump())
        self.db.add(db_worklog)
        self.db.commit()
        self.db.refresh(db_worklog)
        return db_worklog

    def update(self, worklog_id: int, worklog_in: WorkLogUpdate) -> Optional[WorkLog]:
        """Update an existing worklog with 24-hour validation."""
        db_worklog = self.db.query(WorkLog).filter(WorkLog.id == worklog_id).first()
        if not db_worklog:
            return None

        update_data = worklog_in.model_dump(exclude_unset=True)

        # Validate hours if being updated
        if "hours" in update_data:
            target_date = update_data.get("date", db_worklog.date)
            if isinstance(target_date, str):
                target_date = date.fromisoformat(target_date)
            self.validate_daily_hours(
                db_worklog.user_id,
                target_date,
                update_data["hours"],
                exclude_id=worklog_id,
            )

        for key, value in update_data.items():
            setattr(db_worklog, key, value)

        self.db.add(db_worklog)
        self.db.commit()
        self.db.refresh(db_worklog)
        return db_worklog

    def delete(self, worklog_id: int) -> Optional[WorkLog]:
        """Delete a worklog by its ID."""
        db_worklog = self.db.query(WorkLog).filter(WorkLog.id == worklog_id).first()
        if not db_worklog:
            return None

        self.db.delete(db_worklog)
        self.db.commit()
        return db_worklog

    def copy_week(self, user_id: str, target_week_start: date) -> List[WorkLog]:
        """Copy all worklogs from the previous week to the target week."""
        # Calculate previous week's start date (7 days before)
        source_week_start = target_week_start - timedelta(days=7)
        source_week_end = target_week_start - timedelta(days=1)

        # Get all worklogs from previous week
        source_worklogs = (
            self.db.query(WorkLog)
            .filter(
                WorkLog.user_id == user_id,
                cast(WorkLog.date, Date) >= source_week_start,
                cast(WorkLog.date, Date) <= source_week_end,
            )
            .all()
        )

        new_worklogs = []
        for source in source_worklogs:
            # Calculate the new date (add 7 days)
            source_date = (
                source.date.date() if hasattr(source.date, "date") else source.date
            )
            new_date = source_date + timedelta(days=7)

            # Check if we can add these hours (24h validation)
            try:
                self.validate_daily_hours(user_id, new_date, source.hours)
            except ValueError:
                # Skip this entry if it would exceed 24h
                continue

            new_worklog = WorkLog(
                date=new_date,
                user_id=user_id,
                project_id=source.project_id,
                work_type_category_id=source.work_type_category_id,
                hours=source.hours,
                description=source.description,
                is_sudden_work=source.is_sudden_work,
                is_business_trip=source.is_business_trip,
            )
            self.db.add(new_worklog)
            new_worklogs.append(new_worklog)

        if new_worklogs:
            self.db.commit()
            for wl in new_worklogs:
                self.db.refresh(wl)

        return new_worklogs

    def get_daily_summary(self, user_id: str, target_date: date) -> DailySummary:
        """Get daily worklog summary for a user."""
        worklogs = (
            self.db.query(WorkLog)
            .options(joinedload(WorkLog.project))
            .filter(
                WorkLog.user_id == user_id,
                cast(WorkLog.date, Date) == target_date,
            )
            .all()
        )

        # Calculate totals per project
        project_hours: dict = {}
        for wl in worklogs:
            pid = wl.project_id
            if pid not in project_hours:
                project_hours[pid] = {
                    "project_id": pid,
                    "project_code": wl.project.code if wl.project else "N/A",
                    "project_name": wl.project.name if wl.project else "Unknown",
                    "hours": 0.0,
                }
            project_hours[pid]["hours"] += wl.hours

        total_hours = sum(p["hours"] for p in project_hours.values())

        return DailySummary(
            date=target_date,
            user_id=user_id,
            total_hours=total_hours,
            remaining_hours=max(0, 24 - total_hours),
            projects=[ProjectSummary(**p) for p in project_hours.values()],
        )
