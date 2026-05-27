import asyncio
import json
import logging

import groq
from fastapi import APIRouter
from google.cloud import firestore
from pydantic import BaseModel

from config import settings
from db.firestore_client import COL_CYCLES, db, get_active_constraints, get_portfolio

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are Janus, an AI analyst embedded inside the Janus autonomous financial \
intelligence system. You ONLY answer questions about this specific system — \
its agents, cycles, portfolio, constraints, and scores. If asked anything \
unrelated to the Janus system (general knowledge, coding, other topics), \
respond with exactly: 'I only answer questions about the Janus system. Ask me \
about cycles, agents, portfolio performance, or constraints.' Do not elaborate.

You are Janus, an expert AI analyst embedded inside the Janus autonomous \
financial intelligence system. You have full knowledge of the system's \
current state and can answer questions about agent decisions, portfolio \
performance, constraints, and cycle history.

Current Portfolio State:
{portfolio_json}

Last 10 Decision Cycles (newest first):
{cycles_json}

Active Behavioral Constraints:
{constraints_json}

Answer questions concisely and precisely. Reference specific cycle numbers, \
scores, tickers, and constraint IDs when relevant. If asked about a specific \
cycle, reference the data above. Format numbers clearly. You are speaking \
to a technical judge evaluating this system."""


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


async def _get_last_10_cycles() -> list[dict]:
    def _query():
        docs = (
            db.collection(COL_CYCLES)
            .order_by("cycle_number", direction=firestore.Query.DESCENDING)
            .limit(10)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    return await asyncio.to_thread(_query)


async def _call_groq_with_history(messages: list[dict], model: str) -> str:
    import services.gemini_client as llm_client

    all_clients = llm_client.get_clients()
    last_error: Exception | None = None

    for key, client in all_clients:
        if key in llm_client._exhausted_keys:
            continue
        try:
            response = await client.chat.completions.create(
                model=model,
                max_tokens=500,
                temperature=0.7,
                messages=messages,
            )
            return response.choices[0].message.content
        except groq.RateLimitError as e:
            last_error = e
            continue
        except Exception:
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("All Groq keys exhausted")


@router.post("/chat")
async def chat(body: ChatRequest):
    try:
        portfolio, cycles, constraints = await asyncio.gather(
            get_portfolio(settings.FIRESTORE_PORTFOLIO_ID),
            _get_last_10_cycles(),
            get_active_constraints(),
        )

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            portfolio_json=json.dumps(portfolio, default=str, indent=2),
            cycles_json=json.dumps(cycles, default=str, indent=2),
            constraints_json=json.dumps(constraints, default=str, indent=2),
        )

        messages = (
            [{"role": "system", "content": system_prompt}]
            + list(body.history)
            + [{"role": "user", "content": body.message}]
        )

        reply = await _call_groq_with_history(messages, model=settings.GEMINI_MODEL_JUDGE)
        return {"response": reply}

    except Exception as exc:
        logger.error("Chat endpoint error: %s", exc, exc_info=True)
        return {"response": "I encountered an error fetching system data. Please try again."}
