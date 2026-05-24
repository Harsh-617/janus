import logging
from db.firestore_client import get_agent_memory, save_agent_memory

AGENT_IDS = [
    "trading_agent",
    "risk_agent",
    "fraud_agent",
    "regulator_agent",
    "llm_judge",
]


async def update_agent_memories(
    cycle_number: int,
    judge_scores: dict,
    active_constraints: list[dict],
) -> None:
    """
    Updates memory records for all 5 agents after each cycle.
    Called after every decision cycle completes.
    """
    for agent_id in AGENT_IDS:
        try:
            memory = await get_agent_memory(agent_id)

            if memory is None:
                memory = {
                    "agent_id": agent_id,
                    "memory_version": 0,
                    "active_constraints": [],
                    "recent_performance": {
                        "avg_judge_score_last_10": 0.0,
                        "learning_events_last_10": 0,
                        "trend": "STABLE",
                    },
                    "behavioral_notes": [],
                }

            if not active_constraints:
                matching = []
            elif isinstance(active_constraints[0], dict):
                matching = [c for c in active_constraints if c.get("target_agent") == agent_id]
            else:
                matching = []
            memory["active_constraints"] = [c["constraint_id"] for c in matching]

            avg_score = judge_scores.get("overall_score", 0.0)
            is_learning_event = judge_scores.get("learning_event") is True

            if avg_score >= 7.0:
                trend = "IMPROVING"
            elif avg_score >= 5.0:
                trend = "STABLE"
            else:
                trend = "DECLINING"

            current_learning = memory["recent_performance"].get("learning_events_last_10", 0)
            if is_learning_event:
                new_learning = min(current_learning + 1, 10)
            else:
                new_learning = current_learning

            memory["recent_performance"] = {
                "avg_judge_score_last_10": avg_score,
                "learning_events_last_10": new_learning,
                "trend": trend,
            }

            if is_learning_event:
                note = judge_scores.get("recommended_constraint", "")
                notes = memory.get("behavioral_notes", [])
                notes.append(note)
                memory["behavioral_notes"] = notes[-5:]

            memory["memory_version"] = memory.get("memory_version", 0) + 1

            await save_agent_memory(agent_id, memory)
            logging.debug(f"[MemoryService] Updated memory for {agent_id} (v{memory['memory_version']})")

        except Exception:
            logging.exception(f"[MemoryService] Failed to update memory for {agent_id}")
