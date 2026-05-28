from fastapi import APIRouter, HTTPException
from db.firestore_client import (
    get_portfolio, save_portfolio, get_cycles,
    save_portfolio_history_snapshot, get_portfolio_history_snapshots,
    BASELINE_PORTFOLIO_ID,
)
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


@router.post("/portfolio/reset-baseline")
async def reset_baseline_portfolio():
    """Reset janus_baseline to the same initial state as janus_main."""
    from datetime import datetime, timezone
    initial_capital = settings.INITIAL_CAPITAL
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
        "portfolio_id": BASELINE_PORTFOLIO_ID,
        "label": "Baseline (No Self-Correction)",
        "cash": cash,
        "initial_capital": initial_capital,
        "total_value": total_value,
        "pnl_pct": pnl_pct,
        "positions": positions,
        "trade_count": 0,
        "cycle_count": 0,
        "baseline_cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "reset_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(BASELINE_PORTFOLIO_ID, fresh)
    logging.info("[API] Baseline portfolio reset to initial state")
    return {"status": "reset", "portfolio": fresh}


@router.get("/portfolio/comparison")
async def get_portfolio_comparison():
    """Return side-by-side P&L comparison between janus_main and janus_baseline."""
    janus_doc = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    baseline_doc = await get_portfolio(BASELINE_PORTFOLIO_ID)

    if not janus_doc:
        raise HTTPException(status_code=404, detail="janus_main portfolio not found")
    if not baseline_doc:
        raise HTTPException(status_code=404, detail="janus_baseline portfolio not found")

    janus_history_raw = await get_portfolio_history_snapshots(settings.FIRESTORE_PORTFOLIO_ID, limit=100)
    baseline_history_raw = await get_portfolio_history_snapshots(BASELINE_PORTFOLIO_ID, limit=100)

    def _build_history(snapshots: list) -> list:
        return [
            {
                "cycle": s.get("cycle", 0),
                "total_value": s.get("total_value", 0.0),
                "pnl_pct": s.get("pnl_pct", 0.0),
            }
            for s in snapshots
        ]

    janus_initial = float(janus_doc.get("initial_capital", 1_000_000))
    baseline_initial = float(baseline_doc.get("initial_capital", 1_000_000))

    janus_total = float(janus_doc.get("total_value", janus_initial))
    baseline_total = float(baseline_doc.get("total_value", baseline_initial))

    janus_pnl = round(((janus_total - janus_initial) / janus_initial) * 100, 4)
    baseline_pnl = round(((baseline_total - baseline_initial) / baseline_initial) * 100, 4)
    divergence = round(janus_pnl - baseline_pnl, 4)

    return {
        "janus": {
            "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
            "label": janus_doc.get("label", "Janus (Self-Correcting)"),
            "initial_capital": janus_initial,
            "current_value": round(janus_total, 2),
            "pnl_pct": janus_pnl,
            "cycle_count": janus_doc.get("cycle_count", 0),
            "history": _build_history(janus_history_raw),
        },
        "baseline": {
            "portfolio_id": BASELINE_PORTFOLIO_ID,
            "label": baseline_doc.get("label", "Baseline (No Self-Correction)"),
            "initial_capital": baseline_initial,
            "current_value": round(baseline_total, 2),
            "pnl_pct": baseline_pnl,
            "cycle_count": baseline_doc.get("cycle_count", 0),
            "history": _build_history(baseline_history_raw),
        },
        "divergence_pct": divergence,
    }


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
