from config import settings
from graph.state import JanusState
from observability.tracing import trace_agent_call
import json
import logging
import re

from services.gemini_client import generate

RISK_AGENT_PROMPT = """You are the Risk Agent for Janus — a conservative risk officer whose
job is to protect the portfolio from excessive risk.

You receive a trade proposal and the current portfolio state. You must
evaluate the risk and issue one of three decisions: APPROVE, MODIFY, or VETO.

HARD VETO RULES (automatic veto, no exceptions):
- Any single position would exceed 40% of total portfolio value → VETO
- Proposed portfolio VaR exceeds 5% daily → VETO
- More than 70% of portfolio allocated to one sector → VETO

MODIFY CONDITIONS:
- Proposed cash level would drop below 10% of portfolio → MODIFY to preserve cash floor
- A trade increases VaR significantly but not above threshold → MODIFY to reduce size

APPROVE:
- All risk metrics within acceptable bounds

For VaR estimation: use a simplified calculation — assume each position's
daily VaR = position_value * volatility_estimate. Use these volatility
estimates by asset class:
- Crypto (BTC, ETH): 0.08
- Individual stocks: 0.025
- ETFs/Index funds: 0.015
- Commodities (GLD, SLV): 0.018
- Bonds (TLT): 0.01

OUTPUT FORMAT:
Respond with JSON only, no markdown:
{
  "decision": "APPROVE" | "MODIFY" | "VETO",
  "modified_trades": [...],
  "vetoed_trades": [...],
  "risk_report": {
    "current_var": <float>,
    "proposed_var": <float>,
    "verdict": "<explanation>",
    "modifications": "<what was changed and why, or empty string>"
  }
}

If decision is APPROVE, modified_trades and vetoed_trades are empty arrays.
If decision is VETO, modified_trades is empty, vetoed_trades contains all trades.
"""


async def risk_agent_node(state: JanusState) -> dict:
    """LangGraph node function for the Risk Agent."""

    cycle_id = state["cycle_id"]

    if not state.get("trading_proposal"):
        logging.info(f"[Risk Agent] Cycle {cycle_id}: No trades to evaluate")
        return {
            "risk_report": {
                "decision": "APPROVE",
                "current_var": 0.0,
                "proposed_var": 0.0,
                "verdict": "No trades proposed — nothing to evaluate",
                "modifications": "",
                "vetoed_trades": [],
                "modified_trades": [],
            }
        }

    with trace_agent_call("risk_agent", cycle_id) as span:
        try:
            user_message = f"""
CURRENT PORTFOLIO:
{json.dumps(state["portfolio"], indent=2)}

PROPOSED TRADES FROM TRADING AGENT:
{json.dumps(state["trading_proposal"], indent=2)}

TRADING THESIS:
{state["trading_thesis"]}

MARKET SHOCK ACTIVE: {state["market_shock_active"]}

Evaluate the risk of these proposed trades and issue your decision.
"""
            raw_output = await generate(
                system_prompt=RISK_AGENT_PROMPT,
                user_message=user_message,
                temperature=0.3,
            )

            clean = raw_output.strip()
            if clean.startswith("```"):
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("```").strip()

            parsed = json.loads(clean)

            decision = parsed.get("decision", "VETO")
            risk_report = parsed.get("risk_report", {})

            span.set_attribute("risk.decision", decision)
            span.set_attribute("risk.current_var", risk_report.get("current_var", 0.0))
            span.set_attribute("risk.proposed_var", risk_report.get("proposed_var", 0.0))
            span.set_attribute("risk.verdict", risk_report.get("verdict", "")[:200])

            logging.info(
                f"[Risk Agent] Cycle {cycle_id}: {decision} — "
                f"VaR {risk_report.get('current_var', 0):.3f} → "
                f"{risk_report.get('proposed_var', 0):.3f}"
            )

            return {
                "risk_report": {
                    "decision": decision,
                    "current_var": risk_report.get("current_var", 0.0),
                    "proposed_var": risk_report.get("proposed_var", 0.0),
                    "verdict": risk_report.get("verdict", ""),
                    "modifications": risk_report.get("modifications", ""),
                    "vetoed_trades": parsed.get("vetoed_trades", []),
                    "modified_trades": parsed.get("modified_trades", []),
                }
            }

        except json.JSONDecodeError as e:
            logging.error(f"[Risk Agent] JSON parse error: {e}")
            return {
                "risk_report": {
                    "decision": "VETO",
                    "current_var": 0.0,
                    "proposed_var": 0.0,
                    "verdict": "Error parsing risk agent output — defaulting to VETO",
                    "modifications": "",
                    "vetoed_trades": state.get("trading_proposal", []),
                    "modified_trades": [],
                }
            }
        except Exception as e:
            logging.error(f"[Risk Agent] Error: {e}")
            return {
                "risk_report": {
                    "decision": "VETO",
                    "current_var": 0.0,
                    "proposed_var": 0.0,
                    "verdict": f"Risk agent error: {str(e)} — defaulting to VETO",
                    "modifications": "",
                    "vetoed_trades": state.get("trading_proposal", []),
                    "modified_trades": [],
                }
            }
