import logging
from db.firestore_client import get_cycles

DIMENSION_FIELD_MAP = {
    "correctness": "judge_correctness",
    "safety": "judge_safety",
    "hallucination_risk": "judge_hallucination_risk",
    "compliance": "judge_compliance",
    "explainability": "judge_explainability",
    "overall": "judge_overall_score",
}

_AGENTS = [
    "trading_agent",
    "risk_agent",
    "fraud_agent",
    "regulator_agent",
    "judge_agent",
]

_DIMENSIONS = [
    "correctness",
    "safety",
    "hallucination_risk",
    "compliance",
    "explainability",
    "overall",
]


def _extract_scores(cycles: list[dict], dimension: str) -> list[float]:
    field = DIMENSION_FIELD_MAP.get(dimension)
    if not field:
        return []
    scores = []
    for cycle in cycles:
        val = cycle.get(field)
        if val is not None:
            try:
                scores.append(float(val))
            except (TypeError, ValueError):
                pass
    return list(reversed(scores))  # chronological order (oldest first)


def _linear_slope(scores: list[float]) -> float:
    n = len(scores)
    x = list(range(n))
    sum_x = sum(x)
    sum_y = sum(scores)
    sum_xy = sum(xi * yi for xi, yi in zip(x, scores))
    sum_x2 = sum(xi * xi for xi in x)
    denom = n * sum_x2 - sum_x * sum_x
    if denom == 0:
        return 0.0
    return (n * sum_xy - sum_x * sum_y) / denom


def _confidence(n: int) -> float:
    if n >= 8:
        return 1.0
    if n >= 5:
        return 0.7
    return 0.4


def _classify(slope: float) -> str:
    if slope > 0.15:
        return "IMPROVING"
    if slope < -0.15:
        return "DEGRADING"
    return "STABLE"


def _compute_from_scores(scores: list[float], dimension: str, window: int) -> dict:
    n = len(scores)
    if n < 3:
        return {"trend": "INSUFFICIENT_DATA", "slope": None, "confidence": 0}

    slope = _linear_slope(scores)
    return {
        "trend": _classify(slope),
        "slope": round(slope, 4),
        "confidence": _confidence(n),
        "window": window,
        "data_points": n,
        "latest_score": scores[-1],
        "earliest_score": scores[0],
    }


class TrendAnalyzer:
    async def compute_trends(
        self, agent_id: str, dimension: str, window: int = 10
    ) -> dict:
        cycles = await get_cycles(limit=window)
        scores = _extract_scores(cycles, dimension)
        return _compute_from_scores(scores, dimension, window)

    async def compute_all_trends(self, window: int = 10) -> dict:
        cycles = await get_cycles(limit=window)
        result: dict = {}
        for agent_id in _AGENTS:
            result[agent_id] = {}
            for dimension in _DIMENSIONS:
                scores = _extract_scores(cycles, dimension)
                result[agent_id][dimension] = _compute_from_scores(
                    scores, dimension, window
                )
        return result
