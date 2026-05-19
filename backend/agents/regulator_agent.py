import json
import logging
import re
import uuid
from datetime import datetime, timezone

from langchain_google_vertexai import ChatVertexAI

from config import settings
from graph.state import JanusState
from observability.tracing import trace_agent_call

model = ChatVertexAI(
    model_name=settings.VERTEX_MODEL,
    temperature=0.2,
    project=settings.GCP_PROJECT,
    location=settings.GCP_LOCATION,
)

REGULATOR_AGENT_PROMPT = """You are the Regulator Agent for Janus — the final gatekeeper combining
SEC and central bank roles. You make the definitive decision on whether
trades execute, are held, or the system is halted.

You receive inputs from three upstream agents and must synthesize them
into a final decision.

CIRCUIT BREAKER CONDITIONS (activate if ANY of these are true):
- Fraud Agent has raised a HIGH severity alert
- Risk Agent issued a VETO due to VaR breach
- The fraud investigation is open
- Market shock is active AND risk decision is VETO

HOLD CONDITIONS (do not execute, but do not halt system):
- Risk Agent issued MODIFY but modifications seem insufficient
- Fraud alerts are MEDIUM severity only
- Confidence from Trading Agent is below 0.3

EXECUTE CONDITIONS:
- Risk Agent approved or modified with acceptable changes
- No HIGH severity fraud alerts
- System not in crisis

YOUR RESPONSIBILITIES:
1. Make the final EXECUTE / HOLD / HALT decision
2. If HALT: specify cooldown period and resume conditions
3. Always provide a clear audit trail reason
4. If EXECUTE with modifications: specify exactly which trades execute

OUTPUT FORMAT:
Respond with JSON only, no markdown:
{
  "final_decision": "EXECUTE" | "HOLD" | "HALT",
  "circuit_breaker_activated": <true | false>,
  "cooldown_minutes": <0 if not halting, else 15-60>,
  "reason": "<clear explanation of decision for audit trail>",
  "trades_to_execute": [...],
  "resume_conditions": ["<condition 1>", "<condition 2>"],
  "compliance_score": <0.0 to 1.0, your assessment of overall compliance>
}

If HOLD or HALT, trades_to_execute is an empty array.
resume_conditions only needed if circuit_breaker_activated is true."""


async def regulator_agent_node(state: JanusState) -> dict:
    """LangGraph node function for the Regulator Agent."""

    cycle_id = state["cycle_id"]

    with trace_agent_call("regulator_agent", cycle_id) as span:
        try:
            audit_trail_id = f"audit_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{str(uuid.uuid4())[:8]}"

            risk_report = state.get("risk_report", {})
            fraud_alerts = state.get("fraud_alerts", [])
            investigation_open = state.get("fraud_investigation_open", False)

            user_message = f"""
ORIGINAL TRADE PROPOSAL:
{json.dumps(state.get("trading_proposal", []), indent=2)}

TRADING THESIS: {state.get("trading_thesis", "")}
TRADING CONFIDENCE: {state.get("trading_confidence", 0.0)}

RISK AGENT DECISION: {risk_report.get("decision", "UNKNOWN")}
RISK REPORT:
{json.dumps(risk_report, indent=2)}

FRAUD AGENT STATUS: {"ALERT" if fraud_alerts else "CLEAR"}
FRAUD ALERTS:
{json.dumps(fraud_alerts, indent=2)}
INVESTIGATION OPEN: {investigation_open}

MARKET SHOCK ACTIVE: {state["market_shock_active"]}
{f"SHOCK DESCRIPTION: {state['market_shock_description']}" if state["market_shock_active"] else ""}

AUDIT TRAIL ID: {audit_trail_id}

Make your final regulatory decision.
"""
            from langchain_core.messages import HumanMessage, SystemMessage

            messages = [
                SystemMessage(content=REGULATOR_AGENT_PROMPT),
                HumanMessage(content=user_message),
            ]

            response = await model.ainvoke(messages)
            raw_output = response.content

            clean = raw_output.strip()
            if clean.startswith("```"):
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("```").strip()

            parsed = json.loads(clean)

            final_decision = parsed.get("final_decision", "HOLD")
            circuit_breaker = parsed.get("circuit_breaker_activated", False)

            span.set_attribute("regulator.final_decision", final_decision)
            span.set_attribute("regulator.circuit_breaker", circuit_breaker)
            span.set_attribute("regulator.cooldown_minutes", parsed.get("cooldown_minutes", 0))
            span.set_attribute("regulator.compliance_score", parsed.get("compliance_score", 0.0))
            span.set_attribute("regulator.reason", parsed.get("reason", "")[:200])
            span.set_attribute("regulator.audit_trail_id", audit_trail_id)

            if circuit_breaker:
                logging.warning(
                    f"[Regulator Agent] Cycle {cycle_id}: CIRCUIT BREAKER ACTIVATED — {parsed.get('reason', '')}"
                )
            else:
                logging.info(f"[Regulator Agent] Cycle {cycle_id}: {final_decision}")

            return {
                "regulator_decision": {
                    "final_decision": final_decision,
                    "circuit_breaker_activated": circuit_breaker,
                    "cooldown_minutes": parsed.get("cooldown_minutes", 0),
                    "reason": parsed.get("reason", ""),
                    "audit_trail_id": audit_trail_id,
                    "resume_conditions": parsed.get("resume_conditions", []),
                    "trades_to_execute": parsed.get("trades_to_execute", []),
                    "compliance_score": parsed.get("compliance_score", 0.0),
                },
                "pipeline_halted": final_decision == "HALT",
                "halt_reason": parsed.get("reason", "") if final_decision == "HALT" else "",
            }

        except json.JSONDecodeError as e:
            logging.error(f"[Regulator Agent] JSON parse error: {e}")
            return {
                "regulator_decision": {
                    "final_decision": "HOLD",
                    "circuit_breaker_activated": False,
                    "cooldown_minutes": 0,
                    "reason": f"Regulator parse error — defaulting to HOLD: {e}",
                    "audit_trail_id": audit_trail_id,
                    "resume_conditions": [],
                    "trades_to_execute": [],
                    "compliance_score": 0.0,
                },
                "pipeline_halted": False,
                "halt_reason": "",
            }
        except Exception as e:
            logging.error(f"[Regulator Agent] Error: {e}")
            span.record_exception(e)
            return {
                "regulator_decision": {
                    "final_decision": "HOLD",
                    "circuit_breaker_activated": False,
                    "cooldown_minutes": 0,
                    "reason": f"Regulator error — defaulting to HOLD: {str(e)}",
                    "audit_trail_id": f"audit_error_{cycle_id}",
                    "resume_conditions": [],
                    "trades_to_execute": [],
                    "compliance_score": 0.0,
                },
                "pipeline_halted": False,
                "halt_reason": "",
            }
