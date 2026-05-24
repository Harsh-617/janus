from langgraph.graph import StateGraph, END
from graph.state import JanusState, create_initial_state
from agents.trading_agent import trading_agent_node
from agents.risk_agent import risk_agent_node
from agents.fraud_agent import fraud_agent_node
from agents.regulator_agent import regulator_agent_node
from agents.judge_agent import judge_agent_node
from observability.tracing import record_cycle_start
import logging


def should_continue_after_regulator(state: JanusState) -> str:
    """Route to judge if pipeline active, or skip to end if halted."""
    if state.get("pipeline_halted", False):
        logging.warning(f"Pipeline halted: {state.get('halt_reason', '')}")
        return "halted"
    return "continue"


def build_janus_graph() -> StateGraph:
    graph = StateGraph(JanusState)

    graph.add_node("trading_agent", trading_agent_node)
    graph.add_node("risk_agent", risk_agent_node)
    graph.add_node("fraud_agent", fraud_agent_node)
    graph.add_node("regulator_agent", regulator_agent_node)
    graph.add_node("judge_agent", judge_agent_node)

    graph.set_entry_point("trading_agent")

    graph.add_edge("trading_agent", "risk_agent")
    graph.add_edge("risk_agent", "fraud_agent")
    graph.add_edge("fraud_agent", "regulator_agent")

    graph.add_conditional_edges(
        "regulator_agent",
        should_continue_after_regulator,
        {
            "continue": "judge_agent",
            "halted": END,
        },
    )

    graph.add_edge("judge_agent", END)

    return graph


compiled_graph = build_janus_graph().compile()


async def run_decision_cycle(
    cycle_id: str,
    cycle_number: int,
    portfolio: dict,
    market_prices: dict,
    news_headlines: list,
    active_constraints: list,
    market_shock_active: bool = False,
    market_shock_description: str = "",
) -> JanusState:
    """Run one complete Janus decision cycle through all agents."""

    root_span = record_cycle_start(cycle_id)

    initial_state = create_initial_state(cycle_id, cycle_number, portfolio)
    initial_state["market_prices"] = market_prices
    initial_state["news_headlines"] = news_headlines
    initial_state["active_constraints"] = active_constraints
    initial_state["market_shock_active"] = market_shock_active
    initial_state["market_shock_description"] = market_shock_description
    initial_state["phoenix_trace_id"] = cycle_id
    initial_state["cycle_span"] = root_span

    logging.info(f"[Janus Graph] Starting cycle {cycle_id} (#{cycle_number})")

    try:
        config = {"configurable": {"thread_id": f"janus_cycle_{cycle_id}"}}
        final_state = await compiled_graph.ainvoke(initial_state, config)
        logging.info(
            f"[Janus Graph] Cycle {cycle_id} complete — "
            f"Decision: {final_state.get('regulator_decision', {}).get('final_decision', 'UNKNOWN')} — "
            f"Judge score: {final_state.get('judge_scores', {}).get('overall_score', 'N/A')}"
        )
        return final_state
    except Exception as e:
        logging.error(f"[Janus Graph] Cycle {cycle_id} failed: {e}")
        raise
    finally:
        try:
            if root_span:
                root_span.end()
        except Exception:
            pass
