"""
Service layer for LLM-powered weekly report summarization.

Provides hierarchical summarization:
- personal reports → sub-team summary
- sub-team summaries → department summary
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.organization import Department, SubTeam
from app.models.user import User
from app.models.weekly_report import WeeklyReport
from app.prompts.weekly_report_summary import (
    build_group_to_team_prompt,
    build_personal_to_group_prompt,
)
from app.services.llm import LLMClient, get_llm_client
from app.services.weekly_report_service import WeeklyReportService

_REPORT_CONTENT_MAX_CHARS = 2000


def _monday_of_week(ref: date) -> date:
    """Return the Monday of the week containing ref."""
    return ref - timedelta(days=ref.weekday())


class WeeklyReportSummaryService:
    """Service for generating LLM-powered team weekly report summaries."""

    def __init__(self, db: Session, llm_client: Optional[LLMClient] = None):
        self.db = db
        self.llm = llm_client or get_llm_client()
        self.report_service = WeeklyReportService(db)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def summarize_for_team(
        self,
        team_scope_type: str,
        scope_id: str,
        week_start: Optional[date],
        current_user: User,
        save_intermediate: bool = True,
    ) -> dict:
        """
        Generate an LLM summary for the given team scope.

        Args:
            team_scope_type: "department" or "sub_team"
            scope_id: ID of the department or sub-team
            week_start: Monday of the target week; defaults to current week if None
            current_user: Authenticated user (for permission checks)
            save_intermediate: If True, save sub-team summaries back to DB

        Returns:
            dict with keys:
                team_summary_markdown, sub_team_summaries,
                personal_report_count, missing_members, scope_description
        """
        # Validate scope type
        if team_scope_type not in {"department", "sub_team"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="team_scope_type must be 'department' or 'sub_team'",
            )

        # Permission check using resolve_target
        self.report_service.resolve_target(
            current_user=current_user,
            scope="team",
            team_scope_type=team_scope_type,
            scope_id=scope_id,
        )

        # Determine target week
        resolved_week_start = week_start or _monday_of_week(date.today())

        if team_scope_type == "sub_team":
            return await self._summarize_sub_team(
                sub_team_id=scope_id,
                week_start=resolved_week_start,
                save_back=save_intermediate,
                current_user=current_user,
            )

        # department scope
        return await self._summarize_department(
            department_id=scope_id,
            week_start=resolved_week_start,
            current_user=current_user,
            save_intermediate=save_intermediate,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _summarize_sub_team(
        self,
        sub_team_id: str,
        week_start: date,
        save_back: bool = True,
        current_user: Optional[User] = None,
    ) -> dict:
        """Summarize a single sub-team from personal reports."""
        sub_team = self.db.query(SubTeam).filter(SubTeam.id == sub_team_id).first()
        if not sub_team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sub-team not found",
            )

        personal_reports, missing_members = self._collect_personal_reports(
            week_start=week_start,
            sub_team_id=sub_team_id,
        )

        # Get existing sub-team report body for reference
        existing_body = self._get_existing_team_report_body(
            target_key=f"sub_team:{sub_team_id}",
            week_start=week_start,
        )

        summary_markdown = await self._call_llm_personal_to_group(
            reports=personal_reports,
            group_name=sub_team.name,
            existing_body=existing_body,
        )

        if save_back and summary_markdown and current_user is not None:
            self.report_service.upsert(
                current_user=current_user,
                scope="team",
                team_scope_type="sub_team",
                scope_id=sub_team.id,
                week_start=week_start,
                reference_date=None,
                status_value="published",
                title=None,
                markdown_body=summary_markdown,
            )

        return {
            "team_summary_markdown": summary_markdown,
            "sub_team_summaries": None,
            "personal_report_count": len(personal_reports),
            "missing_members": missing_members,
            "scope_description": f"{sub_team.name} (Sub-Team)",
        }

    async def _summarize_department(
        self,
        department_id: str,
        week_start: date,
        current_user: User,
        save_intermediate: bool = True,
    ) -> dict:
        """Summarize a department, using hierarchical or flat approach."""
        department = (
            self.db.query(Department).filter(Department.id == department_id).first()
        )
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        sub_teams = (
            self.db.query(SubTeam)
            .filter(SubTeam.department_id == department_id, SubTeam.is_active == True)
            .all()
        )

        existing_dept_body = self._get_existing_team_report_body(
            target_key=f"department:{department_id}",
            week_start=week_start,
        )

        if sub_teams:
            # Hierarchical: personal → sub-team → department
            return await self._summarize_department_hierarchical(
                department=department,
                sub_teams=sub_teams,
                week_start=week_start,
                existing_dept_body=existing_dept_body,
                save_intermediate=save_intermediate,
                current_user=current_user,
            )
        else:
            # Flat: personal → department
            return await self._summarize_department_flat(
                department=department,
                week_start=week_start,
                existing_body=existing_dept_body,
            )

    async def _summarize_department_hierarchical(
        self,
        department: Department,
        sub_teams: list,
        week_start: date,
        existing_dept_body: str,
        save_intermediate: bool,
        current_user: Optional[User] = None,
    ) -> dict:
        """Hierarchical summarization: personal → sub-team → department."""
        sub_team_summary_results = []
        all_missing_members: list[str] = []
        total_personal_count = 0

        for sub_team in sub_teams:
            personal_reports, missing = self._collect_personal_reports(
                week_start=week_start,
                sub_team_id=sub_team.id,
            )
            all_missing_members.extend(missing)
            total_personal_count += len(personal_reports)

            if not personal_reports:
                # No reports in this sub-team — skip LLM call
                continue

            existing_st_body = self._get_existing_team_report_body(
                target_key=f"sub_team:{sub_team.id}",
                week_start=week_start,
            )

            st_summary = await self._call_llm_personal_to_group(
                reports=personal_reports,
                group_name=sub_team.name,
                existing_body=existing_st_body,
            )

            if save_intermediate and st_summary and current_user is not None:
                self.report_service.upsert(
                    current_user=current_user,
                    scope="team",
                    team_scope_type="sub_team",
                    scope_id=sub_team.id,
                    week_start=week_start,
                    reference_date=None,
                    status_value="published",
                    title=None,
                    markdown_body=st_summary,
                )

            sub_team_summary_results.append(
                {
                    "sub_team_id": sub_team.id,
                    "sub_team_name": sub_team.name,
                    "summary_markdown": st_summary,
                    "member_count": len(personal_reports),
                }
            )

        if not sub_team_summary_results:
            return {
                "team_summary_markdown": "",
                "sub_team_summaries": [],
                "personal_report_count": total_personal_count,
                "missing_members": all_missing_members,
                "scope_description": f"{department.name} (Department)",
            }

        # Aggregate sub-team summaries into department summary
        group_inputs = [
            {"sub_team_name": r["sub_team_name"], "summary": r["summary_markdown"]}
            for r in sub_team_summary_results
        ]
        dept_summary = await self._call_llm_group_to_team(
            sub_team_summaries=group_inputs,
            team_name=department.name,
            existing_body=existing_dept_body,
        )

        return {
            "team_summary_markdown": dept_summary,
            "sub_team_summaries": sub_team_summary_results,
            "personal_report_count": total_personal_count,
            "missing_members": all_missing_members,
            "scope_description": f"{department.name} (Department)",
        }

    async def _summarize_department_flat(
        self,
        department: Department,
        week_start: date,
        existing_body: str,
    ) -> dict:
        """Flat summarization: personal → department (no sub-teams)."""
        personal_reports, missing_members = self._collect_personal_reports(
            week_start=week_start,
            department_id=department.id,
        )

        summary_markdown = await self._call_llm_personal_to_group(
            reports=personal_reports,
            group_name=department.name,
            existing_body=existing_body,
        )

        return {
            "team_summary_markdown": summary_markdown,
            "sub_team_summaries": None,
            "personal_report_count": len(personal_reports),
            "missing_members": missing_members,
            "scope_description": f"{department.name} (Department)",
        }

    def _collect_personal_reports(
        self,
        week_start: date,
        department_id: Optional[str] = None,
        sub_team_id: Optional[str] = None,
    ) -> tuple[list[dict], list[str]]:
        """
        Collect personal weekly reports for the given org scope and week.

        Returns:
            Tuple of (reports, missing_member_names)
            where reports = [{"user_name": str, "content": str}, ...]
        """
        # Build user query
        user_query = self.db.query(User).filter(User.is_active == True)
        if sub_team_id:
            user_query = user_query.filter(User.sub_team_id == sub_team_id)
        elif department_id:
            user_query = user_query.filter(User.department_id == department_id)
        else:
            return [], []

        users = user_query.all()
        if not users:
            return [], []

        user_ids = [u.id for u in users]
        user_map = {u.id: u for u in users}

        # Fetch their personal reports for this week
        reports_db = (
            self.db.query(WeeklyReport)
            .filter(
                WeeklyReport.scope == "user",
                WeeklyReport.week_start == week_start,
                WeeklyReport.owner_user_id.in_(user_ids),
            )
            .all()
        )

        reported_user_ids = {r.owner_user_id for r in reports_db}
        missing_member_names = [
            user_map[uid].name
            for uid in user_ids
            if uid not in reported_user_ids and uid in user_map
        ]

        # Build report dicts, truncating content
        report_list = []
        for report in reports_db:
            user = user_map.get(report.owner_user_id)
            user_name = user.name if user else report.owner_user_id
            content = (report.markdown_body or "").strip()
            if len(content) > _REPORT_CONTENT_MAX_CHARS:
                content = content[:_REPORT_CONTENT_MAX_CHARS] + "\n... (이하 생략)"
            if content:
                report_list.append({"user_name": user_name, "content": content})

        return report_list, missing_member_names

    def _get_existing_team_report_body(
        self, target_key: str, week_start: date
    ) -> str:
        """Return the markdown_body of an existing team report, or empty string."""
        existing = (
            self.db.query(WeeklyReport)
            .filter(
                WeeklyReport.target_key == target_key,
                WeeklyReport.week_start == week_start,
            )
            .first()
        )
        if existing and existing.markdown_body:
            return existing.markdown_body
        return ""

    async def _call_llm_personal_to_group(
        self,
        reports: list[dict],
        group_name: str,
        existing_body: str,
    ) -> str:
        """Call LLM to aggregate personal reports into a group summary."""
        if not reports:
            return ""

        system_prompt, user_prompt = build_personal_to_group_prompt(
            reports=reports,
            group_name=group_name,
            existing_body=existing_body,
        )

        try:
            result = await self.llm.generate_json(user_prompt, system_prompt)
            return result.get("summary_markdown", "")
        except Exception as e:
            return f"<!-- LLM 요약 생성 실패: {e} -->"

    async def _call_llm_group_to_team(
        self,
        sub_team_summaries: list[dict],
        team_name: str,
        existing_body: str,
    ) -> str:
        """Call LLM to aggregate sub-team summaries into a department summary."""
        if not sub_team_summaries:
            return ""

        system_prompt, user_prompt = build_group_to_team_prompt(
            sub_team_summaries=sub_team_summaries,
            team_name=team_name,
            existing_body=existing_body,
        )

        try:
            result = await self.llm.generate_json(user_prompt, system_prompt)
            return result.get("summary_markdown", "")
        except Exception as e:
            return f"<!-- LLM 요약 생성 실패: {e} -->"
