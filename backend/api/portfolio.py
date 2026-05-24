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
    initial_capital = settings.INITIAL_CAPITAL  # 1_000_000.0
    cash = 245000.0
    positions = {
        "AAPL": {"shares": 1100, "avg_cost": 180.50, "current_price": 195.20, "sector": "Technology"},
        "GLD": {"shares": 430, "avg_cost": 220.00, "current_price": 235.10, "sector": "Commodities"},
        "BTC-USD": {"shares": 4.0, "avg_cost": 65000.00, "current_price": 72000.00, "sector": "Crypto"},
        "TLT": {"shares": 1100, "avg_cost": 95.00, "current_price": 92.50, "sector": "Bonds"},
        "XOM": {"shares": 425, "avg_cost": 110.00, "current_price": 118.30, "sector": "Energy"},
    }
    total_value = round(
        sum(p["shares"] * p["current_price"] for p in positions.values()) + cash, 2
    )
    pnl_pct = round(((total_value - initial_capital) / initial_capital) * 100, 4)

    fresh = {
        "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
        "cash": cash,
        "initial_capital": initial_capital,
        "total_value": total_value,
        "pnl_pct": pnl_pct,
        "positions": positions,
        "trade_count": 0,
        "cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "reset_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, fresh)
    logging.info("[API] Portfolio reset to initial state")
    return {"status": "reset", "portfolio": fresh}


@router.get("/portfolio/debug")
async def debug_portfolio():
    """Return raw Firestore portfolio document for debugging P&L issues."""
    portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    positions = portfolio.get("positions", {})
    calculated_position_value = sum(
        float(p.get("shares", 0)) * float(p.get("current_price", 0))
        for p in positions.values()
    )
    calculated_total = calculated_position_value + float(portfolio.get("cash", 0))
    stored_initial_capital = portfolio.get("initial_capital")

    return {
        "raw": portfolio,
        "diagnosis": {
            "initial_capital_present": stored_initial_capital is not None,
            "initial_capital_value": stored_initial_capital if stored_initial_capital is not None else "MISSING — defaulting to 1_000_000 in calculations",
            "stored_total_value": portfolio.get("total_value"),
            "calculated_total_value": round(calculated_total, 2),
            "stored_pnl_pct": portfolio.get("pnl_pct"),
            "action": "Call POST /api/portfolio/reset to fix Firestore data" if stored_initial_capital is None else "OK",
        },
    }
