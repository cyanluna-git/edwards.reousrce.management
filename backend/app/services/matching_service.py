"""
Fuzzy Matching Service for AI Worklog Parsing

Provides multi-stage matching for projects and work types:
1. Exact ID matching (confidence=1.0)
2. Code matching (confidence=0.95)
3. Name containment matching (confidence=0.8)
4. Fuzzy similarity matching (confidence=score*0.7)
"""

from typing import Optional, List, Dict, Tuple, Any

# Try to import jellyfish for advanced string similarity
# Falls back to basic implementation if not available
try:
    import jellyfish
    HAS_JELLYFISH = True
except ImportError:
    HAS_JELLYFISH = False


class FuzzyMatcher:
    """
    Multi-stage fuzzy matcher for projects and work types.

    Matching stages (in order):
    1. Exact ID match - confidence 1.0
    2. Code match - confidence 0.95
    3. Name containment - confidence 0.8
    4. Fuzzy similarity - confidence = similarity_score * 0.7
    """

    @staticmethod
    def jaro_winkler(s1: str, s2: str) -> float:
        """
        Calculate Jaro-Winkler similarity between two strings.
        Effective for short strings and typos.

        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not s1 or not s2:
            return 0.0

        s1_lower = s1.lower()
        s2_lower = s2.lower()

        if s1_lower == s2_lower:
            return 1.0

        if HAS_JELLYFISH:
            return jellyfish.jaro_winkler_similarity(s1_lower, s2_lower)

        # Fallback: basic similarity calculation
        return FuzzyMatcher._basic_similarity(s1_lower, s2_lower)

    @staticmethod
    def levenshtein_ratio(s1: str, s2: str) -> float:
        """
        Calculate Levenshtein distance-based similarity ratio.

        Returns:
            Similarity score between 0.0 and 1.0
        """
        if not s1 or not s2:
            return 0.0

        s1_lower = s1.lower()
        s2_lower = s2.lower()

        if s1_lower == s2_lower:
            return 1.0

        if HAS_JELLYFISH:
            max_len = max(len(s1), len(s2))
            if max_len == 0:
                return 1.0
            distance = jellyfish.levenshtein_distance(s1_lower, s2_lower)
            return 1.0 - (distance / max_len)

        # Fallback: basic similarity
        return FuzzyMatcher._basic_similarity(s1_lower, s2_lower)

    @staticmethod
    def _basic_similarity(s1: str, s2: str) -> float:
        """
        Basic similarity calculation as fallback.
        Uses character overlap ratio.
        """
        if not s1 or not s2:
            return 0.0

        set1 = set(s1)
        set2 = set(s2)
        intersection = len(set1 & set2)
        union = len(set1 | set2)

        if union == 0:
            return 0.0

        return intersection / union

    def match_project(
        self,
        search_term: str,
        projects: List[Dict[str, Any]],
        threshold: float = 0.6,
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Multi-stage project matching.

        Stages:
        1. Exact ID match (full or 8-char prefix)
        2. Code match (exact or prefix)
        3. Name containment
        4. Fuzzy name similarity

        Args:
            search_term: Project ID, code, or name to search for
            projects: List of project dicts with id, code, name
            threshold: Minimum confidence threshold for fuzzy matching

        Returns:
            Tuple of (matched_project, confidence) or None
        """
        if not search_term or not projects:
            return None

        search_lower = search_term.lower().strip()
        search_upper = search_term.upper().strip()

        # Stage 1: Exact ID match
        for proj in projects:
            proj_id = proj.get("id", "")
            if proj_id.lower() == search_lower:
                return (proj, 1.0)
            # Check 8-char prefix match (truncated UUID)
            if len(search_term) >= 8:
                if proj_id.lower().startswith(search_lower[:8]):
                    return (proj, 0.98)
                if search_lower.startswith(proj_id.lower()[:8]):
                    return (proj, 0.98)

        # Stage 2: Code match
        for proj in projects:
            code = proj.get("code", "")
            if code:
                code_lower = code.lower()
                if code_lower == search_lower:
                    return (proj, 0.95)
                # Prefix match for codes
                if code_lower.startswith(search_lower) or search_lower.startswith(code_lower):
                    return (proj, 0.9)

        # Stage 3: Name containment (case-insensitive)
        for proj in projects:
            name = proj.get("name", "")
            name_upper = name.upper()
            # Check if search term is contained in name or vice versa
            if search_upper in name_upper:
                return (proj, 0.8)
            if name_upper in search_upper and len(name) >= 3:
                return (proj, 0.75)

        # Stage 4: Fuzzy similarity matching
        best_match = None
        best_score = 0.0

        for proj in projects:
            name = proj.get("name", "")
            code = proj.get("code", "")

            # Try matching against name
            name_score = self.jaro_winkler(search_term, name)

            # Try matching against code
            code_score = self.jaro_winkler(search_term, code) if code else 0.0

            # Take the best score
            score = max(name_score, code_score)

            if score > best_score:
                best_score = score
                best_match = proj

        if best_match and best_score >= threshold:
            # Fuzzy matches get reduced confidence
            confidence = best_score * 0.7
            return (best_match, confidence)

        return None

    def match_work_type(
        self,
        search_term: str,
        work_types: List[Dict[str, Any]],
        threshold: float = 0.5,
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Multi-stage work type matching.

        Stages:
        1. Exact ID match
        2. Code match
        3. English name containment
        4. Korean name containment (name_ko)
        5. Fuzzy similarity

        Args:
            search_term: Work type ID, code, or name to search for
            work_types: List of work type dicts with id, code, name, name_ko
            threshold: Minimum confidence threshold for fuzzy matching

        Returns:
            Tuple of (matched_work_type, confidence) or None
        """
        if not search_term or not work_types:
            return None

        search_lower = search_term.lower().strip()
        search_upper = search_term.upper().strip()

        # Stage 1: Exact ID match
        for wt in work_types:
            wt_id = str(wt.get("id", ""))
            if wt_id.lower() == search_lower or wt_id == search_term:
                return (wt, 1.0)

        # Stage 2: Code match
        for wt in work_types:
            code = wt.get("code", "")
            if code:
                code_lower = code.lower()
                code_upper = code.upper()
                if code_lower == search_lower or code_upper == search_upper:
                    return (wt, 0.95)
                # Partial code match (e.g., "ENG-DES" matches "ENG-DES-REV")
                if code_upper.startswith(search_upper) or search_upper.startswith(code_upper):
                    return (wt, 0.9)

        # Stage 3: English name containment
        for wt in work_types:
            name = wt.get("name", "")
            name_upper = name.upper()
            if search_upper in name_upper:
                return (wt, 0.8)
            if name_upper in search_upper and len(name) >= 3:
                return (wt, 0.75)

        # Stage 4: Korean name containment
        for wt in work_types:
            name_ko = wt.get("name_ko", "")
            if name_ko:
                if search_term in name_ko or name_ko in search_term:
                    return (wt, 0.8)

        # Stage 5: Fuzzy similarity matching
        best_match = None
        best_score = 0.0

        for wt in work_types:
            name = wt.get("name", "")
            code = wt.get("code", "")
            name_ko = wt.get("name_ko", "")

            # Try matching against different fields
            name_score = self.jaro_winkler(search_term, name)
            code_score = self.jaro_winkler(search_term, code) if code else 0.0
            ko_score = self.jaro_winkler(search_term, name_ko) if name_ko else 0.0

            score = max(name_score, code_score, ko_score)

            if score > best_score:
                best_score = score
                best_match = wt

        if best_match and best_score >= threshold:
            confidence = best_score * 0.7
            return (best_match, confidence)

        return None

    def match_work_type_by_code(
        self,
        code: str,
        work_types: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Direct work type lookup by code.

        Args:
            code: Work type code (e.g., "ENG-DES", "PRJ-MTG")
            work_types: List of work type dicts

        Returns:
            Matched work type dict or None
        """
        if not code or not work_types:
            return None

        code_upper = code.upper().strip()

        for wt in work_types:
            wt_code = wt.get("code", "")
            if wt_code and wt_code.upper() == code_upper:
                return wt

        return None


# Singleton instance
fuzzy_matcher = FuzzyMatcher()
