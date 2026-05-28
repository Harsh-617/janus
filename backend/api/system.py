from fastapi import APIRouter
from config import settings

router = APIRouter()


@router.get("/system/status")
async def system_status():
    from services.cycle_scheduler import get_scheduler_status
    scheduler = get_scheduler_status()
    return {
        "demo_mode": settings.DEMO_MODE,
        "status": "running" if scheduler["running"] else "paused",
    }
