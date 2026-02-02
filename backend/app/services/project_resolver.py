"""
Project Resolver Service for CSV Worklog Migration

Provides multi-stage project matching:
1. Project.Id → IO code (db_projects.csv) → DB UUID
2. IO code exact match
3. Priority keyword matching (OQC, GEN3+, etc.)
4. Description keyword extraction
5. Default project fallback

Includes safeguards against past failure cases:
- GEN3 vs GEN3+ distinction
- 888888 LEGACY project handling
- z [Closed] project exclusion
"""

from typing import Optional, List, Dict, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from .matching_service import FuzzyMatcher
from .keyword_mappings import (
    PROJECT_KEYWORD_MAPPINGS,
    PROJECT_ALIASES,
    get_project_code_by_keyword,
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
    stage: int  # Which stage resolved it (1-5)


# Projects to exclude from matching
EXCLUDED_PROJECT_PATTERNS = [
    "z [Closed]",  # Closed projects
    "z [CLOSED]",
    "[Closed]",
    "LEGACY",
]

# LEGACY project codes (888888 series) - handle specially
LEGACY_PROJECT_CODES = [
    "888888",
    "888888-150",
    "888888-151",
    "888888-152",
    "888888-153",
    "888888-154",
    "888888-155",
    "888888-156",
    "888888-160",  # OQC - this one is active, not legacy
]

# Active LEGACY codes that should be matched (not excluded)
ACTIVE_LEGACY_CODES = ["888888-160"]  # OQC Digitalization


class ProjectResolver:
    """
    Multi-stage project resolver for CSV worklog migration.

    Stages:
    1. Project.Id → IO code (from db_projects.csv) → DB UUID
    2. IO code exact match
    3. Priority keyword matching
    4. Description keyword extraction
    5. Default project fallback
    """

    def __init__(self):
        self.fuzzy_matcher = FuzzyMatcher()

        # Caches built during initialization
        self.csv_project_id_to_code: Dict[str, str] = {}  # CSV Project.Id → IO code
        self.code_to_uuid: Dict[str, str] = {}  # IO code → DB UUID
        self.code_to_name: Dict[str, str] = {}  # IO code → project name

        # DB projects for fuzzy matching
        self.db_projects: List[Dict[str, Any]] = []

        # Sorted keyword mappings (by priority descending)
        self.sorted_keywords = sorted(
            PROJECT_KEYWORD_MAPPINGS,
            key=lambda x: -x[2],  # Sort by priority descending
        )

        # Default project (General/Non-Project)
        self.default_project_id: Optional[str] = None
        self.default_project_code: str = "GENERAL"

        # Statistics
        self.stats = {
            "stage1_resolved": 0,
            "stage2_resolved": 0,
            "stage3_resolved": 0,
            "stage4_resolved": 0,
            "stage5_resolved": 0,
            "unresolved": 0,
            "excluded": 0,
        }

    def load_csv_mappings(self, projects_csv_data: List[Dict[str, Any]]) -> None:
        """
        Load mappings from db_projects.csv.

        Expected columns:
        - ID: CSV internal ID
        - IO: IO code (e.g., "406372")
        - Project: Project name
        - Status: Project status (Completed, WIP, etc.)
        """
        for row in projects_csv_data:
            # Get CSV Project.Id
            csv_id = row.get("ID") or row.get("id")
            if csv_id:
                try:
                    csv_id = str(int(float(csv_id)))
                except (ValueError, TypeError):
                    csv_id = str(csv_id).strip()

            # Get IO code
            io_code = row.get("IO") or row.get("io")
            if io_code:
                try:
                    io_code = str(int(float(io_code)))
                except (ValueError, TypeError):
                    io_code = str(io_code).strip()

            # Get project name and status
            project_name = row.get("Project") or row.get("project") or ""
            status = row.get("Status") or row.get("status") or ""

            # Skip excluded projects
            if self._is_excluded_project(project_name, status):
                continue

            if csv_id and io_code:
                self.csv_project_id_to_code[csv_id] = io_code

            if io_code and project_name:
                self.code_to_name[io_code] = project_name

    def load_db_projects(self, db_projects: List[Dict[str, Any]]) -> None:
        """
        Load projects from database.

        Expected dict keys:
        - id: UUID
        - code: IO code
        - name: Project name
        - status (optional): Project status
        """
        self.db_projects = db_projects

        for proj in db_projects:
            code = (proj.get("code") or "").strip()
            uuid = proj.get("id")
            name = proj.get("name") or ""

            if code and uuid:
                self.code_to_uuid[code] = uuid

            # Check for default project
            if "general" in name.lower() or code == self.default_project_code:
                self.default_project_id = uuid

    def _is_excluded_project(self, name: str, status: str = "") -> bool:
        """Check if project should be excluded from matching."""
        # Check name patterns
        name_upper = name.upper()
        for pattern in EXCLUDED_PROJECT_PATTERNS:
            if pattern.upper() in name_upper:
                return True

        # Check status
        if status.upper() in ("LEGACY", "DISCONTINUED", "ARCHIVED"):
            return True

        return False

    def _is_legacy_code(self, code: str) -> bool:
        """Check if code is a LEGACY project code."""
        if code in ACTIVE_LEGACY_CODES:
            return False  # OQC is active
        return code.startswith("888888")

    def resolve(
        self,
        project_id: str,
        description: Optional[str] = None,
        hints: Optional[Dict[str, Any]] = None,
    ) -> ResolutionResult:
        """
        Resolve a CSV Project.Id to a DB project UUID.

        Args:
            project_id: CSV Project.Id (e.g., "14")
            description: Worklog title/description for keyword matching
            hints: Optional hints (project_name, io_code, etc.)

        Returns:
            ResolutionResult with status, mapped_id, confidence, etc.
        """
        hints = hints or {}

        # Normalize project_id
        try:
            project_id = str(int(float(project_id)))
        except (ValueError, TypeError):
            project_id = str(project_id).strip()

        # Stage 1: CSV Project.Id → IO code → UUID
        result = self._stage1_csv_lookup(project_id)
        if result:
            self.stats["stage1_resolved"] += 1
            return result

        # Stage 2: IO code exact match (from hints)
        io_code = hints.get("io_code") or hints.get("code")
        if io_code:
            result = self._stage2_code_match(io_code)
            if result:
                self.stats["stage2_resolved"] += 1
                return result

        # Stage 3: Priority keyword matching
        if description:
            result = self._stage3_keyword_match(description)
            if result:
                self.stats["stage3_resolved"] += 1
                return result

        # Stage 4: Description keyword extraction
        if description:
            result = self._stage4_description_extract(description)
            if result:
                self.stats["stage4_resolved"] += 1
                return result

        # Stage 5: Default project fallback
        result = self._stage5_default_fallback(project_id, description)
        self.stats["stage5_resolved"] += 1
        return result

    def _stage1_csv_lookup(self, project_id: str) -> Optional[ResolutionResult]:
        """Stage 1: CSV Project.Id → IO code → DB UUID."""
        io_code = self.csv_project_id_to_code.get(project_id)
        if not io_code:
            return None

        # Check if it's a LEGACY code
        if self._is_legacy_code(io_code):
            self.stats["excluded"] += 1
            return ResolutionResult(
                status=ResolutionStatus.LOW_CONFIDENCE,
                mapped_id=self.default_project_id,
                confidence=0.3,
                alternatives=[],
                reason=f"LEGACY project excluded: {io_code}",
                stage=1,
            )

        uuid = self.code_to_uuid.get(io_code)
        if uuid:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=1.0,
                alternatives=[],
                reason=f"CSV lookup: Project.Id={project_id} → IO={io_code}",
                stage=1,
            )

        return None

    def _stage2_code_match(self, io_code: str) -> Optional[ResolutionResult]:
        """Stage 2: IO code exact match."""
        uuid = self.code_to_uuid.get(io_code)
        if uuid:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=0.95,
                alternatives=[],
                reason=f"IO code exact match: {io_code}",
                stage=2,
            )

        # Try with different formats (with/without prefix)
        for prefix in ["", "PRJ-", "406", "407", "888888-"]:
            test_code = f"{prefix}{io_code}" if prefix else io_code
            uuid = self.code_to_uuid.get(test_code)
            if uuid:
                return ResolutionResult(
                    status=ResolutionStatus.RESOLVED,
                    mapped_id=uuid,
                    confidence=0.9,
                    alternatives=[],
                    reason=f"IO code prefix match: {test_code}",
                    stage=2,
                )

        return None

    def _stage3_keyword_match(self, description: str) -> Optional[ResolutionResult]:
        """Stage 3: Priority keyword matching."""
        # Apply Korean aliases first
        desc_upper = description.upper()
        for korean, english in PROJECT_ALIASES.items():
            if korean in description:
                desc_upper = desc_upper.replace(korean.upper(), english)
                desc_upper = description.replace(korean, english).upper()

        # Find matching keyword
        for keyword, code, priority in self.sorted_keywords:
            if keyword in desc_upper:
                # Special handling for GEN3 vs GEN3+
                if keyword == "GEN3" and "GEN3+" in desc_upper:
                    continue  # Skip GEN3 if GEN3+ is present
                if keyword == "GEN3" and "GEN3 PLUS" in desc_upper:
                    continue

                uuid = self.code_to_uuid.get(code)
                if uuid:
                    confidence = 0.85 if priority >= 50 else 0.75
                    return ResolutionResult(
                        status=ResolutionStatus.RESOLVED,
                        mapped_id=uuid,
                        confidence=confidence,
                        alternatives=[],
                        reason=f"Keyword match: '{keyword}' → {code} (priority={priority})",
                        stage=3,
                    )

        return None

    def _stage4_description_extract(self, description: str) -> Optional[ResolutionResult]:
        """Stage 4: Extract keywords from description for fuzzy matching."""
        alternatives = []

        # Tokenize description
        tokens = description.upper().replace(",", " ").replace("_", " ").split()

        for proj in self.db_projects:
            proj_name = proj.get("name") or ""
            proj_code = proj.get("code") or ""

            # Skip excluded projects
            if self._is_excluded_project(proj_name):
                continue

            # Calculate match score
            score = 0.0
            matches = []

            for token in tokens:
                if len(token) < 3:
                    continue
                if token in proj_name.upper():
                    score += 0.3
                    matches.append(token)
                if token in proj_code.upper():
                    score += 0.2
                    matches.append(token)

            # Also try fuzzy matching
            name_score = self.fuzzy_matcher.jaro_winkler(description, proj_name)
            if name_score > 0.7:
                score = max(score, name_score * 0.8)

            if score >= 0.3:
                alternatives.append((proj.get("id"), score, proj_name))

        # Sort by score
        alternatives.sort(key=lambda x: x[1], reverse=True)

        if alternatives and alternatives[0][1] >= 0.6:
            best = alternatives[0]
            return ResolutionResult(
                status=ResolutionStatus.LOW_CONFIDENCE,
                mapped_id=best[0],
                confidence=best[1] * 0.9,
                alternatives=[(a[0], a[1]) for a in alternatives[1:5]],
                reason=f"Description extraction: {description[:50]}... → {best[2]}",
                stage=4,
            )

        return None

    def _stage5_default_fallback(
        self,
        project_id: str,
        description: Optional[str],
    ) -> ResolutionResult:
        """Stage 5: Default project fallback."""
        return ResolutionResult(
            status=ResolutionStatus.LOW_CONFIDENCE,
            mapped_id=self.default_project_id,
            confidence=0.5,
            alternatives=[],
            reason=f"Default fallback for Project.Id={project_id}",
            stage=5,
        )

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
            "stage5_resolved": 0,
            "unresolved": 0,
            "excluded": 0,
        }


# Singleton instance
project_resolver = ProjectResolver()
