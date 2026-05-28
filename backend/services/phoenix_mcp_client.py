import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

PHOENIX_BASE = settings.PHOENIX_BASE_URL


async def get_recent_traces(limit: int = 20) -> list[dict]:
    """
    Fetches recent spans flagged as learning events from Phoenix REST API.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{PHOENIX_BASE}/v1/spans",
                params={
                    "limit": limit,
                    "filter": "metadata['learning_event'] == 'true'",
                    "sort": "startTime desc"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                spans = data.get("data", [])
                logger.info(f"[PhoenixREST] Fetched {len(spans)} learning event spans")
                return spans
            else:
                logger.warning(f"[PhoenixREST] get_recent_traces returned {resp.status_code}")
                return []
    except Exception as e:
        logger.warning(f"[PhoenixREST] get_recent_traces failed: {e}")
        return []


async def get_evaluations_for_traces(trace_ids: list[str]) -> list[dict]:
    """
    Fetches span annotations (evaluations) for given span IDs.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{PHOENIX_BASE}/v1/span_annotations",
                params={"span_ids": ",".join(trace_ids)}
            )
            if resp.status_code == 200:
                data = resp.json()
                annotations = data.get("data", [])
                logger.info(f"[PhoenixREST] Fetched {len(annotations)} annotations")
                return annotations
            else:
                logger.warning(f"[PhoenixREST] get_evaluations returned {resp.status_code}")
                return []
    except Exception as e:
        logger.warning(f"[PhoenixREST] get_evaluations_for_traces failed: {e}")
        return []


async def list_available_tools() -> list[str]:
    """
    Verifies Phoenix REST API is reachable by hitting /v1/projects.
    Returns a fake tool list for compatibility.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{PHOENIX_BASE}/v1/projects")
            if resp.status_code == 200:
                logger.info("[PhoenixREST] Phoenix REST API reachable")
                return ["get_spans", "get_evaluations", "get_projects"]
            return []
    except Exception as e:
        logger.warning(f"[PhoenixREST] connectivity check failed: {e}")
        return []


async def verify_mcp_connection() -> bool:
    """
    Verifies Phoenix REST API is reachable at startup.
    """
    tools = await list_available_tools()
    if tools:
        logger.info("[PhoenixREST] Connection verified. Phoenix REST API ready.")
        return True
    else:
        logger.warning("[PhoenixREST] Could not reach Phoenix REST API.")
        return False
