from config import settings
from db.firestore_client import get_cycles, save_constraint, get_active_constraints, update_constraint
from services.gemini_client import generate
from services.phoenix_service import get_scores_from_cycles, create_constraint_experiment
from services.phoenix_mcp_client import get_recent_traces, list_available_tools
from observability.tracing import trace_agent_call
import asyncio
import logging
import json
import uuid
from datetime import datetime, timezone

_last_run_at: str | None = None

META_AGENT_PROMPT = """You are the Janus Loop Meta Agent — a self-correction engine for an
autonomous financial AI system. You analyze recent decision cycle history
to identify failure patterns and generate behavioral constraints that
will improve future performance.

You receive:
- Recent cycle data with judge scores across 5 dimensions
- Learning events (cycles that scored below threshold)
- Current active constraints

Your job:
1. Identify which dimensions are consistently underperforming
2. Find specific behavioral patterns that cause failures
3. Generate 2-3 precise behavioral constraints to fix them

CONSTRAINT FORMAT:
Each constraint must be:
- Specific and actionable (not vague like "be more careful")
- Targeted at a specific agent
- Triggered by a specific condition
- Measurable in its effect

OUTPUT FORMAT:
Respond with JSON only, no markdown:
{
  "pattern_analysis": "<what patterns you found in the failure data>",
  "underperforming_dimensions": ["<dim1>", "<dim2>"],
  "constraints": [
    {
      "target_agent": "trading_agent" | "risk_agent" | "fraud_agent" | "regulator_agent",
      "condition": "<when this constraint applies>",
      "rule": "<specific behavioral rule>",
      "rationale": "<why this will improve the identified pattern>",
      "expected_improvement": "<which dimension this targets>"
    }
  ]
}

Generate between 1 and 3 constraints. Quality over quantity.
"""


async def run_janus_loop() -> dict:
    """
    Run the Janus Loop self-correction engine.
    Reads cycle history, identifies patterns, generates constraints.
    Returns a summary of what was generated.
    """
    logging.info("[Janus Loop] Starting self-correction run")

    tools = await list_available_tools()
    if tools:
        logging.info(f"[Janus Loop] Phoenix MCP connected — tools available: {tools}")
    else:
        logging.info("[Janus Loop] Phoenix MCP unavailable — falling back to Firestore")

    mcp_traces = await get_recent_traces(limit=20)
    logging.info(f"[Janus Loop] Phoenix MCP returned {len(mcp_traces)} learning event traces")

    try:
        recent_cycles = await get_cycles(limit=20)

        if len(recent_cycles) < 3:
            logging.info("[Janus Loop] Not enough cycles yet (need 3+) — skipping")
            return {"status": "skipped", "reason": "insufficient_data"}

        learning_events = [c for c in recent_cycles if c.get("learning_event")]

        if not learning_events:
            logging.info("[Janus Loop] No learning events found — system performing well")
            return {"status": "skipped", "reason": "no_learning_events"}

        dims = ["correctness", "safety", "hallucination_risk", "compliance", "explainability"]
        dim_avgs = {}
        for dim in dims:
            key = f"judge_{dim}"
            scores = [c.get(key, 5) for c in recent_cycles if c.get(key)]
            dim_avgs[dim] = round(sum(scores) / len(scores), 2) if scores else 5.0

        active_constraints = await get_active_constraints()
        active_rules = [c.get("rule", "") for c in active_constraints]

        user_message = f"""
RECENT CYCLE ANALYSIS ({len(recent_cycles)} cycles):

Average judge scores by dimension:
{json.dumps(dim_avgs, indent=2)}

Learning events ({len(learning_events)} of {len(recent_cycles)} cycles):
{json.dumps([{
    "cycle_id": c.get("cycle_id"),
    "overall_score": c.get("judge_overall_score"),
    "critical_finding": c.get("critical_finding", ""),
    "recommended_constraint": c.get("recommended_constraint", ""),
    "final_decision": c.get("final_decision"),
    "fraud_alerts_count": c.get("fraud_alerts_count", 0),
} for c in learning_events[:10]], indent=2)}

CURRENTLY ACTIVE CONSTRAINTS:
{json.dumps(active_rules, indent=2)}

Analyze these patterns and generate behavioral constraints to improve
the underperforming dimensions. Do not duplicate existing constraints.
"""

        with trace_agent_call("meta_agent", f"janus_loop_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}") as span:
            raw_output = await generate(
                system_prompt=META_AGENT_PROMPT,
                user_message=user_message,
                temperature=0.4,
            )

            clean = raw_output.strip()
            if clean.startswith("```"):
                import re
                clean = re.sub(r"```(?:json)?", "", clean).strip().rstrip("```").strip()

            parsed = json.loads(clean)

            constraints_generated = []
            for c in parsed.get("constraints", []):
                constraint_id = f"constraint_{str(uuid.uuid4())[:8]}"
                constraint_record = {
                    "constraint_id": constraint_id,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "generated_by": "janus_loop",
                    "target_agent": c.get("target_agent", "trading_agent"),
                    "condition": c.get("condition", ""),
                    "rule": c.get("rule", ""),
                    "rationale": c.get("rationale", ""),
                    "expected_improvement": c.get("expected_improvement", ""),
                    "status": "ACTIVE",
                    "performance_delta": {
                        "safety_before": dim_avgs.get("safety", 0),
                        "safety_after": None,
                        "cycles_active": 0,
                    },
                    "expires_after_cycles": 50,
                }
                await save_constraint(constraint_id, constraint_record)
                constraints_generated.append(constraint_record)

            constraint_ids = [c["constraint_id"] for c in constraints_generated]
            loop_run_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            scores_before = await get_scores_from_cycles(recent_cycles)
            experiment_id = await create_constraint_experiment(
                constraint_ids=constraint_ids,
                scores_before=scores_before,
                scores_after={},
                loop_run_id=loop_run_id,
            )
            if experiment_id:
                for cid in constraint_ids:
                    await update_constraint(cid, {"phoenix_experiment_id": experiment_id})
                logging.info(f"[Janus Loop] Phoenix experiment {experiment_id} linked to {len(constraint_ids)} constraints")
            else:
                logging.warning("[Janus Loop] Phoenix experiment creation returned None — phoenix_experiment_id not written")

            span.set_attribute("janus_loop.constraints_generated", len(constraints_generated))
            span.set_attribute("janus_loop.learning_events_analyzed", len(learning_events))
            span.set_attribute("janus_loop.pattern", parsed.get("pattern_analysis", "")[:200])

            global _last_run_at
            _last_run_at = datetime.now(timezone.utc).isoformat()

            logging.info(f"[Janus Loop] Generated {len(constraints_generated)} constraints")
            logging.info(f"[Janus Loop] Pattern: {parsed.get('pattern_analysis', '')[:100]}")

            return {
                "status": "completed",
                "constraints_generated": len(constraints_generated),
                "learning_events_analyzed": len(learning_events),
                "pattern_analysis": parsed.get("pattern_analysis", ""),
                "underperforming_dimensions": parsed.get("underperforming_dimensions", []),
                "constraints": constraints_generated,
            }

    except json.JSONDecodeError as e:
        logging.error(f"[Janus Loop] JSON parse error: {e}")
        return {"status": "error", "reason": str(e)}
    except Exception as e:
        logging.error(f"[Janus Loop] Error: {e}")
        return {"status": "error", "reason": str(e)}


async def maybe_run_janus_loop(cycle_number: int) -> None:
    """Called after each cycle — fires Janus Loop every N cycles."""
    if cycle_number % settings.JANUS_LOOP_INTERVAL_CYCLES == 0:
        logging.info(f"[Janus Loop] Scheduled trigger at cycle {cycle_number}")
        await run_janus_loop()
