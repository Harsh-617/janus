from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from services.cycle_scheduler import (
    broadcast_event, _event_queue, start_scheduler, stop_scheduler,
    run_single_cycle, get_scheduler_status, set_market_shock
)
from config import settings
import asyncio, json, logging

router = APIRouter()

@router.get("/stream")
async def event_stream():
    """
    Server-Sent Events stream of live agent activity.
    Frontend connects here and receives real-time cycle events.
    """
    async def generate() -> AsyncGenerator[str, None]:
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'message': 'Janus stream connected'})}\n\n"

        while True:
            try:
                # Wait for next event with timeout (send keepalive if none)
                event = await asyncio.wait_for(_event_queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Keepalive ping
                yield f"data: {json.dumps({'type': 'ping'})}\n\n"
            except Exception as e:
                logging.error(f"[SSE] Stream error: {e}")
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

@router.post("/stream/start")
async def start_cycle_scheduler():
    """Start the automated cycle scheduler."""
    asyncio.create_task(start_scheduler())
    return {"status": "started", "interval_seconds": settings.AGENT_CYCLE_INTERVAL_SECONDS}

@router.post("/stream/stop")
async def stop_cycle_scheduler():
    """Stop the automated cycle scheduler."""
    stop_scheduler()
    return {"status": "stopped"}

@router.post("/stream/run-once")
async def run_one_cycle():
    """Manually trigger a single decision cycle."""
    asyncio.create_task(run_single_cycle())
    return {"status": "cycle_triggered", "message": "Single cycle started — watch the stream"}

@router.get("/stream/status")
async def get_stream_status():
    """Get current scheduler and market shock status."""
    return get_scheduler_status()
