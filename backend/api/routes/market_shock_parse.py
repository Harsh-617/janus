import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.gemini_client import generate

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a financial market analyst. Given a geopolitical or economic event, "
    "determine which of these tickers would be affected and by what percentage: "
    "AAPL, GLD, BTC-USD, TLT, KRE, XOM, AMZN, QQQ. "
    'Return ONLY valid JSON with no other text: {"TICKER": decimal} '
    "where decimal is between -0.50 and +0.50. "
    "Only include tickers with at least 2% impact. "
    'Example: {"GLD": 0.15, "AAPL": -0.12}'
)


class MarketShockParseRequest(BaseModel):
    event: str


async def _call_and_parse(event: str) -> dict:
    raw = await generate(
        system_prompt=SYSTEM_PROMPT,
        user_message=event,
        model=settings.GEMINI_MODEL_JUDGE,
        temperature=0.3,
    )
    return json.loads(raw.strip())


@router.post("/market-shock/parse")
async def parse_market_shock(body: MarketShockParseRequest):
    try:
        effects = await _call_and_parse(body.event)
    except (json.JSONDecodeError, ValueError):
        logger.warning("First parse attempt failed, retrying once")
        try:
            effects = await _call_and_parse(body.event)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("Second parse attempt failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to parse LLM response as JSON")

    return {"effects": effects, "interpreted_as": body.event}
