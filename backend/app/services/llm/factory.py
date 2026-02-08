"""
LLM Client Factory

Returns the appropriate LLM client based on AI_PROVIDER configuration.
Supports: groq, gemini, pcas
"""

from typing import Optional

from app.core.config import settings
from app.services.llm.base import LLMClient


def get_llm_client(provider: Optional[str] = None) -> LLMClient:
    """
    Get an LLM client instance based on the provider name.

    Args:
        provider: Provider name ("groq", "gemini", "pcas").
                  Defaults to settings.AI_PROVIDER.

    Returns:
        LLMClient instance (singleton)
    """
    provider = provider or settings.AI_PROVIDER

    if provider == "pcas":
        from app.services.llm.pcas_client import pcas_client

        return pcas_client
    elif provider == "gemini":
        from app.services.gemini_client import gemini_client

        return gemini_client
    else:
        # Default to Groq
        from app.services.groq_client import groq_client

        return groq_client
