## Step 12 — observability/evaluations.py
**Date**: 2026-05-20
**Files created**: `backend/observability/evaluations.py`
**What was built**:
Phoenix Evaluations API integration. Posts all 5 judge dimension scores
plus an overall score to Phoenix as formal evaluation records linked to
each cycle's trace. Also adds learning events to the janus_learning_events
Phoenix dataset for the Janus Loop to query.

**Key decisions**:
- Scores normalized to 0.0-1.0 for Phoenix (raw scores are 1-10)
- pass/fail label threshold at 0.6 (score >= 6/10)
- Both functions are fully resilient — ConnectError and all exceptions 
  are caught and logged as warnings, never crash the pipeline
- httpx AsyncClient used (not requests) for async compatibility with FastAPI
- Dataset post only fires if learning_event=True — avoids flooding the 
  dataset with every cycle
- subject_type="trace" links evaluations to the Phoenix trace by ID

**How this appears in Phoenix UI**:
- Open any cycle trace in Phoenix
- The Evaluations tab shows all 6 scores (5 dimensions + overall)
- pass/fail labels make it easy to filter failing cycles
- janus_learning_events dataset grows automatically with every bad cycle

**Notes for team**:
- Call both functions in execute_cycle_results() after saving to Firestore
- If Phoenix is self-hosted on Cloud Run, update PHOENIX_BASE_URL in .env

## Step 11 — graph/janus_graph.py + graph/execution.py
**Date**: 2026-05-20
**Files created**: 
- `backend/graph/janus_graph.py`
- `backend/graph/execution.py`
**What was built**:
LangGraph StateGraph wiring all 5 agents in correct pipeline order with
conditional routing after Regulator (skip Judge if pipeline halted).
Execution module persists cycle results, trade records, and portfolio 
state to Firestore after each cycle completes.

**Key decisions**:
- compiled_graph at module level — compiled once, reused for every cycle
- Conditional edge after Regulator: HALT skips Judge entirely (no point 
  scoring a halted cycle) and goes straight to END
- root_span ended in finally block — Phoenix trace closes even if graph 
  throws an exception mid-cycle
- execution.py is separate from the graph — graph handles reasoning, 
  execution handles persistence. Clean separation of concerns.
- Portfolio cycle_count incremented on every cycle regardless of outcome; 
  trade_count only incremented on EXECUTE

**Notes for team**:
- run_decision_cycle() is what the cycle scheduler calls every N seconds
- execute_cycle_results() is called AFTER run_decision_cycle() returns
- The SSE stream will emit the summary dict from execute_cycle_results()

## Step 10 — agents/judge_agent.py
**Date**: 2026-05-20
**Files created**: `backend/agents/judge_agent.py`
**What was built**:
LLM Judge Agent — the core Arize integration. Scores every decision cycle
across 5 dimensions (correctness, safety, hallucination_risk, compliance,
explainability). Scores are set as Phoenix span attributes so they appear
as evaluations in the Phoenix UI. Flags learning events when score < 6.0.
Generates recommended constraints that feed the Janus Loop.

**Key decisions**:
- Uses GEMINI_MODEL_JUDGE (separate config slot) so we can upgrade just 
  the judge to a more capable model independently
- overall_score calculated by the judge itself; we also recalculate as 
  fallback average if the judge omits it
- learning_event threshold is 6.0 overall OR any single dimension < 4 — 
  catches cases where one dimension is catastrophically bad
- Span attributes use judge.* prefix — these are what Phoenix reads as 
  evaluation scores in the UI
- Recommended_constraint output feeds directly into Janus Loop Step 17

**Notes for team**:
- This agent sees the COMPLETE pipeline output — all 4 agents' inputs 
  and outputs. It needs the full picture to score fairly.
- The hallucination_risk score is the key Arize demo moment — a low score 
  here is what triggers the learning event and Janus Loop response
- Step 12 (evaluations.py) will read judge_scores from state and post 
  them to Phoenix Evaluations API as a separate record

## Step 9 — agents/regulator_agent.py
**Date**: 2026-05-20
**Files created**: `backend/agents/regulator_agent.py`
**What was built**:
Regulator Agent LangGraph node. Final gatekeeper that synthesizes Risk
and Fraud signals into a definitive EXECUTE / HOLD / HALT decision.
Generates unique audit_trail_id per decision. Controls circuit breaker
activation which halts the entire pipeline.

**Key decisions**:
- Temperature 0.2 — matches Risk Agent; final decisions must be
  consistent and auditable
- audit_trail_id generated here (not by Trading Agent) because the
  Regulator owns the compliance record
- pipeline_halted written to state so LangGraph can short-circuit
  remaining nodes when HALT is issued
- Errors default to HOLD (not HALT, not EXECUTE) — neutral safe state
- trades_to_execute in regulator output is the canonical list of what
  actually runs — downstream execution reads this, not the original proposal

**Notes for team**:
- circuit_breaker_activated in regulator_decision is what the frontend
  Circuit Breaker panel reads to show the red alert state
- The demo circuit breaker scenario: Fraud HIGH alert + VaR breach →
  Regulator issues HALT with 15 min cooldown

## Step 8 — agents/fraud_agent.py
**Date**: 2026-05-20
**Files created**: `backend/agents/fraud_agent.py`
**What was built**:
Fraud Intelligence Agent LangGraph node. Detects 5 fraud pattern types
including REASONING_INCONSISTENCY — which is hallucination detection in
financial context. This is the key Arize demo moment: the agent catches
when the Trading Agent's stated rationale contradicts its proposed action.

**Key decisions**:
- Temperature 0.2 — most deterministic of all agents; fraud calls must
  be precise and repeatable
- REASONING_INCONSISTENCY is the most important check — baked into prompt
  as primary focus, directly maps to Phoenix hallucination detection value prop
- Pulls last 20 trades from Firestore for pattern analysis across history
- On error: returns CLEAR (not an alert) — better to miss a fraud signal
  than generate false positives that crash the pipeline
- HIGH severity alerts set investigation_open=true which Regulator reads
  to decide whether to activate Circuit Breaker

**Notes for team**:
- The REASONING_INCONSISTENCY check is what you demonstrate in the demo
  at timestamp 1:30 — Trading Agent claims defensive positioning but
  increases volatile exposure
- fraud_investigation_open in state is read by Regulator Agent as a
  circuit breaker trigger condition

## Step 7 — agents/risk_agent.py
**Date**: 2026-05-20
**Files created**: `backend/agents/risk_agent.py`
**What was built**:
Risk Agent LangGraph node. Evaluates every trade proposal against hard
veto rules and VaR thresholds. Returns APPROVE / MODIFY / VETO decision
with full risk report into JanusState.

**Key decisions**:
- Temperature 0.3 (vs Trading Agent's 0.7) — risk decisions should be
  deterministic and conservative, not creative
- Fails safe: any error defaults to VETO, never to APPROVE
- Skips evaluation entirely if no trades proposed (avoids wasted LLM call)
- Simplified VaR calculation via asset class volatility estimates baked
  into prompt — good enough for demo, clear to judges
- Vetoed trades stored in state so Fraud Agent and Regulator can see
  what was rejected and why

**Notes for team**:
- VaR threshold is 5% daily — this will trigger on crypto positions
  during market shock scenarios, which is intentional for the demo

## Step 6 — agents/trading_agent.py
**Date**: 2026-05-20
**Files created**: `backend/agents/trading_agent.py`
**What was built**:
Trading Agent LangGraph node. Receives portfolio state, market prices,
news headlines, and active constraints. Calls Gemini via LangChain to
propose trades. Returns structured trade proposals into JanusState.

**Key decisions**:
- Vertex AI ChatVertexAI client initialized at module level (not per call)
  for connection reuse
- JSON parsing strips markdown fences defensively since LLMs sometimes
  wrap JSON in ```json blocks
- Trace span captures action type, confidence, trade count for Phoenix
  filtering
- Constraint injection via user message (not system prompt) so constraints
  show up clearly in Phoenix traces

**Notes for team**:
- This is a LangGraph node function — it receives full JanusState and
  returns a partial dict of only the keys it updates
- Gemini temperature 0.7 — high enough for varied reasoning, low enough
  for consistent JSON output

## Step 5 — main.py
**Date**: 2026-05-20
**Files created**: `backend/main.py`
**What was built**:
FastAPI application entry point. Lifespan handler initializes tracing 
and Firestore on startup. CORS configured for local dev and Vercel. 
All API routers imported with graceful fallback if not yet created. 
Health check endpoint at GET /health.

**Key decisions**:
- Lifespan pattern (not deprecated on_event) for startup/shutdown
- Router imports wrapped in try/except so server boots at every 
  phase of development even when API files don't exist yet
- CORS allows localhost:3000 (Next.js dev) and *.vercel.app (production)

**How to run the server**:
  cd backend
  source venv/bin/activate   (Mac/Linux)
  venv\Scripts\activate      (Windows)
  python main.py

**Verify it works**:
  curl http://localhost:8000/health
  Should return: {"status": "ok", "service": "janus-backend", "version": "1.0.0"}

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
