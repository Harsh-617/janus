from config import settings
from graph.state import JanusState, TradeProposal
from observability.tracing import trace_agent_call
from db.firestore_client import get_active_constraints
import json
import logging
import re
from datetime import datetime, timezone

from langchain_google_vertexai import ChatVertexAI

model = ChatVertexAI(
    model_name=settings.GEMINI_MODEL_FAST,
    project=settings.GOOGLE_CLOUD_PROJECT,
    location=settings.VERTEX_AI_LOCATION,
    temperature=0.7,
    max_tokens=2048,
)

TRADING_AGENT_PROMPT = """You are the Trading Agent for Janus, an autonomous financial intelligence
system. You act as a quant-driven hedge fund manager.

Your job is to analyze the current portfolio, market prices, and news headlines,
then propose specific trade actions.

RULES YOU MUST FOLLOW:
- Cite at least one specific market signal per trade you propose
- Never propose single-asset concentration exceeding 40% of portfolio value
- Flag uncertainty explicitly when your confidence is below 0.5
- Must reference any active behavioral constraints provided
- Propose at most 3 trades per cycle unless explicitly instructed otherwise

OUTPUT FORMAT:
Respond with a JSON object only, no markdown, no explanation outside the JSON:
{
  "action": "BUY" | "SELL" | "REBALANCE" | "HOLD",
  "trades": [
    {
      "ticker": "SYMBOL",
      "direction": "BUY" | "SELL",
      "quantity": <number>,
      "rationale": "<specific market signal and reasoning>",
      "confidence": <0.0 to 1.0>
    }
  ],
  "thesis": "<overall market thesis for this cycle>",
  "confidence": <overall confidence 0.0 to 1.0>,
  "uncertainty_flags": ["<flag if confidence < 0.5 per trade>"]
}

If action is HOLD, trades array should be empty.
"""


async def trading_agent_node(state: JanusState) -> dict:
    """LangGraph node function for the Trading Agent."""

    cycle_id = state["cycle_id"]

    with trace_agent_call("trading_agent", cycle_id) as span:
        try:
            portfolio = state["portfolio"]
            prices = state["market_prices"]
            news = state["news_headlines"]
            constraints = state["active_constraints"]

            user_message = f"""
CURRENT PORTFOLIO:
{json.dumps(portfolio, indent=2)}

CURRENT MARKET PRICES:
{json.dumps(prices, indent=2)}

RECENT NEWS HEADLINES:
{chr(10).join(f"- {h}" for h in news[:10])}

ACTIVE BEHAVIORAL CONSTRAINTS FROM JANUS LOOP:
{chr(10).join(f"- {c}" for c in constraints) if constraints else "None active"}

MARKET SHOCK ACTIVE: {state["market_shock_active"]}
{f"SHOCK DESCRIPTION: {state['market_shock_description']}" if state["market_shock_active"] else ""}

Analyze the above and propose your trades for this cycle.
"""

            from langchain_core.messages import SystemMessage, HumanMessage
            messages = [
                SystemMessage(content=TRADING_AGENT_PROMPT),
                HumanMessage(content=user_message),
            ]

            response = await model.ainvoke(messages)
            raw_output = response.content

            clean = raw_output.strip()
            if clean.startswith("```"):
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("```").strip()

            parsed = json.loads(clean)

            span.set_attribute("trading.action", parsed.get("action", "UNKNOWN"))
            span.set_attribute("trading.confidence", parsed.get("confidence", 0.0))
            span.set_attribute("trading.trade_count", len(parsed.get("trades", [])))
            span.set_attribute("trading.thesis", parsed.get("thesis", "")[:200])

            logging.info(
                f"[Trading Agent] Cycle {cycle_id}: {parsed.get('action')} "
                f"— {len(parsed.get('trades', []))} trades proposed"
            )

            return {
                "trading_proposal": parsed.get("trades", []),
                "trading_thesis": parsed.get("thesis", ""),
                "trading_confidence": parsed.get("confidence", 0.0),
            }

        except json.JSONDecodeError as e:
            logging.error(f"[Trading Agent] JSON parse error: {e}")
            return {
                "trading_proposal": [],
                "trading_thesis": "Error: could not parse trading agent output",
                "trading_confidence": 0.0,
            }
        except Exception as e:
            logging.error(f"[Trading Agent] Error: {e}")
            span.record_exception(e)
            return {
                "trading_proposal": [],
                "trading_thesis": f"Error: {str(e)}",
                "trading_confidence": 0.0,
            }
