"""
Summary Service
AI-powered weekly work summary generation with DB caching
"""

from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from uuid import uuid4
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc

from app.models.resource import WorkLog
from app.models.project import Project
from app.models.user import User
from app.models.ai_summary import AISummary
from app.services.gemini_client import GeminiClient, gemini_client
from app.services.groq_client import GroqClient, groq_client
from app.core.config import settings


class SummaryService:
    """Service for generating AI-powered work summaries with caching"""

    def __init__(
        self, db: Session, client: Optional[Union[GeminiClient, GroqClient]] = None
    ):
        self.db = db
        # Select AI provider based on config (same as ai_worklog_service)
        if client:
            self.client = client
        elif settings.AI_PROVIDER == "gemini":
            self.client = gemini_client
        else:
            self.client = groq_client

    def _get_cached_summary(
        self,
        scope: str,
        scope_id: str,
        period_start: date,
        period_end: date,
        team_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get cached summary from DB"""
        query = self.db.query(AISummary).filter(
            AISummary.scope == scope,
            AISummary.scope_id == scope_id,
            AISummary.period_start == period_start,
            AISummary.period_end == period_end,
        )
        if team_type:
            query = query.filter(AISummary.team_type == team_type)

        cached = query.first()
        if cached:
            return cached.summary_data
        return None

    def _save_cached_summary(
        self,
        scope: str,
        scope_id: str,
        period_start: date,
        period_end: date,
        summary_data: Dict[str, Any],
        team_type: Optional[str] = None,
    ) -> None:
        """Save or update cached summary in DB"""
        # Delete existing cache
        query = self.db.query(AISummary).filter(
            AISummary.scope == scope,
            AISummary.scope_id == scope_id,
            AISummary.period_start == period_start,
            AISummary.period_end == period_end,
        )
        if team_type:
            query = query.filter(AISummary.team_type == team_type)
        query.delete()

        # Create new cache entry
        cache_entry = AISummary(
            id=str(uuid4()),
            scope=scope,
            scope_id=scope_id,
            team_type=team_type,
            period_start=period_start,
            period_end=period_end,
            summary_data=summary_data,
            generated_at=datetime.utcnow(),
        )
        self.db.add(cache_entry)
        self.db.commit()

    def _is_current_week(self, start_date: date, end_date: date) -> bool:
        """Check if the period includes current week (don't cache current week)"""
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        return start_date <= today <= end_date or start_date >= week_start

    async def generate_user_summary(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
        force_regenerate: bool = False,
    ) -> Dict[str, Any]:
        """Generate weekly summary for a single user"""

        is_current = self._is_current_week(start_date, end_date)

        # Check cache (skip for current week or forced regeneration)
        if not force_regenerate and not is_current:
            cached = self._get_cached_summary("user", user_id, start_date, end_date)
            if cached:
                cached["from_cache"] = True
                return cached

        # Fetch worklogs for the period with eager loading
        worklogs = (
            self.db.query(WorkLog)
            .options(joinedload(WorkLog.project), joinedload(WorkLog.user))
            .filter(
                WorkLog.user_id == user_id,
                WorkLog.date >= start_date,
                WorkLog.date <= end_date,
            )
            .all()
        )

        if not worklogs:
            return {
                "summary": ["이 기간에 입력된 worklog가 없습니다."],
                "generated_at": date.today().isoformat(),
            }

        # Aggregate data
        summary_data = self._aggregate_worklog_data(worklogs)

        # Build prompt and generate summary
        prompt = self._build_user_prompt(summary_data, start_date, end_date)
        system_prompt = """당신은 업무 분석 전문가입니다. 
주어진 worklog 데이터를 분석하여 한국어로 3-5개 bullet point 요약을 생성하세요.
각 요약은 간결하고 핵심적인 정보만 포함하세요.
JSON 형식으로 응답하세요: {"summary": ["bullet 1", "bullet 2", ...]}"""

        try:
            result = await self.client.generate_json(prompt, system_prompt)
            response = {
                "summary": result.get("summary", []),
                "generated_at": datetime.utcnow().isoformat(),
                "from_cache": False,
            }

            # Save to cache (only for past weeks)
            if not is_current:
                self._save_cached_summary(
                    "user", user_id, start_date, end_date, response
                )

            return response
        except Exception as e:
            return {
                "summary": [f"요약 생성 중 오류 발생: {str(e)}"],
                "generated_at": date.today().isoformat(),
                "error": str(e),
            }

    async def generate_team_summary(
        self,
        team_id: str,
        team_type: str,  # 'sub_team', 'department', 'business_unit'
        start_date: date,
        end_date: date,
        force_regenerate: bool = False,
    ) -> Dict[str, Any]:
        """Generate weekly summary for a team"""

        is_current = self._is_current_week(start_date, end_date)
        scope_id = team_id or "all"

        # Check cache (skip for current week or forced regeneration)
        if not force_regenerate and not is_current:
            cached = self._get_cached_summary(
                "team", scope_id, start_date, end_date, team_type
            )
            if cached:
                cached["from_cache"] = True
                return cached

        # Get team members based on team type
        user_filter = self._get_team_user_filter(team_id, team_type)

        # Fetch worklogs for the period with eager loading
        worklogs = (
            self.db.query(WorkLog)
            .options(joinedload(WorkLog.project), joinedload(WorkLog.user))
            .filter(
                user_filter,
                WorkLog.date >= start_date,
                WorkLog.date <= end_date,
            )
            .all()
        )

        if not worklogs:
            return {
                "project_summary": [],
                "member_summary": [],
                "issues": ["이 기간에 입력된 worklog가 없습니다."],
                "generated_at": date.today().isoformat(),
            }

        # Aggregate team data
        summary_data = self._aggregate_team_data(worklogs)

        # Build prompt and generate summary
        prompt = self._build_team_prompt(summary_data, start_date, end_date)
        system_prompt = """당신은 팀 업무 분석 전문가입니다. 아래 3가지 관점에서 분석하세요:
1. 프로젝트별 요약: 주요 프로젝트 진행 상황 (2-3개)
2. 멤버별 요약: 개인별 집중 업무 (Top 3 기여자)
3. 주요 이슈/특이사항: 리스크, 병목, 비정상 패턴

JSON 형식으로 응답:
{
  "project_summary": ["프로젝트1 요약...", "프로젝트2 요약..."],
  "member_summary": ["멤버1: 업무 요약", "멤버2: 업무 요약"],
  "issues": ["이슈1", "이슈2"]
}"""

        try:
            result = await self.client.generate_json(prompt, system_prompt)
            response = {
                "project_summary": result.get("project_summary", []),
                "member_summary": result.get("member_summary", []),
                "issues": result.get("issues", []),
                "generated_at": datetime.utcnow().isoformat(),
                "from_cache": False,
            }

            # Save to cache (only for past weeks)
            if not is_current:
                self._save_cached_summary(
                    "team", scope_id, start_date, end_date, response, team_type
                )

            return response
        except Exception as e:
            return {
                "project_summary": [],
                "member_summary": [],
                "issues": [f"요약 생성 중 오류 발생: {str(e)}"],
                "generated_at": date.today().isoformat(),
                "error": str(e),
            }

    def _aggregate_worklog_data(self, worklogs: List[WorkLog]) -> Dict[str, Any]:
        """Aggregate worklog data for summary"""
        total_hours = sum(float(wl.hours) for wl in worklogs)

        # Project hours
        project_hours: Dict[str, float] = {}
        category_hours: Dict[str, float] = {
            "Product": 0,
            "Functional": 0,
            "Support": 0,
            "Team": 0,
        }
        descriptions: List[str] = []

        for wl in worklogs:
            hours = float(wl.hours)
            # Project aggregation
            if wl.project:
                proj_name = str(wl.project.name)
                project_hours[proj_name] = project_hours.get(proj_name, 0) + hours

                # Category
                cat = wl.project.category or "PRODUCT"
                if cat == "FUNCTIONAL":
                    category_hours["Functional"] += hours
                elif cat == "SUPPORT":
                    category_hours["Support"] += hours
                else:
                    category_hours["Product"] += hours
            else:
                category_hours["Team"] += hours

            # Descriptions
            if wl.description:
                descriptions.append(str(wl.description))

        # Sort projects by hours
        sorted_projects = sorted(
            project_hours.items(), key=lambda x: x[1], reverse=True
        )[:5]

        return {
            "total_hours": total_hours,
            "projects": sorted_projects,
            "categories": category_hours,
            "descriptions": descriptions[:20],  # Sample of descriptions
        }

    def _aggregate_team_data(self, worklogs: List[WorkLog]) -> Dict[str, Any]:
        """Aggregate team worklog data"""
        base_data = self._aggregate_worklog_data(worklogs)

        # Member contributions
        member_hours: Dict[str, Dict[str, Any]] = {}
        for wl in worklogs:
            if wl.user:
                user_name = str(wl.user.name)
                hours = float(wl.hours)
                if user_name not in member_hours:
                    member_hours[user_name] = {"total": 0, "projects": {}}
                member_hours[user_name]["total"] += hours
                if wl.project:
                    proj = str(wl.project.name)
                    member_hours[user_name]["projects"][proj] = (
                        member_hours[user_name]["projects"].get(proj, 0) + hours
                    )

        # Sort members by contribution
        sorted_members = sorted(
            member_hours.items(), key=lambda x: x[1]["total"], reverse=True
        )[:5]

        base_data["members"] = sorted_members
        return base_data

    def _build_user_prompt(
        self, data: Dict[str, Any], start_date: date, end_date: date
    ) -> str:
        """Build prompt for user summary"""
        lines = [
            f"기간: {start_date} ~ {end_date}",
            f"총 업무시간: {data['total_hours']:.1f}h",
            "",
            "[프로젝트별 시간]",
        ]
        for proj, hours in data["projects"]:
            pct = (hours / data["total_hours"] * 100) if data["total_hours"] > 0 else 0
            lines.append(f"- {proj}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[업무 카테고리 분포]")
        for cat, hours in data["categories"].items():
            if hours > 0:
                pct = (
                    (hours / data["total_hours"] * 100)
                    if data["total_hours"] > 0
                    else 0
                )
                lines.append(f"- {cat}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[주요 description 샘플]")
        lines.append(", ".join(data["descriptions"][:10]))

        return "\n".join(lines)

    def _build_team_prompt(
        self, data: Dict[str, Any], start_date: date, end_date: date
    ) -> str:
        """Build prompt for team summary"""
        lines = [
            f"기간: {start_date} ~ {end_date}",
            f"총 업무시간: {data['total_hours']:.1f}h",
            "",
            "[프로젝트별 시간]",
        ]
        for proj, hours in data["projects"]:
            pct = (hours / data["total_hours"] * 100) if data["total_hours"] > 0 else 0
            lines.append(f"- {proj}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[멤버별 기여]")
        for member_name, member_data in data.get("members", []):
            top_proj = (
                max(member_data["projects"].items(), key=lambda x: x[1])[0]
                if member_data["projects"]
                else "N/A"
            )
            lines.append(
                f"- {member_name}: {member_data['total']:.1f}h (주력: {top_proj})"
            )

        lines.append("")
        lines.append("[업무 카테고리 분포]")
        for cat, hours in data["categories"].items():
            if hours > 0:
                pct = (
                    (hours / data["total_hours"] * 100)
                    if data["total_hours"] > 0
                    else 0
                )
                lines.append(f"- {cat}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[주요 description 샘플]")
        lines.append(", ".join(data["descriptions"][:15]))

        return "\n".join(lines)

    def get_summary_history(
        self,
        scope: str,
        scope_id: str,
        limit: int = 5,
        team_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get historical AI summaries from cache.
        Returns list of summaries sorted by period_start desc.
        """
        query = self.db.query(AISummary).filter(
            AISummary.scope == scope,
            AISummary.scope_id == scope_id,
        )

        if team_type:
            query = query.filter(AISummary.team_type == team_type)

        history = query.order_by(desc(AISummary.period_start)).limit(limit).all()

        return [
            {
                "id": h.id,
                "period_start": h.period_start,
                "period_end": h.period_end,
                "summary": h.summary_data,
                "generated_at": h.generated_at,
            }
            for h in history
        ]

    def _get_team_user_filter(self, team_id: str, team_type: str):
        """Get SQLAlchemy filter for team users"""
        if team_type == "sub_team":
            return WorkLog.user.has(User.sub_team_id == team_id)
        elif team_type == "department":
            return WorkLog.user.has(User.department_id == team_id)
        elif team_type == "business_unit":
            return WorkLog.user.has(User.business_unit_id == team_id)
        else:
            # All users
            return True
