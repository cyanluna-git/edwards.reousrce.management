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
from app.services.matching_service import FuzzyMatcher
from app.services.text_preprocessor import KoreanTextPreprocessor
from app.services.keyword_mappings import (
    get_project_code_by_keyword,
    get_worktype_code_by_keyword,
)
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

        # Initialize matching services
        self.matcher = FuzzyMatcher()
        self.preprocessor = KoreanTextPreprocessor()

        # Caches
        self._projects_cache: Optional[List[Dict[str, Any]]] = None
        self._work_types_cache: Optional[List[Dict[str, Any]]] = None
        self._project_code_map: Optional[Dict[str, Dict[str, Any]]] = None
        self._worktype_code_map: Optional[Dict[str, Dict[str, Any]]] = None

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

        # Build code map for quick lookups
        self._project_code_map = {
            p["code"]: p for p in self._projects_cache if p.get("code")
        }

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

        # Build code map for quick lookups
        self._worktype_code_map = {
            w["code"]: w for w in self._work_types_cache if w.get("code")
        }

        return self._work_types_cache

    def _get_project_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get project by code from cache."""
        if self._project_code_map is None:
            self._load_projects()
        return self._project_code_map.get(code) if self._project_code_map else None

    def _get_worktype_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Get work type by code from cache."""
        if self._worktype_code_map is None:
            self._load_work_types()
        return self._worktype_code_map.get(code) if self._worktype_code_map else None

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

    def _build_system_prompt(
        self,
        user_id: Optional[str] = None,
        hints: Optional[List[str]] = None,
    ) -> str:
        """
        사용자 맞춤형 시스템 프롬프트 생성

        Args:
            user_id: 사용자 ID (제공시 개인화된 프로젝트/업무유형 사용)
            hints: 텍스트에서 감지된 키워드 힌트 목록

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

        return WorklogParserPrompt.build_system_prompt(projects, work_types, hints)

    def _validate_and_map_entry(
        self,
        entry: Dict[str, Any],
        projects_map: Dict[str, Dict[str, Any]],
        work_types_map: Dict[str, Dict[str, Any]],
        original_text: str = "",
    ) -> AIWorklogEntry:
        """
        Validate and map a single parsed entry with fuzzy matching.

        Ensures project_id and work_type_category_id exist in the database.
        Uses multi-stage matching for better accuracy.
        """
        project_id = entry.get("project_id")
        project_name = entry.get("project_name")
        # Handle both field names from AI response
        work_type_id = entry.get("work_type_category_id") or entry.get("work_type_id")
        work_type_name = entry.get("work_type_name")
        description = entry.get("description") or ""

        matched_project = None
        matched_work_type = None
        confidence_boost = 0.0

        # === Project Matching ===
        # Stage 1: Direct ID match
        if project_id and project_id in projects_map:
            matched_project = projects_map[project_id]

        # Stage 2: Fuzzy matching if no direct match
        if not matched_project:
            search_term = project_id or project_name or ""

            if search_term:
                # Try fuzzy matcher
                result = self.matcher.match_project(
                    search_term, list(projects_map.values()), threshold=0.6
                )
                if result:
                    matched_project, conf = result
                    confidence_boost = conf - 0.5  # Adjust confidence based on match quality

            # Stage 3: Keyword-based matching from description
            if not matched_project and description:
                project_code = get_project_code_by_keyword(description)
                if project_code:
                    code_match = self._get_project_by_code(project_code)
                    if code_match and code_match["id"] in projects_map:
                        matched_project = code_match
                        confidence_boost = 0.1

        if matched_project:
            project_id = matched_project["id"]
            project_name = matched_project["name"]
        else:
            project_id = None

        # === Work Type Matching ===
        # Stage 1: Direct ID match
        if work_type_id and work_type_id in work_types_map:
            matched_work_type = work_types_map[work_type_id]

        # Stage 2: Code match (AI sometimes returns code instead of ID)
        if not matched_work_type and work_type_id:
            code_match = self._get_worktype_by_code(str(work_type_id))
            if code_match:
                matched_work_type = code_match

        # Stage 3: Fuzzy matching by name
        if not matched_work_type:
            search_term = work_type_id or work_type_name or ""

            if search_term:
                result = self.matcher.match_work_type(
                    search_term, list(work_types_map.values()), threshold=0.5
                )
                if result:
                    matched_work_type, conf = result

            # Stage 4: Keyword-based matching from description
            if not matched_work_type and description:
                worktype_code = get_worktype_code_by_keyword(description)
                if worktype_code:
                    code_match = self._get_worktype_by_code(worktype_code)
                    if code_match and code_match["id"] in work_types_map:
                        matched_work_type = code_match

        if matched_work_type:
            work_type_id = matched_work_type["id"]
            work_type_name = matched_work_type["name"]
        else:
            work_type_id = None
            # Keep the original name if provided
            work_type_name = work_type_name or entry.get("work_type_name")

        # Ensure hours is within bounds
        hours = entry.get("hours", 1.0)
        if not isinstance(hours, (int, float)):
            hours = 1.0
        hours = max(0.5, min(24.0, float(hours)))

        # Calculate final confidence
        base_confidence = entry.get("confidence", 0.5)
        if not isinstance(base_confidence, (int, float)):
            base_confidence = 0.5

        # Adjust confidence based on matching results
        final_confidence = base_confidence
        if matched_project:
            final_confidence += 0.1
        if matched_work_type:
            final_confidence += 0.1
        final_confidence += confidence_boost
        final_confidence = max(0.0, min(1.0, float(final_confidence)))

        # Ensure description is a string
        if not isinstance(description, str):
            description = str(description)

        return AIWorklogEntry(
            project_id=project_id,
            project_name=project_name,
            work_type_category_id=work_type_id,
            work_type_name=work_type_name,
            description=description,
            hours=hours,
            confidence=final_confidence,
        )

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

        # Step 1: Text preprocessing
        normalized_text = self.preprocessor.normalize(request.text)
        hints = self.preprocessor.extract_hints(normalized_text)

        logger.debug(f"Normalized text: {normalized_text}")
        logger.debug(f"Detected hints: {hints}")

        # Step 2: Build prompts (개인화된 프롬프트 + 힌트)
        system_prompt = self._build_system_prompt(request.user_id, hints)
        user_prompt = WorklogParserPrompt.build_user_prompt(
            normalized_text,  # Use normalized text
            request.target_date,
        )

        # Step 3: Call AI (Groq or Gemini)
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

        # Step 4: Parse and validate entries
        raw_entries = result.get("entries", [])
        if isinstance(result.get("warnings"), list):
            warnings.extend(result["warnings"])

        # Build lookup maps (use full project list for validation)
        projects = self._load_projects()
        work_types = self._load_work_types()
        projects_map = {p["id"]: p for p in projects}
        work_types_map = {w["id"]: w for w in work_types}

        # Step 5: Validate and map entries with fuzzy matching
        entries: List[AIWorklogEntry] = []
        for raw_entry in raw_entries:
            try:
                entry = self._validate_and_map_entry(
                    raw_entry,
                    projects_map,
                    work_types_map,
                    original_text=normalized_text,
                )
                entries.append(entry)
            except Exception as e:
                logger.warning(f"Entry validation failed: {str(e)}")
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
