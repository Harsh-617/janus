from fastapi import APIRouter, Query
from db.firestore_client import get_trades
import logging

router = APIRouter()

@router.get("/trades")
async def list_trades(limit: int = Query(default=50, ge=1, le=200)):
    """Get trade history."""
    trades = await get_trades(limit=limit)
    return {"trades": trades, "count": len(trades)}
