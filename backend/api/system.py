import asyncio

import httpx
from fastapi import APIRouter

from config import settings

router = APIRouter()


@router.get("/system/status")
async def system_status():
    from services.cycle_scheduler import get_scheduler_status
    scheduler = get_scheduler_status()
    try:
        r = await asyncio.to_thread(
            lambda: httpx.get(f"{settings.PHOENIX_BASE_URL}/healthz", timeout=2)
        )
        phoenix_reachable = r.status_code == 200
    except Exception:
        phoenix_reachable = False
    return {
        "demo_mode": settings.DEMO_MODE,
        "status": "running" if scheduler["running"] else "paused",
        "phoenix_reachable": phoenix_reachable,
    }
