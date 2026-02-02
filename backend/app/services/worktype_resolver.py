"""
WorkType Resolver Service for CSV Worklog Migration

Provides multi-stage work type matching:
1. Worktype.Id → Legacy mapping table
2. Title exact match
3. Keyword matching (274+ patterns)
4. AI inference (last resort)

Includes Korean language support with aliases.
"""

from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from .matching_service import FuzzyMatcher
from .keyword_mappings import (
    WORKTYPE_KEYWORD_MAPPINGS,
    WORKTYPE_ALIASES,
    get_worktype_code_by_keyword,
)


class ResolutionStatus(str, Enum):
    RESOLVED = "resolved"
    LOW_CONFIDENCE = "low_confidence"
    UNRESOLVED = "unresolved"


@dataclass
class ResolutionResult:
    """Result of a resolution attempt."""
    status: ResolutionStatus
    mapped_id: Optional[str]
    confidence: float
    alternatives: List[Tuple[str, float]]  # [(uuid, score), ...]
    reason: str
    stage: int  # Which stage resolved it (1-4)


# Legacy Worktype.Id to Category Code mapping
# From db_worktype.csv: Id → Title → Category code
LEGACY_WORKTYPE_MAPPING = {
    "1": "ENG-DES",       # Design
    "2": "ENG-VV",        # Verification & Validation
    "3": "ENG-SW",        # SW Develop
    "4": "KNW-DOC",       # Documentation
    "5": "PRJ-REV",       # Review
    "6": "PRJ-MTG",       # Meeting
    "7": "ABS-LVE",       # Leave
    "8": "PRJ-MGT",       # Management
    "9": "OPS-LAB",       # Field/Shopfloor Work
    "10": "KNW-TRN",      # Workshop
    "11": "KNW-RND",      # Research
    "12": "KNW-STD",      # Self-Study
    "13": "ADM-EML",      # Email
    "14": "SUP-CST",      # Customer Support
    "15": "KNW-TRN",      # Training
    "17": "ADM-GEN",      # Administrative work
    "18": "QMS-CMP",      # Compliances
    "19": "QMS-QC",       # QA/QC
    "20": "QMS-SAF",      # Safety
}


class WorkTypeResolver:
    """
    Multi-stage work type resolver for CSV worklog migration.

    Stages:
    1. Worktype.Id → Legacy mapping table → Category code → UUID
    2. Title exact match
    3. Keyword matching (274+ patterns)
    4. AI inference (optional, last resort)
    """

    def __init__(self):
        self.fuzzy_matcher = FuzzyMatcher()

        # Caches built during initialization
        self.code_to_uuid: Dict[str, str] = {}       # Category code → UUID
        self.name_to_uuid: Dict[str, str] = {}       # Name → UUID
        self.name_ko_to_uuid: Dict[str, str] = {}    # Korean name → UUID

        # DB work types for fuzzy matching
        self.db_work_types: List[Dict[str, Any]] = []

        # Sorted keyword mappings (by priority descending)
        self.sorted_keywords = sorted(
            WORKTYPE_KEYWORD_MAPPINGS,
            key=lambda x: -x[2],  # Sort by priority descending
        )

        # Default work type (Meeting or General)
        self.default_worktype_id: Optional[str] = None

        # Statistics
        self.stats = {
            "stage1_resolved": 0,
            "stage2_resolved": 0,
            "stage3_resolved": 0,
            "stage4_resolved": 0,
            "unresolved": 0,
        }

    def load_db_work_types(self, db_work_types: List[Dict[str, Any]]) -> None:
        """
        Load work types from database.

        Expected dict keys:
        - id: UUID
        - code: Category code (e.g., "ENG-DES", "PRJ-MTG")
        - name: English name
        - name_ko (optional): Korean name
        """
        self.db_work_types = db_work_types

        for wt in db_work_types:
            code = (wt.get("code") or "").strip().upper()
            uuid = wt.get("id")
            name = (wt.get("name") or "").lower().strip()
            name_ko = wt.get("name_ko") or ""

            if code and uuid:
                self.code_to_uuid[code] = uuid

            if name and uuid:
                self.name_to_uuid[name] = uuid

            if name_ko and uuid:
                self.name_ko_to_uuid[name_ko] = uuid

            # Set default (Meeting)
            if code == "PRJ-MTG" or "meeting" in name.lower():
                self.default_worktype_id = uuid

    def resolve(
        self,
        worktype_id: str,
        description: Optional[str] = None,
        hints: Optional[Dict[str, Any]] = None,
        use_llm: bool = False,
    ) -> ResolutionResult:
        """
        Resolve a CSV Worktype.Id to a DB work type UUID.

        Args:
            worktype_id: CSV Worktype.Id (e.g., "6" for Meeting)
            description: Worklog title/description for keyword matching
            hints: Optional hints (title, code, etc.)
            use_llm: Whether to use LLM for stage 4

        Returns:
            ResolutionResult with status, mapped_id, confidence, etc.
        """
        hints = hints or {}

        # Normalize worktype_id
        try:
            worktype_id = str(int(float(worktype_id)))
        except (ValueError, TypeError):
            worktype_id = str(worktype_id).strip()

        # Stage 1: Legacy mapping table
        result = self._stage1_legacy_mapping(worktype_id)
        if result:
            self.stats["stage1_resolved"] += 1
            return result

        # Stage 2: Title exact match
        title = hints.get("title") or hints.get("name")
        if title:
            result = self._stage2_title_match(title)
            if result:
                self.stats["stage2_resolved"] += 1
                return result

        # Stage 3: Keyword matching
        text = description or title or ""
        if text:
            result = self._stage3_keyword_match(text)
            if result:
                self.stats["stage3_resolved"] += 1
                return result

        # Stage 4: AI inference (if enabled)
        if use_llm and text:
            result = self._stage4_llm_inference(text)
            if result:
                self.stats["stage4_resolved"] += 1
                return result

        # Unresolved - use default
        self.stats["unresolved"] += 1
        return ResolutionResult(
            status=ResolutionStatus.LOW_CONFIDENCE,
            mapped_id=self.default_worktype_id,
            confidence=0.5,
            alternatives=[],
            reason=f"No match found for Worktype.Id={worktype_id}, using default",
            stage=0,
        )

    def _stage1_legacy_mapping(self, worktype_id: str) -> Optional[ResolutionResult]:
        """Stage 1: Legacy Worktype.Id → Category code → UUID."""
        code = LEGACY_WORKTYPE_MAPPING.get(worktype_id)
        if not code:
            return None

        uuid = self.code_to_uuid.get(code)
        if uuid:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=1.0,
                alternatives=[],
                reason=f"Legacy mapping: Worktype.Id={worktype_id} → {code}",
                stage=1,
            )

        return None

    def _stage2_title_match(self, title: str) -> Optional[ResolutionResult]:
        """Stage 2: Title exact/fuzzy match."""
        title_lower = title.lower().strip()

        # Exact match
        if title_lower in self.name_to_uuid:
            uuid = self.name_to_uuid[title_lower]
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=0.95,
                alternatives=[],
                reason=f"Exact title match: {title}",
                stage=2,
            )

        # Korean name match
        if title in self.name_ko_to_uuid:
            uuid = self.name_ko_to_uuid[title]
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=0.9,
                alternatives=[],
                reason=f"Korean title match: {title}",
                stage=2,
            )

        # Fuzzy match
        best_match = None
        best_score = 0.0
        alternatives = []

        for wt in self.db_work_types:
            name = wt.get("name") or ""
            name_ko = wt.get("name_ko") or ""

            # Calculate scores
            score = self.fuzzy_matcher.jaro_winkler(title, name)
            if name_ko:
                ko_score = self.fuzzy_matcher.jaro_winkler(title, name_ko)
                score = max(score, ko_score)

            if score > best_score:
                best_score = score
                best_match = wt

            if score >= 0.7:
                alternatives.append((wt.get("id"), score))

        alternatives.sort(key=lambda x: x[1], reverse=True)
        alternatives = alternatives[:5]

        if best_match and best_score >= 0.85:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=best_match.get("id"),
                confidence=best_score * 0.95,
                alternatives=alternatives,
                reason=f"Fuzzy title match ({best_score:.2f}): {title} → {best_match.get('name')}",
                stage=2,
            )

        return None

    def _stage3_keyword_match(self, text: str) -> Optional[ResolutionResult]:
        """Stage 3: Keyword matching from description."""
        # Apply Korean aliases first
        text_processed = text.upper()
        for korean, standard in WORKTYPE_ALIASES.items():
            if korean in text:
                text_processed = text_processed.replace(korean.upper(), standard.upper())

        # Find matching keyword
        for keyword, code, priority in self.sorted_keywords:
            if keyword in text_processed:
                uuid = self.code_to_uuid.get(code)
                if uuid:
                    confidence = 0.8 if priority >= 60 else 0.7
                    return ResolutionResult(
                        status=ResolutionStatus.RESOLVED,
                        mapped_id=uuid,
                        confidence=confidence,
                        alternatives=[],
                        reason=f"Keyword match: '{keyword}' → {code} (priority={priority})",
                        stage=3,
                    )

        return None

    def _stage4_llm_inference(self, text: str) -> Optional[ResolutionResult]:
        """Stage 4: LLM inference for work type classification."""
        # TODO: Implement LLM-based work type classification
        # This would call Gemini/Groq to classify the work type
        return None

    def get_stats(self) -> Dict[str, int]:
        """Get resolution statistics."""
        return self.stats.copy()

    def reset_stats(self) -> None:
        """Reset resolution statistics."""
        self.stats = {
            "stage1_resolved": 0,
            "stage2_resolved": 0,
            "stage3_resolved": 0,
            "stage4_resolved": 0,
            "unresolved": 0,
        }


# Singleton instance
worktype_resolver = WorkTypeResolver()
