"""
Text Preprocessor for AI Worklog Parsing

Handles Korean text normalization, alias expansion, and keyword extraction.
"""

import re
from typing import List, Set

from app.services.keyword_mappings import (
    PROJECT_ALIASES,
    WORKTYPE_ALIASES,
    PROJECT_KEYWORD_MAPPINGS,
    WORKTYPE_KEYWORD_MAPPINGS,
)


class KoreanTextPreprocessor:
    """
    Preprocessor for Korean worklog text input.

    Handles:
    - Alias expansion (젠3 → GEN3, 오큐씨 → OQC)
    - Korean postposition removal (조사 제거)
    - Whitespace normalization
    - Keyword hint extraction
    """

    # Korean postpositions (조사) to remove
    KOREAN_POSTPOSITIONS = [
        "을", "를", "이", "가", "은", "는", "에", "에서", "으로", "로",
        "와", "과", "의", "도", "만", "까지", "부터", "에게", "한테",
        "께", "처럼", "같이", "보다", "마다", "라고", "하고"
    ]

    def __init__(self):
        self._project_aliases = PROJECT_ALIASES
        self._worktype_aliases = WORKTYPE_ALIASES
        self._project_keywords = self._build_keyword_set(PROJECT_KEYWORD_MAPPINGS)
        self._worktype_keywords = self._build_keyword_set(WORKTYPE_KEYWORD_MAPPINGS)

    @staticmethod
    def _build_keyword_set(mappings: List) -> Set[str]:
        """Build a set of keywords from mapping list."""
        return {kw.upper() for kw, _, _ in mappings}

    def normalize(self, text: str) -> str:
        """
        Normalize Korean text for better AI parsing.

        Steps:
        1. Expand Korean aliases to English equivalents
        2. Remove Korean postpositions from compound words
        3. Normalize whitespace

        Args:
            text: Raw input text

        Returns:
            Normalized text string
        """
        if not text:
            return ""

        result = text

        # Step 1: Expand project aliases (Korean phonetic → English)
        for korean, english in self._project_aliases.items():
            # Case-insensitive replacement
            pattern = re.compile(re.escape(korean), re.IGNORECASE)
            result = pattern.sub(english, result)

        # Step 2: Expand worktype aliases
        for korean, standard in self._worktype_aliases.items():
            pattern = re.compile(re.escape(korean), re.IGNORECASE)
            result = pattern.sub(standard, result)

        # Step 3: Remove trailing postpositions from words
        # e.g., "OQC인프라를" → "OQC인프라"
        result = self._remove_postpositions(result)

        # Step 4: Normalize whitespace
        result = " ".join(result.split())

        return result

    def _remove_postpositions(self, text: str) -> str:
        """
        Remove Korean postpositions from the end of words.

        Handles cases like:
        - "OQC인프라를" → "OQC인프라"
        - "HRS관련해서" → "HRS관련"
        """
        words = text.split()
        cleaned_words = []

        for word in words:
            cleaned = word
            # Try removing each postposition from the end
            for postposition in sorted(self.KOREAN_POSTPOSITIONS, key=len, reverse=True):
                if cleaned.endswith(postposition) and len(cleaned) > len(postposition):
                    # Don't remove if it would leave only Korean characters
                    potential = cleaned[:-len(postposition)]
                    if potential and (
                        any(c.isascii() and c.isalpha() for c in potential) or
                        len(potential) >= 2
                    ):
                        cleaned = potential
                        break
            cleaned_words.append(cleaned)

        return " ".join(cleaned_words)

    def extract_hints(self, text: str) -> List[str]:
        """
        Extract keyword hints from text for prompt enhancement.

        Identifies known project and work type keywords in the input.

        Args:
            text: Input text (preferably normalized)

        Returns:
            List of detected keyword hints
        """
        if not text:
            return []

        hints = []
        text_upper = text.upper()

        # Check for project keywords
        for keyword in self._project_keywords:
            if keyword in text_upper:
                hints.append(f"project:{keyword}")

        # Check for worktype keywords
        for keyword in self._worktype_keywords:
            if keyword in text_upper:
                hints.append(f"worktype:{keyword}")

        return hints

    def extract_project_hints(self, text: str) -> List[str]:
        """Extract only project-related hints."""
        if not text:
            return []

        hints = []
        text_upper = text.upper()

        for keyword in self._project_keywords:
            if keyword in text_upper:
                hints.append(keyword)

        return hints

    def extract_worktype_hints(self, text: str) -> List[str]:
        """Extract only work type-related hints."""
        if not text:
            return []

        hints = []
        text_upper = text.upper()

        for keyword in self._worktype_keywords:
            if keyword in text_upper:
                hints.append(keyword)

        return hints


# Singleton instance
text_preprocessor = KoreanTextPreprocessor()
