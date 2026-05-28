import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from db.firestore_client import (
    get_active_constraints, save_constraint, db,
    COL_CONSTRAINTS, COL_CONSTRAINT_CONFLICTS,
    get_unresolved_conflicts,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class ConstraintRequest(BaseModel):
    target_agent: str
    condition: str
    rule: str
    rationale: str


class ResolveRequest(BaseModel):
    action: Literal[
        "ACCEPT_RECOMMENDATION", "SUSPEND_A", "SUSPEND_B", "SUSPEND_BOTH", "DISMISS"
    ]


@router.post("/constraints", status_code=201)
async def create_constraint(body: ConstraintRequest):
    constraint_id = f"constraint_manual_{int(time.time())}"
    doc = {
        "constraint_id": constraint_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": "manual_injection",
        "target_agent": body.target_agent,
        "condition": body.condition,
        "rule": body.rule,
        "rationale": body.rationale,
        "status": "ACTIVE",
        "performance_delta": {
            "safety_before": None,
            "safety_after": None,
            "cycles_active": 0,
        },
        "expires_after_cycles": 50,
        "phoenix_experiment_id": None,
    }
    await save_constraint(constraint_id, doc)
    return JSONResponse(content=doc, status_code=201)


@router.post("/constraints/cleanup")
async def cleanup_constraints():
    def _cleanup():
        docs = list(db.collection(COL_CONSTRAINTS).stream())
        deleted = 0
        remaining = 0
        for doc in docs:
            data = doc.to_dict() or {}
            ta = data.get("target_agent")
            if ta is None or ta == "":
                doc.reference.delete()
                deleted += 1
            else:
                remaining += 1
        return {"deleted": deleted, "remaining": remaining}

    return await asyncio.to_thread(_cleanup)


@router.get("/constraints")
async def list_constraints():
    constraints = await get_active_constraints()
    return {
        "constraints": constraints,
        "count": len(constraints),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# NOTE: /constraints/conflicts must be defined before /constraints/{constraint_id}
# so FastAPI does not treat "conflicts" as a constraint_id path parameter.

@router.get("/constraints/conflicts")
async def list_conflicts():
    raw_conflicts = await get_unresolved_conflicts(limit=20)

    def _fetch_rules(conflict_list):
        enriched = []
        for conflict in conflict_list:
            a_id = conflict.get("constraint_a_id", "")
            b_id = conflict.get("constraint_b_id", "")

            a_doc = db.collection(COL_CONSTRAINTS).document(a_id).get()
            b_doc = db.collection(COL_CONSTRAINTS).document(b_id).get()

            a_rule = (a_doc.to_dict() or {}).get("rule", "") if a_doc.exists else ""
            b_rule = (b_doc.to_dict() or {}).get("rule", "") if b_doc.exists else ""

            enriched.append({
                **conflict,
                "constraint_a_rule": a_rule,
                "constraint_b_rule": b_rule,
            })
        return enriched

    conflicts = await asyncio.to_thread(_fetch_rules, raw_conflicts)
    return {"conflicts": conflicts, "total": len(conflicts)}


@router.post("/constraints/conflicts/{conflict_id}/resolve")
async def resolve_conflict(conflict_id: str, body: ResolveRequest):
    def _get_conflict():
        doc = db.collection(COL_CONSTRAINT_CONFLICTS).document(conflict_id).get()
        return doc.to_dict() if doc.exists else None

    conflict = await asyncio.to_thread(_get_conflict)
    if conflict is None:
        raise HTTPException(status_code=404, detail="Conflict not found")

    action = body.action
    action_taken = action

    def _suspend(cid: str):
        db.collection(COL_CONSTRAINTS).document(cid).update({"status": "SUSPENDED"})

    def _mark_resolved():
        db.collection(COL_CONSTRAINT_CONFLICTS).document(conflict_id).update(
            {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()}
        )

    if action == "ACCEPT_RECOMMENDATION":
        resolution = conflict.get("resolution", {})
        stored_action = resolution.get("action", "SUSPEND_BOTH")
        if stored_action == "SUSPEND_A":
            await asyncio.to_thread(_suspend, conflict["constraint_a_id"])
            action_taken = f"ACCEPT_RECOMMENDATION → suspended {conflict['constraint_a_id']}"
        elif stored_action == "SUSPEND_B":
            await asyncio.to_thread(_suspend, conflict["constraint_b_id"])
            action_taken = f"ACCEPT_RECOMMENDATION → suspended {conflict['constraint_b_id']}"
        else:
            await asyncio.to_thread(_suspend, conflict["constraint_a_id"])
            await asyncio.to_thread(_suspend, conflict["constraint_b_id"])
            action_taken = "ACCEPT_RECOMMENDATION → suspended both"
        await asyncio.to_thread(_mark_resolved)

    elif action == "SUSPEND_A":
        await asyncio.to_thread(_suspend, conflict["constraint_a_id"])
        await asyncio.to_thread(_mark_resolved)

    elif action == "SUSPEND_B":
        await asyncio.to_thread(_suspend, conflict["constraint_b_id"])
        await asyncio.to_thread(_mark_resolved)

    elif action == "SUSPEND_BOTH":
        await asyncio.to_thread(_suspend, conflict["constraint_a_id"])
        await asyncio.to_thread(_suspend, conflict["constraint_b_id"])
        await asyncio.to_thread(_mark_resolved)

    elif action == "DISMISS":
        await asyncio.to_thread(_mark_resolved)

    return {"status": "resolved", "action_taken": action_taken}


@router.get("/constraints/{constraint_id}")
async def get_constraint(constraint_id: str):
    def _get():
        doc = db.collection(COL_CONSTRAINTS).document(constraint_id).get()
        return doc.to_dict() if doc.exists else None

    result = await asyncio.to_thread(_get)
    if result is None:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return result
