import logging
import random
import requests

from config import settings

_FALLBACK_HEADLINES = [
    "Federal Reserve holds interest rates steady amid mixed economic signals",
    "Tech sector rallies as inflation data comes in below expectations",
    "Oil prices surge on geopolitical tensions in Middle East",
    "Gold hits new high as investors seek safe haven assets",
    "Banking sector under pressure as regional lenders report losses",
]


def get_market_news(tickers: list[str] = None, limit: int = 5) -> list[str]:
    """
    Fetches recent market news headlines from Alpha Vantage.
    Returns a list of headline strings.
    Falls back to hardcoded headlines if the API fails.
    """
    try:
        av_keys = settings.alpha_vantage_api_keys
        if not av_keys:
            logging.warning("[news] No Alpha Vantage API keys configured, using fallback")
            return _FALLBACK_HEADLINES
        api_key = random.choice(av_keys)
        params = {
            "function": "NEWS_SENTIMENT",
            "apikey": api_key,
            "limit": 10,
            "sort": "LATEST",
        }
        if tickers:
            params["tickers"] = ",".join(tickers)

        response = requests.get(
            "https://www.alphavantage.co/query",
            params=params,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if "Information" in data:
            logging.warning(f"[news] Alpha Vantage rate limit: {data['Information']}")
            return _FALLBACK_HEADLINES

        feed = data.get("feed")
        if not feed:
            logging.warning("[news] Alpha Vantage response has no 'feed' key")
            return _FALLBACK_HEADLINES

        return [article["title"] for article in feed[:limit]]

    except Exception as e:
        logging.warning(f"[news] Failed to fetch headlines: {e}")
        return _FALLBACK_HEADLINES
