import asyncio
import logging
from google import genai
from google.genai import types
from config import settings

# Models in priority order (highest RPD first)
MODELS_PRIORITY = [
    "gemini-3.1-flash-lite",   # 500 RPD, 15 RPM
    "gemini-2.5-flash-lite",   # 20 RPD, 10 RPM
    "gemini-3.5-flash",        # 20 RPD, 5 RPM
    "gemini-3-flash",          # 20 RPD, 5 RPM
    "gemini-2.5-flash",        # 20 RPD, 5 RPM
]

# Tracks exhausted (model, key) pairs for the session
_exhausted: set[tuple[str, str]] = set()
_clients: dict[str, genai.Client] = {}

def get_client(api_key: str) -> genai.Client:
    if api_key not in _clients:
        _clients[api_key] = genai.Client(api_key=api_key)
    return _clients[api_key]

def get_keys() -> list[str]:
    keys = [
        k for k in [
            settings.GEMINI_API_KEY_1,
            settings.GEMINI_API_KEY_2,
            settings.GEMINI_API_KEY_3,
            settings.GEMINI_API_KEY_4,
            settings.GEMINI_API_KEY_5,
            settings.GEMINI_API_KEY_6,
            settings.GEMINI_API_KEY_7,
            settings.GEMINI_API_KEY_8,
            settings.GEMINI_API_KEY_9,
            settings.GEMINI_API_KEY_10,
        ] if k and k.strip()
    ]
    if not keys:
        raise RuntimeError("No Gemini API keys configured")
    return keys

async def generate(
    system_prompt: str,
    user_message: str,
    model: str = None,
    temperature: float = 0.7,
) -> str:
    keys = get_keys()
    last_error = None

    for key in keys:
        for m in MODELS_PRIORITY:
            if (m, key) in _exhausted:
                continue
            try:
                client = get_client(key)
                logging.info(f"[LLMClient] Trying {m} with key ...{key[-6:]}")
                response = await client.aio.models.generate_content(
                    model=m,
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

                if "quota" in err_str or "429" in err_str or "exhausted" in err_str or "per day" in err_str:
                    logging.warning(f"[LLMClient] {m} key ...{key[-6:]} exhausted — skipping")
                    _exhausted.add((m, key))
                    continue
                elif "503" in err_str or "unavailable" in err_str:
                    logging.warning(f"[LLMClient] {m} 503 — retrying in 5s")
                    await asyncio.sleep(5)
                    continue
                else:
                    logging.error(f"[LLMClient] {m} error: {e}")
                    raise

    raise last_error or RuntimeError("All Gemini models and keys exhausted")
