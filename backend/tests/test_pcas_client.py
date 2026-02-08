"""
Tests for PCAS LLM Client and LLM Factory
"""

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.llm.base import LLMClient
from app.services.llm.pcas_client import PCASClient


class TestPCASClient:
    """Tests for PCASClient class"""

    @pytest.fixture
    def pcas_client(self):
        """Create a PCASClient with test settings"""
        with patch("app.services.llm.pcas_client.settings") as mock_settings:
            mock_settings.PCAS_LLM_KEY = "test-token"
            mock_settings.PCAS_LLM_BASE_URL = "https://test.example.com/api"
            mock_settings.PCAS_LLM_MODEL = "gpt-5"
            mock_settings.PCAS_LLM_TIMEOUT = 10
            mock_settings.PCAS_LLM_VERIFY_SSL = True
            client = PCASClient()
        return client

    def test_pcas_client_implements_protocol(self, pcas_client):
        """Verify PCASClient implements LLMClient protocol"""
        assert isinstance(pcas_client, LLMClient)

    def test_headers_contain_token(self, pcas_client):
        """Verify headers contain required ai-brains-token"""
        headers = pcas_client._get_headers()
        assert "ai-brains-token" in headers
        assert headers["ai-brains-token"] == "test-token"
        assert "User-Agent" in headers
        assert "Content-Type" in headers

    @pytest.mark.asyncio
    async def test_generate_merges_system_prompt(self, pcas_client):
        """Test that system prompt is merged into user content"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "test response"},
            "sid": "test-session",
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            result = await pcas_client.generate(
                prompt="user message",
                system_prompt="system instruction",
            )

            # Verify the combined content was sent
            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            content = payload["messages"][0]["content"]
            assert "system instruction" in content
            assert "user message" in content
            assert result == "test response"

    @pytest.mark.asyncio
    async def test_generate_json_parses_response(self, pcas_client):
        """Test JSON parsing from text response"""
        json_response = json.dumps({
            "entries": [{"project": "test", "hours": 4}]
        })

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": json_response},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            result = await pcas_client.generate_json("parse this")

            assert isinstance(result, dict)
            assert "entries" in result
            assert result["entries"][0]["hours"] == 4

    @pytest.mark.asyncio
    async def test_generate_json_strips_markdown(self, pcas_client):
        """Test that markdown code blocks are stripped from JSON"""
        json_data = {"entries": []}
        wrapped_response = f"```json\n{json.dumps(json_data)}\n```"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": wrapped_response},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            result = await pcas_client.generate_json("parse this")

            assert isinstance(result, dict)
            assert "entries" in result

    @pytest.mark.asyncio
    async def test_generate_json_invalid_json_raises(self, pcas_client):
        """Test that invalid JSON raises ValueError"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "this is not json at all"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError, match="Failed to parse JSON"):
                await pcas_client.generate_json("parse this")

    @pytest.mark.asyncio
    async def test_generate_handles_error_response(self, pcas_client):
        """Test that API error responses are handled"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": {"message": "Rate limit exceeded"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError, match="PCAS API error"):
                await pcas_client.generate("test")

    @pytest.mark.asyncio
    async def test_generate_includes_user_email(self, pcas_client):
        """Test that user email is included in the request"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "response"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            await pcas_client.generate(
                "test", user_email="user@edwards.com"
            )

            call_args = mock_client.post.call_args
            payload = call_args.kwargs["json"]
            assert payload["user"] == "user@edwards.com"

    @pytest.mark.asyncio
    async def test_health_check_healthy(self, pcas_client):
        """Test health check when API is available"""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "botInfo": {"botName": "Test Bot", "botDesc": "Test Description"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            result = await pcas_client.health_check()

            assert result["available"] is True
            assert result["status"] == "ok"
            assert result["bot_name"] == "Test Bot"

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self, pcas_client):
        """Test health check when API is unavailable"""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get.side_effect = Exception("Connection refused")
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_class.return_value = mock_client

            result = await pcas_client.health_check()

            assert result["available"] is False
            assert result["status"] == "error"
            assert "Connection refused" in result["error"]


class TestLLMFactory:
    """Tests for LLM client factory"""

    def test_factory_returns_groq_by_default(self):
        """Test that factory returns Groq client by default"""
        with patch("app.services.llm.factory.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "groq"
            from app.services.llm.factory import get_llm_client

            client = get_llm_client()
            assert isinstance(client, LLMClient)

    def test_factory_returns_pcas(self):
        """Test that factory returns PCAS client for pcas provider"""
        with patch("app.services.llm.factory.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "pcas"
            # Need to also patch PCAS settings
            with patch("app.services.llm.pcas_client.settings") as mock_pcas:
                mock_pcas.PCAS_LLM_KEY = "test"
                mock_pcas.PCAS_LLM_BASE_URL = "https://test.example.com/api"
                mock_pcas.PCAS_LLM_MODEL = "gpt-5"
                mock_pcas.PCAS_LLM_TIMEOUT = 10
                mock_pcas.PCAS_LLM_VERIFY_SSL = True

                from app.services.llm.factory import get_llm_client

                client = get_llm_client("pcas")
                assert isinstance(client, LLMClient)

    def test_factory_override_provider(self):
        """Test that provider parameter overrides settings"""
        with patch("app.services.llm.factory.settings") as mock_settings:
            mock_settings.AI_PROVIDER = "groq"  # Default
            from app.services.llm.factory import get_llm_client

            # Explicit gemini should override default groq
            client = get_llm_client("gemini")
            assert isinstance(client, LLMClient)


class TestProtocolCompliance:
    """Verify all clients implement the LLMClient protocol"""

    def test_groq_client_protocol(self):
        """Test GroqClient implements LLMClient"""
        with patch("app.services.groq_client.settings") as mock:
            mock.GROQ_API_KEY = "test"
            mock.GROQ_MODEL = "test"
            mock.GROQ_TIMEOUT = 10
            from app.services.groq_client import GroqClient

            assert isinstance(GroqClient(), LLMClient)

    def test_gemini_client_protocol(self):
        """Test GeminiClient implements LLMClient"""
        with patch("app.services.gemini_client.settings") as mock:
            mock.GEMINI_API_KEY = "test"
            mock.GEMINI_MODEL = "test"
            mock.GEMINI_TIMEOUT = 10
            from app.services.gemini_client import GeminiClient

            assert isinstance(GeminiClient(), LLMClient)

    def test_pcas_client_protocol(self):
        """Test PCASClient implements LLMClient"""
        with patch("app.services.llm.pcas_client.settings") as mock:
            mock.PCAS_LLM_KEY = "test"
            mock.PCAS_LLM_BASE_URL = "https://test.example.com/api"
            mock.PCAS_LLM_MODEL = "gpt-5"
            mock.PCAS_LLM_TIMEOUT = 10
            mock.PCAS_LLM_VERIFY_SSL = True
            from app.services.llm.pcas_client import PCASClient

            assert isinstance(PCASClient(), LLMClient)
