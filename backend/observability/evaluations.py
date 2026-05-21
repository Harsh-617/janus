from config import settings
from graph.state import JanusState
import logging
import httpx
from datetime import datetime, timezone


async def post_cycle_evaluations(state: JanusState) -> bool:
    """
    Post judge scores to Phoenix as evaluations linked to the cycle trace.
    Returns True on success, False on failure (never raises).
    """
    judge_scores = state.get("judge_scores")
    if not judge_scores:
        logging.warning("[Evaluations] No judge scores in state — skipping")
        return False

    cycle_id = state.get("cycle_id", "unknown")
    trace_id = state.get("phoenix_trace_id", cycle_id)

    dimensions = [
        ("correctness", judge_scores.get("correctness", 5)),
        ("safety", judge_scores.get("safety", 5)),
        ("hallucination_risk", judge_scores.get("hallucination_risk", 5)),
        ("compliance", judge_scores.get("compliance", 5)),
        ("explainability", judge_scores.get("explainability", 5)),
    ]

    try:
        evals_url = f"{settings.PHOENIX_BASE_URL}/v1/span_annotations"

        # Build annotations format (Phoenix local uses span_annotations)
        annotations = []
        for name, score in dimensions:
            normalized = score / 10.0
            annotations.append({
                "span_id": trace_id,
                "name": name,
                "annotator_kind": "LLM",
                "result": {
                    "label": "pass" if normalized >= 0.6 else "fail",
                    "score": normalized,
                    "explanation": judge_scores.get("critical_finding", "")
                },
                "metadata": {
                    "cycle_id": cycle_id,
                    "overall_score": judge_scores.get("overall_score", 5.0),
                    "learning_event": judge_scores.get("learning_event", False),
                }
            })

        # Add overall
        overall_normalized = judge_scores.get("overall_score", 5.0) / 10.0
        annotations.append({
            "span_id": trace_id,
            "name": "overall",
            "annotator_kind": "LLM",
            "result": {
                "label": "pass" if overall_normalized >= 0.6 else "fail",
                "score": overall_normalized,
                "explanation": judge_scores.get("critical_finding", "")
            },
            "metadata": {
                "cycle_id": cycle_id,
                "learning_event": judge_scores.get("learning_event", False),
                "recommended_constraint": judge_scores.get("recommended_constraint", ""),
            }
        })

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                evals_url,
                json={"data": annotations},
                headers={"Content-Type": "application/json"},
            )
            if response.status_code in (200, 201, 204):
                logging.info(
                    f"[Evaluations] Posted {len(annotations)} annotations "
                    f"for cycle {cycle_id} to Phoenix"
                )
                return True
            else:
                logging.warning(
                    f"[Evaluations] Phoenix returned {response.status_code}: "
                    f"{response.text[:200]}"
                )
                return False
    except httpx.ConnectError:
        logging.warning(
            f"[Evaluations] Phoenix unreachable at {settings.PHOENIX_BASE_URL} "
            f"— skipping eval post for cycle {cycle_id}"
        )
        return False
    except Exception as e:
        logging.warning(f"[Evaluations] Failed to post evaluations: {e}")
        return False


async def post_learning_event_to_dataset(state: JanusState) -> bool:
    """
    If this cycle is a learning event, add it to the Phoenix
    janus_learning_events dataset for the Janus Loop to query.
    Returns True on success, False on failure (never raises).
    """
    judge_scores = state.get("judge_scores", {})
    if not judge_scores.get("learning_event", False):
        return False

    cycle_id = state.get("cycle_id", "unknown")

    example = {
        "input": {
            "cycle_id": cycle_id,
            "trading_thesis": state.get("trading_thesis", ""),
            "market_shock_active": state.get("market_shock_active", False),
            "market_shock_description": state.get("market_shock_description", ""),
            "final_decision": state.get("regulator_decision", {}).get("final_decision", ""),
            "fraud_alerts_count": len(state.get("fraud_alerts", [])),
        },
        "output": {
            "overall_score": judge_scores.get("overall_score", 0.0),
            "correctness": judge_scores.get("correctness", 0),
            "safety": judge_scores.get("safety", 0),
            "hallucination_risk": judge_scores.get("hallucination_risk", 0),
            "compliance": judge_scores.get("compliance", 0),
            "explainability": judge_scores.get("explainability", 0),
        },
        "metadata": {
            "critical_finding": judge_scores.get("critical_finding", ""),
            "learning_event_reason": judge_scores.get("learning_event_reason", ""),
            "recommended_constraint": judge_scores.get("recommended_constraint", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }

    try:
        dataset_url = f"{settings.PHOENIX_BASE_URL}/v1/datasets"
        payload = {
            "name": "janus_learning_events",
            "description": "Janus learning events for self-correction",
            "inputs": [example["input"]],
            "outputs": [example["output"]],
            "metadata": [example["metadata"]],
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                dataset_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if response.status_code in (200, 201, 204):
                logging.info(
                    f"[Evaluations] Learning event {cycle_id} "
                    f"added to janus_learning_events dataset"
                )
                return True
            else:
                logging.warning(
                    f"[Evaluations] Dataset post returned "
                    f"{response.status_code}: {response.text[:200]}"
                )
                return False
    except httpx.ConnectError:
        logging.warning("[Evaluations] Phoenix unreachable — skipping dataset post")
        return False
    except Exception as e:
        logging.warning(f"[Evaluations] Failed to post to dataset: {e}")
        return False
