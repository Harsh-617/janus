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
