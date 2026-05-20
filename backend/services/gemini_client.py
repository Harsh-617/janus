import groq
import logging
from config import settings

_client = None

def get_client():
    global _client
    if _client is None:
        _client = groq.AsyncGroq(api_key=settings.GROQ_API_KEY)
        logging.info("[LLMClient] Initialized with Groq")
    return _client

async def generate(
    system_prompt: str,
    user_message: str,
    model: str = None,
    temperature: float = 0.7,
) -> str:
    client = get_client()
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
