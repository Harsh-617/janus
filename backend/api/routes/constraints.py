import asyncio
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from db.firestore_client import get_active_constraints, save_constraint, db, COL_CONSTRAINTS

router = APIRouter()
logger = logging.getLogger(__name__)


class ConstraintRequest(BaseModel):
    target_agent: str
    condition: str
    rule: str
    rationale: str


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


@router.get("/constraints/{constraint_id}")
async def get_constraint(constraint_id: str):
    def _get():
        doc = db.collection(COL_CONSTRAINTS).document(constraint_id).get()
        return doc.to_dict() if doc.exists else None

    result = await asyncio.to_thread(_get)
    if result is None:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return result
