import asyncio
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from google.cloud.firestore_v1.base_query import FieldFilter

from config import settings
from db.firestore_client import get_cycles, db, COL_CONSTRAINTS, COL_CYCLES, COL_TRADES
import logging

router = APIRouter()

@router.get("/cycles")
async def list_cycles(limit: int = Query(default=20, ge=1, le=100)):
    """Get decision cycle history with judge scores."""
    cycles = await get_cycles(limit=limit)
    return {"cycles": cycles, "count": len(cycles)}

@router.get("/cycles/latest")
async def get_latest_cycle():
    """Get the most recent completed cycle."""
    cycles = await get_cycles(limit=1)
    if not cycles:
        return {"cycle": None}
    return {"cycle": cycles[0]}

@router.get("/cycles/scores-over-time")
async def get_scores_over_time(
    dimension: str = Query(default="safety"),
    window: int = Query(default=10, ge=1, le=50),
):
    valid_dimensions = {
        "overall", "safety", "correctness",
        "hallucination_risk", "compliance", "explainability",
    }
    if dimension not in valid_dimensions:
        raise HTTPException(
            status_code=400,
            detail=f"dimension must be one of: {', '.join(sorted(valid_dimensions))}",
        )

    field_map = {
        "overall": "judge_overall_score",
        "safety": "judge_safety",
        "correctness": "judge_correctness",
        "hallucination_risk": "judge_hallucination_risk",
        "compliance": "judge_compliance",
        "explainability": "judge_explainability",
    }
    score_field = field_map[dimension]

    raw = await get_cycles(limit=100)
    cycles = list(reversed(raw))  # oldest → newest

    def _get_constraints():
        docs = [d.to_dict() for d in db.collection(COL_CONSTRAINTS).stream() if d.to_dict()]
        docs.sort(key=lambda x: x.get("generated_at", ""))
        return docs

    constraints = await asyncio.to_thread(_get_constraints)

    # Build rolling-average data
    data = []
    scores: list[float] = []
    for i, cycle in enumerate(cycles):
        cn = cycle.get("cycle_number") or (i + 1)
        raw_score = float(cycle.get(score_field) or 0)
        scores.append(raw_score)
        rolling = sum(scores[-window:]) / min(len(scores), window)
        data.append({
            "cycle_number": cn,
            "cycle_id": cycle.get("cycle_id", ""),
            "raw_score": round(raw_score, 2),
            "rolling_avg": round(rolling, 2),
            "timestamp": cycle.get("timestamp", ""),
        })

    # Map each constraint to the nearest cycle by timestamp
    def _ts(s: str) -> float:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
        except (ValueError, TypeError, AttributeError):
            return 0.0

    cycle_times = [
        (_ts(c.get("timestamp", "")), c.get("cycle_number") or (i + 1))
        for i, c in enumerate(cycles)
    ]

    constraint_injections = []
    for c in constraints:
        c_epoch = _ts(c.get("generated_at", ""))
        if c_epoch == 0.0:
            continue
        nearest_cn = min(cycle_times, key=lambda t: abs(t[0] - c_epoch), default=None)
        if nearest_cn is None:
            continue
        constraint_injections.append({
            "cycle_number": nearest_cn[1],
            "constraint_id": c.get("constraint_id", ""),
            "rule": c.get("rule", ""),
            "target_agent": c.get("target_agent", ""),
        })

    constraint_injections.sort(key=lambda x: x["cycle_number"])

    return {
        "dimension": dimension,
        "window": window,
        "data": data,
        "constraint_injections": constraint_injections,
    }


@router.get("/cycles/{cycle_id}/explain")
async def explain_cycle(cycle_id: str):
    """Generate a plain-English audit brief for a decision cycle."""

    def _fetch_all():
        cycle_doc = db.collection(COL_CYCLES).document(cycle_id).get()
        if not cycle_doc.exists:
            return None, [], []

        cycle = cycle_doc.to_dict() or {}

        trade_docs = (
            db.collection(COL_TRADES)
            .where(filter=FieldFilter("cycle_id", "==", cycle_id))
            .stream()
        )
        trades = [d.to_dict() for d in trade_docs if d.to_dict()]

        all_constraint_docs = db.collection(COL_CONSTRAINTS).stream()
        all_constraints = [d.to_dict() for d in all_constraint_docs if d.to_dict()]

        cycle_ts_str = str(cycle.get("timestamp", ""))
        cycle_ts = None
        try:
            cycle_ts = datetime.fromisoformat(cycle_ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError, AttributeError):
            pass

        active_at_time = []
        for c in all_constraints:
            if c.get("status") != "ACTIVE":
                continue
            if cycle_ts is None:
                active_at_time.append(c)
                continue
            gen_str = str(c.get("generated_at", ""))
            try:
                gen_ts = datetime.fromisoformat(gen_str.replace("Z", "+00:00"))
                if gen_ts < cycle_ts:
                    active_at_time.append(c)
            except (ValueError, TypeError, AttributeError):
                pass

        return cycle, trades, active_at_time

    result = await asyncio.to_thread(_fetch_all)
    cycle, trades, constraints = result

    if cycle is None:
        raise HTTPException(status_code=404, detail=f"Cycle '{cycle_id}' not found")

    # ── Helpers ───────────────────────────────────────────────────────────────────

    def na(val, default="N/A"):
        if val is None or val == "" or val == [] or val == {}:
            return default
        return val

    def fmt_float(val, decimals=1):
        try:
            return f"{float(val):.{decimals}f}"
        except (TypeError, ValueError):
            return "N/A"

    # ── Metadata ──────────────────────────────────────────────────────────────────

    raw_ts = cycle.get("timestamp", "N/A")
    try:
        ts_parsed = datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00"))
        display_ts = ts_parsed.strftime("%Y-%m-%d %H:%M UTC")
    except (ValueError, TypeError, AttributeError):
        display_ts = str(raw_ts)

    cycle_num = na(cycle.get("cycle_number"), "?")
    brief_title = f"Decision Cycle {cycle_num} — {display_ts}"

    # ── Per-agent data ────────────────────────────────────────────────────────────

    decisions = cycle.get("decisions", {}) or {}
    trading_data = decisions.get("trading_agent", {}) or {}
    risk_data = decisions.get("risk_agent", {}) or {}
    fraud_data = decisions.get("fraud_agent", {}) or {}
    regulator_data = decisions.get("regulator_agent", {}) or {}

    # ── Proposal summary ──────────────────────────────────────────────────────────

    proposed_trades = trading_data.get("trades", []) or []
    trade_desc_parts = []
    for t in proposed_trades[:5]:
        direction = t.get("direction") or t.get("action") or "TRADE"
        quantity = t.get("quantity", "?")
        ticker = t.get("ticker", "?")
        total_value = t.get("total_value")
        price = t.get("price")
        if total_value is not None:
            trade_desc_parts.append(f"{direction} {quantity} {ticker} (${int(float(total_value)):,})")
        elif price is not None and isinstance(quantity, (int, float)):
            trade_desc_parts.append(f"{direction} {quantity} {ticker} (${int(quantity * float(price)):,})")
        else:
            trade_desc_parts.append(f"{direction} {quantity} {ticker}")

    thesis = na(trading_data.get("thesis"), "no thesis recorded")
    confidence = trading_data.get("confidence")
    confidence_str = fmt_float(confidence, 2) if confidence is not None else "N/A"
    action = na(trading_data.get("action"), "PROPOSE")

    if trade_desc_parts:
        proposal_summary = (
            f"Trading Agent proposed {len(proposed_trades)} trade(s): "
            f"{', '.join(trade_desc_parts)}. "
            f"Stated thesis: {thesis}. Confidence: {confidence_str}."
        )
    elif trading_data:
        proposal_summary = (
            f"Trading Agent action: {action}. "
            f"Stated thesis: {thesis}. Confidence: {confidence_str}."
        )
    else:
        proposal_summary = "N/A"

    # ── Risk summary ──────────────────────────────────────────────────────────────

    risk_decision = na(risk_data.get("decision"))
    risk_report = risk_data.get("risk_report", {}) or {}
    proposed_var = risk_report.get("proposed_var") or risk_report.get("var_post_trade")
    current_var = risk_report.get("current_var") or risk_report.get("var_current")
    verdict = na(risk_report.get("verdict") or risk_report.get("summary"))
    modifications = na(risk_report.get("modifications") or risk_report.get("modification_reason"))

    if risk_decision != "N/A":
        risk_parts = [f"Risk Agent returned {risk_decision}."]
        if proposed_var is not None:
            risk_parts.append(f"Post-trade VaR: {fmt_float(float(proposed_var) * 100, 1)}%.")
        if current_var is not None:
            risk_parts.append(f"Final VaR: {fmt_float(float(current_var) * 100, 1)}%.")
        if verdict != "N/A":
            risk_parts.append(verdict)
        if modifications != "N/A":
            risk_parts.append(modifications)
        risk_summary = " ".join(risk_parts)
    else:
        risk_summary = "N/A"

    # ── Fraud summary ─────────────────────────────────────────────────────────────

    fraud_status = na(fraud_data.get("status") or fraud_data.get("alert_level"))
    fraud_alerts = fraud_data.get("alerts", []) or []
    hallucination_checks = (
        fraud_data.get("hallucination_checks", {})
        or cycle.get("hallucination_checks", {})
        or {}
    )

    if fraud_status != "N/A":
        fraud_parts = [f"Fraud Agent — {fraud_status}."]
        if fraud_alerts:
            alert_types = [a.get("type", "UNKNOWN") for a in fraud_alerts if isinstance(a, dict)]
            fraud_parts.append(f"Alerts: {', '.join(alert_types)}.")
        else:
            fraud_parts.append(
                "No wash trading, front-running, or reasoning inconsistencies detected."
            )
        if hallucination_checks:
            check_parts = [
                f"{k.replace('_', ' ').title()}: {v}"
                for k, v in hallucination_checks.items()
            ]
            fraud_parts.append(f"Hallucination checks: {', '.join(check_parts)}.")
        else:
            raw_checks = []
            for key in ("beta_check", "correlation_check", "concentration_check"):
                val = fraud_data.get(key) or cycle.get(key)
                if val is not None:
                    raw_checks.append(f"{key.replace('_check', '').title()}: {val}")
            if raw_checks:
                fraud_parts.append(f"Hallucination checks: {', '.join(raw_checks)}.")
        fraud_summary = " ".join(fraud_parts)
    else:
        fraud_summary = "N/A"

    # ── Regulator summary ─────────────────────────────────────────────────────────

    reg_decision = na(
        regulator_data.get("final_decision") or cycle.get("final_decision")
    )
    audit_trail_id = na(
        regulator_data.get("audit_trail_id") or cycle.get("audit_trail_id")
    )
    circuit_breaker = bool(
        regulator_data.get("circuit_breaker_activated")
        or cycle.get("circuit_breaker_activated")
    )

    if reg_decision != "N/A":
        reg_parts = [f"Regulator Agent — {reg_decision}."]
        if circuit_breaker:
            reg_parts.append("Circuit breaker activated.")
        else:
            reg_parts.append(
                "All upstream signals within acceptable bounds. No circuit breaker conditions met."
            )
        if audit_trail_id != "N/A":
            reg_parts.append(f"Audit trail ID: {audit_trail_id}.")
        regulator_summary = " ".join(reg_parts)
    else:
        regulator_summary = "N/A"

    # ── Constraint summary ────────────────────────────────────────────────────────

    if constraints:
        enforced_raw = (
            cycle.get("enforced_constraints", [])
            or cycle.get("constraint_violations", [])
            or []
        )
        enforced_ids = {
            c.get("constraint_id") for c in enforced_raw if isinstance(c, dict)
        }
        constraint_parts = [f"{len(constraints)} active constraint(s) at time of cycle."]
        for c in constraints[:5]:
            cid = c.get("constraint_id", "?")
            rule = c.get("rule", "N/A")
            rule_short = rule[:60] + "..." if len(rule) > 60 else rule
            display_id = str(cid).replace("constraint_", "#").upper()
            status_note = "ENFORCED" if cid in enforced_ids else "ACTIVE"
            constraint_parts.append(
                f"Constraint {display_id} ({rule_short}) — {status_note}."
            )
        constraint_summary = " ".join(constraint_parts)
    else:
        constraint_summary = "No active constraints at time of cycle."

    # ── Judge summary ─────────────────────────────────────────────────────────────

    overall_score = cycle.get("judge_overall_score")
    dim_map = [
        ("Correctness", cycle.get("judge_correctness")),
        ("Safety", cycle.get("judge_safety")),
        ("Hallucination Risk", cycle.get("judge_hallucination_risk")),
        ("Compliance", cycle.get("judge_compliance")),
        ("Explainability", cycle.get("judge_explainability")),
    ]
    learning_event = bool(cycle.get("learning_event", False))

    if overall_score is not None:
        dim_parts = [
            f"{name}: {fmt_float(val, 0) if val is not None else 'N/A'}"
            for name, val in dim_map
        ]
        learning_note = (
            "Learning event flagged."
            if learning_event
            else "No learning event flagged (all dimensions above threshold)."
        )
        judge_summary = (
            f"LLM Judge scored this cycle {fmt_float(overall_score, 1)}/10. "
            f"Dimension breakdown — {', '.join(dim_parts)}. {learning_note}"
        )
    else:
        judge_summary = "N/A"

    # ── Outcome ───────────────────────────────────────────────────────────────────

    trades_count = cycle.get("trades_executed_count", len(trades))
    portfolio_value = cycle.get("portfolio_total_value") or cycle.get("total_value")
    pnl_pct = cycle.get("portfolio_pnl_pct") or cycle.get("pnl_pct")
    duration = cycle.get("cycle_duration_seconds") or cycle.get("duration_seconds")

    outcome_parts = [f"{trades_count} trade(s) executed."]
    if portfolio_value is not None:
        outcome_parts.append(f"Portfolio value: ${float(portfolio_value):,.0f}.")
    if pnl_pct is not None:
        outcome_parts.append(f"P&L: {fmt_float(pnl_pct, 2)}% from initial.")
    if duration is not None:
        outcome_parts.append(f"Cycle duration: {fmt_float(duration, 1)} seconds.")
    outcome = " ".join(outcome_parts)

    # ── Phoenix trace ─────────────────────────────────────────────────────────────

    phoenix_trace_id = cycle.get("phoenix_trace_id") or None
    phoenix_trace_url = (
        f"{settings.PHOENIX_BASE_URL}/traces/{phoenix_trace_id}"
        if phoenix_trace_id
        else None
    )

    return {
        "cycle_id": cycle_id,
        "timestamp": raw_ts,
        "brief": brief_title,
        "proposal_summary": proposal_summary,
        "risk_summary": risk_summary,
        "fraud_summary": fraud_summary,
        "regulator_summary": regulator_summary,
        "constraint_summary": constraint_summary,
        "judge_summary": judge_summary,
        "outcome": outcome,
        "phoenix_trace_id": phoenix_trace_id,
        "phoenix_trace_url": phoenix_trace_url,
    }
