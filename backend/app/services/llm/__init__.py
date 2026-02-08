"""
LLM abstraction layer.

Provides a unified interface for multiple AI providers:
- Groq (Llama 70B - fast inference)
- Gemini (Google Gemini 2.0 Flash)
- PCAS (Atlas Copco AI Brains Bot - GPT-5)
"""

from app.services.llm.base import LLMClient
from app.services.llm.factory import get_llm_client

__all__ = ["LLMClient", "get_llm_client"]
