import logging
import requests

from config import settings

_FALLBACK_HEADLINES = [
    "Federal Reserve holds interest rates steady amid mixed economic signals",
    "Tech sector rallies as inflation data comes in below expectations",
    "Oil prices surge on geopolitical tensions in Middle East",
    "Gold hits new high as investors seek safe haven assets",
    "Banking sector under pressure as regional lenders report losses",
]

_exhausted_av_keys: set[str] = set()


def get_market_news(tickers: list[str] = None, limit: int = 5) -> list[str]:
    """
    Fetches recent market news headlines from Alpha Vantage.
    Returns a list of headline strings.
    Falls back to hardcoded headlines if the API fails.
    """
    all_keys = settings.alpha_vantage_api_keys
    available_keys = [k for k in all_keys if k not in _exhausted_av_keys]

    if not available_keys:
        logging.warning("[news] No Alpha Vantage API keys available (all exhausted or none configured), using fallback")
        return _FALLBACK_HEADLINES

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

            response = requests.get(
                "https://www.alphavantage.co/query",
                params=params,
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            if "Information" in data:
                _exhausted_av_keys.add(api_key)
                logging.warning("[news] Alpha Vantage key exhausted, removing from pool")
                continue

            if "feed" in data:
                return [article["title"] for article in data["feed"][:limit]]

            continue

        except Exception as e:
            logging.warning(f"[news] Alpha Vantage key error: {e}")
            continue

    logging.warning("[news] All Alpha Vantage keys failed or exhausted, using fallback")
    return _FALLBACK_HEADLINES
