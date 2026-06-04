<div align="center">

# JANUS
### *The Two-Faced Financial Intelligence System That Watches Itself — and Corrects Itself*

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.2-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Arize Phoenix](https://img.shields.io/badge/Arize_Phoenix-15.x-7C3AED?style=for-the-badge)](https://phoenix.arize.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

**Google Cloud Rapid Agent Hackathon — Arize Track**

</div>

---

## What is Janus?

Janus is an autonomous, self-correcting multi-agent financial intelligence system. Every N seconds, five specialized LLM agents powered by Google Gemini collaborate inside a LangGraph state machine to propose trades, stress-test them for risk, investigate them for fraud, issue a regulatory verdict, and then score the entire decision pipeline across five dimensions. When failure patterns accumulate, the Janus Loop — a Meta-Agent backed by live Arize Phoenix telemetry — reads the history of bad decisions, generates plain-language behavioral constraints, and injects them directly into the agents' prompts for every future cycle. The improvement is not a claim: it is a Phoenix Experiment with before-and-after scores that can be inspected live. Alongside the governed Janus portfolio, an ungoverned baseline portfolio runs the same agents without constraints or a judge, so the performance delta between a self-correcting system and a raw agent pipeline is visible in real time.

---

## 🚀 Live Demo

| Service | URL |
|---------|-----|
| **Frontend** | https://janus-rouge.vercel.app |
| **Backend API** | https://janus-backend-696629280223.us-central1.run.app |
| **Phoenix Observability** | https://janus-phoenix-696629280223.us-central1.run.app |

---

## The Two-Face Architecture

Named after the Roman god of duality and transitions, Janus has two inseparable faces. The **Forward Face** executes — it acts in the market every cycle using real prices from yfinance, live news from Alpha Vantage, and calculated risk limits enforced in Python before any LLM reasoning happens. The **Backward Face** reflects — it reads Arize Phoenix for failure patterns, scores every decision the forward face makes, and rewrites the behavioral rules the forward face must follow. The two faces share one nervous system: Arize Phoenix, where every agent call is traced end-to-end, every judge score becomes a span evaluation, every failure becomes a dataset example, and every constraint improvement is measured in a controlled experiment.

```
          FORWARD FACE                    BACKWARD FACE
   (Execute — act in the market)    (Reflect — judge and improve)

  ┌──────────────────────────┐     ┌──────────────────────────────┐
  │  Trading Agent           │     │  LLM Judge                   │
  │  Constraint Enforcer     │     │  (5-dimension scorer)        │
  │  Risk Agent        ──────┼────▶│                              │
  │  Fraud Agent             │     │  Janus Loop (Meta-Agent)     │
  │  Regulator Agent         │     │  (pattern analysis)          │
  └──────────────────────────┘     └──────────────────────────────┘
           │                                      │
           ▼                                      ▼
    Firestore — Trades                Arize Phoenix
    Portfolio P&L                     Traces · Evals · Datasets
    Baseline Comparison               Experiments
           │                                      │
           └──────────── Constraints ◀────────────┘
                    (injected back into agents)
```

---

## System Architecture

```
╔═══════════════════════════════════════════════════════════════════════╗
║                           MARKET LAYER                                ║
║  ┌────────────────┐  ┌───────────────────┐  ┌──────────────────────┐ ║
║  │ yfinance       │  │ Alpha Vantage     │  │ Market Shock Events  │ ║
║  │ Real-time      │  │ News + Sentiment  │  │ (user-injected demo) │ ║
║  │ prices + beta  │  │ (4-key rotation)  │  │                      │ ║
║  └───────┬────────┘  └────────┬──────────┘  └──────────┬───────────┘ ║
╚══════════╪═══════════════════╪══════════════════════════╪════════════╝
           └───────────────────┴──────────────────────────┘
                               │ Market data + news
                               ▼
╔═══════════════════════════════════════════════════════════════════════╗
║                   JANUS AGENT ECONOMY (LangGraph)                     ║
║                                                                       ║
║  Firestore: active constraints ──────────────────────────────────┐   ║
║                                                                  ▼   ║
║  ┌──────────────────────────────────────────────────────────────────┐ ║
║  │ 1. TRADING AGENT (Gemini Flash)                                  │ ║
║  │    Portfolio + prices + news + beta → trade proposal             │ ║
║  └───────────────────────────────┬──────────────────────────────────┘ ║
║                                  │                                    ║
║  ┌───────────────────────────────▼──────────────────────────────────┐ ║
║  │ 2. CONSTRAINT ENFORCER (mechanical — no LLM)                     │ ║
║  │    Max trades · position size · forbidden actions · cash floor   │ ║
║  └───────────────────────────────┬──────────────────────────────────┘ ║
║                                  │                                    ║
║       ┌──────────────────────────┴──────────────────────┐            ║
║       ▼                                                 ▼            ║
║  ┌─────────────────────────┐         ┌──────────────────────────────┐ ║
║  │ 3. RISK AGENT           │         │ 4. FRAUD INTELLIGENCE AGENT  │ ║
║  │    Parametric VaR       │         │    Wash trading (Python)     │ ║
║  │    Hard limits (Python) │         │    Reasoning inconsistency   │ ║
║  │    APPROVE / MODIFY /   │         │    (LLM) + hallucination      │ ║
║  │    VETO                 │         │    detection (data-driven)   │ ║
║  └─────────────┬───────────┘         └────────────────┬─────────────┘ ║
║                └───────────────────────────────────────┘              ║
║                                  │ Risk + Fraud signals               ║
║                                  ▼                                    ║
║  ┌──────────────────────────────────────────────────────────────────┐ ║
║  │ 5. REGULATOR AGENT                                               │ ║
║  │    Final: EXECUTE / HOLD / HALT + Circuit Breaker                │ ║
║  │    Auto-release after 5-min cooldown                             │ ║
║  └───────────────────────────────┬──────────────────────────────────┘ ║
║                                  │                                    ║
║  ┌───────────────────────────────▼──────────────────────────────────┐ ║
║  │ 6. LLM JUDGE (Gemini Flash)                                      │ ║
║  │    5-dimension scoring (1–10): Correctness · Safety ·            │ ║
║  │    Hallucination Risk · Compliance · Explainability              │ ║
║  │    score < 6 → learning_event = true                             │ ║
║  └──────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════╤═══════════════════════════════════╝
                                    │ OpenTelemetry (auto-instrumented)
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║                        ARIZE PHOENIX LAYER                            ║
║                                                                       ║
║  ┌───────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌─────────┐  ║
║  │   TRACING     │ │  EVALUATIONS    │ │   DATASETS   │ │  EXPTS  │  ║
║  │ Full OTel     │ │ Judge scores    │ │ janus_learn  │ │ Pre vs  │  ║
║  │ span tree     │ │ per cycle       │ │ ing_events   │ │ Post    │  ║
║  │ per cycle     │ │ all 5 dims      │ │ (auto-grow)  │ │ constr  │  ║
║  └───────────────┘ └─────────────────┘ └──────────────┘ └─────────┘  ║
╚═══════════════════════════════════╤═══════════════════════════════════╝
                                    │ Phoenix REST API queries
                                    ▼
╔═══════════════════════════════════════════════════════════════════════╗
║               JANUS LOOP — THE SELF-CORRECTION ENGINE                 ║
║                                                                       ║
║  Meta-Agent queries Phoenix ──▶ Pattern analysis (Gemini Flash)      ║
║  ──▶ Constraint generation ──▶ Firestore (versioned) ──▶ Injected    ║
║  into next cycle + Phoenix Experiment (before/after scores)          ║
╚═══════════════════════════════════════════════════════════════════════╝
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
   ┌──────────────────────┐                 ┌──────────────────────────┐
   │  Janus Main Portfolio│                 │  Baseline Portfolio      │
   │  (with constraints + │                 │  (same agents, NO        │
   │   judge + loop)      │                 │   constraints, NO judge) │
   └──────────────────────┘                 └──────────────────────────┘
              │                                           │
              └─────────────────┬─────────────────────────┘
                                ▼
              ┌──────────────────────────────────────────┐
              │  FastAPI + SSE  ──▶  Next.js Dashboard   │
              │  Live stream · P&L comparison · Traces   │
              └──────────────────────────────────────────┘
```

---

## The Five Agents

### 1. Trading Agent

The quant strategist. It reads live portfolio positions and cash from Firestore, fetches real-time market prices and position betas via yfinance, retrieves the latest news headlines from Alpha Vantage, and injects all of this — along with any active behavioral constraints from the Janus Loop — into a Gemini Flash prompt. The output is a structured trade proposal: specific tickers, direction (BUY or SELL), quantity, a mandatory market-signal rationale for each trade, and a confidence score. Hard rules that are enforced in the prompt include: no single asset exceeding 40% of portfolio value, at most 3 trades per cycle, and explicit uncertainty flagging when confidence falls below 0.5. Beta values for held positions are pre-computed and injected into the prompt so the agent cannot hallucinate whether a position is "defensive" or "aggressive."

### 2. Risk Agent

The conservative gatekeeper. Before any LLM reasoning occurs, Python code pre-computes the portfolio's one-day Value-at-Risk at 95% confidence using a parametric model: weighted position volatilities multiplied by 1.645. The LLM then evaluates the Trading Agent's proposed trades against four non-negotiable hard limits: a single position must not exceed 40% of portfolio value, daily VaR must stay below 5%, cash reserves must remain above a 10% floor, and sector concentration must not exceed 70%. Because the math runs in Python before the LLM is ever called, the agent cannot hallucinate past these constraints — the numbers are facts given to it, not something it is asked to calculate. The output is APPROVE, MODIFY, or VETO, with a structured risk report including current and proposed VaR.

### 3. Fraud Intelligence Agent

The investigator. It uses three layers of detection simultaneously. First, programmatic Python checks catch the most clear-cut violations: wash trading (same ticker bought and sold in the last five trades) and unusual concentration (a single ticker appearing in more than 30% of the last twenty trades). Second, a Gemini Flash call at low temperature analyzes the full pipeline trace for reasoning inconsistencies, abnormal trade velocity, and front-running patterns that correlate suspiciously with active market shocks. Third, a data-driven `HallucinationDetector` cross-references agent claims against the pre-injected beta data — if the Trading Agent describes a position as "defensive" but the actual beta is above 1.0, that is a flagged hallucination. The result is a CLEAR or ALERT status with structured findings, severity levels (LOW / MEDIUM / HIGH), and specific audit recommendations.

### 4. Regulator Agent

The final authority. It synthesizes the Risk Agent's report and the Fraud Agent's alerts into one of three decisions: EXECUTE (proceed with the approved trades), HOLD (pause this cycle without halting the system), or HALT (activate the circuit breaker). The circuit breaker is triggered automatically by any HIGH severity fraud alert, a Risk Agent VETO, or an open fraud investigation. Once activated, it freezes all trading for a configurable cooldown period — defaulting to five minutes — and then auto-releases, resuming the cycle scheduler without manual intervention. Every regulator decision includes a unique `audit_trail_id`, a plain-language reason, and explicit resume conditions, forming a complete audit log baked into the agent's output schema.

### 5. LLM Judge

The meta-evaluator. After every decision cycle, the Judge reviews the complete agent pipeline trace and scores it across five dimensions on a 1–10 scale: **Correctness** (was the financial reasoning sound and internally consistent?), **Safety** (were all risk boundaries respected?), **Hallucination Risk** (did any agent make claims unsupported by the data given to it?), **Compliance** (were all behavioral constraints and regulatory rules followed?), and **Explainability** (could a human regulator follow and audit the reasoning chain?). Any cycle scoring below 6.0 overall, or below 4.0 on any single dimension, is flagged as a `learning_event`. The Judge does not veto trades — it is purely observational. Its scores are posted to Arize Phoenix as span evaluations after every cycle, and learning events are added to the `janus_learning_events` Phoenix Dataset, which feeds directly into the Janus Loop.

---

## The Janus Loop — Self-Correction Engine

The Janus Loop runs every N cycles (default: 10) and closes the feedback loop between failure and correction. It transforms a static agent pipeline into one that watches its own failures and changes its own behavior.

**Step 1 — Query Phoenix:** The Meta-Agent calls Arize Phoenix's REST API to fetch the last 20 learning events, retrieve per-dimension score trends, and identify which agents appear most frequently in failing cycles.

**Step 2 — Pattern Analysis:** Gemini Flash analyzes the failure clusters. Example finding: *"Trading Agent safety score averaged 4.2/10 over 15 cycles; all failures cluster around high-news-volume market periods."*

**Step 3 — Constraint Generation:** The Meta-Agent produces 1–3 natural language behavioral constraints, each specifying a target agent, a triggering condition, an explicit rule, a rationale, and the dimension it targets. Example:
```
CONSTRAINT_042  (2026-05-19T14:22:00Z)
Agent:     Trading Agent
Condition: news_volume > 5 headlines/hour AND volatility = HIGH
Rule:      Reduce position sizing by 50%. Max 2 trades per cycle.
Rationale: Safety scores below threshold in high-news environments.
Expires:   50 cycles (auto-review)
```

**Step 4 — Injection:** Constraints are written to Firestore (versioned, timestamped) and fetched by agents at the start of each new cycle. The Constraint Enforcer node — positioned between the Trading Agent and Risk Agent in the LangGraph — mechanically enforces four rule types without any LLM involvement: max trades per cycle (trim by confidence), position size limits (scale quantities down), forbidden actions (remove matching trades), and cash floor enforcement (remove expensive BUYs until floor is respected). Violations are logged to the cycle state and reported to the Judge as context, raising the compliance dimension score when constraints are correctly enforced.

**Step 5 — Measurement:** A Phoenix Experiment is created automatically, comparing dimension scores across cycles before and after the constraint becomes active. The improvement is numerical and inspectable: *"Constraint #042: Safety score 4.2 → 7.1 over 20 cycles."* Constraints auto-expire after 50 cycles and are monitored by a `ConstraintConflictDetector` that flags contradictions between rules.

---

## Arize Phoenix Integration

Phoenix is not a logging tool in Janus — it is the intelligence backbone of the self-correction engine.

| Pillar | What | How |
|--------|------|-----|
| **Tracing** | Full OpenTelemetry span tree per decision cycle covering every agent LLM call, every tool call, full inputs/outputs, token counts, latency, and cost | `openinference-instrumentation-langchain` auto-instrumentation; batch OTLP exporter to Phoenix collector; all spans share `cycle.id` attribute |
| **Evaluations** | Judge scores posted as span annotations after every cycle; normalized 0–1, labeled pass/fail; 10-cycle trend annotations (IMPROVING / STABLE / DEGRADING) per agent per dimension | `post_cycle_evaluations()` in `observability/evaluations.py` |
| **Datasets** | Every learning event auto-added to `janus_learning_events` Phoenix Dataset; primary data source for Meta-Agent pattern queries; grows continuously | `post_learning_event_to_dataset()` called on every flagged cycle |
| **Experiments** | A new Phoenix Experiment created each time the Janus Loop generates constraints; shows pre/post dimension scores with improvement deltas; quantifies constraint impact | `create_constraint_experiment()` in `services/phoenix_service.py` |

**Span hierarchy per cycle:**
```
decision_cycle_012
  ├── trading_agent       [llm_call, fetch_market_data, fetch_news]
  ├── risk_agent          [llm_call]
  ├── fraud_agent         [llm_call, analyze_trade_history]
  ├── regulator_agent     [llm_call]
  └── judge_agent         [llm_call]
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Agent Orchestration | LangGraph StateGraph | 1.2 |
| LLM | Google Gemini Flash (AI Studio) | 2.0 |
| LLM Rotation | 10 API keys × 5 model fallbacks, runtime exhaustion tracking | — |
| Backend Framework | FastAPI + Uvicorn | 0.136 / 0.47 |
| Real-time Stream | Server-Sent Events (sse-starlette) | 3.4 |
| Observability | Arize Phoenix (self-hosted) | 15.10 |
| OTel Instrumentation | openinference-instrumentation-langchain | 0.1.66 |
| Database | Google Cloud Firestore | 2.27 |
| Market Data | yfinance (prices, beta) | 1.3 |
| News | Alpha Vantage (4-key rotation) | — |
| Frontend Framework | Next.js 14 App Router + TypeScript | 14 |
| Frontend UI | Tailwind CSS + shadcn/ui | — |
| Charts | Recharts | — |
| Container | Docker (python:3.11-slim) | — |
| Cloud | Google Cloud Run | — |

---

## How to Run Locally

> **The system is fully deployed and accessible at the live URLs above** — no local setup required to explore it. The instructions below are for running your own instance.

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud project with Firestore enabled
- Service account JSON with Firestore read/write permissions
- At least one Gemini API key from [Google AI Studio](https://aistudio.google.com) (free tier)
- At least one Alpha Vantage API key from [alphavantage.co](https://www.alphavantage.co) (free tier)

### 1. Clone and configure

```bash
git clone https://github.com/Harsh-617/janus.git
cd janus
cp backend/.env.example backend/.env
# Edit backend/.env — fill in your keys (see Environment Variables below)
```

Place your Google Cloud service account JSON at `backend/service-account.json`.

### 2. Start Arize Phoenix (local) — Terminal 1

Phoenix must be running before the backend so it can receive traces.

```bash
pip install arize-phoenix
python -m phoenix.server.main serve
# Phoenix UI at http://localhost:6006
```

### 3. Start the backend — Terminal 2

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health`

### 4. Seed portfolios (first run only)

```bash
python scripts/seed_baseline.py
```

This initializes both the `janus_main` and `janus_baseline` Firestore documents with $1,000,000 starting capital.

### 5. Start the frontend — Terminal 3

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
# Dashboard at http://localhost:3000
```

### 6. Navigate the dashboard

| Page | URL | What it shows |
|------|-----|--------------|
| The Arena | `http://localhost:3000` | Live agent feed, portfolio P&L, Janus vs Baseline chart |
| Agent Control Room | `/agents` | Per-agent status, radar chart of 5-dimension scores |
| Janus Loop | `/loop` | Constraint history, Phoenix experiment results |
| Observability | `/observability` | Embedded Phoenix UI (traces, evals, datasets) |
| Audit Log | `/audit` | Filterable full decision history |

### 7. Trigger the system via API

```bash
# Run a single decision cycle immediately
curl -X POST http://localhost:8000/api/stream/run-once

# Start the auto-cycle scheduler
curl -X POST http://localhost:8000/api/stream/start

# Inject a market shock scenario
curl -X POST http://localhost:8000/api/market-shock/preset/oil_shock

# Manually trigger the Janus Loop self-correction
curl -X POST http://localhost:8000/api/janus-loop/trigger
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Path to service account JSON (e.g. `./service-account.json`) |
| `VERTEX_AI_LOCATION` | Yes | GCP region (e.g. `us-central1`) |
| `GEMINI_API_KEY_1` | Yes | Primary Gemini API key (Google AI Studio — free tier) |
| `GEMINI_API_KEY_2` – `GEMINI_API_KEY_10` | No | Additional keys for multi-key rotation; system skips exhausted (quota) keys automatically |
| `GEMINI_MODEL_FAST` | No | Model override for agent calls (default: `gemini-2.0-flash`) |
| `GEMINI_MODEL_JUDGE` | No | Model override for LLM Judge (default: `gemini-2.0-flash`) |
| `ALPHA_VANTAGE_API_KEY_1` | Yes | Primary Alpha Vantage key for news headlines |
| `ALPHA_VANTAGE_API_KEY_2` – `ALPHA_VANTAGE_API_KEY_4` | No | Additional keys for rotation when daily limit is hit |
| `PHOENIX_COLLECTOR_ENDPOINT` | Yes | OTLP trace ingest endpoint (e.g. `http://localhost:6006/v1/traces`) |
| `PHOENIX_BASE_URL` | Yes | Phoenix REST API base (e.g. `http://localhost:6006`) |
| `FIRESTORE_PORTFOLIO_ID` | No | Main portfolio document ID (default: `janus_main`) |
| `AGENT_CYCLE_INTERVAL_SECONDS` | No | Seconds between decision cycles (default: `120`; use `30` for demo) |
| `JANUS_LOOP_INTERVAL_CYCLES` | No | How often the self-correction loop runs, in cycles (default: `10`) |
| `INITIAL_CAPITAL` | No | Starting portfolio capital in USD (default: `1000000.0`) |

---

## License

This project is licensed under the **MIT License**.

All market data is used for simulation purposes only. This is not financial advice.

---

<div align="center">

*Janus governed transitions.*
*This system governs the transition from wrong decision to right behavior.*
*Every time the system corrects itself — Janus makes a transition.*

**Built with purpose. Observed with Phoenix. Governed by design.**

</div>
