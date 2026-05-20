from fastapi import APIRouter
from db.firestore_client import get_active_constraints, get_cycles
from config import settings
import logging

router = APIRouter()

@router.get("/janus-loop/status")
async def get_loop_status():
    """Get Janus Loop status and active constraints."""
    constraints = await get_active_constraints()
    cycles = await get_cycles(limit=20)

    learning_events = [c for c in cycles if c.get("learning_event")]
    avg_score = (
        sum(c.get("judge_overall_score", 0) for c in cycles) / len(cycles)
        if cycles else 0
    )

    return {
        "active_constraints": constraints,
        "constraint_count": len(constraints),
        "recent_cycles_analyzed": len(cycles),
        "learning_events_count": len(learning_events),
        "avg_judge_score": round(avg_score, 2),
    }

@router.get("/janus-loop/history")
async def get_loop_history():
    """Get history of Janus Loop runs and generated constraints."""
    constraints = await get_active_constraints()
    return {
        "constraints": constraints,
        "count": len(constraints),
    }

@router.post("/janus-loop/trigger")
async def trigger_janus_loop():
    """Manually trigger the Janus Loop self-correction engine."""
    import asyncio
    from agents.meta_agent import run_janus_loop
    asyncio.create_task(run_janus_loop())
    return {
        "status": "triggered",
        "message": "Janus Loop started — check /janus-loop/history for results"
    }
