from db.firestore_client import get_trades
import logging


async def get_trade_summary(limit: int = 100) -> dict:
    """Summarize recent trade history for fraud detection and reporting.

    Returns: {
        recent_trades: list,
        ticker_frequency: dict,  # how often each ticker traded
        buy_sell_ratio: float,   # BUY count / SELL count
        avg_confidence: float,
    }
    """
    trades = await get_trades(limit=limit)

    if not trades:
        return {
            "recent_trades": [],
            "ticker_frequency": {},
            "buy_sell_ratio": 1.0,
            "avg_confidence": 0.0,
        }

    ticker_freq = {}
    buy_count = 0
    sell_count = 0
    confidence_sum = 0

    for trade in trades:
        ticker = trade.get("ticker", "UNKNOWN")
        ticker_freq[ticker] = ticker_freq.get(ticker, 0) + 1

        if trade.get("direction") == "BUY":
            buy_count += 1
        elif trade.get("direction") == "SELL":
            sell_count += 1

        confidence_sum += float(trade.get("confidence", 0))

    return {
        "recent_trades": trades,
        "ticker_frequency": ticker_freq,
        "buy_sell_ratio": buy_count / max(sell_count, 1),
        "avg_confidence": round(confidence_sum / len(trades), 3),
    }
