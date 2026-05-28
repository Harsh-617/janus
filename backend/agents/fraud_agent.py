import json
import logging
import re

from config import settings
from db.firestore_client import get_trades
from graph.state import JanusState
from observability.tracing import trace_agent_call
from services.gemini_client import generate

FRAUD_AGENT_PROMPT = """You are the Fraud Intelligence Agent for Janus — a financial crimes \
investigator. Your job is to detect suspicious patterns and reasoning \
inconsistencies in the trading activity.

You are specifically looking for:

1. WASH_TRADING: Rapid buy/sell of the same asset within a short window
   (same ticker appearing in both buy and sell proposals in the same cycle)

2. UNUSUAL_CONCENTRATION: Sudden heavy accumulation of a single asset
   (one ticker representing >30% of all proposed trades by value)

3. REASONING_INCONSISTENCY: The Trading Agent's stated rationale
   contradicts the action taken. Examples:
   - Claims "defensive positioning" but increases volatile asset exposure
   - Claims assets are "uncorrelated" without citing data
   - States a bearish thesis but proposes net buying
   - Makes absolute claims about market relationships that are oversimplifications
   This is the most important check — flag any claim that is factually
   unsupported or logically inconsistent with the proposed action.

4. ABNORMAL_VELOCITY: Unusually high number of trades in this cycle
   compared to normal (more than 3 trades in a single cycle is suspicious)

5. FRONT_RUNNING: Trades that seem timed to precede news events
   (if market shock is active and trades align perfectly with shock direction)

SEVERITY LEVELS:
- LOW: Minor inconsistency, informational
- MEDIUM: Notable concern, should be flagged for review
- HIGH: Serious concern, should trigger escalation to Regulator

OUTPUT FORMAT:
Respond with JSON only, no markdown:
{
  "status": "CLEAR" | "ALERT",
  "alerts": [
    {
      "type": "WASH_TRADING" | "UNUSUAL_CONCENTRATION" | "REASONING_INCONSISTENCY" | "ABNORMAL_VELOCITY" | "FRONT_RUNNING",
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "description": "<specific description of what was found>",
      "recommendation": "<what the Regulator should do>"
    }
  ],
  "investigation_open": <true if any HIGH severity alert, false otherwise>,
  "summary": "<one sentence summary of findings>"
}

If status is CLEAR, alerts is an empty array and investigation_open is false.
"""


async def fraud_agent_node(state: JanusState) -> dict:
    """LangGraph node function for the Fraud Intelligence Agent."""

    cycle_id = state["cycle_id"]

    from services.cycle_scheduler import broadcast_event
    await broadcast_event("agent_thinking", {
        "agent": "fraud_agent",
        "status": "thinking",
        "cycle_id": state.get("cycle_id", "unknown"),
    })

    with trace_agent_call("fraud_agent", cycle_id) as span:
        try:
            recent_trades = await get_trades(limit=20)

            user_message = f"""
CURRENT CYCLE TRADE PROPOSAL:
{json.dumps(state["trading_proposal"], indent=2)}

TRADING THESIS (check for reasoning inconsistencies):
{state["trading_thesis"][:500]}

TRADING CONFIDENCE: {state["trading_confidence"]}

RISK AGENT DECISION: {json.dumps(state.get("risk_report", {}), indent=2)}

RECENT TRADE HISTORY (last 20 trades for pattern analysis):
{json.dumps(recent_trades[-20:], indent=2)}

MARKET SHOCK ACTIVE: {state["market_shock_active"]}
{f"SHOCK DESCRIPTION: {state['market_shock_description']}" if state["market_shock_active"] else ""}

Investigate this cycle for fraud patterns and reasoning inconsistencies.
Pay special attention to whether the Trading Agent's thesis logically
supports the proposed trades.
"""
            raw_output = await generate(
                system_prompt=FRAUD_AGENT_PROMPT,
                user_message=user_message,
                model=settings.GEMINI_MODEL_JUDGE,
                temperature=0.2,
            )

            clean = raw_output.strip()
            if clean.startswith("```"):
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("```").strip()

            parsed = json.loads(clean)

            status = parsed.get("status", "CLEAR")
            alerts = parsed.get("alerts", [])
            investigation_open = parsed.get("investigation_open", False)

            high_severity = [a for a in alerts if a.get("severity") == "HIGH"]

            span.set_attribute("fraud.status", status)
            span.set_attribute("fraud.alert_count", len(alerts))
            span.set_attribute("fraud.high_severity_count", len(high_severity))
            span.set_attribute("fraud.investigation_open", investigation_open)
            span.set_attribute("fraud.summary", parsed.get("summary", "")[:200])

            if status == "ALERT":
                logging.warning(
                    f"[Fraud Agent] Cycle {cycle_id}: ALERT — "
                    f"{len(alerts)} alerts, {len(high_severity)} HIGH severity"
                )
            else:
                logging.info(f"[Fraud Agent] Cycle {cycle_id}: CLEAR")

            await broadcast_event("agent_done", {
                "agent": "fraud_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
            return {
                "fraud_alerts": alerts,
                "fraud_investigation_open": investigation_open,
            }

        except json.JSONDecodeError as e:
            logging.error(f"[Fraud Agent] JSON parse error: {e}")
            await broadcast_event("agent_done", {
                "agent": "fraud_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
            return {
                "fraud_alerts": [],
                "fraud_investigation_open": False,
            }
        except Exception as e:
            logging.error(f"[Fraud Agent] Error: {e}")
            await broadcast_event("agent_done", {
                "agent": "fraud_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
            return {
                "fraud_alerts": [],
                "fraud_investigation_open": False,
            }
