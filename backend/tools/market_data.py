import logging

import numpy as np
import pandas as pd
import yfinance as yf

from config import settings
from data.demo_market_data import (
    DEMO_PRICES,
    OIL_SHOCK_PRICES,
    DEMO_VOLATILITY,
    OIL_SHOCK_VOLATILITY,
)

logger = logging.getLogger(__name__)

_demo_shock_active: bool = False


def set_demo_shock(active: bool) -> None:
    global _demo_shock_active
    _demo_shock_active = active


def is_demo_shock_active() -> bool:
    return _demo_shock_active

_DEFAULT_TICKERS = ["AAPL", "GLD", "BTC-USD", "TLT", "XOM", "KRE", "AMZN", "ETH-USD"]

_FALLBACK_PRICES = {
    "AAPL": 195.20,
    "GLD": 235.10,
    "BTC-USD": 72000.0,
    "TLT": 95.50,
    "XOM": 112.30,
    "KRE": 45.20,
    "AMZN": 185.40,
    "ETH-USD": 3800.0,
}


def get_market_volatility() -> str:
    """Returns current volatility label. In DEMO_MODE, returns pre-canned value."""
    if settings.DEMO_MODE:
        return OIL_SHOCK_VOLATILITY if _demo_shock_active else DEMO_VOLATILITY
    return "MODERATE"


def get_live_market_data(tickers: list[str] = None) -> dict:
    """
    Fetches current market prices for a list of tickers using yfinance.
    Returns a dict of { ticker: price } for all tickers that returned valid data.
    Falls back to last known price if yfinance fails for a ticker.
    """
    if settings.DEMO_MODE:
        return OIL_SHOCK_PRICES.copy() if _demo_shock_active else DEMO_PRICES.copy()

    if tickers is None:
        tickers = _DEFAULT_TICKERS

    try:
        data = yf.download(tickers, period="1d", interval="1m", progress=False)

        if data.empty:
            logger.warning("[MarketData] yfinance returned empty data — using fallback prices")
            return _FALLBACK_PRICES.copy()

        prices = {}

        if isinstance(data.columns, pd.MultiIndex):
            close_df = data["Close"]
            for ticker in tickers:
                try:
                    if ticker not in close_df.columns:
                        logger.warning(f"[MarketData] {ticker} not in response — skipping")
                        continue
                    series = close_df[ticker].dropna()
                    if series.empty:
                        logger.warning(f"[MarketData] {ticker} has no valid rows — skipping")
                        continue
                    val = float(series.iloc[-1])
                    if np.isnan(val):
                        logger.warning(f"[MarketData] {ticker} returned NaN — skipping")
                        continue
                    prices[ticker] = round(val, 2)
                except Exception as e:
                    logger.warning(f"[MarketData] Failed to extract price for {ticker}: {e}")
        else:
            ticker = tickers[0]
            try:
                series = data["Close"].dropna()
                if not series.empty:
                    val = float(series.iloc[-1])
                    if not np.isnan(val):
                        prices[ticker] = round(val, 2)
                    else:
                        logger.warning(f"[MarketData] {ticker} returned NaN — skipping")
            except Exception as e:
                logger.warning(f"[MarketData] Failed to extract price for {ticker}: {e}")

        return prices

    except Exception as e:
        logger.warning(f"[MarketData] yfinance completely failed: {e} — using fallback prices")
        return _FALLBACK_PRICES.copy()


def get_price(ticker: str) -> float | None:
    """Fetch a single ticker price. Returns None if unavailable."""
    result = get_live_market_data([ticker])
    return result.get(ticker)
