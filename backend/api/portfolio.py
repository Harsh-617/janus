from fastapi import APIRouter, HTTPException
from db.firestore_client import get_portfolio, save_portfolio, get_cycles
from config import settings
import logging

router = APIRouter()

@router.get("/portfolio")
async def get_portfolio_state():
    """Get current portfolio state."""
    portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio

@router.get("/portfolio/history")
async def get_portfolio_history():
    """Get portfolio value history across recent cycles for charting."""
    cycles = await get_cycles(limit=50)
    history = []
    for cycle in cycles:
        if "total_portfolio_value" not in cycle:
            continue
        history.append({
            "cycle": cycle.get("cycle_number", cycle.get("cycle_id")),
            "total_value": cycle["total_portfolio_value"],
            "pnl_pct": cycle.get("pnl_pct"),
            "timestamp": cycle.get("timestamp"),
        })
    history.sort(key=lambda x: x["timestamp"] if x["timestamp"] else "")
    return {"history": history}


@router.post("/portfolio/reset")
async def reset_portfolio():
    """Reset portfolio to initial state (demo utility)."""
    from datetime import datetime, timezone
    fresh = {
        "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
        "cash": 245000.0,
        "total_value": 1087500.0,
        "pnl_pct": 0.0,
        "positions": {
            "AAPL": {"shares": 100, "avg_cost": 180.50, "current_price": 195.20, "sector": "Technology"},
            "GLD": {"shares": 50, "avg_cost": 220.00, "current_price": 235.10, "sector": "Commodities"},
            "BTC-USD": {"shares": 0.5, "avg_cost": 65000.00, "current_price": 72000.00, "sector": "Crypto"},
            "TLT": {"shares": 200, "avg_cost": 95.00, "current_price": 92.50, "sector": "Bonds"},
            "XOM": {"shares": 75, "avg_cost": 110.00, "current_price": 118.30, "sector": "Energy"}
        },
        "trade_count": 0,
        "cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "reset_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, fresh)
    logging.info("[API] Portfolio reset to initial state")
    return {"status": "reset", "portfolio": fresh}
