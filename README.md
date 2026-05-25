<div align="center">

# ⚖️ JANUS

### *The Self-Governing Autonomous Financial Intelligence System*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Arize Phoenix](https://img.shields.io/badge/Arize_Phoenix-LLM_Observability-7C3AED?style=for-the-badge)](https://phoenix.arize.com)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Vertex_AI-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

---

> *Janus is an autonomous financial intelligence system where AI agents trade, regulate, and investigate — then audit themselves, score their own decisions, and evolve their behavior based on what they got wrong.*

**Google Cloud Rapid Agent Hackathon — Arize Track** · Submission Deadline: June 12, 2026

</div>

---

## 🏛️ The Mythology — Why Janus?

**Janus** is the Roman god of transitions, duality, and time. He is depicted with two faces — one gazing forward into the future, one turned backward into the past.

This is not metaphor. It is the literal architecture:

| Face | Direction | What It Does |
|------|-----------|--------------|
| ⚡ **The Forward Face** | Looks ahead | Runs the live agent economy — trades, validates risk, detects fraud, enforces regulation, scores decisions in real time |
| 🔍 **The Backward Face** | Looks back | Reads Phoenix trace history, identifies failure patterns, generates new behavioral constraints, and feeds them forward |

The two faces are inseparable by design. The forward face produces decisions; the backward face learns from them. Every time the system corrects itself, **Janus makes a transition** — from wrong decision to right behavior. That is the architecture. That is the product.

> *"Most AI systems just answer questions. Janus is different — it watches itself fail, and changes."*

---

## 🗺️ System Architecture

```
╔══════════════════════════════════════════════════════════════════════════╗
║                            MARKET LAYER                                  ║
║                                                                          ║
║   ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────────┐ ║
║   │  yfinance Prices │   │ Alpha Vantage News│   │ Market Shock Events  │ ║
║   │  (Real-time)     │   │ (Sentiment feed) │   │ (User-injected demo) │ ║
║   └────────┬─────────┘   └────────┬─────────┘   └──────────┬───────────┘ ║
║            └───────────────────────┴──────────────────────────┘           ║
╚════════════════════════════════════╤═════════════════════════════════════╝
                                     │  Market data + news + events
                                     ▼
╔══════════════════════════════════════════════════════════════════════════╗
║                       JANUS AGENT ECONOMY                                ║
║                    (LangGraph Stateful Graph)                             ║
║                                                                          ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │ Step 1: TRADING AGENT                                               │ ║
║  │   Reads portfolio + market signals → Proposes trade actions         │ ║
║  │   Output: { action, trades[], thesis, confidence, expected_impact } │ ║
║  └──────────────────────────────────┬──────────────────────────────────┘ ║
║                                     │ Proposed trades                     ║
║                                     ▼                                     ║
║  ┌────────────────────┐   ┌─────────────────────────────────────────────┐ ║
║  │ FRAUD INTELLIGENCE │   │ Step 2: RISK AGENT                          │ ║
║  │ AGENT (parallel)   │   │   Validates VaR, exposure, liquidity        │ ║
║  │                    │   │   Checks: concentration, leverage, sectors  │ ║
║  │ Monitors:          │   │   Output: APPROVE / MODIFY / VETO           │ ║
║  │ • Wash trading     │   │   Hard veto: single position > 40%          │ ║
║  │ • Front-running    │   │   Hard veto: daily VaR > 5%                 │ ║
║  │ • Concentration    │   └──────────────────────┬──────────────────────┘ ║
║  │ • Hallucinations   │                          │ Risk verdict            ║
║  │ • Abnormal velocity│                          │                         ║
║  └──────────┬─────────┘                          │                         ║
║             │ Fraud alerts                        │                         ║
║             └─────────────────────────────────────┘                        ║
║                                     │ Risk + Fraud signals                  ║
║                                     ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │ Step 3: REGULATOR AGENT                                             │ ║
║  │   Final gatekeeper — synthesizes all upstream agent signals         │ ║
║  │   Final verdict: EXECUTE / HOLD / HALT                              │ ║
║  │   Can activate Circuit Breaker (freezes all trading)                │ ║
║  └──────────────────────────────────┬──────────────────────────────────┘ ║
║                                     │ Final decision + audit trail          ║
║                                     ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────────────┐ ║
║  │ Step 4: LLM JUDGE AGENT                                             │ ║
║  │   Reviews complete decision pipeline across 5 scoring dimensions    │ ║
║  │   Correctness · Safety · Hallucination Risk · Compliance · Explain  │ ║
║  │   Flags low-scoring cycles as learning_event = true                 │ ║
║  └──────────────────────────────────┬──────────────────────────────────┘ ║
╚════════════════════════════════════╤═════════════════════════════════════╝
                                     │  OpenTelemetry traces (per agent span)
                                     ▼
╔══════════════════════════════════════════════════════════════════════════╗
║                         ARIZE PHOENIX LAYER                              ║
║                   (Self-hosted · Cloud Run)                               ║
║                                                                          ║
║   ┌────────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌────────┐ ║
║   │    TRACING     │ │   EVALUATIONS    │ │    DATASETS    │ │ EXPTS  │ ║
║   │                │ │                  │ │                │ │        │ ║
║   │ Full OTel span │ │ Judge scores     │ │ janus_learning │ │ Pre vs │ ║
║   │ hierarchy per  │ │ logged per cycle │ │ _events corpus │ │ Post   │ ║
║   │ decision cycle │ │ (all 5 dims)     │ │ (auto-growing) │ │ constr │ ║
║   └────────────────┘ └──────────────────┘ └────────────────┘ └────────┘ ║
║                                                                          ║
║   ◉ Phoenix MCP Server — JSON-RPC over HTTP — agents query live         ║
╚════════════════════════════════════╤═════════════════════════════════════╝
                                     │  Phoenix MCP queries (read failures)
                                     ▼
╔══════════════════════════════════════════════════════════════════════════╗
║              JANUS LOOP — THE SELF-CORRECTION ENGINE                     ║
║                        (The Backward Face)                               ║
║                                                                          ║
║   Meta-Agent reads Phoenix telemetry via MCP                             ║
║         ↓                                                                ║
║   Identifies failure patterns across last N decision cycles              ║
║         ↓                                                                ║
║   Generates 1–3 specific natural language behavioral constraints         ║
║         ↓                                                                ║
║   Writes constraints to Firestore (versioned, timestamped)               ║
║         ↓                                                                ║
║   Creates Phoenix Experiment: before vs after constraint scores          ║
╚════════════════════════════════════╤═════════════════════════════════════╝
                                     │  Updated behavioral constraints
                                     ▼
                    ┌────────────────────────────────┐
                    │   Injected into agent prompts  │
                    │   at the start of next cycle   │
                    └───────────────┬────────────────┘
                                    │
                                    └──────────────────────────► back to agents ↑
```

---

## 🔧 Component Map

| Component | Technology | Responsibility |
|-----------|-----------|---------------|
| **Agent Orchestration** | LangGraph 0.2+ | Stateful multi-agent graph, routing, checkpointing |
| **LLM — Dev** | Groq `llama-3.1-8b-instant` / `llama-3.3-70b-versatile` | Fast, free-tier inference during development |
| **LLM — Production** | Gemini 2.0 Flash via Vertex AI | Required. Flash for agent loops; Pro for Judge calls |
| **Agent Deployment** | Vertex AI Agent Engine (Google Cloud Agent Builder) | Agent hosting, scaling, session management |
| **Observability** | Arize Phoenix (self-hosted on Cloud Run) | All tracing and evaluations |
| **Phoenix MCP** | Arize Phoenix MCP Server | Agent-to-Phoenix programmatic access (JSON-RPC) |
| **Backend API** | FastAPI on Cloud Run | REST endpoints + SSE live stream |
| **Real-time Events** | Server-Sent Events (SSE) | Live agent activity stream to UI |
| **Portfolio State** | Firestore | Portfolio, trade history, behavioral constraints, memory |
| **Graph Checkpointing** | LangGraph Firestore Checkpointer | Persists graph state between cycles |
| **Market Data** | yfinance + Alpha Vantage | Real prices, historical data, news sentiment |
| **Frontend** | Next.js 14 (App Router) + TypeScript | The Janus Dashboard |
| **Styling** | Tailwind CSS + shadcn/ui | Dark-mode financial terminal aesthetic |
| **Charts** | Recharts | Portfolio P&L, score trends, radar charts |
| **Frontend Hosting** | Vercel | Zero-config deploys, instant preview URLs |

---

## 🤖 The Five Agents

| # | Agent | Role | Key Behaviors |
|---|-------|------|--------------|
| 1 | ⚡ **Trading Agent** | Quant-driven hedge fund manager | Proposes trade actions (BUY/SELL/HOLD/REBALANCE) based on market prices, news sentiment, and active Janus Loop constraints. Must cite at least one market signal per trade. Cannot propose single-asset concentration > 40%. |
| 2 | 🛡️ **Risk Agent** | Conservative risk officer | Validates VaR and exposure limits. Hard veto triggers: single position > 40% of portfolio, daily VaR > 5%, cash floor drops below 10%, sector concentration > 70%. Issues APPROVE / MODIFY / VETO. |
| 3 | 🔎 **Fraud Intelligence Agent** | Financial crimes investigator (runs in parallel) | Detects wash trading, front-running patterns, unusual concentration spikes, abnormal trade velocity, and **reasoning inconsistencies** — where a Trading Agent's stated rationale does not match its actual action. This is hallucination detection in financial context. |
| 4 | ⚖️ **Regulator Agent** | Final gatekeeper (SEC + central bank) | Synthesizes Risk and Fraud signals into a final EXECUTE / HOLD / HALT verdict. Activates the **Circuit Breaker** on HIGH severity fraud alerts or confirmed VaR breaches. Maintains a full audit trail per decision. |
| 5 | 🧑‍⚖️ **LLM Judge Agent** | Meta-evaluator (not a guardian — a scorer) | Reviews the entire decision pipeline after every cycle. Scores across 5 dimensions (1–10). Flags cycles with overall score < 6 as `learning_event = true`. These events directly feed the Janus Loop. Scores are logged to Phoenix as evaluations. |

### LLM Judge Scoring Dimensions

| Dimension | What It Measures | Threshold |
|-----------|-----------------|-----------|
| **Correctness** | Was the reasoning financially sound and internally consistent? | ≥ 6 to pass |
| **Safety** | Did the decision respect all risk boundaries and exposure limits? | ≥ 6 to pass |
| **Hallucination Risk** | Did any agent claim something unsupported by data in its context? | ≥ 6 to pass |
| **Compliance** | Were all regulatory and behavioral constraints respected? | ≥ 6 to pass |
| **Explainability** | Could a human regulator understand and audit this decision chain? | ≥ 6 to pass |

---

## 🔁 The Janus Loop — Self-Correction Engine

The Janus Loop is the most technically innovative part of the system. It transforms a static agent pipeline into one that **measures its own failures and changes its own behavior**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  JANUS LOOP EXECUTION SEQUENCE                          │
│            (Runs every N cycles — configurable via .env)                │
└─────────────────────────────────────────────────────────────────────────┘

  Step 1 ── QUERY PHOENIX VIA MCP
  │
  │   Meta-Agent calls Phoenix MCP server (JSON-RPC over HTTP):
  │   • Fetch last 20 judge evaluations
  │   • Fetch all traces flagged as learning_event = true
  │   • Retrieve dimension score trends over time
  │
  ▼
  Step 2 ── PATTERN ANALYSIS
  │
  │   Which scoring dimensions are consistently below threshold?
  │   Which agents appear in the most failing cycles?
  │   What specific behaviors recur across all failed traces?
  │
  │   Example finding:
  │   "Trading Agent safety score: 4.2/10 avg over last 15 cycles.
  │    All failures cluster around high-news-volume market periods."
  │
  ▼
  Step 3 ── CONSTRAINT GENERATION
  │
  │   Meta-Agent produces 1–3 natural language behavioral constraints:
  │
  │   CONSTRAINT_042 (2026-05-19T14:22:00Z)
  │   Agent: Trading Agent
  │   Condition: news_volume > 5 headlines/hour AND volatility = HIGH
  │   Rule: Reduce position sizing by 50%. Max 2 trades per cycle.
  │   Rationale: Safety scores below threshold in high-news environments.
  │   Expires: 50 cycles (auto-review)
  │
  ▼
  Step 4 ── CONSTRAINT INJECTION
  │
  │   Constraints written to Firestore (versioned, timestamped).
  │   At the start of each new cycle, every agent fetches active
  │   constraints and receives them in its system prompt:
  │
  │   "Current Behavioral Constraints from Janus Loop Cycle 8:
  │    [CONSTRAINT_042] When news_volume > 5..."
  │
  ▼
  Step 5 ── EXPERIMENT LOGGING IN PHOENIX
  │
  │   Phoenix Experiment created automatically:
  │   • Baseline: dimension scores before constraint activation
  │   • Treatment: dimension scores in cycles after constraint
  │   • Comparison: which constraints improved which dimensions
  │
  │   Result visible to judges in Phoenix UI:
  │   "Constraint #042 improved Safety score: 4.2 → 7.1 over 20 cycles."
  │
  ▼
  ── back to agents (next cycle includes new constraints) ──────────────────
```

This is **measurable AI improvement** — not a claim, not a chart — a Phoenix Experiment with before/after scores that judges can inspect live.

---

## 🔭 Arize Phoenix Integration — Four Pillars

Phoenix is not used for logging. It is the backbone of Janus's intelligence.

### Pillar 1 — Tracing (OpenTelemetry)

Every agent invocation is traced end-to-end using `openinference-instrumentation-langchain` + Phoenix's OTLP collector. The full span hierarchy per decision cycle:

```
Span: decision_cycle_012
  ├── Span: trading_agent
  │     ├── Span: fetch_market_data       [tool]
  │     ├── Span: fetch_news              [tool]
  │     └── Span: llm_call               [Gemini/Groq]
  ├── Span: risk_agent
  │     └── Span: llm_call               [Gemini/Groq]
  ├── Span: fraud_agent
  │     ├── Span: analyze_trade_history   [tool]
  │     └── Span: llm_call               [Gemini/Groq]
  ├── Span: regulator_agent
  │     └── Span: llm_call               [Gemini/Groq]
  └── Span: llm_judge
        └── Span: llm_call               [Gemini/Groq — Pro tier]
```

Each span captures: agent name, full LLM input (including injected constraints), complete LLM output, tool calls, token count, latency, cost estimate, and the cycle ID that links all agents in one decision together.

### Pillar 2 — Evaluations

After every Judge cycle, scores are posted to Phoenix as evaluations on the corresponding trace:

```python
phoenix_client.log_evaluations([
    Evaluation(trace_id=cycle_trace_id, name="correctness",
               score=score/10, label="pass" if score >= 6 else "fail",
               explanation=judge_output.critical_finding),
    Evaluation(trace_id=..., name="safety", ...),
    Evaluation(trace_id=..., name="hallucination_risk", ...),
    Evaluation(trace_id=..., name="compliance", ...),
    Evaluation(trace_id=..., name="explainability", ...),
])
```

Every decision cycle shows **live eval scores alongside the trace** in the Phoenix UI.

### Pillar 3 — Datasets

Every flagged learning event (judge overall score < 6) is automatically added to a Phoenix Dataset named `janus_learning_events`. This corpus grows over time and is the primary data source for the Meta-Agent's pattern analysis.

### Pillar 4 — Experiments

When the Janus Loop generates a new constraint batch, a Phoenix Experiment is created comparing pre/post performance. Judges can see in the Phoenix UI, numerically and visually, that a specific constraint produced a measurable improvement in specific scoring dimensions.

**Phoenix MCP — Functional Usage (not decorative):**

| MCP Call | Purpose |
|----------|---------|
| `GET /v1/traces?filter=learning_event:true&limit=20` | Fetch recent failing traces for pattern analysis |
| `GET /v1/evaluations?trace_ids=[...]` | Retrieve dimension scores for flagged traces |
| `POST /v1/datasets/janus_learning_events/examples` | Add new learning events to the corpus |
| `POST /v1/experiments` | Create pre/post constraint performance comparison |

---

## 🛠️ Full Tech Stack

### Backend

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Language | Python | 3.11+ | All AI/agent libraries are Python-first |
| Agent Framework | LangGraph | 0.2+ | Stateful cyclical graphs, checkpointing, native tool support |
| LLM (Dev) | Groq — llama-3.1-8b / llama-3.3-70b | Latest | Free tier, fast inference, drop-in replacement |
| LLM (Prod) | Gemini 2.0 Flash via Vertex AI | Latest | Required. Flash for loops, Pro for Judge calls |
| Agent Deployment | Vertex AI Agent Engine | Latest | Required by hackathon. Handles hosting and scaling |
| API Layer | FastAPI | 0.110+ | Async, lightweight, native SSE support |
| Hosting | Google Cloud Run | — | Containerized FastAPI + Phoenix |
| Database | Firestore | — | Portfolio state, trades, constraints, agent memory |
| Graph State | LangGraph Firestore Checkpointer | — | Persists graph state between cycles |
| Tracing | OpenInference + Phoenix OTLP | Latest | Full agent span hierarchy |
| Market Data | yfinance | Latest | Real prices, no API key required |
| News | Alpha Vantage | Free tier | Sentiment headlines for agent inputs |

### Frontend

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Framework | Next.js (App Router) | 14 | SSE support, server components, production quality |
| Language | TypeScript | 5+ | Type safety across all API responses and state |
| Styling | Tailwind CSS + shadcn/ui | Latest | Fast, consistent, customizable dark-mode UI |
| Charts | Recharts | Latest | Portfolio P&L, score trends, radar charts per agent |
| Real-time | EventSource (SSE) | Native | Live agent feed from FastAPI backend |
| Hosting | Vercel | — | Zero-config deploys, instant preview URLs |

---

## ⚡ Quick Start

### Prerequisites

| Requirement | Version | Where to Get |
|-------------|---------|-------------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Google Cloud Project | — | [console.cloud.google.com](https://console.cloud.google.com) with Firestore enabled |
| Groq API Key | — | [console.groq.com](https://console.groq.com) (free) |
| Alpha Vantage API Key | — | [alphavantage.co](https://www.alphavantage.co) (free tier) |

---

### 1 — Clone the Repository

```bash
git clone https://github.com/Harsh-617/janus.git
cd janus
```

---

### 2 — Start Phoenix (Observability) — Terminal 1

Phoenix must be running **before** the backend so it can receive OpenTelemetry traces.

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python scripts/start_phoenix.py
```

Phoenix UI will be available at: **http://localhost:6006**

---

### 3 — Start the Backend — Terminal 2

```bash
cd backend

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Configure environment variables
cp .env.example .env
# Edit .env — set GROQ_API_KEY, ALPHA_VANTAGE_API_KEY, GOOGLE_CLOUD_PROJECT

python main.py
```

Backend will be available at: **http://localhost:8000**

Verify with:
```bash
curl http://localhost:8000/health
```

---

### 4 — Start the Frontend — Terminal 3

```bash
cd frontend
npm install

# Set the API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

Janus Dashboard will be available at: **http://localhost:3000**

---

### 5 — Reset Portfolio for a Clean Demo Run

```bash
curl -X POST http://localhost:8000/api/portfolio/reset
```

---

### 6 — Trigger the Full System

```bash
# Run a single decision cycle immediately
curl -X POST http://localhost:8000/api/stream/run-once

# Start the auto-cycle scheduler (runs every N seconds as configured)
curl -X POST http://localhost:8000/api/stream/start

# Inject a market shock to stress-test all agents
curl -X POST http://localhost:8000/api/market-shock/preset/oil_shock

# Manually trigger the Janus self-correction loop
curl -X POST http://localhost:8000/api/janus-loop/trigger
```

---

## 📡 API Endpoint Reference

### Portfolio

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend health check |
| `GET` | `/api/portfolio` | Current portfolio state — positions, cash, P&L |
| `GET` | `/api/portfolio/history` | Cycle-by-cycle portfolio value history for charts |
| `POST` | `/api/portfolio/reset` | Reset to seed state (demo tool) |

### Decision Cycles & Trades

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/trades` | Trade history with pagination (`?limit=N`) |
| `GET` | `/api/cycles` | Decision cycle history with judge scores (`?limit=N`) |
| `GET` | `/api/agents` | Per-agent state, average scores, and active constraints |
| `GET` | `/api/constraints` | All active behavioral constraints |
| `GET` | `/api/constraints/{id}` | Single constraint by ID |

### Live Stream

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stream` | SSE live agent activity stream |
| `GET` | `/api/stream/status` | Whether auto-cycling is currently running |
| `POST` | `/api/stream/run-once` | Trigger a single decision cycle immediately |
| `POST` | `/api/stream/start` | Start the auto-cycle scheduler |
| `POST` | `/api/stream/stop` | Pause the auto-cycle scheduler |

### Market Shocks

| Method | Endpoint | Scenario ID | Description |
|--------|----------|-------------|-------------|
| `POST` | `/api/market-shock/preset/{scenario}` | `oil_shock` | Oil surge +40% — geopolitical conflict |
| `POST` | `/api/market-shock/preset/{scenario}` | `crypto_crash` | Major exchange collapse, 60% crypto selloff |
| `POST` | `/api/market-shock/preset/{scenario}` | `fed_rate_hike` | Emergency +150bps surprise Fed hike |
| `POST` | `/api/market-shock/preset/{scenario}` | `bank_run` | Regional bank crisis, contagion fears |
| `POST` | `/api/market-shock/clear` | — | Clear the active market shock |

### Circuit Breaker & Governance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/circuit-breaker/activate` | Manually halt all trading |
| `POST` | `/api/circuit-breaker/release` | Resume trading after circuit breaker |
| `GET` | `/api/phoenix/traces` | Proxied Phoenix trace data for dashboard |
| `POST` | `/api/janus-loop/trigger` | Manually trigger the self-correction loop |
| `GET` | `/api/janus-loop/history` | History of all Janus Loop runs and generated constraints |

---

## 🧠 LLM Architecture Note

Janus is designed around **Gemini 2.0 Flash** via Google Vertex AI in production. During development, [Groq](https://console.groq.com) is used as a drop-in replacement due to Vertex AI quota limitations on development accounts.

| Context | Model | Endpoint |
|---------|-------|----------|
| Dev — Agent reasoning | `llama-3.1-8b-instant` | Groq API |
| Dev — LLM Judge | `llama-3.3-70b-versatile` | Groq API |
| Prod — Agent reasoning | `gemini-2.0-flash` | Vertex AI |
| Prod — LLM Judge | `gemini-2.0-flash-exp` | Vertex AI |

The system is **LLM-agnostic by design**. Switching from Groq to Gemini requires only updating the API client and model strings in `backend/services/gemini_client.py` and `backend/config.py`. All agent logic, LangGraph graph structure, Phoenix instrumentation, and Firestore state management remain identical.

**Google Cloud services in production use:**

| Service | Purpose |
|---------|---------|
| Firestore | Portfolio state, trade records, behavioral constraints, agent memory |
| Cloud Run | Backend FastAPI container + self-hosted Phoenix instance |
| Vertex AI | Gemini 2.0 Flash for agent inference |
| Vertex AI Agent Engine | Agent hosting, scaling, and session management |

---

## 📁 Project Structure

```
janus/
│
├── backend/                          # Python FastAPI backend
│   ├── main.py                       # FastAPI app entry point
│   ├── config.py                     # Environment config (LLM, Firestore, Phoenix)
│   ├── requirements.txt
│   │
│   ├── agents/                       # The five LangGraph agents
│   │   ├── trading_agent.py          # Proposes trades from market signals
│   │   ├── risk_agent.py             # VaR + exposure validation
│   │   ├── fraud_agent.py            # Wash trading, front-running, hallucination detection
│   │   ├── regulator_agent.py        # Final gatekeeper + circuit breaker
│   │   ├── judge_agent.py            # 5-dimension scoring + learning event flagging
│   │   └── meta_agent.py             # Janus Loop — queries Phoenix, generates constraints
│   │
│   ├── graph/                        # LangGraph orchestration
│   │   ├── janus_graph.py            # Full 5-agent stateful graph definition
│   │   ├── state.py                  # Shared graph state schema
│   │   └── execution.py              # Cycle execution + checkpointing
│   │
│   ├── observability/                # Arize Phoenix integration
│   │   ├── tracing.py                # OpenTelemetry instrumentation (span hierarchy)
│   │   └── evaluations.py            # Judge score → Phoenix Evaluations API
│   │
│   ├── services/                     # Business logic services
│   │   ├── gemini_client.py          # LLM client (Groq dev / Gemini prod)
│   │   ├── portfolio_service.py      # Portfolio math, position sizing, P&L
│   │   ├── phoenix_service.py        # Phoenix client wrapper
│   │   ├── phoenix_mcp_client.py     # Phoenix MCP (JSON-RPC) queries
│   │   ├── constraint_service.py     # Constraint CRUD + agent prompt injection
│   │   ├── cycle_scheduler.py        # Auto-cycle scheduler (configurable interval)
│   │   ├── trade_service.py          # Trade execution + Firestore persistence
│   │   └── memory_service.py         # Per-agent behavioral memory (Firestore)
│   │
│   ├── api/                          # FastAPI route handlers
│   │   └── routes/
│   │       ├── portfolio.py
│   │       ├── trades.py
│   │       ├── cycles.py
│   │       ├── agents.py
│   │       ├── constraints.py
│   │       ├── stream.py             # SSE live stream endpoint
│   │       ├── market_shock.py
│   │       └── janus_loop.py
│   │
│   ├── tools/                        # Agent tool definitions (LangGraph tools)
│   │   ├── market_data.py            # yfinance real-time price fetcher
│   │   └── news.py                   # Alpha Vantage news sentiment fetcher
│   │
│   ├── db/
│   │   └── firestore_client.py       # Firestore connection + collection helpers
│   │
│   └── scripts/
│       └── start_phoenix.py          # Phoenix server startup script
│
├── frontend/                         # Next.js 14 dashboard
│   ├── app/                          # Next.js App Router pages
│   │   ├── arena/page.tsx            # The Arena — main live dashboard
│   │   ├── agents/page.tsx           # Agent Control Room
│   │   ├── janus-loop/page.tsx       # Self-correction engine view
│   │   ├── observability/page.tsx    # Embedded Phoenix UI
│   │   └── audit/page.tsx            # Full decision audit log
│   │
│   ├── components/
│   │   ├── arena/                    # Arena page components
│   │   │   ├── portfolio-panel.tsx   # Live positions + sparklines
│   │   │   ├── decision-feed.tsx     # Real-time agent decision stream
│   │   │   ├── agent-status-bar.tsx  # Active agent indicator
│   │   │   └── market-shock-panel.tsx # Scenario injection panel
│   │   ├── agents/
│   │   │   ├── agent-card.tsx        # Per-agent state card
│   │   │   └── radar-chart.tsx       # 5-dimension score radar
│   │   ├── janus-loop/
│   │   │   ├── loop-timeline.tsx     # History of loop runs
│   │   │   ├── constraint-table.tsx  # Active constraints + performance delta
│   │   │   └── experiment-viewer.tsx # Phoenix before/after experiment view
│   │   ├── audit/
│   │   │   └── audit-table.tsx       # Filterable decision history
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── topbar.tsx
│   │       ├── janus-divider.tsx     # The two-face visual motif divider
│   │       └── layout-wrapper.tsx
│   │
│   ├── hooks/
│   │   ├── use-agent-stream.ts       # SSE EventSource hook
│   │   ├── use-portfolio.ts
│   │   └── use-cycles.ts
│   │
│   └── lib/
│       ├── api.ts                    # Typed API client
│       ├── types.ts                  # Shared TypeScript interfaces
│       └── constants.ts
│
├── docs/
│   └── JANUS_PRD.md                 # Full product requirements document
│
├── LICENSE                           # MIT License
└── README.md
```

---

## 🏆 Hackathon Details

| Field | Value |
|-------|-------|
| **Competition** | Google Cloud Rapid Agent Hackathon |
| **Track** | Arize — LLM Observability |
| **Submission Deadline** | June 12, 2026 at 5:00 AM GMT+8 |
| **Judges** | Richard Young (Director of Partner Solutions, Arize) · Clay Miner (Head of Solutions Strategy, Arize) |
| **Team Size** | 2 |
| **Required Services** | Google Cloud Agent Builder (Vertex AI Agent Engine) · Arize Phoenix |

### What Makes Janus Win

| What most hackathon teams build | What Janus does |
|--------------------------------|-----------------|
| Agents that answer questions | Agents that **execute financial decisions** with hard constraints and veto logic |
| Single agent | **5 specialized agents** in a stateful, cyclical LangGraph graph |
| No evaluation pipeline | **LLM Judge** scoring 5 dimensions per cycle, every cycle |
| Logs to console | **Full OpenTelemetry traces** in Phoenix — agent-by-agent, token-by-token |
| Static behavior | **Dynamic behavior** via the Janus Loop self-correction engine |
| No memory of failures | **Phoenix Dataset** (`janus_learning_events`) — the system's own failure corpus |
| Uses Phoenix MCP for show | **Functional MCP usage** — queries, analyzes, and acts on live telemetry |
| Improvement is unmeasurable | **Phoenix Experiments** track before/after constraint performance numerically |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

*Janus governed transitions.*  
*This system governs the transition from wrong decision to right behavior.*  
*Every time the system corrects itself — Janus makes a transition.*

**Built with purpose. Observed with Phoenix. Governed by design.**

</div>
