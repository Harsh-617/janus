import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from db.firestore_client import get_active_constraints, db, COL_CONSTRAINTS

router = APIRouter()
logger = logging.getLogger(__name__)


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
