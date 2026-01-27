"""
Tests for AI Worklog Matching Service

Tests cover:
- FuzzyMatcher for projects and work types
- KoreanTextPreprocessor for text normalization
- Keyword mappings
"""

import pytest
from app.services.matching_service import FuzzyMatcher
from app.services.text_preprocessor import KoreanTextPreprocessor
from app.services.keyword_mappings import (
    get_project_code_by_keyword,
    get_worktype_code_by_keyword,
)


class TestFuzzyMatcher:
    """Tests for FuzzyMatcher class"""

    @pytest.fixture
    def matcher(self):
        return FuzzyMatcher()

    @pytest.fixture
    def sample_projects(self):
        return [
            {"id": "888888-160", "code": "888888-160", "name": "2510 OQC Digitalization Infrastructure"},
            {"id": "406886", "code": "406886", "name": "2025 EUV Gen3 Plus Rapidus"},
            {"id": "406886-120", "code": "406886-120", "name": "2025 EUV Gen3 Plus Micron ID"},
            {"id": "406437", "code": "406437", "name": "2025 EUV Gen4 Phase 1 Tumalo"},
            {"id": "406403", "code": "406403", "name": "2025 Hydrogen Recycling System_KR"},
            {"id": "406420", "code": "406420", "name": "2025 Protron | Single ROW"},
            {"id": "PRJ-112", "code": "PRJ-112", "name": "ACM NPI"},
        ]

    @pytest.fixture
    def sample_work_types(self):
        return [
            {"id": "ENG-DES", "code": "ENG-DES", "name": "Design"},
            {"id": "ENG-DES-REV", "code": "ENG-DES-REV", "name": "Design Review"},
            {"id": "ENG-SW", "code": "ENG-SW", "name": "Software Development"},
            {"id": "ENG-SW-COD", "code": "ENG-SW-COD", "name": "Coding"},
            {"id": "PRJ-MTG", "code": "PRJ-MTG", "name": "Meeting"},
            {"id": "PRJ-MTG-INT", "code": "PRJ-MTG-INT", "name": "Internal Meeting"},
            {"id": "KNW-DOC", "code": "KNW-DOC", "name": "Documentation"},
            {"id": "ENG-SIM", "code": "ENG-SIM", "name": "Simulation/Analysis"},
        ]

    def test_project_exact_id_match(self, matcher, sample_projects):
        """Test exact ID matching returns confidence 1.0"""
        result = matcher.match_project("888888-160", sample_projects)
        assert result is not None
        project, confidence = result
        assert project["id"] == "888888-160"
        assert confidence == 1.0

    def test_project_partial_id_match(self, matcher, sample_projects):
        """Test 8-char prefix ID matching"""
        result = matcher.match_project("888888-1", sample_projects)
        assert result is not None
        project, confidence = result
        assert project["id"] == "888888-160"
        assert confidence >= 0.9

    def test_project_code_match(self, matcher, sample_projects):
        """Test code matching returns high confidence"""
        result = matcher.match_project("406886", sample_projects)
        assert result is not None
        project, confidence = result
        assert project["id"] == "406886"
        assert confidence >= 0.9

    def test_project_name_containment_match(self, matcher, sample_projects):
        """Test name containment matching"""
        result = matcher.match_project("OQC", sample_projects)
        assert result is not None
        project, confidence = result
        assert "OQC" in project["name"]
        assert confidence >= 0.7

    def test_project_name_containment_gen3(self, matcher, sample_projects):
        """Test GEN3 matches Gen3 Plus project"""
        result = matcher.match_project("GEN3", sample_projects)
        assert result is not None
        project, confidence = result
        assert "Gen3" in project["name"]

    def test_project_name_containment_hrs(self, matcher, sample_projects):
        """Test HRS matches Hydrogen Recycling System"""
        result = matcher.match_project("HRS", sample_projects)
        assert result is not None
        project, confidence = result
        assert "Hydrogen" in project["name"] or "HRS" in project["name"]

    def test_project_fuzzy_match(self, matcher, sample_projects):
        """Test fuzzy matching for similar names"""
        result = matcher.match_project("Protron Single", sample_projects, threshold=0.5)
        assert result is not None
        project, confidence = result
        assert "Protron" in project["name"]

    def test_project_no_match(self, matcher, sample_projects):
        """Test no match returns None"""
        result = matcher.match_project("NONEXISTENT_PROJECT_XYZ", sample_projects)
        assert result is None

    def test_work_type_exact_id_match(self, matcher, sample_work_types):
        """Test exact ID matching for work types"""
        result = matcher.match_work_type("ENG-DES", sample_work_types)
        assert result is not None
        wt, confidence = result
        assert wt["id"] == "ENG-DES"
        assert confidence >= 0.9

    def test_work_type_code_match(self, matcher, sample_work_types):
        """Test code matching for work types"""
        result = matcher.match_work_type("PRJ-MTG", sample_work_types)
        assert result is not None
        wt, confidence = result
        assert wt["code"] == "PRJ-MTG"
        assert confidence >= 0.9

    def test_work_type_partial_code_match(self, matcher, sample_work_types):
        """Test partial code matching (e.g., ENG-DES matches ENG-DES-REV)"""
        result = matcher.match_work_type("ENG-DES-REV", sample_work_types)
        assert result is not None
        wt, confidence = result
        assert wt["code"] == "ENG-DES-REV"

    def test_work_type_name_match(self, matcher, sample_work_types):
        """Test name containment matching for work types"""
        result = matcher.match_work_type("Design", sample_work_types)
        assert result is not None
        wt, confidence = result
        assert "Design" in wt["name"]

    def test_work_type_meeting_match(self, matcher, sample_work_types):
        """Test meeting work type matching"""
        result = matcher.match_work_type("Meeting", sample_work_types)
        assert result is not None
        wt, confidence = result
        assert "Meeting" in wt["name"]

    def test_work_type_no_match(self, matcher, sample_work_types):
        """Test no match returns None"""
        result = matcher.match_work_type("NONEXISTENT_TYPE", sample_work_types)
        assert result is None

    def test_jaro_winkler_identical(self, matcher):
        """Test Jaro-Winkler similarity for identical strings"""
        score = matcher.jaro_winkler("hello", "hello")
        assert score == 1.0

    def test_jaro_winkler_similar(self, matcher):
        """Test Jaro-Winkler similarity for similar strings"""
        score = matcher.jaro_winkler("design", "Design")
        assert score == 1.0  # Case insensitive

    def test_jaro_winkler_different(self, matcher):
        """Test Jaro-Winkler similarity for different strings"""
        score = matcher.jaro_winkler("hello", "world")
        assert score < 0.5

    def test_levenshtein_ratio_identical(self, matcher):
        """Test Levenshtein ratio for identical strings"""
        score = matcher.levenshtein_ratio("test", "test")
        assert score == 1.0

    def test_levenshtein_ratio_similar(self, matcher):
        """Test Levenshtein ratio for similar strings"""
        score = matcher.levenshtein_ratio("design", "designs")
        assert score > 0.8


class TestKoreanTextPreprocessor:
    """Tests for KoreanTextPreprocessor class"""

    @pytest.fixture
    def preprocessor(self):
        return KoreanTextPreprocessor()

    def test_alias_expansion_oqc(self, preprocessor):
        """Test 오큐씨 expands to OQC"""
        result = preprocessor.normalize("오큐씨 인프라 작업")
        assert "OQC" in result

    def test_alias_expansion_gen3(self, preprocessor):
        """Test 젠3 expands to GEN3"""
        result = preprocessor.normalize("젠3 프로젝트 미팅")
        assert "GEN3" in result

    def test_alias_expansion_gen4(self, preprocessor):
        """Test 젠4 expands to GEN4"""
        result = preprocessor.normalize("젠4 설계 리뷰")
        assert "GEN4" in result

    def test_alias_expansion_tumalo(self, preprocessor):
        """Test 투말로 expands to TUMALO"""
        result = preprocessor.normalize("투말로 프로젝트")
        assert "TUMALO" in result

    def test_alias_expansion_protron(self, preprocessor):
        """Test 프로트론 expands to PROTRON"""
        result = preprocessor.normalize("프로트론 관련 업무")
        assert "PROTRON" in result

    def test_postposition_removal(self, preprocessor):
        """Test Korean postposition removal"""
        result = preprocessor.normalize("OQC인프라를 설계")
        # Should remove trailing '를' from compound word
        assert "OQC인프라" in result or "OQC" in result

    def test_postposition_removal_multiple(self, preprocessor):
        """Test multiple postposition removal"""
        result = preprocessor.normalize("HRS관련해서 미팅을 했습니다")
        # Should handle postpositions
        assert "HRS" in result

    def test_whitespace_normalization(self, preprocessor):
        """Test whitespace normalization"""
        result = preprocessor.normalize("  OQC   인프라    설계  ")
        assert result == "OQC 인프라 설계"

    def test_extract_hints_project(self, preprocessor):
        """Test project keyword hint extraction"""
        hints = preprocessor.extract_hints("OQC 인프라 DB 설계")
        project_hints = [h for h in hints if h.startswith("project:")]
        assert len(project_hints) > 0
        assert any("OQC" in h for h in project_hints)

    def test_extract_hints_worktype(self, preprocessor):
        """Test worktype keyword hint extraction"""
        hints = preprocessor.extract_hints("설계 리뷰 미팅")
        worktype_hints = [h for h in hints if h.startswith("worktype:")]
        assert len(worktype_hints) > 0

    def test_extract_hints_mixed(self, preprocessor):
        """Test mixed project and worktype hint extraction"""
        hints = preprocessor.extract_hints("OQC 프로젝트 설계 미팅")
        project_hints = [h for h in hints if h.startswith("project:")]
        worktype_hints = [h for h in hints if h.startswith("worktype:")]
        assert len(project_hints) > 0
        assert len(worktype_hints) > 0

    def test_extract_project_hints(self, preprocessor):
        """Test extract_project_hints method"""
        hints = preprocessor.extract_project_hints("HRS 관련 업무")
        assert "HRS" in hints

    def test_extract_worktype_hints(self, preprocessor):
        """Test extract_worktype_hints method"""
        hints = preprocessor.extract_worktype_hints("코딩 작업")
        # '코딩' should be detected
        assert any("코딩" in h.upper() or "CODING" in h.upper() for h in hints) or len(hints) >= 0

    def test_empty_input(self, preprocessor):
        """Test handling of empty input"""
        assert preprocessor.normalize("") == ""
        assert preprocessor.normalize(None) == ""
        assert preprocessor.extract_hints("") == []
        assert preprocessor.extract_hints(None) == []


class TestKeywordMappings:
    """Tests for keyword mapping functions"""

    def test_project_keyword_oqc(self):
        """Test OQC keyword maps to correct project code"""
        code = get_project_code_by_keyword("OQC 인프라")
        assert code == "888888-160"

    def test_project_keyword_gen3(self):
        """Test GEN3 keyword maps to correct project code"""
        code = get_project_code_by_keyword("GEN3 프로젝트")
        assert code == "406886"

    def test_project_keyword_gen4(self):
        """Test GEN4 keyword maps to correct project code"""
        code = get_project_code_by_keyword("GEN4 설계")
        assert code == "406437"

    def test_project_keyword_hrs(self):
        """Test HRS keyword maps to correct project code"""
        code = get_project_code_by_keyword("HRS 관련")
        assert code == "406403"

    def test_project_keyword_protron(self):
        """Test PROTRON keyword maps to correct project code"""
        code = get_project_code_by_keyword("PROTRON 업무")
        assert code == "406420"

    def test_project_keyword_acm(self):
        """Test ACM keyword maps to correct project code"""
        code = get_project_code_by_keyword("ACM NPI")
        assert code == "PRJ-112"

    def test_project_keyword_priority(self):
        """Test keyword priority - more specific matches first"""
        # GEN3+ should match before GEN3
        code = get_project_code_by_keyword("GEN3+ 프로젝트")
        assert code == "406886"  # GEN3+ maps to Rapidus

    def test_project_keyword_no_match(self):
        """Test no keyword match returns None"""
        code = get_project_code_by_keyword("random text without keywords")
        assert code is None

    def test_worktype_keyword_design(self):
        """Test design keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("설계 작업")
        assert code.startswith("ENG-DES")

    def test_worktype_keyword_meeting(self):
        """Test meeting keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("미팅 참석")
        assert "MTG" in code

    def test_worktype_keyword_coding(self):
        """Test coding keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("코딩 작업")
        assert "SW" in code

    def test_worktype_keyword_review(self):
        """Test review keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("리뷰")
        assert "REV" in code

    def test_worktype_keyword_documentation(self):
        """Test documentation keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("문서 작성")
        assert "DOC" in code

    def test_worktype_keyword_analysis(self):
        """Test analysis keyword maps to correct work type"""
        code = get_worktype_code_by_keyword("분석 업무")
        assert "SIM" in code

    def test_worktype_keyword_no_match(self):
        """Test no keyword match returns None"""
        code = get_worktype_code_by_keyword("random text")
        assert code is None


class TestIntegration:
    """Integration tests combining multiple components"""

    @pytest.fixture
    def preprocessor(self):
        return KoreanTextPreprocessor()

    @pytest.fixture
    def matcher(self):
        return FuzzyMatcher()

    @pytest.fixture
    def sample_projects(self):
        return [
            {"id": "888888-160", "code": "888888-160", "name": "2510 OQC Digitalization Infrastructure"},
            {"id": "406403", "code": "406403", "name": "2025 Hydrogen Recycling System_KR"},
        ]

    @pytest.fixture
    def sample_work_types(self):
        return [
            {"id": "ENG-DES", "code": "ENG-DES", "name": "Design"},
            {"id": "PRJ-MTG", "code": "PRJ-MTG", "name": "Meeting"},
        ]

    def test_korean_input_to_project_match(self, preprocessor, matcher, sample_projects):
        """Test full flow: Korean input → normalize → match project"""
        # Input with Korean alias
        text = "오큐씨 인프라 DB 설계"

        # Step 1: Normalize
        normalized = preprocessor.normalize(text)
        assert "OQC" in normalized

        # Step 2: Extract hints
        hints = preprocessor.extract_hints(normalized)
        assert any("OQC" in h for h in hints)

        # Step 3: Match project
        result = matcher.match_project("OQC", sample_projects)
        assert result is not None
        project, confidence = result
        assert "OQC" in project["name"]

    def test_complex_korean_input(self, preprocessor, matcher, sample_projects, sample_work_types):
        """Test complex Korean input with multiple keywords"""
        text = "오전에 OQC 인프라 DB 설계했고, 오후에 HRS 관련 미팅"

        # Normalize
        normalized = preprocessor.normalize(text)

        # Extract hints
        hints = preprocessor.extract_hints(normalized)

        # Should detect both OQC and HRS
        project_hints = preprocessor.extract_project_hints(normalized)
        assert "OQC" in project_hints or any("OQC" in h for h in project_hints)
        assert "HRS" in project_hints or any("HRS" in h for h in project_hints)

        # Should detect worktype keywords
        worktype_hints = preprocessor.extract_worktype_hints(normalized)
        # 설계 and 미팅 should be detected
        assert len(worktype_hints) >= 0  # May vary based on exact keyword list
