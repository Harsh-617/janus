from config import settings
from graph.state import JanusState
from observability.tracing import trace_agent_call
import json
import logging
import re

from services.gemini_client import generate

VOLATILITY_MAP = {
    "AAPL": 0.022, "GLD": 0.010, "BTC-USD": 0.055,
    "TLT": 0.012, "XOM": 0.018, "KRE": 0.025,
    "AMZN": 0.024, "ETH-USD": 0.060, "DEFAULT": 0.020
}


def compute_portfolio_var(positions: dict, cash: float,
                          total_value: float,
                          proposed_trades: list) -> dict:
    """
    Computes 1-day 95% VaR using parametric method.
    Returns dict with current_var, proposed_var, var_change.
    """
    if total_value <= 0:
        return {"current_var": 0.0, "proposed_var": 0.0,
                "var_change": 0.0}

    # Current portfolio VaR
    current_var = 0.0
    for ticker, pos in positions.items():
        shares = pos.get("shares", 0)
        price = pos.get("current_price", pos.get("avg_cost", 0))
        position_value = shares * price
        weight = position_value / total_value
        vol = VOLATILITY_MAP.get(ticker, VOLATILITY_MAP["DEFAULT"])
        current_var += (weight * vol) ** 2
    current_var = (current_var ** 0.5) * 1.645  # 95% confidence

    # Proposed VaR (apply trade adjustments)
    adjusted_positions = dict(positions)
    for trade in proposed_trades:
        ticker = trade.get("ticker", "")
        direction = trade.get("direction", "")
        quantity = trade.get("quantity", 0)
        price = trade.get("price",
                positions.get(ticker, {}).get("current_price", 100))
        if ticker not in adjusted_positions:
            adjusted_positions[ticker] = {
                "shares": 0, "current_price": price, "avg_cost": price
            }
        if direction == "BUY":
            adjusted_positions[ticker]["shares"] = \
                adjusted_positions[ticker].get("shares", 0) + quantity
        elif direction == "SELL":
            adjusted_positions[ticker]["shares"] = max(0,
                adjusted_positions[ticker].get("shares", 0) - quantity)

    proposed_total = sum(
        p.get("shares", 0) * p.get("current_price",
                                    p.get("avg_cost", 0))
        for p in adjusted_positions.values()
    ) + cash
    if proposed_total <= 0:
        proposed_total = total_value

    proposed_var = 0.0
    for ticker, pos in adjusted_positions.items():
        shares = pos.get("shares", 0)
        price = pos.get("current_price", pos.get("avg_cost", 0))
        position_value = shares * price
        weight = position_value / proposed_total
        vol = VOLATILITY_MAP.get(ticker, VOLATILITY_MAP["DEFAULT"])
        proposed_var += (weight * vol) ** 2
    proposed_var = (proposed_var ** 0.5) * 1.645

    return {
        "current_var": round(current_var, 4),
        "proposed_var": round(proposed_var, 4),
        "var_change": round(proposed_var - current_var, 4)
    }


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

VaR values are pre-computed in Python and provided in the user message.
Use those exact numbers — do not recalculate VaR yourself.

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

    from services.cycle_scheduler import broadcast_event
    await broadcast_event("agent_thinking", {
        "agent": "risk_agent",
        "status": "thinking",
        "cycle_id": state.get("cycle_id", "unknown"),
    })

    if not state.get("trading_proposal"):
        logging.info(f"[Risk Agent] Cycle {cycle_id}: No trades to evaluate")
        await broadcast_event("agent_done", {
            "agent": "risk_agent",
            "status": "done",
            "cycle_id": state.get("cycle_id", "unknown"),
        })
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
            portfolio = state.get("portfolio", {})
            positions = portfolio.get("positions", {})
            cash = portfolio.get("cash", 0.0)
            total_value = portfolio.get("total_value", 0.0)
            proposed_trades = state.get("trading_proposal", [])
            if isinstance(proposed_trades, dict):
                proposed_trades = proposed_trades.get("trades", [])

            var_result = compute_portfolio_var(
                positions, cash, total_value, proposed_trades
            )

            user_message = f"""
CURRENT PORTFOLIO:
{json.dumps(state["portfolio"], indent=2)}

PROPOSED TRADES FROM TRADING AGENT:
{json.dumps(state["trading_proposal"], indent=2)}

TRADING THESIS:
{state["trading_thesis"]}

MARKET SHOCK ACTIVE: {state["market_shock_active"]}

PRE-COMPUTED RISK METRICS (use these exact numbers, do not recalculate):
- Current Portfolio VaR (1-day, 95%): {var_result['current_var']:.4f} ({var_result['current_var']*100:.2f}%)
- Proposed Portfolio VaR (1-day, 95%): {var_result['proposed_var']:.4f} ({var_result['proposed_var']*100:.2f}%)
- VaR Change: {var_result['var_change']:+.4f}
- VaR Threshold: 0.0500 (5.00%) — VETO if proposed exceeds this

Your job is to reason about these numbers and decide APPROVE / MODIFY / VETO. Do not recalculate VaR yourself.

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
            span.set_attribute("risk.current_var", var_result["current_var"])
            span.set_attribute("risk.proposed_var", var_result["proposed_var"])
            span.set_attribute("risk.verdict", risk_report.get("verdict", "")[:200])

            logging.info(
                f"[Risk Agent] Cycle {cycle_id}: {decision} — "
                f"VaR {var_result['current_var']:.4f} → "
                f"{var_result['proposed_var']:.4f}"
            )

            await broadcast_event("agent_done", {
                "agent": "risk_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
            return {
                "risk_report": {
                    "decision": decision,
                    "current_var": var_result["current_var"],
                    "proposed_var": var_result["proposed_var"],
                    "verdict": risk_report.get("verdict", ""),
                    "modifications": risk_report.get("modifications", ""),
                    "vetoed_trades": parsed.get("vetoed_trades", []),
                    "modified_trades": parsed.get("modified_trades", []),
                },
                "computed_var": var_result,
            }

        except json.JSONDecodeError as e:
            logging.error(f"[Risk Agent] JSON parse error: {e}")
            await broadcast_event("agent_done", {
                "agent": "risk_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
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
            await broadcast_event("agent_done", {
                "agent": "risk_agent",
                "status": "done",
                "cycle_id": state.get("cycle_id", "unknown"),
            })
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
