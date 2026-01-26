"""
Ollama API Client
Async HTTP client for communicating with Ollama API
"""

import json
import httpx
from typing import Optional

from app.core.config import settings


class OllamaClient:
    """Async client for Ollama API"""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self.base_url = base_url or settings.OLLAMA_URL
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout or settings.OLLAMA_TIMEOUT

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        format_json: bool = False,
    ) -> dict:
        """
        Generate a completion from Ollama.

        Args:
            prompt: The user prompt
            system: Optional system prompt
            format_json: If True, request JSON format response

        Returns:
            Dict containing the response
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }

        if system:
            payload["system"] = system

        if format_json:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def generate_json(
        self,
        prompt: str,
        system: Optional[str] = None,
    ) -> dict:
        """
        Generate a JSON completion from Ollama and parse it.

        Args:
            prompt: The user prompt
            system: Optional system prompt

        Returns:
            Parsed JSON dict from the response
        """
        result = await self.generate(prompt, system, format_json=True)
        response_text = result.get("response", "{}")

        # Try to parse the response as JSON
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from the response text
            # Sometimes the model might wrap JSON in markdown code blocks
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                return json.loads(json_match.group(1))

            # Try to find a JSON array or object in the text
            json_match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', response_text)
            if json_match:
                return json.loads(json_match.group(1))

            raise ValueError(f"Could not parse JSON from response: {response_text}")

    async def check_health(self) -> bool:
        """
        Check if Ollama service is healthy and model is available.

        Returns:
            True if healthy, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                # Check if Ollama is running
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code != 200:
                    return False

                # Check if our model is available
                data = response.json()
                models = data.get("models", [])
                model_names = [m.get("name", "") for m in models]

                # Check for exact match or match without tag
                model_base = self.model.split(":")[0]
                return any(
                    self.model in name or model_base in name
                    for name in model_names
                )
        except Exception:
            return False

    async def pull_model(self) -> bool:
        """
        Pull the configured model if not available.

        Returns:
            True if successful
        """
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                response = await client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": self.model, "stream": False},
                )
                return response.status_code == 200
        except Exception:
            return False


# Global client instance
ollama_client = OllamaClient()
