"""
User Resolver Service for CSV Worklog Migration

Provides multi-stage user matching:
1. Person.id → email → DB UUID (exact match)
2. English name Jaro-Winkler similarity
3. Korean name containment
4. LLM inference (last resort)
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from .matching_service import FuzzyMatcher


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


class UserResolver:
    """
    Multi-stage user resolver for CSV worklog migration.

    Stages:
    0. Manual mappings (hardcoded exceptions)
    1. Person.id → email (from db_users.csv) → DB UUID
    2. English name Jaro-Winkler >= 0.9
    3. Korean name containment
    4. LLM inference (optional, last resort)
    """

    # Manual mappings for users not in db_users.csv
    # Format: Person.id → email
    MANUAL_PERSON_ID_TO_EMAIL = {
        "446": "alyssa.park@atlascopco.com",  # Alyssa Park - NPI, IntegratedSystem
    }

    def __init__(self):
        self.fuzzy_matcher = FuzzyMatcher()

        # Caches built during initialization
        self.person_id_to_email: Dict[str, str] = {}
        self.email_to_uuid: Dict[str, str] = {}
        self.name_to_uuid: Dict[str, str] = {}  # English name
        self.korean_name_to_uuid: Dict[str, str] = {}

        # DB users for fuzzy matching
        self.db_users: List[Dict[str, Any]] = []

        # Statistics
        self.stats = {
            "stage1_resolved": 0,
            "stage2_resolved": 0,
            "stage3_resolved": 0,
            "stage4_resolved": 0,
            "unresolved": 0,
        }

    def load_csv_mappings(self, users_csv_data: List[Dict[str, Any]]) -> None:
        """
        Load mappings from db_users.csv.

        Expected columns:
        - Person.id: CSV internal ID
        - Person.email or email: Email address
        - English Name or Person.EnglishName: English name
        - KoreanName: Korean name
        """
        for row in users_csv_data:
            # Get Person.id (handle various formats)
            person_id = row.get("Person.id") or row.get("ID") or row.get("id")
            if person_id:
                # Normalize "123.0" format to "123"
                try:
                    person_id = str(int(float(person_id)))
                except (ValueError, TypeError):
                    person_id = str(person_id).strip()

            # Get email (multiple possible column names)
            email = (
                (row.get("Person.email") or row.get("email") or row.get("Email") or "")
                .lower()
                .strip()
            )

            # Get names
            english_name = (
                row.get("English Name") or row.get("Person.EnglishName") or ""
            ).strip()

            korean_name = (row.get("KoreanName") or "").strip()

            if person_id and email:
                self.person_id_to_email[person_id] = email

            if english_name:
                # Store multiple name formats for matching
                name_lower = english_name.lower()
                # Original: "Wookhee Lee"
                # Also store reversed: "Lee Wookhee"
                name_parts = english_name.split()
                if len(name_parts) >= 2:
                    reversed_name = f"{name_parts[-1]} {' '.join(name_parts[:-1])}"
                    self.name_to_uuid[reversed_name.lower()] = email
                self.name_to_uuid[name_lower] = email

            if korean_name:
                self.korean_name_to_uuid[korean_name] = email

    def load_db_users(self, db_users: List[Dict[str, Any]]) -> None:
        """
        Load users from database.

        Expected dict keys:
        - id: UUID
        - email: Email address
        - name or display_name: Display name
        - korean_name (optional): Korean name
        """
        self.db_users = db_users

        for user in db_users:
            email = (user.get("email") or "").lower().strip()
            uuid = user.get("id")

            if email and uuid:
                self.email_to_uuid[email] = uuid

    def resolve(
        self,
        person_id: str,
        hints: Optional[Dict[str, Any]] = None,
        use_llm: bool = False,
    ) -> ResolutionResult:
        """
        Resolve a CSV Person.id to a DB user UUID.

        Args:
            person_id: CSV Person.id (e.g., "209")
            hints: Optional hints (english_name, korean_name, etc.)
            use_llm: Whether to use LLM for stage 4 (default: False)

        Returns:
            ResolutionResult with status, mapped_id, confidence, etc.
        """
        hints = hints or {}

        # Normalize person_id
        try:
            person_id = str(int(float(person_id)))
        except (ValueError, TypeError):
            person_id = str(person_id).strip()

        # Stage 1: Person.id → email → UUID
        result = self._stage1_email_lookup(person_id)
        if result:
            self.stats["stage1_resolved"] += 1
            return result

        # Stage 2: English name Jaro-Winkler
        english_name = hints.get("english_name") or hints.get("name")
        if english_name:
            result = self._stage2_name_fuzzy(english_name)
            if result:
                self.stats["stage2_resolved"] += 1
                return result

        # Stage 3: Korean name containment
        korean_name = hints.get("korean_name")
        if korean_name:
            result = self._stage3_korean_name(korean_name)
            if result:
                self.stats["stage3_resolved"] += 1
                return result

        # Stage 4: LLM inference (if enabled)
        if use_llm:
            result = self._stage4_llm_inference(person_id, hints)
            if result:
                self.stats["stage4_resolved"] += 1
                return result

        # Unresolved
        self.stats["unresolved"] += 1
        return ResolutionResult(
            status=ResolutionStatus.UNRESOLVED,
            mapped_id=None,
            confidence=0.0,
            alternatives=self._find_alternatives(person_id, hints),
            reason=f"No match found for Person.id={person_id}",
            stage=0,
        )

    def _stage1_email_lookup(self, person_id: str) -> Optional[ResolutionResult]:
        """Stage 1: Direct Person.id → email → UUID lookup."""
        # Check manual mappings first
        email = self.MANUAL_PERSON_ID_TO_EMAIL.get(person_id)
        if not email:
            email = self.person_id_to_email.get(person_id)
        if not email:
            return None

        uuid = self.email_to_uuid.get(email)
        if not uuid:
            # Try alternate email domains
            for domain in ["@edwardsvacuum.com", "@csk.kr", "@atlascopco.com"]:
                local_part = email.split("@")[0]
                alt_email = f"{local_part}{domain}"
                uuid = self.email_to_uuid.get(alt_email)
                if uuid:
                    break

        if uuid:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=uuid,
                confidence=1.0,
                alternatives=[],
                reason=f"Exact email match: {email}",
                stage=1,
            )

        return None

    def _stage2_name_fuzzy(self, english_name: str) -> Optional[ResolutionResult]:
        """Stage 2: English name Jaro-Winkler matching."""
        name_lower = english_name.lower().strip()

        # Check direct name lookup first
        if name_lower in self.name_to_uuid:
            email = self.name_to_uuid[name_lower]
            uuid = self.email_to_uuid.get(email)
            if uuid:
                return ResolutionResult(
                    status=ResolutionStatus.RESOLVED,
                    mapped_id=uuid,
                    confidence=0.95,
                    alternatives=[],
                    reason=f"Exact name match: {english_name}",
                    stage=2,
                )

        # Fuzzy matching against DB users
        best_match = None
        best_score = 0.0
        alternatives = []

        for user in self.db_users:
            user_name = user.get("name") or user.get("display_name") or ""
            if not user_name:
                continue

            score = self.fuzzy_matcher.jaro_winkler(english_name, user_name)

            if score > best_score:
                best_score = score
                best_match = user

            if score >= 0.7:
                alternatives.append((user.get("id"), score))

        # Sort alternatives by score
        alternatives.sort(key=lambda x: x[1], reverse=True)
        alternatives = alternatives[:5]  # Keep top 5

        if best_match and best_score >= 0.9:
            return ResolutionResult(
                status=ResolutionStatus.RESOLVED,
                mapped_id=best_match.get("id"),
                confidence=best_score * 0.95,
                alternatives=alternatives,
                reason=f"Jaro-Winkler match ({best_score:.2f}): {english_name} → {best_match.get('name')}",
                stage=2,
            )
        elif best_match and best_score >= 0.8:
            return ResolutionResult(
                status=ResolutionStatus.LOW_CONFIDENCE,
                mapped_id=best_match.get("id"),
                confidence=best_score * 0.9,
                alternatives=alternatives,
                reason=f"Low confidence name match ({best_score:.2f}): {english_name}",
                stage=2,
            )

        return None

    def _stage3_korean_name(self, korean_name: str) -> Optional[ResolutionResult]:
        """Stage 3: Korean name containment matching."""
        korean_name = korean_name.strip()

        # Direct lookup
        if korean_name in self.korean_name_to_uuid:
            email = self.korean_name_to_uuid[korean_name]
            uuid = self.email_to_uuid.get(email)
            if uuid:
                return ResolutionResult(
                    status=ResolutionStatus.RESOLVED,
                    mapped_id=uuid,
                    confidence=0.9,
                    alternatives=[],
                    reason=f"Korean name match: {korean_name}",
                    stage=3,
                )

        # Containment search in DB users
        for user in self.db_users:
            user_korean_name = user.get("korean_name") or ""
            if user_korean_name and korean_name in user_korean_name:
                return ResolutionResult(
                    status=ResolutionStatus.RESOLVED,
                    mapped_id=user.get("id"),
                    confidence=0.8,
                    alternatives=[],
                    reason=f"Korean name containment: {korean_name} in {user_korean_name}",
                    stage=3,
                )

        return None

    def _stage4_llm_inference(
        self,
        person_id: str,
        hints: Dict[str, Any],
    ) -> Optional[ResolutionResult]:
        """Stage 4: LLM inference for name variations."""
        # TODO: Implement LLM-based inference
        # This would call Gemini/Groq to infer user from context
        return None

    def _find_alternatives(
        self,
        person_id: str,
        hints: Dict[str, Any],
    ) -> List[Tuple[str, float]]:
        """Find potential alternative matches for unresolved cases."""
        alternatives = []

        english_name = hints.get("english_name") or hints.get("name")
        if english_name:
            for user in self.db_users:
                user_name = user.get("name") or user.get("display_name") or ""
                if user_name:
                    score = self.fuzzy_matcher.jaro_winkler(english_name, user_name)
                    if score >= 0.5:
                        alternatives.append((user.get("id"), score))

        alternatives.sort(key=lambda x: x[1], reverse=True)
        return alternatives[:5]

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
user_resolver = UserResolver()
