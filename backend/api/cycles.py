import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from db.firestore_client import get_cycles, db, COL_CONSTRAINTS
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

@router.get("/cycles/scores-over-time")
async def get_scores_over_time(
    dimension: str = Query(default="safety"),
    window: int = Query(default=10, ge=1, le=50),
):
    valid_dimensions = {
        "overall", "safety", "correctness",
        "hallucination_risk", "compliance", "explainability",
    }
    if dimension not in valid_dimensions:
        raise HTTPException(
            status_code=400,
            detail=f"dimension must be one of: {', '.join(sorted(valid_dimensions))}",
        )

    field_map = {
        "overall": "judge_overall_score",
        "safety": "judge_safety",
        "correctness": "judge_correctness",
        "hallucination_risk": "judge_hallucination_risk",
        "compliance": "judge_compliance",
        "explainability": "judge_explainability",
    }
    score_field = field_map[dimension]

    raw = await get_cycles(limit=100)
    cycles = list(reversed(raw))  # oldest → newest

    def _get_constraints():
        docs = [d.to_dict() for d in db.collection(COL_CONSTRAINTS).stream() if d.to_dict()]
        docs.sort(key=lambda x: x.get("generated_at", ""))
        return docs

    constraints = await asyncio.to_thread(_get_constraints)

    # Build rolling-average data
    data = []
    scores: list[float] = []
    for i, cycle in enumerate(cycles):
        cn = cycle.get("cycle_number") or (i + 1)
        raw_score = float(cycle.get(score_field) or 0)
        scores.append(raw_score)
        rolling = sum(scores[-window:]) / min(len(scores), window)
        data.append({
            "cycle_number": cn,
            "cycle_id": cycle.get("cycle_id", ""),
            "raw_score": round(raw_score, 2),
            "rolling_avg": round(rolling, 2),
            "timestamp": cycle.get("timestamp", ""),
        })

    # Map each constraint to the nearest cycle by timestamp
    def _ts(s: str) -> float:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        except (ValueError, TypeError, AttributeError):
            return 0.0

    cycle_times = [
        (_ts(c.get("timestamp", "")), c.get("cycle_number") or (i + 1))
        for i, c in enumerate(cycles)
    ]

    constraint_injections = []
    for c in constraints:
        c_epoch = _ts(c.get("generated_at", ""))
        if c_epoch == 0.0:
            continue
        nearest_cn = min(cycle_times, key=lambda t: abs(t[0] - c_epoch), default=None)
        if nearest_cn is None:
            continue
        constraint_injections.append({
            "cycle_number": nearest_cn[1],
            "constraint_id": c.get("constraint_id", ""),
            "rule": c.get("rule", ""),
            "target_agent": c.get("target_agent", ""),
        })

    constraint_injections.sort(key=lambda x: x["cycle_number"])

    return {
        "dimension": dimension,
        "window": window,
        "data": data,
        "constraint_injections": constraint_injections,
    }
