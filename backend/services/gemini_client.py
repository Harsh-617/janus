# =============================================================================
# LLM CLIENT — ARCHITECTURE NOTE
# =============================================================================
# This system is architected for Gemini 2.0 Flash via Google Vertex AI.
# The intended production configuration:
#   - Fast agent calls: gemini-2.0-flash (Vertex AI)
#   - Judge calls: gemini-2.0-pro (Vertex AI)
#   - Deployment: Google Cloud Agent Engine (Vertex AI Agent Builder)
#
# During development, Groq (llama-3.1-8b-instant / llama-3.3-70b-versatile)
# is used as a drop-in replacement due to Vertex AI quota limitations on the
# development GCP account. The architecture is LLM-agnostic by design —
# swapping to Gemini requires only changing the API client and model strings
# in this file and config.py.
#
# To switch to Gemini when quota is available:
#   1. Set GEMINI_API_KEY in .env (Google AI Studio key)
#   2. Replace groq.AsyncGroq() with google.generativeai client
#   3. Update GEMINI_MODEL_FAST and GEMINI_MODEL_JUDGE in config.py
# =============================================================================

import groq
import logging
import itertools
from config import settings

_clients = None
_client_cycle = None

def get_clients():
    global _clients, _client_cycle
    if _clients is None:
        keys = [k.strip() for k in settings.GROQ_API_KEYS.split(",") if k.strip()]
        if not keys:
            keys = [settings.GROQ_API_KEY]
        _clients = [groq.AsyncGroq(api_key=k) for k in keys]
        _client_cycle = itertools.cycle(_clients)
        logging.info(f"[LLMClient] Initialized with {len(_clients)} Groq key(s)")
    return _client_cycle

async def generate(
    system_prompt: str,
    user_message: str,
    model: str = None,
    temperature: float = 0.7,
) -> str:
    client = next(get_clients())
    if model is None:
        model = settings.GEMINI_MODEL_FAST
    response = await client.chat.completions.create(
        model=model,
        max_tokens=2048,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content
