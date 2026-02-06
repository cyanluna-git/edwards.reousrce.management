"""
LLM Client Protocol

Abstract interface for all LLM providers (Groq, Gemini, PCAS).
Ensures consistent API across different AI backends.
"""

from typing import Optional, Protocol, runtime_checkable


@runtime_checkable
class LLMClient(Protocol):
    """
    Protocol defining the interface for LLM clients.

    All LLM providers must implement:
    - generate_json: Send prompt and get structured JSON response
    - health_check: Verify service availability
    """

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> dict:
        """
        Generate a JSON response from the LLM.

        Args:
            prompt: User prompt text
            system_prompt: Optional system instruction for context
            user_email: Optional user UPN (PCAS only; Groq/Gemini ignore)

        Returns:
            Parsed JSON dict from the LLM response
        """
        ...

    async def health_check(self) -> dict:
        """
        Check if the LLM service is accessible.

        Returns:
            Dict with at least: {available: bool, model: str}
            On error: {available: False, error: str}
        """
        ...
