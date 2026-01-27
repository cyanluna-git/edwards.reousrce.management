"""
Gemini API Client for AI worklog parsing.
Uses Google's Gemini 2.0 Flash model for fast inference.
"""

import httpx
from typing import Optional
from app.core.config import settings


class GeminiClient:
    """Async client for Google Gemini API."""

    def __init__(self):
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.model = settings.GEMINI_MODEL
        self.api_key = settings.GEMINI_API_KEY
        self.timeout = settings.GEMINI_TIMEOUT

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> dict:
        """
        Generate a response from Gemini.

        Args:
            prompt: User prompt
            system_prompt: Optional system instruction

        Returns:
            Parsed JSON response or raw text
        """
        url = f"{self.base_url}/models/{self.model}:generateContent"

        # Build content parts
        parts = []
        if system_prompt:
            parts.append({"text": system_prompt})
        parts.append({"text": prompt})

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.1,  # Low temperature for consistent JSON output
                "topP": 0.95,
                "maxOutputTokens": 2048,
            },
        }

        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": self.api_key,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> dict:
        """
        Generate JSON response from Gemini.

        Args:
            prompt: User prompt
            system_prompt: Optional system instruction

        Returns:
            Parsed JSON from the response
        """
        import json

        result = await self.generate(prompt, system_prompt)

        # Extract text from Gemini response
        try:
            text = result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise ValueError(f"Unexpected Gemini response format: {result}") from e

        # Parse JSON from response
        # Gemini may wrap JSON in markdown code blocks
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
            raise ValueError(f"Failed to parse JSON from Gemini response: {text}") from e

    async def health_check(self) -> dict:
        """
        Check if Gemini API is accessible.

        Returns:
            Status dict with available flag
        """
        try:
            # Simple test request
            url = f"{self.base_url}/models/{self.model}"
            headers = {"X-goog-api-key": self.api_key}

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                model_info = response.json()

                return {
                    "status": "ok",
                    "available": True,
                    "model": self.model,
                    "display_name": model_info.get("displayName", self.model),
                }
        except Exception as e:
            return {
                "status": "error",
                "available": False,
                "error": str(e),
            }


# Singleton instance
gemini_client = GeminiClient()
