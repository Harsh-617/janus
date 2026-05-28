import logging
import json
from typing import Any
from config import settings

logger = logging.getLogger(__name__)

PHOENIX_MCP_URL = f"{settings.PHOENIX_BASE_URL}/mcp"


async def _call_phoenix_mcp_tool(tool_name: str, arguments: dict) -> Any:
    """
    Calls a tool on the Phoenix MCP server using the mcp library
    with SSE transport.
    """
    try:
        from mcp import ClientSession
        from mcp.client.sse import sse_client

        async with sse_client(PHOENIX_MCP_URL) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments)
                if result.content and len(result.content) > 0:
                    text = result.content[0].text
                    return json.loads(text)
                return []
    except Exception as e:
        logger.warning(f"[PhoenixMCP] Tool call '{tool_name}' failed: {e}")
        return []


async def get_recent_traces(limit: int = 20) -> list[dict]:
    """
    Queries Phoenix MCP for recent spans flagged as learning events.
    """
    result = await _call_phoenix_mcp_tool(
        "get_spans",
        {"limit": limit, "filter": "learning_event:true"}
    )
    if isinstance(result, list):
        return result
    return []


async def get_evaluations_for_traces(trace_ids: list[str]) -> list[dict]:
    """
    Fetches evaluation scores for a list of trace IDs from Phoenix MCP.
    """
    result = await _call_phoenix_mcp_tool(
        "get_evaluations",
        {"trace_ids": trace_ids}
    )
    if isinstance(result, list):
        return result
    return []


async def list_available_tools() -> list[str]:
    """
    Lists available tools on the Phoenix MCP server.
    Used to verify MCP connectivity at startup.
    """
    try:
        from mcp import ClientSession
        from mcp.client.sse import sse_client

        async with sse_client(PHOENIX_MCP_URL) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools = await session.list_tools()
                names = [t.name for t in tools.tools]
                logger.info(f"[PhoenixMCP] Connected. Available tools: {names}")
                return names
    except Exception as e:
        logger.warning(f"[PhoenixMCP] list_available_tools failed: {e}")
        return []


async def verify_mcp_connection() -> bool:
    """
    Verifies the Phoenix MCP server is reachable.
    Call this at backend startup to log connection status.
    """
    tools = await list_available_tools()
    if tools:
        logger.info(f"[PhoenixMCP] Connection verified. {len(tools)} tools available.")
        return True
    else:
        logger.warning("[PhoenixMCP] Could not connect to Phoenix MCP server.")
        return False
