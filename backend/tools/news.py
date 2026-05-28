import asyncio
import logging
import requests
from datetime import datetime, timedelta

from config import settings
from data.demo_market_data import DEMO_NEWS, OIL_SHOCK_NEWS

FALLBACK_HEADLINES = [
    "Federal Reserve signals cautious approach to rate adjustments amid mixed economic data",
    "Gold prices rise as investors seek safe-haven assets amid global uncertainty",
    "Technology sector faces headwinds from rising bond yields and valuation concerns",
    "Energy stocks outperform as crude oil supply constraints persist",
    "Dollar strengthens against major currencies following strong jobs report",
    "Emerging market equities under pressure from capital outflows",
    "Corporate earnings season shows mixed results across sectors",
    "Inflation data comes in above expectations, markets reprice rate path",
    "Banking sector cautious amid tightening credit conditions and rising defaults",
    "Commodity markets volatile as supply chain disruptions continue",
]

_exhausted_av_keys: set[str] = set()
_all_keys_exhausted: bool = False
_exhaustion_reset_time: datetime | None = None


async def get_market_news(tickers: list[str] = None, limit: int = 5) -> list[str]:
    """
    Fetches recent market news headlines from Alpha Vantage.
    Returns a list of headline strings.
    Falls back to FALLBACK_HEADLINES if the API fails or all keys are exhausted.
    """
    if settings.DEMO_MODE:
        from tools.market_data import is_demo_shock_active
        news = OIL_SHOCK_NEWS if is_demo_shock_active() else DEMO_NEWS
        return [item["title"] for item in news]

    global _all_keys_exhausted, _exhaustion_reset_time

    now = datetime.utcnow()

    if _all_keys_exhausted:
        if now < _exhaustion_reset_time:
            logging.info("[news] All keys exhausted — serving fallback headlines (cooldown active)")
            return FALLBACK_HEADLINES
        else:
            logging.info("[news] Key exhaustion cooldown expired — retrying API")
            _all_keys_exhausted = False
            _exhaustion_reset_time = None

    all_keys = settings.alpha_vantage_api_keys
    available_keys = [k for k in all_keys if k not in _exhausted_av_keys]

    if not available_keys:
        logging.warning("[news] No Alpha Vantage API keys available (all exhausted or none configured), using fallback")
        _all_keys_exhausted = True
        _exhaustion_reset_time = datetime.utcnow() + timedelta(hours=12)
        return FALLBACK_HEADLINES

    keys_failed_this_call: set[str] = set()

    for api_key in available_keys:
        try:
            params = {
                "function": "NEWS_SENTIMENT",
                "apikey": api_key,
                "limit": 10,
                "sort": "LATEST",
            }
            if tickers:
                params["tickers"] = ",".join(tickers)

            response = await asyncio.to_thread(
                requests.get,
                "https://www.alphavantage.co/query",
                params=params,
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            if "Information" in data:
                _exhausted_av_keys.add(api_key)
                keys_failed_this_call.add(api_key)
                logging.warning("[news] Alpha Vantage key exhausted (daily limit), removing from pool")
                continue

            if "feed" in data:
                headlines = [article["title"] for article in data["feed"][:limit]]
                if headlines:
                    return headlines

            continue

        except Exception as e:
            logging.warning(f"[news] Alpha Vantage key error: {e}")
            keys_failed_this_call.add(api_key)
            continue

    if len(keys_failed_this_call) >= len(available_keys):
        _all_keys_exhausted = True
        _exhaustion_reset_time = datetime.utcnow() + timedelta(hours=12)
        logging.warning(
            "[news] All Alpha Vantage keys exhausted. Using fallback headlines for next 12 hours."
        )

    return FALLBACK_HEADLINES
