from fastapi import APIRouter, Query
from db.firestore_client import get_cycles
import logging

router = APIRouter()

@router.get("/cycles")
async def list_cycles(limit: int = Query(default=20, ge=1, le=100)):
    """Get decision cycle history with judge scores."""
    cycles = await get_cycles(limit=limit)
    return {"cycles": cycles, "count": len(cycles)}

@router.get("/cycles/latest")
async def get_latest_cycle():
    """Get the most recent completed cycle."""
    cycles = await get_cycles(limit=1)
    if not cycles:
        return {"cycle": None}
    return {"cycle": cycles[0]}
