import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from config import settings
from graph.janus_graph import run_decision_cycle
from graph.execution import execute_cycle_results
from db.firestore_client import get_portfolio, get_active_constraints
from tools.market_data import get_live_market_data

# Global event queue — SSE clients subscribe to this
_event_queue: asyncio.Queue = asyncio.Queue(maxsize=500)

# Global state
_scheduler_running: bool = False
_current_cycle_number: int = 0
_market_shock: dict = {"active": False, "description": "", "effects": {}}

async def broadcast_event(event_type: str, data: dict) -> None:
    """Put an event on the queue for all SSE subscribers."""
    event = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _event_queue.put_nowait(event)
    except asyncio.QueueFull:
        # Drop oldest event to make room
        try:
            _event_queue.get_nowait()
            _event_queue.put_nowait(event)
        except Exception:
            pass

# LEGACY: replaced by get_live_market_data()
async def get_mock_market_data() -> tuple[dict, list]:
    """
    Returns mock market prices and news headlines.
    In production this calls yfinance and Alpha Vantage.
    For now returns realistic static data with market shock effects applied.
    """
    base_prices = {
        "AAPL": 195.20,
        "GLD": 235.10,
        "BTC-USD": 72000.0,
        "TLT": 92.50,
        "XOM": 118.30,
        "AMZN": 185.40,
        "KRE": 44.20,
    }

    # Apply market shock price effects if active
    if _market_shock["active"]:
        effects = _market_shock.get("effects", {})
        for ticker, pct_change in effects.items():
            if ticker in base_prices:
                base_prices[ticker] = round(base_prices[ticker] * (1 + pct_change), 2)

    base_headlines = [
        "Federal Reserve holds rates steady amid mixed economic signals",
        "Tech sector rallies on strong earnings reports",
        "Gold prices rise as dollar weakens",
        "Energy stocks outperform as oil demand forecasts improve",
        "Bond yields stabilize after recent volatility",
    ]

    if _market_shock["active"] and _market_shock.get("description"):
        base_headlines.insert(0, f"BREAKING: {_market_shock['description']}")

    return base_prices, base_headlines

async def run_single_cycle() -> dict:
    """Run one complete decision cycle and return the summary."""
    global _current_cycle_number
    _current_cycle_number += 1

    cycle_id = f"cycle_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{str(uuid.uuid4())[:8]}"

    await broadcast_event("cycle_start", {
        "cycle_id": cycle_id,
        "cycle_number": _current_cycle_number,
        "message": f"Starting decision cycle #{_current_cycle_number}",
    })

    try:
        portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
        if not portfolio:
            raise ValueError("Portfolio not found")

        market_prices = await asyncio.to_thread(get_live_market_data)
        if _market_shock["active"]:
            for ticker, pct_change in _market_shock.get("effects", {}).items():
                if ticker in market_prices:
                    market_prices[ticker] = round(market_prices[ticker] * (1 + pct_change), 2)
        news_headlines = [
            "Federal Reserve holds rates steady amid mixed economic signals",
            "Tech sector rallies on strong earnings reports",
            "Gold prices rise as dollar weakens",
            "Energy stocks outperform as oil demand forecasts improve",
            "Bond yields stabilize after recent volatility",
        ]
        if _market_shock["active"] and _market_shock.get("description"):
            news_headlines.insert(0, f"BREAKING: {_market_shock['description']}")
        active_constraints = await get_active_constraints()
        constraint_rules = [c.get("rule", "") for c in active_constraints if c.get("rule")]

        # Broadcast agent start events
        for agent in ["trading_agent", "risk_agent", "fraud_agent",
                      "regulator_agent", "judge_agent"]:
            await broadcast_event("agent_thinking", {
                "agent": agent,
                "cycle_id": cycle_id,
            })

        # Run the full LangGraph pipeline
        final_state = await run_decision_cycle(
            cycle_id=cycle_id,
            cycle_number=_current_cycle_number,
            portfolio=portfolio,
            market_prices=market_prices,
            news_headlines=news_headlines,
            active_constraints=constraint_rules,
            market_shock_active=_market_shock["active"],
            market_shock_description=_market_shock.get("description", ""),
        )

        # Persist results
        summary = await execute_cycle_results(final_state)

        # Trigger Janus Loop on schedule
        from agents.meta_agent import maybe_run_janus_loop
        await maybe_run_janus_loop(_current_cycle_number)

        # Broadcast cycle complete
        await broadcast_event("cycle_complete", summary)

        # Broadcast circuit breaker if activated
        if summary.get("circuit_breaker"):
            await broadcast_event("circuit_breaker_activated", {
                "cycle_id": cycle_id,
                "reason": final_state.get("regulator_decision", {}).get("reason", ""),
                "cooldown_minutes": final_state.get("regulator_decision", {}).get("cooldown_minutes", 15),
            })

        return summary

    except Exception as e:
        logging.error(f"[Scheduler] Cycle {cycle_id} failed: {e}")
        await broadcast_event("cycle_error", {
            "cycle_id": cycle_id,
            "error": str(e),
        })
        return {"cycle_id": cycle_id, "error": str(e)}

async def start_scheduler() -> None:
    """Start the cycle scheduler loop."""
    global _scheduler_running
    if _scheduler_running:
        logging.warning("[Scheduler] Already running")
        return

    _scheduler_running = True
    logging.info(f"[Scheduler] Starting — interval: {settings.AGENT_CYCLE_INTERVAL_SECONDS}s")

    while _scheduler_running:
        try:
            await run_single_cycle()
        except Exception as e:
            logging.error(f"[Scheduler] Unhandled error: {e}")

        await asyncio.sleep(settings.AGENT_CYCLE_INTERVAL_SECONDS)

def stop_scheduler() -> None:
    global _scheduler_running
    _scheduler_running = False
    logging.info("[Scheduler] Stopped")

def set_market_shock(active: bool, description: str = "", effects: dict = {}) -> None:
    global _market_shock
    _market_shock = {"active": active, "description": description, "effects": effects}
    logging.info(f"[Scheduler] Market shock set: active={active}, description={description}")

def get_scheduler_status() -> dict:
    return {
        "running": _scheduler_running,
        "current_cycle_number": _current_cycle_number,
        "market_shock_active": _market_shock["active"],
        "market_shock_description": _market_shock.get("description", ""),
    }
