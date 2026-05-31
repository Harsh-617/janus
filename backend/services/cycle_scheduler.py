import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator

from google.cloud import firestore as _firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from config import settings
from graph.janus_graph import run_decision_cycle, run_baseline_decision_cycle
from graph.execution import execute_cycle_results, execute_baseline_cycle_results
from db.firestore_client import (
    get_portfolio, get_active_constraints, db, COL_CONSTRAINTS, COL_PORTFOLIOS,
    save_portfolio_history_snapshot, BASELINE_PORTFOLIO_ID,
)
from tools.market_data import get_live_market_data
from tools.news import get_market_news

# Per-client subscriber queues — one Queue per connected SSE client
_subscribers: list[asyncio.Queue] = []

# Global state
_scheduler_running: bool = False
_current_cycle_number: int = 0
_market_shock: dict = {"active": False, "description": "", "effects": {}}
_next_cycle_time = None


def subscribe() -> asyncio.Queue:
    """Create a new subscriber queue and register it for broadcasts."""
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a subscriber queue (called on SSE client disconnect)."""
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


async def broadcast_event(event_type: str, data: dict) -> None:
    """Broadcast an event to all connected SSE subscribers."""
    event = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    for q in list(_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            # Drop oldest event to make room
            try:
                q.get_nowait()
                q.put_nowait(event)
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

async def _update_safety_deltas(constraints: list, current_safety: float) -> None:
    """Update running average safety score for active constraints after each cycle."""
    def _update():
        for c in constraints:
            cid = c.get("constraint_id")
            if not cid:
                continue
            perf = c.get("performance_delta") or {}
            # cycles_active is the pre-increment value; post-increment is +1
            cycles_active = (perf.get("cycles_active") or 0) + 1
            if cycles_active < 2:
                continue
            old_avg = perf.get("safety_after")
            if old_avg is None:
                new_avg = current_safety
            else:
                new_avg = (old_avg * (cycles_active - 1) + current_safety) / cycles_active
            db.collection(COL_CONSTRAINTS).document(cid).update({
                "performance_delta.safety_after": round(new_avg, 3)
            })
    await asyncio.to_thread(_update)


async def _increment_and_expire_constraints() -> None:
    """Increment cycles_active on each active constraint; auto-expire when limit is reached."""
    def _update():
        docs = db.collection(COL_CONSTRAINTS).where(
            filter=FieldFilter("status", "==", "ACTIVE")
        ).stream()
        for doc in docs:
            data = doc.to_dict() or {}
            if not data.get("target_agent"):
                continue
            cycles_active = (data.get("performance_delta") or {}).get("cycles_active", 0) or 0
            expires_after = data.get("expires_after_cycles")
            new_cycles_active = cycles_active + 1
            updates = {"performance_delta.cycles_active": _firestore.Increment(1)}
            if expires_after is not None and new_cycles_active >= expires_after:
                updates["status"] = "EXPIRED"
            doc.reference.update(updates)

    await asyncio.to_thread(_update)


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
        # LEGACY: replaced by get_market_news()
        # "Federal Reserve holds rates steady amid mixed economic signals",
        # "Tech sector rallies on strong earnings reports",
        # "Gold prices rise as dollar weakens",
        # "Energy stocks outperform as oil demand forecasts improve",
        # "Bond yields stabilize after recent volatility",
        news_headlines = await get_market_news(tickers=list(market_prices.keys()))
        if _market_shock["active"] and _market_shock.get("description"):
            news_headlines.insert(0, f"BREAKING: {_market_shock['description']}")
        active_constraints = await get_active_constraints()
        constraint_rules = [c.get("rule", "") for c in active_constraints if c.get("rule")]
        await _increment_and_expire_constraints()

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

        # Write janus_main history snapshot for this cycle
        main_portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
        if main_portfolio:
            initial_capital = float(main_portfolio.get("initial_capital", 1_000_000))
            total_value = float(main_portfolio.get("total_value", initial_capital))
            pnl_pct = round(((total_value - initial_capital) / initial_capital) * 100, 4)
            await save_portfolio_history_snapshot(
                settings.FIRESTORE_PORTFOLIO_ID,
                _current_cycle_number,
                {
                    "cycle": _current_cycle_number,
                    "total_value": round(total_value, 2),
                    "pnl_pct": pnl_pct,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

        # Run baseline cycle sequentially with same market data (no constraints, no Janus Loop, no judge)
        baseline_portfolio = await get_portfolio(BASELINE_PORTFOLIO_ID)
        if baseline_portfolio:
            try:
                baseline_cycle_id = f"baseline_{cycle_id}"
                baseline_state = await run_baseline_decision_cycle(
                    cycle_id=baseline_cycle_id,
                    cycle_number=_current_cycle_number,
                    portfolio=baseline_portfolio,
                    market_prices=market_prices,
                    news_headlines=news_headlines,
                )
                baseline_summary = await execute_baseline_cycle_results(baseline_state, _current_cycle_number)
                await broadcast_event("cycle_complete", {**baseline_summary, "is_baseline": True})
            except Exception as e:
                logging.error(f"[Scheduler] Baseline cycle failed (non-fatal): {e}")

        # Update safety delta running averages for active constraints.
        # summary only contains "judge_score" (overall); safety sub-score must come from final_state.
        _js = final_state.get("judge_scores", {})
        if isinstance(_js, list):
            _js = _js[-1] if _js else {}
        current_safety = _js.get("safety") if isinstance(_js, dict) else None
        if isinstance(current_safety, (int, float)) and active_constraints:
            await _update_safety_deltas(active_constraints, float(current_safety))

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
            portfolio_doc = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
            if portfolio_doc and portfolio_doc.get("circuit_breaker_active"):
                resume_at_str = portfolio_doc.get("circuit_breaker_resume_at")
                now_utc = datetime.now(timezone.utc)
                released = False
                if resume_at_str:
                    resume_at = datetime.fromisoformat(resume_at_str)
                    if now_utc >= resume_at:
                        def _clear():
                            db.collection(COL_PORTFOLIOS).document(
                                settings.FIRESTORE_PORTFOLIO_ID
                            ).update({"circuit_breaker_active": False})
                        await asyncio.to_thread(_clear)
                        logging.info("[Scheduler] Circuit breaker auto-released — resuming cycles")
                        released = True
                if not released:
                    logging.info("[Scheduler] Circuit breaker active — cycle skipped")
                    await asyncio.sleep(30)
                    continue

            await run_single_cycle()
        except Exception as e:
            logging.error(f"[Scheduler] Unhandled error: {e}")

        global _next_cycle_time
        _next_cycle_time = datetime.now(timezone.utc) + timedelta(seconds=settings.AGENT_CYCLE_INTERVAL_SECONDS)
        await asyncio.sleep(settings.AGENT_CYCLE_INTERVAL_SECONDS)

def stop_scheduler() -> None:
    global _scheduler_running
    _scheduler_running = False
    logging.info("[Scheduler] Stopped")

def set_market_shock(active: bool, description: str = "", effects: dict = {}) -> None:
    global _market_shock
    _market_shock = {"active": active, "description": description, "effects": effects}
    logging.info(f"[Scheduler] Market shock set: active={active}, description={description}")

def seconds_until_next_cycle() -> int:
    if not _next_cycle_time:
        return 60
    remaining = (_next_cycle_time - datetime.now(timezone.utc)).total_seconds()
    return max(0, int(remaining))


def get_scheduler_status() -> dict:
    return {
        "running": _scheduler_running,
        "current_cycle_number": _current_cycle_number,
        "market_shock_active": _market_shock["active"],
        "market_shock_description": _market_shock.get("description", ""),
        "next_cycle_in_seconds": seconds_until_next_cycle(),
    }
