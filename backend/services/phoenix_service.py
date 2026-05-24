import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

DIMENSIONS = ["correctness", "safety", "hallucination_risk", "compliance", "explainability", "overall"]


async def create_constraint_experiment(
    constraint_ids: list[str],
    scores_before: dict,
    scores_after: dict,
    loop_run_id: str,
) -> str | None:
    """
    Creates a Phoenix Experiment comparing scores before and after constraints were applied.
    Returns the experiment ID if successful, None if Phoenix is unreachable.
    """
    payload = {
        "name": f"janus-loop-{loop_run_id}",
        "description": (
            f"Pre/post constraint comparison for loop run {loop_run_id}. "
            f"Constraints: {', '.join(constraint_ids)}"
        ),
        "metadata": {
            "loop_run_id": loop_run_id,
            "constraint_ids": constraint_ids,
            "scores_before": scores_before,
            "scores_after": scores_after,
            "improvement": {
                dimension: round(scores_after[dimension] - scores_before[dimension], 2)
                for dimension in scores_before
                if dimension in scores_after
            },
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.PHOENIX_BASE_URL}/v1/experiments",
                json=payload,
            )

        if response.status_code in (200, 201):
            data = response.json()
            experiment_id = (
                data.get("id")
                or data.get("experiment_id")
                or data.get("experimentId")
            )
            logger.info(
                f"[Phoenix] Created experiment '{payload['name']}' — id={experiment_id}"
            )
            return experiment_id
        else:
            logger.warning(
                f"[Phoenix] Experiment creation returned {response.status_code}: {response.text[:200]}"
            )
            return None

    except Exception as e:
        logger.warning(f"[Phoenix] Experiment creation failed (Phoenix may be unreachable): {e}")
        return None


async def get_scores_from_cycles(cycles: list[dict]) -> dict:
    """
    Averages dimension scores across a list of cycle dicts.
    Returns { correctness, safety, hallucination_risk, compliance, explainability, overall }
    Returns all zeros if cycles list is empty or has no judge_scores.
    """
    if not cycles:
        return {dim: 0.0 for dim in DIMENSIONS}

    dim_scores: dict[str, list[float]] = {dim: [] for dim in DIMENSIONS}

    for cycle in cycles:
        for dim in ["correctness", "safety", "hallucination_risk", "compliance", "explainability"]:
            val = cycle.get(f"judge_{dim}")
            if val is not None:
                try:
                    dim_scores[dim].append(float(val))
                except (TypeError, ValueError):
                    pass
        overall = cycle.get("judge_overall_score")
        if overall is not None:
            try:
                dim_scores["overall"].append(float(overall))
            except (TypeError, ValueError):
                pass

    return {
        dim: round(sum(vals) / len(vals), 2) if vals else 0.0
        for dim, vals in dim_scores.items()
    }
