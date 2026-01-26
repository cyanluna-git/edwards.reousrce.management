"""
AI Worklog Service
Business logic for AI-assisted worklog parsing
"""

import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.project import Project
from app.models.work_type import WorkTypeCategory
from app.services.ollama_client import OllamaClient, ollama_client
from app.prompts.worklog_parser import WorklogParserPrompt
from app.schemas.ai_worklog import (
    AIWorklogParseRequest,
    AIWorklogParseResponse,
    AIWorklogEntry,
)


class AIWorklogService:
    """Service for AI-assisted worklog parsing"""

    def __init__(self, db: Session, client: Optional[OllamaClient] = None):
        self.db = db
        self.client = client or ollama_client
        self._projects_cache: Optional[List[Dict[str, Any]]] = None
        self._work_types_cache: Optional[List[Dict[str, Any]]] = None

    def _load_projects(self) -> List[Dict[str, Any]]:
        """Load active projects from database"""
        if self._projects_cache is not None:
            return self._projects_cache

        projects = (
            self.db.query(Project)
            .filter(Project.status.in_(["Planned", "InProgress"]))
            .order_by(Project.name)
            .all()
        )

        self._projects_cache = [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
            }
            for p in projects
        ]
        return self._projects_cache

    def _load_work_types(self) -> List[Dict[str, Any]]:
        """Load work type categories from database"""
        if self._work_types_cache is not None:
            return self._work_types_cache

        # Load leaf-level work types (those without children, or level 2+)
        work_types = (
            self.db.query(WorkTypeCategory)
            .filter(WorkTypeCategory.level >= 1)
            .order_by(WorkTypeCategory.name)
            .all()
        )

        self._work_types_cache = [
            {
                "id": w.id,
                "code": w.code,
                "name": w.name,
            }
            for w in work_types
        ]
        return self._work_types_cache

    def _build_system_prompt(self) -> str:
        """Build the system prompt with current projects and work types"""
        projects = self._load_projects()
        work_types = self._load_work_types()
        return WorklogParserPrompt.build_system_prompt(projects, work_types)

    def _validate_and_map_entry(
        self,
        entry: Dict[str, Any],
        projects_map: Dict[str, Dict[str, Any]],
        work_types_map: Dict[int, Dict[str, Any]],
    ) -> AIWorklogEntry:
        """
        Validate and map a single parsed entry.

        Ensures project_id and work_type_category_id exist in the database.
        """
        project_id = entry.get("project_id")
        project_name = entry.get("project_name")
        # Handle both field names from AI response
        work_type_id = entry.get("work_type_category_id") or entry.get("work_type_id")
        work_type_name = entry.get("work_type_name")

        # Validate project
        if project_id and project_id in projects_map:
            project_name = projects_map[project_id]["name"]
        elif project_id:
            # Try to find by prefix match (AI returns truncated IDs)
            matched = None
            for pid, proj in projects_map.items():
                if pid.startswith(project_id) or project_id.startswith(pid[:8]):
                    matched = proj
                    break

            # If no prefix match, try fuzzy name match
            if not matched:
                matched = self._fuzzy_match_project(project_id, projects_map)

            if matched:
                project_id = matched["id"]
                project_name = matched["name"]
            else:
                project_id = None
                project_name = entry.get("project_name")

        # Validate work type
        if work_type_id and work_type_id in work_types_map:
            work_type_name = work_types_map[work_type_id]["name"]
        elif work_type_id:
            work_type_id = None
            work_type_name = entry.get("work_type_name")

        # Ensure hours is within bounds
        hours = entry.get("hours", 1.0)
        if not isinstance(hours, (int, float)):
            hours = 1.0
        hours = max(0.5, min(24.0, float(hours)))

        # Ensure confidence is within bounds
        confidence = entry.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)):
            confidence = 0.5
        confidence = max(0.0, min(1.0, float(confidence)))

        # Ensure description is a string
        description = entry.get("description") or ""
        if not isinstance(description, str):
            description = str(description)

        return AIWorklogEntry(
            project_id=project_id,
            project_name=project_name,
            work_type_category_id=work_type_id,
            work_type_name=work_type_name,
            description=description,
            hours=hours,
            confidence=confidence,
        )

    def _fuzzy_match_project(
        self,
        search_term: str,
        projects_map: Dict[str, Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Try to fuzzy match a project by name or code.
        """
        search_lower = search_term.lower()

        for proj in projects_map.values():
            if (
                search_lower in proj["name"].lower()
                or search_lower in proj.get("code", "").lower()
            ):
                return proj

        return None

    async def parse_worklog(
        self,
        request: AIWorklogParseRequest,
    ) -> AIWorklogParseResponse:
        """
        Parse natural language input into structured worklog entries.

        Args:
            request: Parse request with text, user_id, and target_date

        Returns:
            AIWorklogParseResponse with parsed entries
        """
        warnings: List[str] = []

        # Build prompts
        system_prompt = self._build_system_prompt()
        user_prompt = WorklogParserPrompt.build_user_prompt(
            request.text,
            request.target_date,
        )

        # Call AI
        try:
            result = await self.client.generate_json(
                prompt=user_prompt,
                system=system_prompt,
            )
        except Exception as e:
            logger.error(f"AI parsing failed: {str(e)}")
            return AIWorklogParseResponse(
                entries=[],
                total_hours=0.0,
                warnings=[f"AI 파싱 실패: {str(e)}"],
            )

        # Parse and validate entries
        raw_entries = result.get("entries", [])
        if isinstance(result.get("warnings"), list):
            warnings.extend(result["warnings"])

        # Build lookup maps
        projects = self._load_projects()
        work_types = self._load_work_types()
        projects_map = {p["id"]: p for p in projects}
        work_types_map = {w["id"]: w for w in work_types}

        # Validate and map entries
        entries: List[AIWorklogEntry] = []
        for raw_entry in raw_entries:
            try:
                entry = self._validate_and_map_entry(
                    raw_entry,
                    projects_map,
                    work_types_map,
                )
                entries.append(entry)
            except Exception as e:
                warnings.append(f"항목 파싱 실패: {str(e)}")

        # Calculate total hours
        total_hours = sum(e.hours for e in entries)

        # Add warning if total hours exceeds reasonable limit
        if total_hours > 24:
            warnings.append(f"총 시간이 24시간을 초과합니다: {total_hours}시간")
        elif total_hours > 12:
            warnings.append(f"총 시간이 12시간을 초과합니다: {total_hours}시간")

        # Add warning for low confidence entries
        low_confidence = [e for e in entries if e.confidence < 0.5]
        if low_confidence:
            warnings.append(
                f"{len(low_confidence)}개 항목의 신뢰도가 낮습니다. 확인이 필요합니다."
            )

        return AIWorklogParseResponse(
            entries=entries,
            total_hours=total_hours,
            warnings=warnings,
        )

    async def check_health(self) -> Dict[str, Any]:
        """
        Check AI service health.

        Returns:
            Dict with status, model, and message
        """
        is_healthy = await self.client.check_health()
        return {
            "status": "healthy" if is_healthy else "unhealthy",
            "model": self.client.model,
            "message": "Ollama 서비스 연결됨" if is_healthy else "Ollama 서비스 연결 실패",
        }
