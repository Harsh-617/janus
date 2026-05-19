## Step 4 — graph/state.py
**Date**: 2026-05-20
**Files created**: `backend/graph/state.py`
**What was built**:
LangGraph state schema for the full decision pipeline. Supporting
dataclasses for each agent's output type (TradeProposal, RiskReport,
FraudAlert, RegulatorDecision, JudgeScore). Main JanusState TypedDict
that flows through all 5 agents. Factory function create_initial_state().

**Key decisions**:
- TypedDict (not Pydantic) because LangGraph requires it for state nodes
- Agent outputs stored as dict (serialized) not typed objects — keeps
  state JSON-serializable for Firestore and SSE streaming
- cycle_span stored in state so the root Phoenix span can be ended
  after the full pipeline completes
- pipeline_halted flag lets the graph short-circuit if regulator halts

**Notes for team**:
- Dev B: JudgeScore fields are exactly what gets logged to Phoenix
  as evaluations — don't rename them
- Any agent can read the full state; only write to your own section

## Step 3 — observability/tracing.py
**Date**: 2026-05-20
**Files created**: `backend/observability/tracing.py`
**What was built**:
Phoenix/OpenTelemetry tracing setup. Configures OTLP exporter to Phoenix,
instruments LangChain/LangGraph automatically, provides trace_agent_call()
context manager and record_cycle_start() for the decision pipeline.

**Key decisions**:
- setup_tracing() is resilient — swallowed exceptions mean agents still 
  run if Phoenix is down; judges won't see a crashed demo
- trace_agent_call() is a context manager so agent code stays clean
- LangChainInstrumentor auto-instruments all LLM calls, tool calls, 
  and chain executions without manual span creation per call
- Parent span per cycle (decision_cycle.{id}) so all 5 agent spans 
  nest cleanly under one trace in Phoenix UI

**Notes for team**:
- Call setup_tracing() once in main.py at app startup
- Dev B: you don't need to touch this file; tracing is automatic 
  once initialized
- If Phoenix traces aren't showing up: check PHOENIX_COLLECTOR_ENDPOINT 
  in .env points to the right host/port

## Step 2 — db/firestore_client.py
**Date**: 2026-05-20
**Files created**: `backend/db/firestore_client.py`
**What was built**:
Central Firestore client with singleton `db` instance. All collection 
name constants defined. Async helper functions for portfolio, trades, 
constraints, agent memory, and cycles. Auto-seeds janus_main portfolio 
on first run if it doesn't exist.

**Key decisions**:
- Sync Firestore SDK wrapped in asyncio.to_thread() for FastAPI compatibility
- initialize_portfolio() called at app startup to ensure clean state
- Collection names as constants so they never get typo'd across the codebase

**Notes for team**:
- Dev B: import helpers directly, e.g. `from db.firestore_client import get_portfolio`
- All Firestore writes use set(merge=True) so partial updates don't wipe fields

## Step 1 — config.py
**Date**: 2026-05-20
**Files created**: `backend/config.py`
**What was built**:
Central Settings class using pydantic-settings. All environment variables
loaded from backend/.env. Singleton `settings` instance exported for use
across the entire backend.

**Key decisions**:
- Used pydantic-settings over raw os.environ for type safety and validation
- Two Gemini model slots (fast + judge) so we can swap models independently
- JANUS_LOOP_INTERVAL_CYCLES controls how often the self-correction engine fires

**Notes for team**:
- Dev B: when you import settings in your files, use `from config import settings`
- The .env file must be present at backend/.env for the server to start
