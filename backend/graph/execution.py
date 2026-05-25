from graph.state import JanusState
from db.firestore_client import (
    save_trade, save_cycle, save_portfolio,
    get_portfolio, COL_TRADES,
)
import logging
import uuid
from datetime import datetime, timezone


def get_state_value(state, key, default=None):
    """LangGraph may accumulate state fields as lists via reducers; extract the last item if so."""
    val = state.get(key, default)
    if isinstance(val, list):
        return val[-1] if val else default
    return val if val is not None else default


async def execute_cycle_results(state: JanusState) -> dict:
    """
    After the graph completes, persist results to Firestore.
    Returns a summary dict for the SSE stream.
    """
    cycle_id = state["cycle_id"]
    regulator_decision = get_state_value(state, "regulator_decision", {})
    judge_scores = get_state_value(state, "judge_scores", {})
    risk_decision = get_state_value(state, "risk_report", {})
    final_decision = regulator_decision.get("final_decision", "HOLD")

    trades_executed = []

    if final_decision == "EXECUTE":
        trades_to_run = regulator_decision.get("trades_to_execute", [])
        market_prices = state.get("market_prices", {})

        for trade in trades_to_run:
            trade_id = (
                f"trade_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
                f"_{str(uuid.uuid4())[:8]}"
            )
            ticker = trade.get("ticker", "UNKNOWN")
            price = market_prices.get(ticker, 0.0)
            quantity = trade.get("quantity", 0)

            approved_by = []
            if risk_decision.get("decision") in ("APPROVE", "MODIFY"):
                approved_by.append("risk_agent")
            if regulator_decision.get("final_decision") == "EXECUTE":
                approved_by.append("regulator_agent")

            if risk_decision.get("decision") == "VETO":
                vetoed_by = "risk_agent"
            elif regulator_decision.get("final_decision") == "HALT":
                vetoed_by = "regulator_agent"
            else:
                vetoed_by = None

            trade_record = {
                "trade_id": trade_id,
                "cycle_id": cycle_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "ticker": ticker,
                "direction": trade.get("direction", "UNKNOWN"),
                "quantity": quantity,
                "price": price,
                "total_value": price * quantity,
                "rationale": trade.get("rationale", ""),
                "confidence": trade.get("confidence", 0.0),
                "proposed_by": "trading_agent",
                "approved_by": approved_by,
                "vetoed_by": vetoed_by,
                "judge_score": judge_scores.get("overall_score", 0.0),
                "phoenix_trace_id": state.get("phoenix_trace_id", ""),
                "executed": True,
            }
            await save_trade(trade_id, trade_record)
            trades_executed.append(trade_record)
            logging.info(
                f"[Execution] Trade {trade_id}: {trade.get('direction')} "
                f"{trade.get('quantity')} {trade.get('ticker')}"
            )

    # After saving individual trades, apply them to portfolio positions
    if final_decision == "EXECUTE" and trades_executed:
        from services.portfolio_service import apply_trade_to_portfolio
        from config import settings

        # Get current prices from state
        current_prices = state.get("market_prices", {})

        for trade_record in trades_executed:
            success = await apply_trade_to_portfolio(
                portfolio_id=settings.FIRESTORE_PORTFOLIO_ID,
                trade={
                    "ticker": trade_record["ticker"],
                    "direction": trade_record["direction"],
                    "quantity": trade_record["quantity"],
                },
                current_prices=current_prices,
            )
            if not success:
                logging.warning(
                    f"[Execution] Failed to apply trade {trade_record['trade_id']} to portfolio"
                )

    cycle_record = {
        "cycle_id": cycle_id,
        "cycle_number": state["cycle_number"],
        "timestamp": state["timestamp"],
        "final_decision": final_decision,
        "circuit_breaker_activated": regulator_decision.get("circuit_breaker_activated", False),
        "trades_executed_count": len(trades_executed),
        "judge_overall_score": judge_scores.get("overall_score", 0.0),
        "judge_correctness": judge_scores.get("correctness", 0),
        "judge_safety": judge_scores.get("safety", 0),
        "judge_hallucination_risk": judge_scores.get("hallucination_risk", 0),
        "judge_compliance": judge_scores.get("compliance", 0),
        "judge_explainability": judge_scores.get("explainability", 0),
        "learning_event": judge_scores.get("learning_event", False),
        "critical_finding": judge_scores.get("critical_finding", ""),
        "recommended_constraint": judge_scores.get("recommended_constraint", ""),
        "fraud_alerts_count": len(state.get("fraud_alerts", [])),
        "phoenix_trace_id": state.get("phoenix_trace_id", ""),
        "market_shock_active": state.get("market_shock_active", False),
        "decisions": {
            "trading_agent": {
                "action": "HOLD" if not state.get("trading_proposal") else "EXECUTE",
                "thesis": state.get("trading_thesis", ""),
                "confidence": state.get("trading_confidence", 0),
            },
            "risk_agent": {
                "decision": risk_decision.get("decision", ""),
                "verdict": risk_decision.get("verdict", ""),
            },
            "fraud_agent": {
                "status": get_state_value(state, "fraud_report", {}).get("status", ""),
                "alerts": get_state_value(state, "fraud_report", {}).get("alerts", []),
            },
            "regulator_agent": {
                "final_decision": regulator_decision.get("final_decision", ""),
                "reason": regulator_decision.get("reason", ""),
            },
            "llm_judge": {
                "overall_score": judge_scores.get("overall_score", 0),
                "critical_finding": judge_scores.get("critical_finding", ""),
                "recommended_constraint": judge_scores.get("recommended_constraint", ""),
            },
        },
    }
    await save_cycle(cycle_id, cycle_record)

    portfolio = await get_portfolio("janus_main")
    if portfolio:
        portfolio["cycle_count"] = portfolio.get("cycle_count", 0) + 1
        portfolio["circuit_breaker_active"] = regulator_decision.get(
            "circuit_breaker_activated", False
        )
        if final_decision == "EXECUTE" and trades_executed:
            portfolio["trade_count"] = portfolio.get("trade_count", 0) + len(trades_executed)
        await save_portfolio("janus_main", portfolio)

    summary = {
        "cycle_id": cycle_id,
        "final_decision": final_decision,
        "trades_executed": len(trades_executed),
        "judge_score": judge_scores.get("overall_score", 0.0),
        "learning_event": judge_scores.get("learning_event", False),
        "circuit_breaker": regulator_decision.get("circuit_breaker_activated", False),
        "critical_finding": judge_scores.get("critical_finding", ""),
    }

    logging.info(
        f"[Execution] Cycle {cycle_id} persisted — "
        f"{len(trades_executed)} trades executed"
    )

    # Post evaluations to Phoenix (non-blocking — failures are logged not raised)
    from observability.evaluations import post_cycle_evaluations, post_learning_event_to_dataset
    await post_cycle_evaluations(state)
    await post_learning_event_to_dataset(state)

    # At the end of execute_cycle_results, always update prices
    from services.portfolio_service import update_portfolio_prices
    from config import settings

    current_prices = state.get("market_prices", {})
    if current_prices:
        await update_portfolio_prices(settings.FIRESTORE_PORTFOLIO_ID, current_prices)

    from services.memory_service import update_agent_memories
    await update_agent_memories(
        cycle_number=state.get("cycle_number", 0),
        judge_scores=get_state_value(state, "judge_scores", {}),
        active_constraints=state.get("active_constraints", []),
    )

    return summary
