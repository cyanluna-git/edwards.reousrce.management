"""
PCAS (Atlas Copco AI Brains) LLM Client.

Async wrapper for the internal AI Brains Bot API (GPT-5).
Based on: D:/00.Dev/remote.work/aibrain.bot/src/aibrains_client.py

Key differences from Groq/Gemini:
- No native system prompt support: merged into user message
- Response is plain text: JSON must be extracted from content
- Requires ai-brains-token header + User-Agent (Azure Gateway)
"""

import json
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# User-Agent is required to pass Azure Application Gateway
_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


class PCASClient:
    """Async client for Atlas Copco AI Brains Bot API."""

    def __init__(self):
        self.base_url = settings.PCAS_LLM_BASE_URL.rstrip("/")
        self.api_key = settings.PCAS_LLM_KEY
        self.model = settings.PCAS_LLM_MODEL
        self.timeout = settings.PCAS_LLM_TIMEOUT
        self.verify_ssl = settings.PCAS_LLM_VERIFY_SSL

    def _get_headers(self) -> dict:
        """Build request headers with AI Brains token."""
        return {
            "ai-brains-token": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": _DEFAULT_USER_AGENT,
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> str:
        """
        Send a message to PCAS AI Brains and get text response.

        PCAS Chat API does not support separate system messages,
        so system_prompt is prepended to the user prompt.

        Args:
            prompt: User prompt text
            system_prompt: Optional system instruction (merged into content)
            user_email: Optional user UPN for the API request

        Returns:
            Raw text response from the AI
        """
        url = f"{self.base_url}/chat"

        # Merge system prompt into user content
        if system_prompt:
            combined_content = f"{system_prompt}\n\n{prompt}"
        else:
            combined_content = prompt

        # PCAS API requires "user" (UPN) or "userToken"
        upn = user_email or settings.PCAS_LLM_DEFAULT_UPN or ""
        if not upn.strip():
            raise ValueError(
                "PCAS API requires user (UPN). Set PCAS_LLM_DEFAULT_UPN in .env or pass user_email when calling."
            )

        payload: dict = {
            "messages": [{"role": "user", "content": combined_content}],
            "stream": False,
            "model": self.model,
            "user": upn.strip(),
        }

        async with httpx.AsyncClient(
            timeout=self.timeout,
            verify=self.verify_ssl,
        ) as client:
            response = await client.post(
                url, json=payload, headers=self._get_headers()
            )
            response.raise_for_status()
            result = response.json()

        # Extract text from PCAS response format: {message: {content: "..."}}
        if "message" in result and "content" in result["message"]:
            return result["message"]["content"]

        # Handle error responses
        if "error" in result:
            error_msg = result["error"].get("message", "Unknown error")
            raise ValueError(f"PCAS API error: {error_msg}")

        raise ValueError(f"Unexpected PCAS response format: {result}")

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> dict:
        """
        Generate JSON response from PCAS AI Brains.

        Appends JSON instruction to ensure structured output,
        then parses the text response into a dict.

        Args:
            prompt: User prompt text
            system_prompt: Optional system instruction
            user_email: User UPN (required by PCAS; falls back to PCAS_LLM_DEFAULT_UPN)

        Returns:
            Parsed JSON dict from the response
        """
        # Ensure prompt requests JSON output
        if system_prompt and "JSON" not in system_prompt and "json" not in system_prompt:
            system_prompt = system_prompt + "\n\nYou MUST respond with JSON only."

        text = await self.generate(prompt, system_prompt, user_email=user_email)

        # Strip markdown code block wrappers
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from PCAS response: {text[:500]}")
            raise ValueError(
                f"Failed to parse JSON from PCAS response: {text[:200]}"
            ) from e

    async def health_check(self) -> dict:
        """
        Check if PCAS AI Brains API is accessible.

        1. GET /bot-info to verify token and base connectivity.
        2. If PCAS_LLM_DEFAULT_UPN is set, POST /chat with a minimal message
           to verify the chat endpoint (which requires user) works.

        Returns:
            Status dict with available flag and model info
        """
        try:
            url = f"{self.base_url}/bot-info"
            async with httpx.AsyncClient(
                timeout=10,
                verify=self.verify_ssl,
            ) as client:
                response = await client.get(url, headers=self._get_headers())
                response.raise_for_status()
                info = response.json()

            bot_info = info.get("botInfo", {})
            available = True
            message_extra = ""

            # Verify chat endpoint if default UPN is configured (ensures "user" requirement is satisfied)
            default_upn = (settings.PCAS_LLM_DEFAULT_UPN or "").strip()
            if default_upn:
                chat_ok = await self._check_chat_endpoint(default_upn)
                if not chat_ok:
                    available = False
                    message_extra = " (bot-info OK, chat endpoint failed - check PCAS_LLM_DEFAULT_UPN)"

            return {
                "status": "ok" if available else "error",
                "available": available,
                "model": self.model,
                "bot_name": bot_info.get("botName", "AI Brains"),
                "error": None if available else f"Chat verification failed{message_extra}",
            }
        except Exception as e:
            return {
                "status": "error",
                "available": False,
                "model": self.model,
                "error": str(e),
            }

    async def _check_chat_endpoint(self, user_upn: str) -> bool:
        """Send a minimal chat request to verify the chat endpoint works."""
        try:
            url = f"{self.base_url}/chat"
            payload = {
                "messages": [{"role": "user", "content": "test"}],
                "stream": False,
                "model": self.model,
                "user": user_upn,
            }
            async with httpx.AsyncClient(
                timeout=15,
                verify=self.verify_ssl,
            ) as client:
                response = await client.post(
                    url, json=payload, headers=self._get_headers()
                )
                response.raise_for_status()
                data = response.json()
                if "error" in data:
                    return False
                return "message" in data and "content" in data.get("message", {})
        except Exception:
            return False


# Singleton instance
pcas_client = PCASClient()
