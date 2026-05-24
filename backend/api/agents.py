from datetime import datetime, timezone

from fastapi import APIRouter

from config import settings
from db.firestore_client import get_cycles, get_active_constraints, get_portfolio

router = APIRouter()

AGENT_IDS = ["trading_agent", "risk_agent", "fraud_agent", "regulator_agent", "judge_agent"]

DIMENSION_KEYS = ["correctness", "safety", "hallucination_risk", "compliance", "explainability"]


def _display_name(agent_id: str) -> str:
    return " ".join(word.capitalize() for word in agent_id.split("_"))


def _last_decision_for(agent_id: str, cycles: list[dict]) -> tuple[str, str | None]:
    """Return (last_decision_text, last_decision_at_iso) for a given agent."""
    for cycle in cycles:
        decisions = cycle.get("decisions", {})
        if agent_id in decisions:
            action = decisions[agent_id]
            if isinstance(action, dict):
                text = action.get("action") or action.get("decision") or str(action)
            else:
                text = str(action)
            ts = cycle.get("timestamp")
            at = ts.isoformat() if hasattr(ts, "isoformat") else str(ts) if ts else None
            return text, at
    return "No data yet", None


DIMENSION_FIELD_MAP = {
    "correctness": "judge_correctness",
    "safety": "judge_safety",
    "hallucination_risk": "judge_hallucination_risk",
    "compliance": "judge_compliance",
    "explainability": "judge_explainability",
}


def _dimension_averages(cycles: list[dict]) -> dict:
    totals = {k: 0.0 for k in DIMENSION_KEYS}
    counts = {k: 0 for k in DIMENSION_KEYS}

    for cycle in cycles:
        if not cycle.get("judge_overall_score"):
            continue
        for key, field in DIMENSION_FIELD_MAP.items():
            val = cycle.get(field)
            if val is not None:
                try:
                    totals[key] += float(val)
                    counts[key] += 1
                except (TypeError, ValueError):
                    pass

    return {k: round(totals[k] / counts[k], 2) if counts[k] else 0.0 for k in DIMENSION_KEYS}


def _avg_judge_score(cycles: list[dict]) -> float:
    total, count = 0.0, 0
    for cycle in cycles:
        val = cycle.get("judge_overall_score", 0.0)
        if val:
            try:
                total += float(val)
                count += 1
            except (TypeError, ValueError):
                pass
    return round(total / count, 2) if count else 0.0


@router.get("/agents")
async def get_agents():
    cycles, all_constraints, portfolio = await _fetch_data()

    circuit_breaker = portfolio.get("circuit_breaker_active", False) if portfolio else False

    agents = []
    for agent_id in AGENT_IDS:
        last_decision, last_decision_at = _last_decision_for(agent_id, cycles)
        agent_constraints = [c for c in all_constraints if c.get("target_agent") == agent_id]

        if circuit_breaker:
            status = "CIRCUIT_BREAKER"
        elif cycles:
            status = "ACTIVE"
        else:
            status = "IDLE"

        agents.append({
            "agent_id": agent_id,
            "display_name": _display_name(agent_id),
            "last_decision": last_decision,
            "last_decision_at": last_decision_at,
            "avg_judge_score_last_20": _avg_judge_score(cycles),
            "dimension_scores": _dimension_averages(cycles),
            "active_constraints": agent_constraints,
            "status": status,
        })

    return {
        "agents": agents,
        "cycle_count": len(cycles),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


async def _fetch_data():
    import asyncio
    cycles, constraints, portfolio = await asyncio.gather(
        get_cycles(limit=20),
        get_active_constraints(),
        get_portfolio(settings.FIRESTORE_PORTFOLIO_ID),
    )
    return cycles, constraints, portfolio
