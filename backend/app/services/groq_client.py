"""
Groq API Client for AI worklog parsing.
Uses Groq's fast inference with Llama 70B model.
"""

import httpx
import json
from typing import Optional
from app.core.config import settings


class GroqClient:
    """Async client for Groq API (OpenAI-compatible)."""

    def __init__(self):
        self.base_url = "https://api.groq.com/openai/v1"
        self.model = settings.GROQ_MODEL
        self.api_key = settings.GROQ_API_KEY
        self.timeout = settings.GROQ_TIMEOUT

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> dict:
        """
        Generate a response from Groq.

        Args:
            prompt: User prompt
            system_prompt: Optional system instruction

        Returns:
            API response
        """
        url = f"{self.base_url}/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 2048,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
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
        Generate JSON response from Groq.

        Args:
            prompt: User prompt
            system_prompt: Optional system instruction (must mention JSON)

        Returns:
            Parsed JSON from the response
        """
        # Ensure system prompt mentions JSON for response_format to work
        if system_prompt and "JSON" not in system_prompt and "json" not in system_prompt:
            system_prompt = system_prompt + "\n\n반드시 JSON 형식으로 응답하세요."

        result = await self.generate(prompt, system_prompt)

        # Extract text from Groq response
        try:
            text = result["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise ValueError(f"Unexpected Groq response format: {result}") from e

        # Parse JSON from response
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
            raise ValueError(f"Failed to parse JSON from Groq response: {text}") from e

    async def health_check(self) -> dict:
        """
        Check if Groq API is accessible.

        Returns:
            Status dict with available flag
        """
        try:
            url = f"{self.base_url}/models"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                models = response.json()

                return {
                    "status": "ok",
                    "available": True,
                    "model": self.model,
                    "models_count": len(models.get("data", [])),
                }
        except Exception as e:
            return {
                "status": "error",
                "available": False,
                "error": str(e),
            }


# Singleton instance
groq_client = GroqClient()
