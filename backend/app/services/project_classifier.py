"""
Project Financial Classification Service

Provides intelligent classification of projects into financial categories
based on project code, name, and type. This service is reusable across
scripts, API endpoints, and Excel import workflows.

Author: Edwards Engineering Team
Date: 2026-01-21
Version: 2.0
"""

import re
import unicodedata
from dataclasses import dataclass
from typing import Optional, Tuple
from enum import Enum


class ConfidenceScore(Enum):
    """Confidence level for classification results"""
    HIGH = "HIGH"        # Explicit match (VSS, SUN in code)
    MEDIUM = "MEDIUM"    # Inferred from project type
    LOW = "LOW"          # Default fallback


@dataclass
class ClassificationResult:
    """Result of project financial classification"""
    funding_entity_id: str
    recharge_status: str
    io_category_code: str
    is_capitalizable: bool
    confidence: ConfidenceScore
    reason: str  # Human-readable explanation
    requires_manual_review: bool  # Flag for low confidence cases


class ProjectClassifier:
    """
    Intelligent classifier for project financial attributes.

    Uses pattern matching and business rules to auto-classify projects
    into funding entities, recharge status, and IO categories.

    Classification Rules (priority order):
    1. VSS in code/name → ENTITY_VSS, BILLABLE
    2. SUN in code/name → ENTITY_SUN, BILLABLE
    3. Product line specific (GEN3/GEN4) → ENTITY_LOCAL_KR, NON_BILLABLE
    4. Project type (NPI, SUSTAINING, etc.) → appropriate category
    5. Default → ENTITY_LOCAL_KR, INTERNAL
    """

    # Classification rule configuration (priority ordered)
    FUNDING_RULES = [
        {
            "pattern": r"\bVSS\b",
            "funding_entity_id": "ENTITY_VSS",
            "recharge_status": "BILLABLE",
            "confidence": ConfidenceScore.HIGH,
            "reason": "VSS entity code found in project code/name",
            "priority": 1
        },
        {
            "pattern": r"\bSUN\b",
            "funding_entity_id": "ENTITY_SUN",
            "recharge_status": "BILLABLE",
            "confidence": ConfidenceScore.HIGH,
            "reason": "SUN entity code found in project code/name",
            "priority": 2
        }
    ]

    # IO Category rules (project type based)
    CATEGORY_RULES = {
        "NPI": {
            "io_category_code": "NPI",
            "is_capitalizable": True,
            "confidence": ConfidenceScore.HIGH,
            "reason": "New Product Introduction (NPI) project type"
        },
        "ETO": {
            "io_category_code": "NPI",
            "is_capitalizable": True,
            "confidence": ConfidenceScore.HIGH,
            "reason": "Engineering To Order (ETO) classified as NPI"
        },
        "SUSTAINING": {
            "io_category_code": "SUSTAINING",
            "is_capitalizable": True,
            "confidence": ConfidenceScore.HIGH,
            "reason": "Sustaining engineering project"
        },
        "CIP": {
            "io_category_code": "SUSTAINING",
            "is_capitalizable": True,
            "confidence": ConfidenceScore.MEDIUM,
            "reason": "Continuous Improvement Project (CIP)"
        },
        "SUPPORT": {
            "io_category_code": "OTHER",
            "is_capitalizable": False,
            "confidence": ConfidenceScore.MEDIUM,
            "reason": "Support project (OPEX)"
        },
        "TEAM_TASK": {
            "io_category_code": "OTHER",
            "is_capitalizable": False,
            "confidence": ConfidenceScore.MEDIUM,
            "reason": "Internal team task (OPEX)"
        },
        "INTERNAL": {
            "io_category_code": "OTHER",
            "is_capitalizable": False,
            "confidence": ConfidenceScore.MEDIUM,
            "reason": "Internal project (OPEX)"
        }
    }

    def __init__(self):
        """Initialize classifier with pre-compiled regex patterns"""
        # Compile all patterns for performance
        self._compiled_patterns = []
        for rule in self.FUNDING_RULES:
            compiled = re.compile(rule["pattern"], re.IGNORECASE)
            self._compiled_patterns.append((compiled, rule))

    def classify(
        self,
        project_code: str,
        project_name: str,
        project_type_id: Optional[str] = None
    ) -> ClassificationResult:
        """
        Classify a project into financial categories.

        Args:
            project_code: Project IO code (e.g., "IO-VSS-001")
            project_name: Project display name
            project_type_id: Project type ID (e.g., "NPI", "SUSTAINING")

        Returns:
            ClassificationResult with funding entity, recharge status, and category

        Example:
            >>> classifier = ProjectClassifier()
            >>> result = classifier.classify("IO-VSS-001", "VSS Support Project", "SUPPORT")
            >>> print(result.funding_entity_id)  # "ENTITY_VSS"
            >>> print(result.recharge_status)    # "BILLABLE"
        """
        # Normalize input text (handle None, empty strings, special characters)
        normalized_text = self._normalize_text(project_code, project_name)

        # Step 1: Determine funding entity and recharge status
        funding_entity, recharge_status, funding_conf, funding_reason = \
            self._determine_funding(normalized_text)

        # Step 2: Determine IO category and capitalization
        io_category, is_capitalizable, category_conf, category_reason = \
            self._determine_category(project_type_id)

        # Step 3: Calculate overall confidence
        overall_confidence = self._combine_confidence(funding_conf, category_conf)

        # Step 4: Determine if manual review is needed
        requires_review = overall_confidence == ConfidenceScore.LOW

        # Combine reasons
        combined_reason = f"Funding: {funding_reason}; Category: {category_reason}"

        return ClassificationResult(
            funding_entity_id=funding_entity,
            recharge_status=recharge_status,
            io_category_code=io_category,
            is_capitalizable=is_capitalizable,
            confidence=overall_confidence,
            reason=combined_reason,
            requires_manual_review=requires_review
        )

    def _normalize_text(self, code: Optional[str], name: Optional[str]) -> str:
        """
        Normalize project code and name for pattern matching.

        Handles:
        - None values
        - Empty strings
        - Unicode/special characters
        - Case normalization
        """
        # Handle None and empty values
        code_clean = (code or "").strip()
        name_clean = (name or "").strip()

        # Combine code and name and uppercase once
        combined = f"{code_clean} {name_clean}".strip().upper()

        # Handle empty case explicitly
        if not combined:
            return ""

        # Normalize Unicode (remove accents, convert to ASCII where possible)
        try:
            normalized = unicodedata.normalize('NFKD', combined)
            return normalized.encode('ascii', 'ignore').decode('ascii')
        except (UnicodeDecodeError, UnicodeEncodeError):
            # Fallback if unicode normalization fails
            return combined

    def _determine_funding(
        self,
        normalized_text: str
    ) -> Tuple[str, str, ConfidenceScore, str]:
        """
        Determine funding entity and recharge status from project code/name.

        Returns:
            (funding_entity_id, recharge_status, confidence, reason)
        """
        # Try to match patterns in priority order (early exit on first match)
        # Patterns are already sorted by priority, so first match is best
        for pattern, rule in self._compiled_patterns:
            if pattern.search(normalized_text):
                return (
                    rule["funding_entity_id"],
                    rule["recharge_status"],
                    rule["confidence"],
                    rule["reason"]
                )

        # Default fallback: Local Korea, Internal
        return (
            "ENTITY_LOCAL_KR",
            "INTERNAL",
            ConfidenceScore.LOW,
            "No explicit entity marker found - defaulting to LOCAL_KR"
        )

    def _determine_category(
        self,
        project_type_id: Optional[str]
    ) -> Tuple[str, bool, ConfidenceScore, str]:
        """
        Determine IO category and capitalization from project type.

        Returns:
            (io_category_code, is_capitalizable, confidence, reason)
        """
        if not project_type_id:
            return (
                "OTHER",
                False,
                ConfidenceScore.LOW,
                "No project type provided - defaulting to OTHER"
            )

        # Normalize project type
        type_upper = project_type_id.upper()

        # Look up in category rules
        if type_upper in self.CATEGORY_RULES:
            rule = self.CATEGORY_RULES[type_upper]
            return (
                rule["io_category_code"],
                rule["is_capitalizable"],
                rule["confidence"],
                rule["reason"]
            )

        # Default fallback
        return (
            "OTHER",
            False,
            ConfidenceScore.LOW,
            f"Unknown project type '{project_type_id}' - defaulting to OTHER"
        )

    def _combine_confidence(
        self,
        funding_conf: ConfidenceScore,
        category_conf: ConfidenceScore
    ) -> ConfidenceScore:
        """
        Combine two confidence scores into an overall confidence.

        Rules:
        - If either is LOW → overall is LOW
        - If both are HIGH → overall is HIGH
        - Otherwise → MEDIUM
        """
        if funding_conf == ConfidenceScore.LOW or category_conf == ConfidenceScore.LOW:
            return ConfidenceScore.LOW
        elif funding_conf == ConfidenceScore.HIGH and category_conf == ConfidenceScore.HIGH:
            return ConfidenceScore.HIGH
        else:
            return ConfidenceScore.MEDIUM
