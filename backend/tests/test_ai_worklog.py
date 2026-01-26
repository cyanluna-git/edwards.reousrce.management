"""
Tests for AI Worklog Service and Endpoints
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.orm import Session

from app.schemas.ai_worklog import (
    AIWorklogParseRequest,
    AIWorklogEntry,
    AIWorklogParseResponse,
)
from app.services.ai_worklog_service import AIWorklogService
from app.prompts.worklog_parser import WorklogParserPrompt


class TestWorklogParserPrompt:
    """Tests for WorklogParserPrompt class"""

    def test_build_system_prompt_with_projects(self):
        """Test system prompt generation with projects"""
        projects = [
            {"id": "proj-1", "code": "OQC", "name": "OQC Infra"},
            {"id": "proj-2", "code": "HRS", "name": "HRS Abingdon"},
        ]
        work_types = [
            {"id": 1, "code": "DEV", "name": "Development"},
            {"id": 2, "code": "DOC", "name": "Documentation"},
        ]

        prompt = WorklogParserPrompt.build_system_prompt(projects, work_types)

        assert "OQC Infra" in prompt
        assert "HRS Abingdon" in prompt
        assert "Development" in prompt
        assert "Documentation" in prompt

    def test_build_system_prompt_empty_lists(self):
        """Test system prompt generation with empty lists"""
        prompt = WorklogParserPrompt.build_system_prompt([], [])

        assert "(프로젝트 목록 없음)" in prompt
        assert "(업무 유형 목록 없음)" in prompt

    def test_build_user_prompt(self):
        """Test user prompt generation"""
        text = "오전에 OQC 작업했음"
        date = "2024-01-15"

        prompt = WorklogParserPrompt.build_user_prompt(text, date)

        assert text in prompt
        assert date in prompt


class TestAIWorklogService:
    """Tests for AIWorklogService class"""

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session"""
        session = MagicMock(spec=Session)
        # Mock project query
        mock_project_query = MagicMock()
        mock_project_query.filter.return_value = mock_project_query
        mock_project_query.order_by.return_value = mock_project_query
        mock_project_query.all.return_value = []

        # Mock work type query
        mock_work_type_query = MagicMock()
        mock_work_type_query.filter.return_value = mock_work_type_query
        mock_work_type_query.order_by.return_value = mock_work_type_query
        mock_work_type_query.all.return_value = []

        session.query.return_value = mock_project_query
        return session

    @pytest.fixture
    def mock_ollama_client(self):
        """Create a mock Ollama client"""
        client = MagicMock()
        client.model = "phi3:mini"
        client.generate_json = AsyncMock()
        client.check_health = AsyncMock()
        return client

    @pytest.mark.asyncio
    async def test_parse_worklog_success(self, mock_db_session, mock_ollama_client):
        """Test successful worklog parsing"""
        mock_ollama_client.generate_json.return_value = {
            "entries": [
                {
                    "project_id": None,
                    "project_name": "OQC Infra",
                    "work_type_category_id": None,
                    "work_type_name": "Development",
                    "description": "DB 설계",
                    "hours": 4.0,
                    "confidence": 0.8,
                }
            ],
            "warnings": [],
        }

        service = AIWorklogService(mock_db_session, mock_ollama_client)
        request = AIWorklogParseRequest(
            text="오전에 OQC 인프라 DB 설계했음",
            user_id="user-1",
            target_date="2024-01-15",
        )

        result = await service.parse_worklog(request)

        assert isinstance(result, AIWorklogParseResponse)
        assert len(result.entries) == 1
        assert result.entries[0].hours == 4.0
        assert result.total_hours == 4.0

    @pytest.mark.asyncio
    async def test_parse_worklog_ai_failure(self, mock_db_session, mock_ollama_client):
        """Test handling of AI parsing failure"""
        mock_ollama_client.generate_json.side_effect = Exception("AI Error")

        service = AIWorklogService(mock_db_session, mock_ollama_client)
        request = AIWorklogParseRequest(
            text="test input",
            user_id="user-1",
            target_date="2024-01-15",
        )

        result = await service.parse_worklog(request)

        assert isinstance(result, AIWorklogParseResponse)
        assert len(result.entries) == 0
        assert len(result.warnings) > 0
        assert "AI 파싱 실패" in result.warnings[0]

    @pytest.mark.asyncio
    async def test_check_health_healthy(self, mock_db_session, mock_ollama_client):
        """Test health check when AI is healthy"""
        mock_ollama_client.check_health.return_value = True

        service = AIWorklogService(mock_db_session, mock_ollama_client)
        result = await service.check_health()

        assert result["status"] == "healthy"
        assert result["model"] == "phi3:mini"

    @pytest.mark.asyncio
    async def test_check_health_unhealthy(self, mock_db_session, mock_ollama_client):
        """Test health check when AI is unhealthy"""
        mock_ollama_client.check_health.return_value = False

        service = AIWorklogService(mock_db_session, mock_ollama_client)
        result = await service.check_health()

        assert result["status"] == "unhealthy"

    def test_validate_hours_bounds(self, mock_db_session, mock_ollama_client):
        """Test that hours are bounded correctly"""
        service = AIWorklogService(mock_db_session, mock_ollama_client)

        # Test entry with excessive hours
        entry = {
            "hours": 30.0,
            "confidence": 0.5,
            "description": "test",
        }

        result = service._validate_and_map_entry(entry, {}, {})

        assert result.hours == 24.0  # Should be capped at 24

    def test_validate_confidence_bounds(self, mock_db_session, mock_ollama_client):
        """Test that confidence is bounded correctly"""
        service = AIWorklogService(mock_db_session, mock_ollama_client)

        # Test entry with excessive confidence
        entry = {
            "hours": 1.0,
            "confidence": 1.5,
            "description": "test",
        }

        result = service._validate_and_map_entry(entry, {}, {})

        assert result.confidence == 1.0  # Should be capped at 1.0


class TestAIWorklogSchemas:
    """Tests for AI Worklog schemas"""

    def test_ai_worklog_entry_validation(self):
        """Test AIWorklogEntry validation"""
        entry = AIWorklogEntry(
            project_id="proj-1",
            project_name="Test Project",
            work_type_category_id=1,
            work_type_name="Development",
            description="Test description",
            hours=4.0,
            confidence=0.8,
        )

        assert entry.hours == 4.0
        assert entry.confidence == 0.8

    def test_ai_worklog_entry_hours_validation(self):
        """Test that hours must be positive and <= 24"""
        with pytest.raises(ValueError):
            AIWorklogEntry(
                description="test",
                hours=0,  # Invalid: must be > 0
                confidence=0.5,
            )

        with pytest.raises(ValueError):
            AIWorklogEntry(
                description="test",
                hours=25,  # Invalid: must be <= 24
                confidence=0.5,
            )

    def test_ai_worklog_parse_response(self):
        """Test AIWorklogParseResponse"""
        response = AIWorklogParseResponse(
            entries=[
                AIWorklogEntry(
                    description="test",
                    hours=4.0,
                    confidence=0.8,
                )
            ],
            total_hours=4.0,
            warnings=["warning 1"],
        )

        assert len(response.entries) == 1
        assert response.total_hours == 4.0
        assert len(response.warnings) == 1
