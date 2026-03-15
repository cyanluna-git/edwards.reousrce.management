"""
Summary Service
AI-powered weekly work summary generation with DB caching
"""

from datetime import date, datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import uuid4
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc

from app.models.resource import WorkLog
from app.models.project import Project
from app.models.user import User
from app.models.ai_summary import AISummary
from app.services.llm import LLMClient, get_llm_client
from app.core.config import settings


class SummaryService:
    """Service for generating AI-powered work summaries with caching"""

    # English system prompts for token efficiency and language-adaptive output

    USER_SUMMARY_SYSTEM_PROMPT = """You are an engineering work analyst preparing a realistic manager-facing brief for one person.

## Analysis Framework
1. **Focus areas**: Which projects or work types consumed the most effort
2. **Workload pattern**: Utilization and category balance across Product / Functional / Support / Team work
3. **Risk signals**: Concentration, overload, sparse records, unclear descriptions, or other observable concerns
4. **Record quality**: Mention when the available worklog detail is too thin for stronger conclusions

## Response Rules
- Respond in the SAME LANGUAGE as the worklog descriptions (Korean descriptions -> Korean summary, English -> English, mixed -> follow the dominant language)
- Be specific: cite project names, hours, and visible patterns
- Do NOT claim milestone completion or business outcome unless the input clearly states it
- Do NOT create action items or assign owners; stay observation-first
- If evidence is weak, say that directly and keep the statement limited
- Each list item should be concise: 1-2 sentences max
- JSON only:
{
  "focus_areas": ["..."],
  "workload_observations": ["..."],
  "risk_signals": ["..."],
  "record_quality_notes": ["..."]
}"""

    TEAM_SUMMARY_SYSTEM_PROMPT = """You are an engineering team work analyst preparing a realistic manager-facing brief.

## Analysis Framework
1. **Analysis**: Where the team's time was concentrated and what that suggests
2. **Workload observations**: Distribution across members, functions, and organizational slices
3. **Risk signals**: Imbalance, concentration, single-point dependency, weak coverage, or low-detail reporting
4. **Coverage / record quality**: Mention when the available records are too sparse or uneven to support stronger conclusions

## Response Rules
- Respond in the SAME LANGUAGE as the worklog descriptions (Korean -> Korean, English -> English, mixed -> dominant language)
- Be specific: cite project names, member names, hours, percentages, and visible patterns from the input
- Do NOT claim milestone completion or project health unless the input clearly supports it
- Do NOT invent follow-up actions; keep the tone analytical and observational
- If evidence is weak or uneven, say so explicitly
- Each list item should be concise: 1-2 sentences max
- JSON only:
{
  "analysis": ["..."],
  "workload_observations": ["..."],
  "risk_signals": ["..."],
  "coverage_gaps": ["..."],
  "record_quality_notes": ["..."]
}"""

    def __init__(
        self, db: Session, client: Optional[LLMClient] = None
    ):
        self.db = db
        # Select AI provider via factory (supports groq, gemini, pcas)
        self.client = client or get_llm_client()

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

    def _build_period_metadata(
        self,
        start_date: date,
        end_date: date,
    ) -> Dict[str, str]:
        """Return normalized period metadata for current responses and cache."""
        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
        }

    def _normalize_items(self, value: Any, limit: int = 4) -> List[str]:
        """Normalize arbitrary model output into a short string list."""
        if not isinstance(value, list):
            return []

        items: List[str] = []
        for item in value:
            if isinstance(item, str):
                normalized = item.strip()
                if normalized:
                    items.append(normalized)
            if len(items) >= limit:
                break
        return items

    def _build_user_response(
        self,
        result: Dict[str, Any],
        start_date: date,
        end_date: date,
        from_cache: bool,
    ) -> Dict[str, Any]:
        focus_areas = self._normalize_items(result.get("focus_areas"))
        workload_observations = self._normalize_items(result.get("workload_observations"))
        risk_signals = self._normalize_items(result.get("risk_signals"))
        record_quality_notes = self._normalize_items(result.get("record_quality_notes"), limit=2)

        summary = [
            *focus_areas[:2],
            *workload_observations[:2],
            *risk_signals[:1],
        ]
        if not summary and record_quality_notes:
            summary = record_quality_notes[:2]

        return {
            "summary": summary,
            "focus_areas": focus_areas,
            "workload_observations": workload_observations,
            "risk_signals": risk_signals,
            "record_quality_notes": record_quality_notes,
            "generated_at": datetime.utcnow().isoformat(),
            "from_cache": from_cache,
            **self._build_period_metadata(start_date, end_date),
        }

    def _build_team_response(
        self,
        result: Dict[str, Any],
        start_date: date,
        end_date: date,
        from_cache: bool,
    ) -> Dict[str, Any]:
        analysis = self._normalize_items(result.get("analysis"))
        workload_observations = self._normalize_items(result.get("workload_observations"))
        risk_signals = self._normalize_items(result.get("risk_signals"))
        coverage_gaps = self._normalize_items(result.get("coverage_gaps"))
        record_quality_notes = self._normalize_items(result.get("record_quality_notes"), limit=2)

        return {
            "project_summary": analysis,
            "member_summary": workload_observations,
            "issues": [*risk_signals, *coverage_gaps, *record_quality_notes][:5],
            "analysis": analysis,
            "workload_observations": workload_observations,
            "risk_signals": risk_signals,
            "coverage_gaps": coverage_gaps,
            "record_quality_notes": record_quality_notes,
            "generated_at": datetime.utcnow().isoformat(),
            "from_cache": from_cache,
            **self._build_period_metadata(start_date, end_date),
        }

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
                "summary": ["No worklogs found for this period."],
                "focus_areas": [],
                "workload_observations": [],
                "risk_signals": [],
                "record_quality_notes": [],
                "generated_at": date.today().isoformat(),
                **self._build_period_metadata(start_date, end_date),
            }

        # Aggregate data
        summary_data = self._aggregate_worklog_data(worklogs)

        # Build prompt and generate summary
        prompt = self._build_user_prompt(summary_data, start_date, end_date)
        system_prompt = self.USER_SUMMARY_SYSTEM_PROMPT

        try:
            result = await self.client.generate_json(prompt, system_prompt)
            response = self._build_user_response(
                result,
                start_date,
                end_date,
                from_cache=False,
            )

            # Save to cache (only for past weeks)
            if not is_current:
                self._save_cached_summary(
                    "user", user_id, start_date, end_date, response
                )

            return response
        except Exception as e:
            return {
                "summary": [f"Summary generation failed: {str(e)}"],
                "focus_areas": [],
                "workload_observations": [],
                "risk_signals": [],
                "record_quality_notes": [],
                "generated_at": date.today().isoformat(),
                "error": str(e),
                **self._build_period_metadata(start_date, end_date),
            }

    async def generate_team_summary(
        self,
        team_id: str,
        team_type: str,  # 'sub_team', 'department', 'business_unit'
        start_date: date,
        end_date: date,
        force_regenerate: bool = False,
        dashboard_context: Optional[Dict[str, Any]] = None,
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
                "issues": ["No worklogs found for this period."],
                "analysis": [],
                "workload_observations": [],
                "risk_signals": [],
                "coverage_gaps": [],
                "record_quality_notes": [],
                "generated_at": date.today().isoformat(),
                **self._build_period_metadata(start_date, end_date),
            }

        # Aggregate team data
        summary_data = self._aggregate_team_data(worklogs)

        # Build prompt and generate summary
        prompt = self._build_team_prompt(
            summary_data,
            start_date,
            end_date,
            dashboard_context=dashboard_context,
        )
        system_prompt = self.TEAM_SUMMARY_SYSTEM_PROMPT

        try:
            result = await self.client.generate_json(prompt, system_prompt)
            response = self._build_team_response(
                result,
                start_date,
                end_date,
                from_cache=False,
            )

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
                "issues": [f"Summary generation failed: {str(e)}"],
                "analysis": [],
                "workload_observations": [],
                "risk_signals": [],
                "coverage_gaps": [],
                "record_quality_notes": [],
                "generated_at": date.today().isoformat(),
                "error": str(e),
                **self._build_period_metadata(start_date, end_date),
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
        description_count = 0
        empty_description_count = 0

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
                description_count += 1
                descriptions.append(str(wl.description))
            else:
                empty_description_count += 1

        # Sort projects by hours
        sorted_projects = sorted(
            project_hours.items(), key=lambda x: x[1], reverse=True
        )[:5]

        return {
            "total_hours": total_hours,
            "projects": sorted_projects,
            "categories": category_hours,
            "descriptions": descriptions[:20],  # Sample of descriptions
            "description_count": description_count,
            "empty_description_count": empty_description_count,
            "worklog_count": len(worklogs),
            "project_count": len(project_hours),
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
        base_data["member_count_with_logs"] = len(member_hours)
        return base_data

    def _build_utilization_line(
        self, total_hours: float, start_date: date, end_date: date
    ) -> str:
        """Calculate utilization rate and return a formatted line for prompt data"""
        working_days = (end_date - start_date).days + 1
        # Exclude weekends (simple heuristic)
        biz_days = sum(
            1
            for d in range(working_days)
            if (start_date + timedelta(days=d)).weekday() < 5
        )
        standard_hours = biz_days * 8
        if standard_hours > 0:
            utilization = total_hours / standard_hours * 100
            return f"Utilization: {total_hours:.1f}h / {standard_hours:.1f}h ({utilization:.0f}%)"
        return f"Utilization: {total_hours:.1f}h / 0h (N/A)"

    def _build_user_prompt(
        self, data: Dict[str, Any], start_date: date, end_date: date
    ) -> str:
        """Build prompt for user summary"""
        # Calculate utilization rate
        utilization_line = self._build_utilization_line(
            data["total_hours"], start_date, end_date
        )

        lines = [
            f"Period: {start_date} ~ {end_date}",
            f"Total hours: {data['total_hours']:.1f}h",
            utilization_line,
            f"Worklog count: {data['worklog_count']}",
            f"Descriptions with detail: {data['description_count']}",
            f"Descriptions missing or empty: {data['empty_description_count']}",
            "",
            "[Hours by Project]",
        ]
        for proj, hours in data["projects"]:
            pct = (hours / data["total_hours"] * 100) if data["total_hours"] > 0 else 0
            lines.append(f"- {proj}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[Category Distribution]")
        for cat, hours in data["categories"].items():
            if hours > 0:
                pct = (
                    (hours / data["total_hours"] * 100)
                    if data["total_hours"] > 0
                    else 0
                )
                lines.append(f"- {cat}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[Description Samples]")
        lines.append(", ".join(data["descriptions"][:10]))
        lines.append("")
        lines.append("[Interpretation Guardrails]")
        lines.append(
            "- Use only observable workload patterns from hours, categories, and descriptions."
        )
        lines.append(
            "- If descriptions are sparse, prefer saying the evidence is limited."
        )
        lines.append(
            "- Do not infer milestone completion unless it is explicitly written in the descriptions."
        )

        return "\n".join(lines)

    def _build_team_prompt(
        self,
        data: Dict[str, Any],
        start_date: date,
        end_date: date,
        dashboard_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build prompt for team summary"""
        lines = [
            f"Period: {start_date} ~ {end_date}",
            f"Total hours: {data['total_hours']:.1f}h",
            f"Worklog count: {data['worklog_count']}",
            f"Descriptions with detail: {data['description_count']}",
            f"Descriptions missing or empty: {data['empty_description_count']}",
            "",
            "[Hours by Project]",
        ]
        for proj, hours in data["projects"]:
            pct = (hours / data["total_hours"] * 100) if data["total_hours"] > 0 else 0
            lines.append(f"- {proj}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[Member Contributions]")
        for member_name, member_data in data.get("members", []):
            top_proj = (
                max(member_data["projects"].items(), key=lambda x: x[1])[0]
                if member_data["projects"]
                else "N/A"
            )
            lines.append(
                f"- {member_name}: {member_data['total']:.1f}h (primary: {top_proj})"
            )

        lines.append("")
        lines.append("[Category Distribution]")
        for cat, hours in data["categories"].items():
            if hours > 0:
                pct = (
                    (hours / data["total_hours"] * 100)
                    if data["total_hours"] > 0
                    else 0
                )
                lines.append(f"- {cat}: {hours:.1f}h ({pct:.0f}%)")

        lines.append("")
        lines.append("[Description Samples]")
        lines.append(", ".join(data["descriptions"][:15]))

        if dashboard_context:
            team_info = dashboard_context.get("team_info", {})
            member_contributions = dashboard_context.get("member_contributions", [])
            sub_org_contributions = dashboard_context.get("sub_org_contributions", [])
            org_context = dashboard_context.get("org_context", {})

            lines.append("")
            lines.append("[Dashboard Context]")
            if team_info.get("name"):
                lines.append(
                    f"- Team: {team_info.get('name')} ({team_info.get('member_count', 0)} members)"
                )
            if org_context.get("team_percentage") is not None:
                lines.append(
                    f"- Share of wider engineering hours: {org_context.get('team_percentage', 0)}%"
                )

            if member_contributions:
                lines.append("[Top Member Load]")
                for member in member_contributions[:5]:
                    member_hours = float(member.get("hours") or 0)
                    lines.append(
                        f"- {member.get('korean_name') or member.get('name')}: {member_hours:.1f}h ({member.get('percentage', 0)}%)"
                    )

            if sub_org_contributions:
                lines.append("[Sub-Organization Split]")
                for org in sub_org_contributions[:5]:
                    org_hours = float(org.get("hours") or 0)
                    lines.append(
                        f"- {org.get('org_name')}: {org_hours:.1f}h ({org.get('percentage', 0)}%, {org.get('member_count', 0)} members)"
                    )

        lines.append("")
        lines.append("[Interpretation Guardrails]")
        lines.append(
            "- Use the dashboard context as grounding for workload distribution and concentration only."
        )
        lines.append(
            "- Do not claim milestone completion or project progress unless the descriptions clearly support it."
        )
        lines.append(
            "- If records are sparse or uneven across members, call that out as a record-quality limitation."
        )

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
