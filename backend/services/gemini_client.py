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
import asyncio
from config import settings

_clients: list[tuple[str, groq.AsyncGroq]] | None = None
_current_index: int = 0
_exhausted_keys: set[str] = set()
_lock = asyncio.Lock()


def get_clients() -> list[tuple[str, groq.AsyncGroq]]:
    global _clients
    if _clients is None:
        keys = settings.groq_api_keys
        if not keys:
            raise ValueError("No Groq API keys configured")
        _clients = [(k, groq.AsyncGroq(api_key=k)) for k in keys]
        logging.info(f"[LLMClient] Initialized with {len(_clients)} Groq key(s)")
    return _clients


async def generate(
    system_prompt: str,
    user_message: str,
    model: str = None,
    temperature: float = 0.7,
) -> str:
    global _current_index
    if model is None:
        model = settings.GEMINI_MODEL_FAST

    all_clients = get_clients()
    last_error: Exception | None = None

    while True:
        async with _lock:
            available = [
                (i, k, c)
                for i, (k, c) in enumerate(all_clients)
                if k not in _exhausted_keys
            ]
            if not available:
                msg = "All Groq keys exhausted for today — waiting for reset"
                logging.warning(f"[LLMClient] {msg}")
                if last_error is not None:
                    raise last_error
                raise RuntimeError(msg)

            pos = _current_index % len(available)
            orig_idx, key, client = available[pos]

        try:
            response = await client.chat.completions.create(
                model=model,
                max_tokens=2048,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            async with _lock:
                _current_index = pos + 1
            return response.choices[0].message.content
        except groq.RateLimitError as e:
            last_error = e
            err_msg = str(e).lower()
            if "per day" in err_msg or "tokens per day" in err_msg or "tpd" in err_msg:
                async with _lock:
                    logging.warning(
                        f"[LLMClient] Key {orig_idx} marked as daily-exhausted — removing from pool"
                    )
                    _exhausted_keys.add(key)
            elif "per minute" in err_msg or "tpm" in err_msg:
                await asyncio.sleep(60)
                async with _lock:
                    _current_index = pos + 1
            else:
                raise
