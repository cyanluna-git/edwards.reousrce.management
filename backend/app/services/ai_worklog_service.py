"""
AI Worklog Service
Business logic for AI-assisted worklog parsing
"""

import logging
from datetime import date, timedelta
from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import func

logger = logging.getLogger(__name__)

from app.models.project import Project
from app.models.work_type import WorkTypeCategory
from app.models.resource import WorkLog
from app.models.user import User
from app.services.gemini_client import GeminiClient, gemini_client
from app.services.groq_client import GroqClient, groq_client
from app.prompts.worklog_parser import WorklogParserPrompt
from app.schemas.ai_worklog import (
    AIWorklogParseRequest,
    AIWorklogParseResponse,
    AIWorklogEntry,
)
from app.core.config import settings


class AIWorklogService:
    """Service for AI-assisted worklog parsing"""

    def __init__(
        self,
        db: Session,
        client: Optional[Union[GeminiClient, GroqClient]] = None,
    ):
        self.db = db
        # Select AI provider based on config
        if client:
            self.client = client
        elif settings.AI_PROVIDER == "gemini":
            self.client = gemini_client
        else:
            self.client = groq_client
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

    def _load_user_recent_projects(self, user_id: str) -> List[Dict[str, Any]]:
        """
        사용자가 최근 3개월간 입력한 프로젝트 (빈도순)

        Args:
            user_id: 사용자 ID

        Returns:
            최근 사용 프로젝트 목록 (빈도순 정렬, 최대 10개)
        """
        three_months_ago = date.today() - timedelta(days=90)

        # 최근 3개월 워크로그에서 프로젝트별 사용 빈도 집계
        project_stats = (
            self.db.query(
                WorkLog.project_id,
                func.count(WorkLog.id).label('usage_count')
            )
            .filter(
                WorkLog.user_id == user_id,
                WorkLog.date >= three_months_ago,
                WorkLog.project_id.isnot(None)
            )
            .group_by(WorkLog.project_id)
            .order_by(func.count(WorkLog.id).desc())
            .limit(10)
            .all()
        )

        if not project_stats:
            # 최근 기록이 없으면 전체 활성 프로젝트 반환
            return self._load_projects()

        # 프로젝트 정보 조회 (빈도순 유지)
        project_ids = [ps.project_id for ps in project_stats]
        projects = self.db.query(Project).filter(Project.id.in_(project_ids)).all()

        # 빈도순으로 정렬하기 위해 맵 사용
        projects_map = {p.id: p for p in projects}

        return [
            {"id": p_id, "code": projects_map[p_id].code, "name": projects_map[p_id].name}
            for p_id in project_ids
            if p_id in projects_map
        ]

    def _load_user_work_types(self, user_id: str) -> List[Dict[str, Any]]:
        """
        직책에 맞는 업무유형 + 자주 사용한 업무유형 (상위 10개)

        Args:
            user_id: 사용자 ID

        Returns:
            사용자 맞춤 업무유형 목록 (빈도순 + 직책별 필터, 최대 10개)
        """
        # 1. 사용자의 직책 조회
        user = self.db.query(User).filter(User.id == user_id).first()
        position_id = user.position_id if user else None

        # 2. 최근 3개월 자주 사용한 업무유형 (시간 합계순)
        three_months_ago = date.today() - timedelta(days=90)

        work_type_stats = (
            self.db.query(
                WorkLog.work_type_category_id,
                func.sum(WorkLog.hours).label('total_hours')
            )
            .filter(
                WorkLog.user_id == user_id,
                WorkLog.date >= three_months_ago
            )
            .group_by(WorkLog.work_type_category_id)
            .order_by(func.sum(WorkLog.hours).desc())
            .limit(10)
            .all()
        )

        frequent_ids = {wt.work_type_category_id for wt in work_type_stats}

        # 3. 모든 활성 업무유형 조회
        all_work_types = (
            self.db.query(WorkTypeCategory)
            .filter(WorkTypeCategory.level >= 1, WorkTypeCategory.is_active == True)
            .all()
        )

        result = []
        for wt in all_work_types:
            # 자주 사용한 것 우선 (priority 1)
            if wt.id in frequent_ids:
                result.append({"id": wt.id, "code": wt.code, "name": wt.name, "priority": 1})
            # 직책에 맞는 것 (priority 2)
            elif position_id and wt.applicable_roles:
                # applicable_roles는 콤마로 구분된 문자열
                applicable_list = [r.strip() for r in wt.applicable_roles.split(',')]
                if position_id in applicable_list:
                    result.append({"id": wt.id, "code": wt.code, "name": wt.name, "priority": 2})

        # 결과가 없으면 기본 업무유형 반환
        if not result:
            return self._load_work_types()

        # 우선순위로 정렬, 상위 10개
        result.sort(key=lambda x: x["priority"])
        return [{"id": r["id"], "code": r["code"], "name": r["name"]} for r in result[:10]]

    def _build_system_prompt(self, user_id: Optional[str] = None) -> str:
        """
        사용자 맞춤형 시스템 프롬프트 생성

        Args:
            user_id: 사용자 ID (제공시 개인화된 프로젝트/업무유형 사용)

        Returns:
            시스템 프롬프트 문자열
        """
        if user_id:
            # 개인화된 데이터 로드
            projects = self._load_user_recent_projects(user_id)
            work_types = self._load_user_work_types(user_id)
        else:
            # 기존 전체 데이터 로드
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

        # Build prompts (개인화된 프롬프트 사용)
        system_prompt = self._build_system_prompt(request.user_id)
        user_prompt = WorklogParserPrompt.build_user_prompt(
            request.text,
            request.target_date,
        )

        # Call AI (Groq or Gemini)
        try:
            result = await self.client.generate_json(
                prompt=user_prompt,
                system_prompt=system_prompt,
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
        if isinstance(self.client, GroqClient):
            result = await self.client.health_check()
            return {
                "status": "healthy" if result["available"] else "unhealthy",
                "model": result.get("model", settings.GROQ_MODEL),
                "provider": "groq",
                "message": "Groq API 연결됨" if result["available"] else f"Groq API 연결 실패: {result.get('error', 'Unknown')}",
            }
        else:
            result = await self.client.health_check()
            return {
                "status": "healthy" if result["available"] else "unhealthy",
                "model": result.get("model", settings.GEMINI_MODEL),
                "provider": "gemini",
                "message": "Gemini API 연결됨" if result["available"] else f"Gemini API 연결 실패: {result.get('error', 'Unknown')}",
            }
