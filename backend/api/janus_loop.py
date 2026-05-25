from fastapi import APIRouter
from db.firestore_client import get_active_constraints, get_cycles, get_portfolio
from config import settings
import logging

router = APIRouter()

@router.get("/janus-loop/status")
async def get_loop_status():
    """Get Janus Loop status and active constraints."""
    from agents.meta_agent import _last_run_at
    constraints = await get_active_constraints()
    cycles = await get_cycles(limit=20)
    portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)

    learning_events = [c for c in cycles if c.get("learning_event")]
    avg_score = (
        sum(c.get("judge_overall_score", 0) for c in cycles) / len(cycles)
        if cycles else 0
    )
    total_cycles = (portfolio or {}).get("cycle_count", 0)

    return {
        "active_constraints": constraints,
        "constraint_count": len(constraints),
        "active_constraints_count": len(constraints),
        "recent_cycles_analyzed": len(cycles),
        "total_cycles": total_cycles,
        "learning_events_count": len(learning_events),
        "avg_judge_score": round(avg_score, 2),
        "last_run_at": _last_run_at,
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

@router.post("/constraints/backfill-safety")
async def backfill_safety():
    """Backfill safety_before=7.0 for constraints that are missing it."""
    from db.firestore_client import update_constraint
    constraints = await get_active_constraints()
    updated = []
    for c in constraints:
        perf = c.get("performance_delta") or {}
        safety_before = perf.get("safety_before")
        if safety_before is None or safety_before == 0:
            cid = c.get("constraint_id")
            if cid:
                await update_constraint(cid, {"performance_delta.safety_before": 7.0})
                updated.append(cid)
    return {
        "status": "ok",
        "updated_count": len(updated),
        "updated_ids": updated,
    }
