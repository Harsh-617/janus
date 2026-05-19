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
| `portfolios` | `janus_main` | Single portfolio document |
| `trades` | `trade_{timestamp}_{n}` | One doc per trade |
| `cycles` | `cycle_{timestamp}_{n}` | One doc per decision cycle |
| `constraints` | `constraint_{n}` | Behavioral constraints |
| `agent_memory` | `{agent_id}` | Per-agent performance history |

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
GOOGLE_CLOUD_PROJECT=janus-hackathon
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
VERTEX_AI_LOCATION=us-central1
ALPHA_VANTAGE_API_KEY=your_key
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces  # local dev
PHOENIX_API_KEY=your_key  # if using cloud Phoenix
PHOENIX_BASE_URL=https://your-phoenix-instance.run.app
```

---

## Key Rules for Claude Code

1. **All agent prompts live in `docs/prompts.md`** — never hardcode prompts in agent files, always import from a central config
2. **All Pydantic schemas live in `backend/models/schemas.py`** — one source of truth for data shapes
3. **TypeScript interfaces in `frontend/lib/types.ts`** must match the Pydantic schemas
4. **Never write to Firestore directly from an agent** — always go through the tool functions in `backend/tools/portfolio.py`
5. **Every agent function must be a LangGraph node** — takes `JanusGraphState`, returns `JanusGraphState` update dict
6. **Phoenix tracing is set up once in `observability/tracing.py`** — all agents inherit it via LangChain instrumentation, no manual span creation needed unless for custom events
7. **The SSE stream endpoint emits every state change** — agents call a shared event emitter, the FastAPI SSE route reads from it