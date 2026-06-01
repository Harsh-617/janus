import asyncio
import logging
from datetime import datetime, timezone

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from config import settings

db = firestore.Client(project=settings.GOOGLE_CLOUD_PROJECT)

COL_PORTFOLIOS = "portfolios"
COL_TRADES = "trades"
COL_BASELINE_TRADES = "baseline_trades"
COL_CONSTRAINTS = "constraints"
COL_CONSTRAINT_CONFLICTS = "constraint_conflicts"
COL_AGENT_MEMORY = "agent_memory"
COL_CYCLES = "cycles"
COL_HISTORY = "history"

BASELINE_PORTFOLIO_ID = "janus_baseline"


async def get_portfolio(portfolio_id: str) -> dict | None:
    def _get():
        doc = db.collection(COL_PORTFOLIOS).document(portfolio_id).get()
        return doc.to_dict() if doc.exists else None

    return await asyncio.to_thread(_get)


async def save_portfolio(portfolio_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_PORTFOLIOS).document(portfolio_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def save_trade(trade_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_TRADES).document(trade_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def get_trades(limit: int = 100) -> list[dict]:
    def _get():
        docs = (
            db.collection(COL_TRADES)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    return await asyncio.to_thread(_get)


async def save_constraint(constraint_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_CONSTRAINTS).document(constraint_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def update_constraint(constraint_id: str, updates: dict) -> None:
    """Updates specific fields on an existing constraint document."""
    def _update():
        try:
            doc_ref = db.collection(COL_CONSTRAINTS).document(constraint_id)
            doc_ref.update(updates)
        except Exception as e:
            logging.warning(f"Failed to update constraint {constraint_id}: {e}")

    await asyncio.to_thread(_update)


async def get_active_constraints(agent_id: str | None = None) -> list[dict]:
    def _get():
        query = (
            db.collection(COL_CONSTRAINTS)
            .where(filter=FieldFilter("status", "==", "ACTIVE"))
        )
        if agent_id is not None:
            docs = [
                doc.to_dict()
                for doc in query.where(filter=FieldFilter("target_agent", "==", agent_id)).stream()
            ]
            docs.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
            return docs[:5]
        all_docs = [doc.to_dict() for doc in query.stream()]
        all_docs = [d for d in all_docs if d.get("target_agent")]
        all_docs.sort(key=lambda x: x.get("generated_at", ""), reverse=True)
        per_agent: dict[str, list] = {}
        for doc in all_docs:
            bucket = per_agent.setdefault(doc.get("target_agent", ""), [])
            if len(bucket) < 5:
                bucket.append(doc)
        return [doc for bucket in per_agent.values() for doc in bucket]

    return await asyncio.to_thread(_get)


async def save_agent_memory(agent_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_AGENT_MEMORY).document(agent_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def get_agent_memory(agent_id: str) -> dict | None:
    def _get():
        doc = db.collection(COL_AGENT_MEMORY).document(agent_id).get()
        return doc.to_dict() if doc.exists else None

    return await asyncio.to_thread(_get)


async def save_cycle(cycle_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_CYCLES).document(cycle_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def get_cycles(limit: int = 50) -> list[dict]:
    def _get():
        docs = (
            db.collection(COL_CYCLES)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    return await asyncio.to_thread(_get)


async def save_baseline_trade(trade_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_BASELINE_TRADES).document(trade_id).set(data, merge=True)

    await asyncio.to_thread(_set)


async def save_conflict(conflict_id: str, data: dict) -> None:
    def _set():
        db.collection(COL_CONSTRAINT_CONFLICTS).document(conflict_id).set(
            {**data, "resolved": False}, merge=True
        )

    await asyncio.to_thread(_set)


async def update_conflict_resolution(conflict_id: str, resolution: dict) -> None:
    def _update():
        try:
            db.collection(COL_CONSTRAINT_CONFLICTS).document(conflict_id).update(
                {"resolution": resolution}
            )
        except Exception as e:
            logging.warning(f"Failed to update conflict resolution {conflict_id}: {e}")

    await asyncio.to_thread(_update)


async def get_unresolved_conflicts(limit: int = 20) -> list[dict]:
    def _get():
        query = (
            db.collection(COL_CONSTRAINT_CONFLICTS)
            .where(filter=FieldFilter("resolved", "==", False))
            .limit(50)
        )
        docs = query.stream()
        results = [doc.to_dict() for doc in docs]
        results.sort(key=lambda x: x.get("detected_at", ""), reverse=True)
        return results[:20]

    return await asyncio.to_thread(_get)


async def save_portfolio_history_snapshot(
    portfolio_id: str, cycle_number: int, data: dict
) -> None:
    def _set():
        doc_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_") + str(cycle_number)
        (
            db.collection(COL_PORTFOLIOS)
            .document(portfolio_id)
            .collection(COL_HISTORY)
            .document(doc_id)
            .set(data)
        )

    await asyncio.to_thread(_set)


async def get_portfolio_history_snapshots(
    portfolio_id: str, limit: int = 100
) -> list[dict]:
    def _get():
        docs = (
            db.collection(COL_PORTFOLIOS)
            .document(portfolio_id)
            .collection(COL_HISTORY)
            .order_by("cycle")
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]

    return await asyncio.to_thread(_get)


async def initialize_portfolio() -> None:
    existing = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if existing is not None:
        return

    initial_capital = settings.INITIAL_CAPITAL  # 1_000_000.0
    cash = 245000.0
    positions = {
        "AAPL": {"shares": 1100, "avg_cost": 180.50, "current_price": 195.20, "sector": "Technology"},
        "GLD": {"shares": 430, "avg_cost": 220.00, "current_price": 235.10, "sector": "Commodities"},
        "BTC-USD": {"shares": 4.0, "avg_cost": 65000.00, "current_price": 72000.00, "sector": "Crypto"},
        "TLT": {"shares": 1100, "avg_cost": 95.00, "current_price": 92.50, "sector": "Bonds"},
        "XOM": {"shares": 425, "avg_cost": 110.00, "current_price": 118.30, "sector": "Energy"},
    }
    total_value = sum(p["shares"] * p["current_price"] for p in positions.values()) + cash
    pnl_pct = round(((total_value - initial_capital) / initial_capital) * 100, 4)

    seed = {
        "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
        "cash": cash,
        "initial_capital": initial_capital,
        "total_value": round(total_value, 2),
        "pnl_pct": pnl_pct,
        "positions": positions,
        "trade_count": 0,
        "cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, seed)
