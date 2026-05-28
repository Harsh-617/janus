import json
import logging
import re

from config import settings
from db.firestore_client import get_trades
from graph.state import JanusState
from observability.tracing import trace_agent_call
from services.gemini_client import generate
from services.hallucination_detector import HallucinationDetector

_hallucination_detector = HallucinationDetector()

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


def detect_wash_trading(trade_history: list) -> list:
    """
    Detects wash trading: same ticker bought AND sold within
    the last 5 trades.
    Returns list of alert dicts.
    """
    alerts = []
    recent = trade_history[-5:] if len(trade_history) >= 5 else trade_history
    tickers_bought = {t["ticker"] for t in recent if t.get("action") == "BUY"}
    tickers_sold = {t["ticker"] for t in recent if t.get("action") == "SELL"}
    wash_tickers = tickers_bought & tickers_sold
    for ticker in wash_tickers:
        alerts.append({
            "type": "WASH_TRADING",
            "severity": "HIGH",
            "description": f"{ticker} was both bought and sold in the last 5 trades — potential wash trading pattern.",
            "recommendation": "Escalate to Regulator. Halt trading in this ticker."
        })
    return alerts


def detect_concentration(trade_history: list, total_portfolio_value: float) -> list:
    """
    Detects unusual concentration: single ticker > 30% of all
    trades by count in last 20 trades.
    Returns list of alert dicts.
    """
    alerts = []
    if not trade_history:
        return alerts
    recent = trade_history[-20:]
    ticker_counts = {}
    for t in recent:
        ticker = t.get("ticker", "UNKNOWN")
        ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
    total = len(recent)
    for ticker, count in ticker_counts.items():
        pct = count / total
        if pct > 0.30:
            alerts.append({
                "type": "CONCENTRATION",
                "severity": "MEDIUM",
                "description": f"{ticker} appears in {count}/{total} recent trades ({pct*100:.0f}%) — unusual concentration.",
                "recommendation": "Review trading pattern for potential manipulation."
            })
    return alerts


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

            total_portfolio_value = state.get("portfolio", {}).get("total_value", 1000000)
            programmatic_alerts = detect_wash_trading(recent_trades)
            programmatic_alerts += detect_concentration(recent_trades, total_portfolio_value)

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

PRE-COMPUTED FRAUD SIGNALS (Python-detected, factual):
{json.dumps(programmatic_alerts, indent=2) if programmatic_alerts else "None detected"}

Your task: Focus ONLY on reasoning inconsistency detection.
Check if the Trading Agent's stated thesis matches its proposed
actions. The above signals are already confirmed — do not
re-analyze them, just include them in your output as-is.
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

            # Merge: programmatic alerts take precedence; deduplicate LLM alerts by type.
            # CONCENTRATION and UNUSUAL_CONCENTRATION are treated as the same category.
            prog_types = {a["type"] for a in programmatic_alerts}
            if "CONCENTRATION" in prog_types:
                prog_types.add("UNUSUAL_CONCENTRATION")
            llm_alerts = [a for a in parsed.get("alerts", []) if a.get("type") not in prog_types]
            alerts = programmatic_alerts + llm_alerts

            # Data-driven hallucination checks (beta, correlation, concentration)
            hallucination_flags = await _hallucination_detector.check(
                reasoning=state["trading_thesis"],
                proposed_trades=state.get("trading_proposal", {}).get("trades", []),
                portfolio=state.get("portfolio", {}),
            )
            for flag in hallucination_flags:
                alerts.append({
                    "type": "HALLUCINATION_DETECTED",
                    "severity": "HIGH",
                    "description": flag.get("flag", str(flag)),
                    "recommendation": "Escalate to Regulator. Flag trace for Phoenix review.",
                    "detail": flag,
                })

            status = "ALERT" if alerts else "CLEAR"
            investigation_open = parsed.get("investigation_open", False) or any(
                a.get("severity") == "HIGH" for a in alerts
            )

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
