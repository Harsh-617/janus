from config import settings
from graph.state import JanusState
import logging
import httpx
from datetime import datetime, timezone

_dataset_id: str | None = None


def _trend_to_score(trend: str) -> float:
    return {"IMPROVING": 1.0, "STABLE": 0.5, "DEGRADING": 0.0}.get(trend, 0.5)


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
    span_id = state.get("phoenix_span_id") or state.get("phoenix_trace_id", "")
    if not span_id:
        span_id = cycle_id

    logging.info(f"Posting evaluations for span_id={span_id} cycle={cycle_id}")

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
                "span_id": span_id,
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
            "span_id": span_id,
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
                try:
                    from services.trend_analyzer import TrendAnalyzer
                    analyzer = TrendAnalyzer()
                    trend_annotations = []
                    for dim in [
                        "correctness",
                        "safety",
                        "hallucination_risk",
                        "compliance",
                        "explainability",
                    ]:
                        trend_result = await analyzer.compute_trends(
                            "trading_agent", dim, window=10
                        )
                        if trend_result["trend"] != "INSUFFICIENT_DATA":
                            trend_annotations.append({
                                "span_id": span_id,
                                "name": f"{dim}_trend",
                                "annotator_kind": "LLM",
                                "result": {
                                    "label": trend_result["trend"],
                                    "score": _trend_to_score(trend_result["trend"]),
                                    "explanation": (
                                        f"Slope: {trend_result['slope']:.3f}/cycle over "
                                        f"{trend_result['data_points']} cycles. "
                                        f"Latest: {trend_result['latest_score']}, "
                                        f"Earliest: {trend_result['earliest_score']}. "
                                        f"Confidence: {trend_result['confidence']}"
                                    ),
                                },
                                "metadata": {"cycle_id": cycle_id},
                            })
                    if trend_annotations:
                        await client.post(
                            evals_url,
                            json={"data": trend_annotations},
                            headers={"Content-Type": "application/json"},
                        )
                        logging.info(
                            f"[Evaluations] Posted {len(trend_annotations)} trend "
                            f"annotations for cycle {cycle_id} to Phoenix"
                        )
                except Exception as _trend_err:
                    logging.warning(
                        f"[Evaluations] Trend annotation failed (non-fatal): {_trend_err}"
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


async def _get_cached_dataset_id(client: httpx.AsyncClient) -> str | None:
    """Return cached dataset ID by looking it up via GET /v1/datasets."""
    global _dataset_id
    if _dataset_id is not None:
        return _dataset_id

    base = settings.PHOENIX_BASE_URL
    dataset_name = "janus_learning_events"

    get_resp = await client.get(
        f"{base}/v1/datasets",
        params={"name": dataset_name},
    )
    logging.info(
        f"[Evaluations] GET /v1/datasets?name={dataset_name} "
        f"→ {get_resp.status_code}: {get_resp.text[:300]}"
    )
    if get_resp.status_code != 200:
        return None

    body = get_resp.json()
    # Response shape: {"data": [...]} or {"datasets": [...]} or plain list
    if isinstance(body, dict):
        items = body.get("data") or body.get("datasets") or []
    elif isinstance(body, list):
        items = body
    else:
        items = []

    if items:
        _dataset_id = items[0].get("id") or items[0].get("dataset_id")
        if _dataset_id:
            logging.info(f"[Evaluations] Found existing dataset id={_dataset_id}")
    return _dataset_id


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
        async with httpx.AsyncClient(timeout=10.0) as client:
            # POST /v1/datasets/upload creates or updates the dataset in one call.
            # action="update" means "upsert" — creates if absent, appends otherwise.
            upload_url = f"{settings.PHOENIX_BASE_URL}/v1/datasets/upload"
            payload = {
                "action": "update",
                "name": "janus_learning_events",
                "description": "Janus learning events for self-correction",
                "inputs": [example["input"]],
                "outputs": [example["output"]],
                "metadata": [example["metadata"]],
            }
            response = await client.post(
                upload_url,
                json=payload,
                params={"sync": "true"},
                headers={"Content-Type": "application/json", "accept": "application/json"},
            )
            if response.status_code in (200, 201, 204):
                # Cache the dataset ID from the response for future lookups
                try:
                    body = response.json()
                    ds = body.get("data", body) if isinstance(body, dict) else body
                    if isinstance(ds, dict):
                        global _dataset_id
                        _dataset_id = ds.get("id") or ds.get("dataset_id") or _dataset_id
                except Exception:
                    pass
                logging.info(
                    f"[Evaluations] Learning event {cycle_id} "
                    f"uploaded to janus_learning_events dataset"
                )
                return True
            else:
                logging.warning(
                    f"[Evaluations] Dataset upload returned "
                    f"{response.status_code}: {response.text[:200]}"
                )
                return False
    except httpx.ConnectError:
        logging.warning("[Evaluations] Phoenix unreachable — skipping dataset post")
        return False
    except Exception as e:
        logging.warning(f"[Evaluations] Failed to post to dataset: {e}")
        return False
