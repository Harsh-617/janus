# Janus — Architecture Reference
> This file is the primary context document for Claude Code. Read this before writing any code.

---

## Repository Structure
janus/
├── backend/
│   ├── agents/               # One file per agent
│   │   ├── trading_agent.py
│   │   ├── risk_agent.py
│   │   ├── fraud_agent.py
│   │   ├── regulator_agent.py
│   │   ├── judge_agent.py
│   │   └── meta_agent.py     # Janus Loop / self-correction
│   ├── graph/
│   │   └── janus_graph.py    # LangGraph graph wiring all agents
│   ├── tools/
│   │   ├── market_data.py    # yfinance + Alpha Vantage
│   │   ├── portfolio.py      # Firestore portfolio read/write
│   │   └── phoenix_mcp.py    # Phoenix MCP client calls
│   ├── api/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── routes/
│   │   │   ├── portfolio.py
│   │   │   ├── trades.py
│   │   │   ├── cycles.py
│   │   │   ├── constraints.py
│   │   │   ├── stream.py     # SSE endpoint
│   │   │   ├── market_shock.py
│   │   │   └── janus_loop.py
│   ├── observability/
│   │   └── tracing.py        # Phoenix/OpenTelemetry setup
│   ├── models/
│   │   └── schemas.py        # Pydantic models for all data
│   ├── config.py             # Env vars, constants
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # The Arena (main dashboard)
│   │   ├── agents/page.tsx       # Agent Control Room
│   │   ├── loop/page.tsx         # Janus Loop page
│   │   ├── observability/page.tsx # Phoenix embedded
│   │   └── audit/page.tsx        # Audit Log
│   ├── components/
│   │   ├── arena/            # Arena page components
│   │   ├── agents/           # Agent Control Room components
│   │   ├── loop/             # Janus Loop components
│   │   └── shared/           # Shared UI components
│   ├── lib/
│   │   ├── api.ts            # Backend API client functions
│   │   ├── types.ts          # TypeScript interfaces (source of truth)
│   │   └── sse.ts            # SSE hook for live stream
│   └── hooks/
│       └── useAgentStream.ts # Custom hook for SSE feed
└── docs/
├── JANUS_PRD.md
├── ARCHITECTURE.md       # This file
├── DEVLOG.md
├── prompts.md            # All agent system prompts
└── api-contracts.md      # API response shapes

---

## How the System Works — Data Flow

Every 30 seconds (demo) or 5 minutes (production):

Trading Agent

Reads portfolio from Firestore
Fetches prices via yfinance
Fetches news via Alpha Vantage
Reads active constraints from Firestore
Calls Gemini Flash → produces trade proposal


Risk Agent

Receives Trading Agent output
Calculates VaR, leverage, concentration
Issues APPROVE / MODIFY / VETO


Fraud Agent (parallel to Risk)

Reads last 100 trades from Firestore
Checks for wash trading, front-running, reasoning inconsistencies
Issues CLEAR / ALERT


Regulator Agent

Receives Risk + Fraud outputs
Makes final EXECUTE / HOLD / HALT
Can activate Circuit Breaker


LLM Judge

Reviews entire cycle trace
Scores 5 dimensions (1-10 each): correctness, safety, hallucination_risk, compliance, explainability
Posts scores to Phoenix as evaluations
Flags learning events (overall score < 6)


Phoenix receives:

OpenTelemetry trace (every agent call)
Evaluation scores (from Judge)
Learning event added to dataset if flagged


Trade executed (if approved) → written to Firestore
SSE stream emits event → frontend updates live

Every N cycles:
9. Janus Loop (Meta-Agent)

Queries Phoenix via MCP for recent learning events
Identifies failure patterns
Generates behavioral constraints
Writes constraints to Firestore
Creates Phoenix Experiment (pre/post comparison)

---

## LangGraph State Shape

```python
class JanusGraphState(TypedDict):
    # Inputs
    cycle_id: str
    portfolio: dict
    market_data: dict
    news: list[dict]
    active_constraints: list[dict]

    # Agent outputs (populated sequentially)
    trading_proposal: dict | None
    risk_decision: dict | None
    fraud_alerts: list[dict]
    regulator_decision: dict | None
    judge_scores: dict | None

    # Metadata
    circuit_breaker_active: bool
    cycle_timestamp: str
    phoenix_trace_id: str | None
```

---

## Firestore Collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| `portfolios` | `janus_main` | Governed portfolio (with constraints + judge + Janus Loop) |
| `portfolios` | `janus_baseline` | Ungoverned baseline portfolio (same agents, no constraints/judge) |
| `trades` | `trade_{timestamp}_{n}` | One doc per executed trade (main portfolio) |
| `baseline_trades` | `trade_{timestamp}_{n}` | One doc per baseline portfolio trade |
| `cycles` | `cycle_{timestamp}_{n}` | One doc per decision cycle |
| `constraints` | `constraint_{n}` | Behavioral constraints (versioned, timestamped) |
| `agent_memory` | `{agent_id}` | Per-agent performance history |
| `portfolios/{id}/history` | `{cycle_number}` | Cycle-level P&L snapshot for charting |

---

## Phoenix Integration Points

| What | How | When |
|------|-----|-------|
| Trace each agent call | OpenTelemetry auto-instrumentation via `openinference-instrumentation-langchain` | Every cycle, automatically |
| Log judge scores | `phoenix_client.log_evaluations()` | After every Judge run |
| Add learning events to dataset | Phoenix Datasets API | When judge overall score < 6 |
| Query failures | Phoenix MCP server | When Janus Loop runs |
| Create experiments | Phoenix Experiments API | When new constraints generated |

Phoenix is self-hosted on Cloud Run. OTLP endpoint is set via `PHOENIX_COLLECTOR_ENDPOINT` env var.

---

## Environment Variables

```bash
# backend/.env (never commit this)
GOOGLE_CLOUD_PROJECT=janus-496816
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VERTEX_AI_LOCATION=us-central1

# Gemini keys (AI Studio free tier) — system rotates across all provided keys
GEMINI_API_KEY_1=your_key
GEMINI_API_KEY_2=your_key
# ... up to GEMINI_API_KEY_10

# Alpha Vantage — system rotates across all provided keys
ALPHA_VANTAGE_API_KEY_1=your_key
ALPHA_VANTAGE_API_KEY_2=your_key
ALPHA_VANTAGE_API_KEY_3=your_key
ALPHA_VANTAGE_API_KEY_4=your_key

PHOENIX_COLLECTOR_ENDPOINT=https://janus-phoenix-696629280223.us-central1.run.app/v1/traces
PHOENIX_BASE_URL=https://janus-phoenix-696629280223.us-central1.run.app

FIRESTORE_PORTFOLIO_ID=janus_main
AGENT_CYCLE_INTERVAL_SECONDS=120
JANUS_LOOP_INTERVAL_CYCLES=10
INITIAL_CAPITAL=1000000.0
```

---

## Deployment Architecture

All three services are in production. See the live URLs in the README.

**Backend — Google Cloud Run (us-central1)**
- Containerized with `python:3.11-slim` (`backend/Dockerfile`)
- Built and pushed via Google Cloud Build
- Serves FastAPI over HTTPS; Cloud Run handles TLS, auto-scaling, and zero idle cost
- Service account JSON mounted as a Cloud Run secret for Firestore access

**Frontend — Vercel**
- Deployed from `frontend/` on every push to `main`
- `NEXT_PUBLIC_API_URL` points to the Cloud Run backend
- `NEXT_PUBLIC_PHOENIX_URL` points to the Cloud Run Phoenix instance

**Phoenix Observability — Google Cloud Run (us-central1)**
- Runs the official `arizephoenix/phoenix` Docker image
- OTLP traces sent from the backend via `PHOENIX_COLLECTOR_ENDPOINT`
- Backend queries Phoenix REST API via `PHOENIX_BASE_URL` for the Janus Loop

---

## Multi-Model Gemini Rotation

The system supports up to 10 Gemini API keys (`GEMINI_API_KEY_1` through `GEMINI_API_KEY_10`) and rotates across five model variants to survive free-tier quota limits. The deployed instance uses 5 keys.

**Model priority order** (highest requests-per-day first):
1. `gemini-3.1-flash-lite` — primary, highest RPD (500 RPD free tier), tried first
2. `gemini-2.5-flash-lite`
3. `gemini-3.5-flash`
4. `gemini-3-flash`
5. `gemini-2.5-flash`

**Algorithm** (`services/gemini_client.py`):
- For each key, for each model (in priority order): if `(model, key)` is in the `_exhausted` set, skip.
- On `QuotaError` / `429` / `"per day"` → add `(model, key)` to `_exhausted`, continue.
- On `503 / unavailable` → sleep 5s and retry.
- Other errors → raise immediately.
- `_exhausted` is a module-level set (session-scoped, resets on restart).
- If all combinations are exhausted, raise `RuntimeError("All models exhausted")`.

This means the system can sustain up to `10 keys × 5 models = 50` independent quota pools before failing.

---

## Circuit Breaker — Auto-Release Logic

The circuit breaker is activated by the Regulator Agent when:
1. Fraud Agent raises a HIGH severity alert
2. Risk Agent issues a VETO (proposed VaR > 5%)
3. A fraud investigation is open
4. Market shock is active AND Risk Agent VETOs

**State stored in Firestore** on the portfolio document:
- `circuit_breaker_active: true`
- `circuit_breaker_activated_at: ISO timestamp`
- `circuit_breaker_resume_at: ISO timestamp` (activated_at + cooldown minutes)

**Auto-release mechanism** (`services/cycle_scheduler.py`):
- At the start of every new cycle, the scheduler checks whether `circuit_breaker_resume_at` has passed.
- If `now >= circuit_breaker_resume_at`, the circuit breaker is cleared automatically: `circuit_breaker_active` is set to `false` and the resume/activated timestamps are removed.
- The cycle then proceeds normally.
- Cooldown default: **5 minutes** (configurable per-activation via `regulator_decision.cooldown_minutes`).
- On application startup, stale circuit breakers (activated before the current process started) are cleared to prevent indefinitely frozen state.

**In LangGraph** (`graph/janus_graph.py`):
- `should_continue_after_regulator()` routes to `judge_agent` or `circuit_breaker_finalizer`.
- `circuit_breaker_finalizer_node()` returns safe default judge scores so downstream state consumers never receive `None`.

---

## Beta Injection into Trading Agent Prompt

To prevent the Trading Agent from hallucinating about the risk profile of held positions, real beta values are pre-fetched via `yfinance` and injected into the agent's user message before any LLM call.

**Implementation** (`agents/trading_agent.py`):
```python
beta_line = ""
if held_tickers:
    beta_parts = [f"{t}: {get_beta(t):.2f}" for t in held_tickers]
    beta_line = f"Current position betas: {', '.join(beta_parts)}"
```

The injected text appears in the user message as:
```
Current position betas: AAPL: 1.23, GLD: -0.05, BTC-USD: 2.10
```

**Why this matters:** The Fraud Agent's `HallucinationDetector` checks whether the Trading Agent's rationale is consistent with the beta data that was given to it. If the agent describes GLD as "high-beta growth exposure" but the injected beta is -0.05, that is a flagged hallucination (severity: HIGH), regardless of how convincing the reasoning sounds. Without pre-injecting real betas, this check cannot be made.

---

## Timer Accuracy — Wall-Clock Cycle Scheduling

**Problem:** Using a naive `asyncio.sleep(INTERVAL)` after each cycle causes drift. If a cycle takes 3 seconds and the interval is 30 seconds, sleeping 30 seconds means the actual wall-clock interval is 33 seconds. Over many cycles this compounds.

**Solution** (`services/cycle_scheduler.py`): Wall-clock remainder scheduling.

```python
cycle_started_at = time.time()

# ... run full decision cycle ...

elapsed = time.time() - cycle_started_at
remaining = max(0, CYCLE_INTERVAL_SECONDS - elapsed)
if remaining > 0:
    await asyncio.sleep(remaining)

_next_cycle_scheduled_at = time.time()
_next_cycle_time = datetime.now(timezone.utc) + timedelta(seconds=CYCLE_INTERVAL_SECONDS)
```

The scheduler sleeps only the *remainder* of the configured interval after subtracting actual execution time. If a cycle takes 2s on a 30s interval, it sleeps 28s — not 30s. The frontend timer uses `next_cycle_scheduled_at` from the backend (a server-authoritative timestamp, not a client-side countdown) to display an accurate countdown without accumulating client/server clock drift.

---

## Baseline Portfolio Comparison

Janus runs two parallel portfolios to quantify the value of the self-correction system.

**janus_main** (`FIRESTORE_PORTFOLIO_ID`):
- Full pipeline: Trading Agent → Constraint Enforcer → Risk Agent → Fraud Agent → Regulator Agent → LLM Judge
- Behavioral constraints from Janus Loop are injected
- Judge scores are logged and learning events fed back into the loop

**janus_baseline** (`BASELINE_PORTFOLIO_ID`, default: `janus_baseline`):
- Same four execution agents: Trading Agent → Risk Agent → Fraud Agent → Regulator Agent
- No Constraint Enforcer node
- No LLM Judge node
- No Janus Loop (no constraints ever generated or injected)
- Represents a raw, ungoverned agent pipeline

**Execution** (`graph/execution.py`):
- `execute_cycle_results()` — runs main portfolio graph, saves to `COL_TRADES`
- `execute_baseline_cycle_results()` — runs baseline graph, saves to `COL_BASELINE_TRADES`
- Both apply the same trade execution logic and save cycle-level P&L snapshots

**History document shape** (in `portfolios/{id}/history/{cycle_number}`):
```python
{
    "cycle": int,
    "total_value": float,
    "pnl_pct": float,   # ((total_value - initial_capital) / initial_capital) * 100
    "timestamp": ISO string
}
```

**Frontend:** The Arena dashboard shows both portfolios' total value on the same time-series chart. The P&L delta (Janus vs Baseline) is the primary quantitative demonstration that self-correction produces measurably better outcomes.

---

## Key Rules for Claude Code

1. **All agent prompts live in `docs/prompts.md`** — never hardcode prompts in agent files, always import from a central config
2. **All Pydantic schemas live in `backend/models/schemas.py`** — one source of truth for data shapes
3. **TypeScript interfaces in `frontend/lib/types.ts`** must match the Pydantic schemas
4. **Never write to Firestore directly from an agent** — always go through the tool functions in `backend/tools/portfolio.py`
5. **Every agent function must be a LangGraph node** — takes `JanusGraphState`, returns `JanusGraphState` update dict
6. **Phoenix tracing is set up once in `observability/tracing.py`** — all agents inherit it via LangChain instrumentation, no manual span creation needed unless for custom events
7. **The SSE stream endpoint emits every state change** — agents call a shared event emitter, the FastAPI SSE route reads from it