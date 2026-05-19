import asyncio
from datetime import datetime, timezone

from google.cloud import firestore

from config import settings

db = firestore.Client(project=settings.GOOGLE_CLOUD_PROJECT)

COL_PORTFOLIOS = "portfolios"
COL_TRADES = "trades"
COL_CONSTRAINTS = "constraints"
COL_AGENT_MEMORY = "agent_memory"
COL_CYCLES = "cycles"


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


async def get_active_constraints(agent_id: str | None = None) -> list[dict]:
    def _get():
        query = db.collection(COL_CONSTRAINTS).where("status", "==", "ACTIVE")
        if agent_id is not None:
            query = query.where("target_agent", "==", agent_id)
        return [doc.to_dict() for doc in query.stream()]

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


async def initialize_portfolio() -> None:
    existing = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if existing is not None:
        return

    seed = {
        "portfolio_id": settings.FIRESTORE_PORTFOLIO_ID,
        "cash": settings.INITIAL_CAPITAL,
        "total_value": settings.INITIAL_CAPITAL,
        "pnl_pct": 0.0,
        "positions": {},
        "trade_count": 0,
        "cycle_count": 0,
        "circuit_breaker_active": False,
        "risk_mode": "NORMAL",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, seed)
