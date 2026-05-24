import logging
import json
import httpx
from config import settings


async def get_recent_traces(limit: int = 20) -> list[dict]:
    """
    Queries Phoenix MCP for recent traces flagged as learning events.
    Falls back to empty list if Phoenix MCP is unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.PHOENIX_BASE_URL}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "tools/call",
                    "params": {
                        "name": "get_spans",
                        "arguments": {
                            "limit": limit,
                            "filter": "learning_event:true",
                        },
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["result"]["content"][0]["text"]
            return json.loads(text)
    except Exception as e:
        logging.warning(f"[PhoenixMCP] get_recent_traces failed: {e}")
        return []


async def get_evaluations_for_traces(trace_ids: list[str]) -> list[dict]:
    """
    Fetches evaluation scores for a list of trace IDs from Phoenix MCP.
    Falls back to empty list if unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.PHOENIX_BASE_URL}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/call",
                    "params": {
                        "name": "get_evaluations",
                        "arguments": {
                            "trace_ids": trace_ids,
                        },
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["result"]["content"][0]["text"]
            return json.loads(text)
    except Exception as e:
        logging.warning(f"[PhoenixMCP] get_evaluations_for_traces failed: {e}")
        return []


async def list_available_tools() -> list[str]:
    """
    Lists available tools on the Phoenix MCP server.
    Used to verify MCP connectivity at startup.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.PHOENIX_BASE_URL}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": 3,
                    "method": "tools/list",
                    "params": {},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            tools = data.get("result", {}).get("tools", [])
            return [t.get("name", "") for t in tools if t.get("name")]
    except Exception as e:
        logging.warning(f"[PhoenixMCP] list_available_tools failed: {e}")
        return []
