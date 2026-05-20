from fastapi import APIRouter, HTTPException
from db.firestore_client import get_portfolio, save_portfolio
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

@router.post("/portfolio/reset")
async def reset_portfolio():
    """Reset portfolio to initial state (demo utility)."""
    from datetime import datetime, timezone
    fresh = {
        "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
        "cash": settings.INITIAL_CAPITAL,
        "total_value": settings.INITIAL_CAPITAL,
        "pnl_pct": 0.0,
        "positions": {},
        "trade_count": 0,
        "cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "reset_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, fresh)
    logging.info("[API] Portfolio reset to initial state")
    return {"status": "reset", "portfolio": fresh}
