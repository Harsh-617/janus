"""Seed portfolios/janus_baseline to the same initial state as janus_main."""
import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db.firestore_client import save_portfolio, BASELINE_PORTFOLIO_ID

INITIAL_CAPITAL = 1_000_000.0
SEED_CASH = 245_000.0
SEED_POSITIONS = {
    "AAPL": {"shares": 1100, "avg_cost": 180.50, "current_price": 195.20, "sector": "Technology"},
    "GLD": {"shares": 430, "avg_cost": 220.00, "current_price": 235.10, "sector": "Commodities"},
    "BTC-USD": {"shares": 4.0, "avg_cost": 65000.00, "current_price": 72000.00, "sector": "Crypto"},
    "TLT": {"shares": 1100, "avg_cost": 95.00, "current_price": 92.50, "sector": "Bonds"},
    "XOM": {"shares": 425, "avg_cost": 110.00, "current_price": 118.30, "sector": "Energy"},
}


async def seed_baseline() -> dict:
    total_value = round(
        sum(p["shares"] * p["current_price"] for p in SEED_POSITIONS.values()) + SEED_CASH, 2
    )
    pnl_pct = round(((total_value - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100, 4)

    doc = {
        "portfolio_id": BASELINE_PORTFOLIO_ID,
        "label": "Baseline (No Self-Correction)",
        "cash": SEED_CASH,
        "initial_capital": INITIAL_CAPITAL,
        "total_value": total_value,
        "pnl_pct": pnl_pct,
        "positions": SEED_POSITIONS,
        "trade_count": 0,
        "cycle_count": 0,
        "baseline_cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(BASELINE_PORTFOLIO_ID, doc)
    print(
        f"[seed_baseline] Seeded portfolios/{BASELINE_PORTFOLIO_ID} — "
        f"total_value={total_value}, pnl_pct={pnl_pct}%"
    )
    return doc


if __name__ == "__main__":
    asyncio.run(seed_baseline())
