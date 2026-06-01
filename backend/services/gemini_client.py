import asyncio
import logging
from google import genai
from google.genai import types
from config import settings

_clients: list[tuple[str, genai.Client]] = []
_exhausted_keys: set[str] = set()

def get_clients() -> list[tuple[str, genai.Client]]:
    global _clients
    if not _clients:
        keys = [
            k for k in [
                settings.GEMINI_API_KEY_1,
                settings.GEMINI_API_KEY_2,
                settings.GEMINI_API_KEY_3,
                settings.GEMINI_API_KEY_4,
                settings.GEMINI_API_KEY_5,
            ] if k and k.strip()
        ]
        if not keys:
            raise RuntimeError("No Gemini API keys configured")
        _clients = [(k, genai.Client(api_key=k)) for k in keys]
        logging.info(f"[LLMClient] Initialized with {len(_clients)} Gemini key(s)")
    return _clients

async def generate(
    system_prompt: str,
    user_message: str,
    model: str = None,
    temperature: float = 0.7,
) -> str:
    clients = get_clients()
    if model is None:
        model = settings.GEMINI_MODEL_FAST

    last_error = None
    available = [(k, c) for k, c in clients if k not in _exhausted_keys]

    for key, client in available:
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=8192,
                ),
            )
            return response.text

        except Exception as e:
            err_str = str(e).lower()
            last_error = e

            if "quota" in err_str or "429" in err_str or "rate" in err_str or "exhausted" in err_str:
                logging.warning(f"[LLMClient] Key rate-limited, trying next: {e}")
                _exhausted_keys.add(key)
                continue
            elif "503" in err_str or "unavailable" in err_str:
                logging.warning(f"[LLMClient] Gemini 503 — retrying in 5s: {e}")
                await asyncio.sleep(5)
                continue
            else:
                logging.error(f"[LLMClient] Gemini error: {e}")
                raise

    raise last_error or RuntimeError("All Gemini keys exhausted")
