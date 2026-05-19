# JANUS — Product Requirements Document
### The Self-Governing Autonomous Financial Intelligence System
**Hackathon**: Google Cloud Rapid Agent Hackathon — Arize Track  
**Team Size**: 2  
**Submission Deadline**: June 12, 2026 @ 5:00 AM GMT+8  
**Version**: 1.0 — Final

---

## Table of Contents

1. [Vision & Core Concept](#1-vision--core-concept)
2. [What Makes This Win](#2-what-makes-this-win)
3. [System Architecture](#3-system-architecture)
4. [The Agents — Detailed Specs](#4-the-agents--detailed-specs)
5. [The Janus Loop — Self-Correction Engine](#5-the-janus-loop--self-correction-engine)
6. [Arize Phoenix Integration — The Critical Layer](#6-arize-phoenix-integration--the-critical-layer)
7. [Tech Stack — Final Decisions](#7-tech-stack--final-decisions)
8. [Data Models & State](#8-data-models--state)
9. [API Integrations](#9-api-integrations)
10. [Frontend & UI Design](#10-frontend--ui-design)
11. [The Demo Flow](#11-the-demo-flow)
12. [Development Phases & Task Breakdown](#12-development-phases--task-breakdown)
13. [Team Division of Work](#13-team-division-of-work)
14. [Submission Checklist](#14-submission-checklist)

---

## 1. Vision & Core Concept

### The Name

**Janus** — Roman god of transitions, duality, and time. Depicted with two faces:

- **Face 1 (Forward)** — looks ahead at real-time markets, news, and risk in the present moment
- **Face 2 (Backward)** — looks back at its own decision history, traces, failures, and scores via Phoenix

This is not a metaphor. It is the literal architecture. The system has two operational modes running simultaneously: a forward-acting agent economy and a backward-looking observability and self-correction engine. They are inseparable. One cannot function without the other.

### The One-Line Pitch

> *Janus is an autonomous financial intelligence system where AI agents trade, regulate, and investigate — then audit themselves, score their own decisions, and evolve their behavior based on what they got wrong.*

### What Janus Is NOT

- Not a chatbot that answers finance questions
- Not a simple stock screener
- Not agents that just call tools and return text
- Not a dashboard that wraps an existing API

### What Janus IS

A **closed-loop autonomous agent economy** with five specialized AI agents operating on a simulated portfolio, where every decision is traced, evaluated by an LLM judge, scored across multiple dimensions, stored in Phoenix, and fed back into the system to make the next generation of decisions smarter.

---

## 2. What Makes This Win

### Against the Arize Judging Criteria

**Technological Implementation**
- Deep Phoenix integration: tracing, evaluations, datasets, experiments — all four pillars used
- Google Cloud Agent Builder + Vertex AI as the deployment backbone
- LangGraph for stateful multi-agent orchestration
- Phoenix MCP server used meaningfully, not just for show

**Design**
- A dedicated Governance Dashboard showing live traces, scores, and agent state
- The "Janus Face" metaphor expressed visually in the UI
- Not a terminal or notebook — a real product-quality interface

**Potential Impact**
- Financial services is one of the three example domains in the hackathon brief
- The self-correction loop represents the future of enterprise AI governance
- Applicable beyond finance: any domain where AI decisions need to be trusted, audited, and improved

**Quality of Idea**
- No other hackathon team will build a system that *watches itself fail and changes its behavior*
- The LLM-as-Judge + Phoenix evaluation pipeline is something Arize judges built their company around
- The mythology framing gives it narrative power that purely technical projects lack

### The Unfair Advantage

Arize's judges (Richard Young — Director of Partner Solutions, Clay Miner — Head of Solutions Strategy) are not looking for another RAG chatbot. They are looking for something that makes a serious argument about how AI systems should be built in the enterprise. Janus makes that argument at every level: architecture, tooling, UI, and demo.

---

## 3. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MARKET LAYER                             │
│   Real price data (yfinance) + News feed + User-injected events │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JANUS AGENT ECONOMY                          │
│              (LangGraph stateful multi-agent graph)             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Trading Agent│  │  Risk Agent  │  │ Fraud Intelligence   │  │
│  │              │  │              │  │       Agent          │  │
│  │ Proposes     │  │ Validates    │  │ Monitors suspicious  │  │
│  │ trades based │  │ risk metrics │  │ patterns, anomalies  │  │
│  │ on market    │  │ VaR/exposure │  │ insider signals      │  │
│  │ signals      │  │ constraints  │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘             │
│                           │                                     │
│                           ▼                                     │
│                 ┌──────────────────┐                           │
│                 │  Regulator Agent │                           │
│                 │                  │                           │
│                 │  Compliance      │                           │
│                 │  enforcement     │                           │
│                 │  Final gatekeeper│                           │
│                 └────────┬─────────┘                           │
│                          │                                     │
│                          ▼                                     │
│                 ┌──────────────────┐                           │
│                 │  LLM Judge Agent │                           │
│                 │                  │                           │
│                 │  Scores decision │                           │
│                 │  across 5 dims   │                           │
│                 │  Approves/Rejects│                           │
│                 └────────┬─────────┘                           │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ARIZE PHOENIX LAYER                            │
│                                                                 │
│   Every agent call → OpenTelemetry trace                       │
│   Every judge score → Phoenix evaluation                        │
│   Every failure → flagged as learning event                    │
│   All traces queryable via Phoenix MCP server                  │
│                                                                 │
│   Traces │ Evaluations │ Datasets │ Experiments │ Annotations  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│               JANUS SELF-CORRECTION ENGINE                      │
│                    (The Backward Face)                          │
│                                                                 │
│   Meta-Agent reads Phoenix telemetry via MCP                   │
│   Identifies failure patterns across last N decisions          │
│   Generates updated behavioral constraints                     │
│   Injects constraints into next agent cycle                    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Map

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Agent Orchestration | LangGraph | Stateful agent graph, routing, memory |
| LLM | Gemini 2.0 Flash (Vertex AI) | All agent reasoning |
| Agent Deployment | Google Cloud Agent Builder (Vertex AI Agent Engine) | Hosting and scaling |
| Observability | Arize Phoenix (self-hosted on Cloud Run) | All tracing and evals |
| Phoenix MCP | Arize Phoenix MCP Server | Agent-to-Phoenix programmatic access |
| Backend API | FastAPI on Cloud Run | REST endpoints for frontend |
| Real-time Events | Server-Sent Events (SSE) | Live agent activity stream to UI |
| Portfolio State | Firestore | Persistent portfolio, trade history |
| Agent Memory | Firestore + LangGraph Checkpointer | Per-agent behavioral history |
| Market Data | yfinance + Alpha Vantage | Real prices and news |
| Frontend | Next.js 14 + Tailwind | The Janus Dashboard |

---

## 4. The Agents — Detailed Specs

### Agent 1: The Trading Agent

**Role**: Acts as a quant-driven hedge fund manager

**Trigger**: Runs every market cycle (configurable: every 30s in demo, every 5min in production)

**Inputs**:
- Current portfolio state (positions, cash, P&L)
- Latest market prices for held assets
- Recent news headlines relevant to portfolio
- Behavioral constraints from Self-Correction Engine
- Risk Agent's last veto history

**What it does**:
1. Reads current portfolio and market data
2. Analyzes news for sentiment signals
3. Generates a proposed trade action (buy/sell/hold/rebalance)
4. Provides reasoning chain: market signal → thesis → proposed action
5. Calculates expected impact on portfolio metrics

**Output schema**:
```json
{
  "action": "REBALANCE",
  "trades": [
    {"ticker": "AAPL", "direction": "SELL", "quantity": 100, "rationale": "..."},
    {"ticker": "GLD", "direction": "BUY", "quantity": 50, "rationale": "..."}
  ],
  "thesis": "Inflation data suggests rotation from growth to commodities...",
  "confidence": 0.78,
  "expected_portfolio_change": {...}
}
```

**Key behaviors to enforce via prompt**:
- Must cite at least one specific market signal per trade
- Cannot propose single-asset concentration > 40%
- Must reference behavioral constraints from correction engine
- Must flag uncertainty explicitly when confidence < 0.5

---

### Agent 2: The Risk Agent

**Role**: The "adult in the room" — a conservative risk officer

**Trigger**: Immediately after every Trading Agent output, before any execution

**Inputs**:
- Trading Agent's proposed trades
- Current portfolio state
- Market volatility metrics (VIX equivalent for the simulation)
- Historical VaR (Value at Risk) data
- Correlation matrix of held assets

**What it does**:
1. Calculates portfolio VaR post-proposed-trade
2. Checks leverage ratios
3. Evaluates liquidity (can we exit these positions?)
4. Checks for excessive correlation (not truly diversified)
5. Issues: APPROVE / MODIFY / VETO with specific reasoning

**Veto Conditions** (hard rules):
- Single position > 40% of portfolio → veto
- Portfolio VaR exceeds 5% daily → veto
- Proposed cash level drops below 10% → modify
- >70% allocation to one sector → veto

**Output schema**:
```json
{
  "decision": "MODIFY",
  "modified_trades": [...],
  "vetoed_trades": [...],
  "risk_report": {
    "current_var": 0.032,
    "proposed_var": 0.061,
    "verdict": "Proposed VaR exceeds 5% threshold",
    "modifications": "Reduce AAPL sell to 50 shares to maintain cash floor"
  }
}
```

---

### Agent 3: The Fraud Intelligence Agent

**Role**: Runs parallel to trading operations, acts as a financial crimes investigator

**Trigger**: Every trade execution, plus periodic portfolio-wide scans

**Inputs**:
- Full trade history (last 100 transactions)
- News events with timestamps
- Agent decision reasoning chains
- Statistical baselines for normal trading behavior

**What it looks for**:
1. **Wash trading signals** — rapid buy/sell of same asset within short window
2. **Front-running patterns** — trades that consistently precede news events
3. **Unusual concentration** — sudden heavy accumulation of a single asset
4. **Reasoning inconsistencies** — Trading Agent's stated rationale doesn't match action taken (this is a form of hallucination detection)
5. **Abnormal velocity** — trade frequency spikes without market justification

**Output schema**:
```json
{
  "status": "ALERT",
  "alerts": [
    {
      "type": "REASONING_INCONSISTENCY",
      "severity": "HIGH",
      "description": "Trading Agent cited 'defensive positioning' but increased volatile asset exposure by 23%",
      "flagged_trade_id": "trade_20260519_047",
      "recommendation": "Escalate to Regulator. Flag trace for Phoenix review."
    }
  ],
  "investigation_open": true
}
```

**Why this agent matters for Arize**: Reasoning inconsistency detection is *hallucination detection in financial context* — this is Phoenix's core value proposition translated into a domain use case.

---

### Agent 4: The Regulator Agent

**Role**: Final gatekeeper — combines SEC + central bank roles

**Trigger**: After Risk Agent and Fraud Agent have both produced outputs

**Inputs**:
- Original trade proposal
- Risk Agent decision + report
- Fraud Agent alerts
- Current regulatory state (is system in "crisis mode"?)
- Historical compliance score from Phoenix

**What it does**:
1. Synthesizes all upstream signals
2. Makes final EXECUTE / HOLD / HALT decision
3. Can activate "Circuit Breaker" mode — halts all trading for a cooldown period
4. Logs compliance decision with audit trail
5. Can escalate: trigger a full portfolio audit

**Circuit Breaker Conditions**:
- Fraud Agent raises HIGH severity alert
- VaR breach confirmed by Risk Agent
- 3 consecutive judge scores below 4/10
- User manually triggers from dashboard

**Output schema**:
```json
{
  "final_decision": "HALT",
  "circuit_breaker_activated": true,
  "cooldown_minutes": 15,
  "reason": "Fraud alert HIGH severity combined with VaR breach. Circuit breaker engaged.",
  "audit_trail_id": "audit_20260519_012",
  "resume_conditions": ["Fraud investigation resolved", "VaR below 4%", "Manual override"]
}
```

---

### Agent 5: The LLM Judge

**Role**: Meta-evaluator — reviews the entire decision pipeline after each cycle

**Trigger**: After Regulator Agent decision, before execution

**This is not a guardian — it is a scorer.** The Judge's role is not to block (that's the Regulator) but to *evaluate quality* and feed scores into Phoenix.

**Inputs**:
- The complete decision trace for this cycle (all 4 agents' inputs/outputs)
- The final action to be taken
- Historical judge scores for this agent
- Portfolio performance since last correction

**Scoring Dimensions** (each scored 1–10):

| Dimension | What it measures |
|-----------|-----------------|
| **Correctness** | Was the reasoning financially sound? |
| **Safety** | Did the decision respect risk boundaries? |
| **Hallucination Risk** | Did any agent claim something unsupported by data? |
| **Compliance** | Were all regulatory constraints respected? |
| **Explainability** | Could a human regulator understand and audit this decision? |

**Output schema**:
```json
{
  "cycle_id": "cycle_20260519_012",
  "overall_score": 6.4,
  "dimension_scores": {
    "correctness": 8,
    "safety": 5,
    "hallucination_risk": 6,
    "compliance": 8,
    "explainability": 5
  },
  "critical_finding": "Trading Agent claimed 'commodities are uncorrelated with equities in inflationary environments' — this is an oversimplification that constitutes mild hallucination. The relationship is partial, not absolute.",
  "learning_event": true,
  "learning_event_reason": "Safety and explainability below threshold (< 6). Flag for self-correction.",
  "recommended_constraint": "Trading Agent should cite correlation data from portfolio when making asset relationship claims."
}
```

**These scores go directly into Phoenix as evaluations.** This is the core Arize integration.

---

## 5. The Janus Loop — Self-Correction Engine

This is the most technically innovative part of Janus. It is what separates it from "agents that do stuff" into "a system that learns."

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    JANUS LOOP (runs every N cycles)         │
│                                                             │
│  1. Meta-Agent queries Phoenix via MCP                      │
│     → Get last 20 judge evaluations                        │
│     → Get traces flagged as learning_event = true          │
│     → Get dimension score trends over time                 │
│                                                             │
│  2. Pattern Analysis                                        │
│     → Which dimensions are consistently low?               │
│     → Which agents are underperforming?                    │
│     → What specific behaviors recur in failed cycles?      │
│                                                             │
│  3. Constraint Generation                                   │
│     → Generate 2-3 specific behavioral rules               │
│     → Written as natural language constraints              │
│     → Timestamped and versioned                            │
│                                                             │
│  4. Constraint Injection                                    │
│     → Constraints stored in Firestore                      │
│     → Fetched by agents at start of each cycle             │
│     → Injected into system prompt as "Current Behavioral   │
│       Constraints from Janus Loop Cycle N"                 │
│                                                             │
│  5. Experiment Logging                                      │
│     → Phoenix Experiment created: "Pre-correction" vs      │
│       "Post-correction" performance                         │
│     → Measurable improvement tracked                        │
└─────────────────────────────────────────────────────────────┘
```

### Example in Action

**Janus Loop reads Phoenix and finds:**
- Last 15 cycles: Trading Agent safety score average = 4.2/10
- Pattern: Safety failures all involve trades proposed during simulated "high news volume" periods
- Trading Agent tends to over-trade in volatile news environments

**Janus Loop generates constraint:**
```
CONSTRAINT_042 (Generated: 2026-05-19T14:22:00Z)
Agent: Trading Agent
Condition: When news_volume > 5 headlines/hour AND market_volatility > HIGH
Rule: Reduce position sizing by 50%. Propose no more than 2 trades per cycle.
Rationale: Historical data shows aggressive trading in high-news-volume environments 
consistently produces safety score below threshold.
Expires: 50 cycles (auto-review)
```

**Next cycle:**
Trading Agent receives this constraint in its system prompt and adjusts behavior.

**Phoenix tracks:**
- Safety score before constraint: 4.2 avg
- Safety score after constraint: 7.1 avg
- Constraint effectiveness: POSITIVE → persist

This is **measurable AI improvement**. Judges can see the graph.

---

## 6. Arize Phoenix Integration — The Critical Layer

This section defines exactly how Phoenix is integrated. This is the heart of the Arize track submission.

### Integration Points

#### 6.1 Tracing (OpenTelemetry)

Every agent call is traced end-to-end using `openinference-instrumentation-langchain` + Phoenix's OTLP collector.

Each trace captures:
- Agent name and role
- Full input to the LLM (including injected constraints)
- Complete output from the LLM
- Tool calls made within the agent
- Token count, latency, cost estimate
- Cycle ID (links all agents in one decision cycle together)

**Trace hierarchy:**
```
Span: decision_cycle_012
  ├── Span: trading_agent
  │     ├── Span: fetch_market_data (tool)
  │     ├── Span: fetch_news (tool)
  │     └── Span: llm_call (Gemini)
  ├── Span: risk_agent
  │     └── Span: llm_call (Gemini)
  ├── Span: fraud_agent
  │     ├── Span: analyze_trade_history (tool)
  │     └── Span: llm_call (Gemini)
  ├── Span: regulator_agent
  │     └── Span: llm_call (Gemini)
  └── Span: llm_judge
        └── Span: llm_call (Gemini)
```

#### 6.2 Evaluations

After each Judge cycle, scores are posted to Phoenix as evaluations on the corresponding trace:

```python
# After each judge cycle
phoenix_client.log_evaluations([
    Evaluation(
        trace_id=cycle_trace_id,
        name="correctness",
        score=judge_output.dimension_scores.correctness / 10,
        label="pass" if score >= 0.6 else "fail",
        explanation=judge_output.critical_finding
    ),
    Evaluation(trace_id=..., name="safety", ...),
    Evaluation(trace_id=..., name="hallucination_risk", ...),
    Evaluation(trace_id=..., name="compliance", ...),
    Evaluation(trace_id=..., name="explainability", ...),
])
```

This means in the Phoenix UI, every decision cycle shows **live eval scores alongside the trace.**

#### 6.3 Datasets

Every flagged "learning event" (judge overall score < 6) is added to a Phoenix Dataset called `janus_learning_events`. This dataset grows over time and becomes the corpus that the Meta-Agent queries during the self-correction loop.

#### 6.4 Experiments

When the Janus Loop generates a new batch of constraints, a Phoenix Experiment is created:
- **Baseline**: Performance scores before constraints
- **Treatment**: Performance scores after constraints
- **Comparison**: Which constraints improved which dimensions

This lets judges see in the Phoenix UI: *"Constraint #042 improved safety score by 69% over 20 cycles."*

#### 6.5 Phoenix MCP Server Usage

The Meta-Agent (Self-Correction Engine) uses the Phoenix MCP server to:
1. `GET /v1/traces?filter=learning_event:true&limit=20` — fetch recent failures
2. `GET /v1/evaluations?trace_ids=[...]` — get scores for those traces
3. `POST /v1/datasets/janus_learning_events/examples` — add new learning events
4. `POST /v1/experiments` — create pre/post constraint experiment

This is **meaningful, functional MCP usage** — not just logging.

#### 6.6 The Governance Dashboard (Phoenix Embedded)

The Janus frontend embeds the Phoenix UI in an iframe for the "Observability" tab, giving judges a live view of the Phoenix environment without leaving the Janus dashboard.

---

## 7. Tech Stack — Final Decisions

### Backend

| Layer | Choice | Reason |
|-------|--------|---------|
| Agent Framework | **LangGraph 0.2+** | Best for stateful, cyclical multi-agent graphs with checkpointing. Native tool support. |
| LLM | **Gemini 2.0 Flash** (via Vertex AI) | Required. Flash for speed in agent loops; Pro available for Judge calls. |
| Agent Deployment | **Vertex AI Agent Engine** (Google Cloud Agent Builder) | Required. Handles agent hosting, scaling, session management. |
| Backend API | **FastAPI** | Lightweight, async, SSE support for live streaming |
| Hosting | **Google Cloud Run** | FastAPI container, easy CI/CD |
| Database | **Firestore** | Portfolio state, trade history, behavioral constraints, agent memory |
| LangGraph Checkpointer | **Firestore-backed** | Persists graph state between cycles |

### Observability

| Component | Choice |
|-----------|--------|
| Tracing | Arize Phoenix (self-hosted on Cloud Run) + OpenInference instrumentation |
| Evaluation pipeline | Phoenix Evaluations API |
| MCP Server | Arize Phoenix MCP server |

### Frontend

| Component | Choice | Reason |
|-----------|--------|--------|
| Framework | **Next.js 14 (App Router)** | SSE support, server components, production-quality |
| Language | **TypeScript** | Type safety across API responses and state |
| Styling | **Tailwind CSS + shadcn/ui** | Fast, consistent, customizable |
| Charts | **Recharts** | Portfolio P&L, score trends, agent activity |
| Real-time | **EventSource (SSE)** | Live agent feed from FastAPI backend |
| Hosting | **Vercel** | Zero-config deploys, free tier, instant preview URLs |

### Backend

| Layer | Choice | Reason |
|-------|--------|---------|
| Language | **Python 3.11+** | All agent/AI libraries are Python-first |
| Agent Framework | **LangGraph 0.2+** | Stateful multi-agent graphs, checkpointing, native Gemini support |
| LLM | **Gemini 2.0 Flash** via Vertex AI | Required. Flash for agent loops, Pro only for LLM Judge |
| Agent Deployment | **Vertex AI Agent Engine** (Google Cloud Agent Builder) | Required by hackathon rules |
| API Layer | **FastAPI** | Async, lightweight, native SSE support |
| Hosting | **Google Cloud Run** | Containerized FastAPI, easy CI/CD from GitHub |
| Database | **Firestore** | Portfolio state, trade history, behavioral constraints |
| LangGraph Checkpointer | **Firestore-backed** | Persists agent graph state between cycles |

### Financial Data

| Source | Usage |
|--------|-------|
| **yfinance** | Real-time and historical price data (free, no API key) |
| **Alpha Vantage** (free tier) | News sentiment API for top headlines |

### Dev & Infra

| Tool | Usage |
|------|-------|
| Docker | All services containerized |
| Google Cloud Run | Backend + Phoenix deployment |
| GitHub | Repo (required for submission) |
| GitHub Actions | CI/CD to Cloud Run |

---

## 8. Data Models & State

### Portfolio State (Firestore: `portfolios/janus_main`)

```json
{
  "portfolio_id": "janus_main",
  "created_at": "2026-05-19T00:00:00Z",
  "initial_capital": 1000000,
  "cash": 245000,
  "total_value": 1087500,
  "pnl_pct": 8.75,
  "positions": {
    "AAPL": {"shares": 500, "avg_cost": 180.5, "current_price": 195.2},
    "GLD": {"shares": 200, "avg_cost": 220.0, "current_price": 235.1},
    "BTC-USD": {"shares": 0.5, "avg_cost": 65000, "current_price": 72000}
  },
  "trade_count": 47,
  "cycle_count": 23,
  "circuit_breaker_active": false,
  "risk_mode": "NORMAL"
}
```

### Trade Record (Firestore: `trades/{trade_id}`)

```json
{
  "trade_id": "trade_20260519_047",
  "cycle_id": "cycle_012",
  "timestamp": "...",
  "action": "BUY",
  "ticker": "GLD",
  "quantity": 50,
  "price": 235.1,
  "total_value": 11755,
  "proposed_by": "trading_agent",
  "approved_by": ["risk_agent", "regulator_agent"],
  "vetoed_by": null,
  "judge_score": 7.8,
  "phoenix_trace_id": "trace_abc123",
  "executed": true
}
```

### Behavioral Constraint (Firestore: `constraints/{constraint_id}`)

```json
{
  "constraint_id": "constraint_042",
  "generated_at": "...",
  "generated_by": "janus_loop_cycle_8",
  "target_agent": "trading_agent",
  "condition": "news_volume > 5 AND volatility = HIGH",
  "rule": "Reduce position sizing by 50%. Max 2 trades per cycle.",
  "rationale": "Safety scores consistently below threshold in high-news environments.",
  "status": "ACTIVE",
  "performance_delta": {
    "safety_before": 4.2,
    "safety_after": null,
    "cycles_active": 0
  },
  "expires_after_cycles": 50,
  "phoenix_experiment_id": "exp_xyz789"
}
```

### Agent Memory (Firestore: `agent_memory/{agent_id}`)

```json
{
  "agent_id": "trading_agent",
  "memory_version": 12,
  "active_constraints": ["constraint_042", "constraint_038"],
  "recent_performance": {
    "avg_judge_score_last_10": 6.8,
    "learning_events_last_10": 3,
    "trend": "IMPROVING"
  },
  "behavioral_notes": [
    "Tends to over-trade in high news volume",
    "Strong commodity rotation signals historically accurate"
  ]
}
```

---

## 9. API Integrations

### Backend REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio` | GET | Current portfolio state |
| `/api/trades` | GET | Trade history with pagination |
| `/api/cycles` | GET | Decision cycle history with judge scores |
| `/api/constraints` | GET | Active behavioral constraints |
| `/api/market-shock` | POST | Inject a market event (demo tool) |
| `/api/circuit-breaker` | POST | Manually trigger/release circuit breaker |
| `/api/stream` | GET (SSE) | Live agent activity stream |
| `/api/phoenix/traces` | GET | Proxied Phoenix trace data for dashboard |
| `/api/janus-loop/trigger` | POST | Manually trigger self-correction loop |
| `/api/janus-loop/history` | GET | History of generated constraints |

### Market Shock Events API (Demo Feature)

Users can inject events from the dashboard. Pre-built scenarios:

```json
{
  "scenarios": [
    {
      "id": "oil_shock",
      "name": "Oil Price Surge",
      "description": "Geopolitical conflict drives oil up 40%",
      "market_effects": {"XOM": +0.18, "GLD": +0.12, "AAPL": -0.08},
      "news_injection": "Major oil producer announces export restrictions amid conflict."
    },
    {
      "id": "crypto_crash",
      "name": "Crypto Black Swan",
      "description": "Major exchange collapse triggers 60% crypto selloff",
      "market_effects": {"BTC-USD": -0.60, "ETH-USD": -0.55, "GLD": +0.15}
    },
    {
      "id": "fed_rate_hike",
      "name": "Emergency Fed Rate Hike",
      "description": "+150bps surprise hike",
      "market_effects": {"TLT": -0.12, "AAPL": -0.10, "GLD": +0.08}
    },
    {
      "id": "bank_run",
      "name": "Regional Bank Crisis",
      "description": "Contagion fears spread through banking sector",
      "market_effects": {"KRE": -0.35, "GLD": +0.20, "AMZN": -0.08}
    }
  ]
}
```

---

## 10. Frontend & UI Design

### Design Direction

**Aesthetic**: Dark-mode financial terminal meets ancient artifact. The UI should feel like a Bloomberg terminal that Janus himself designed — authoritative, precise, and slightly mythological.

**Color Palette**:
- Background: Near-black `#0A0B0D`
- Surface: Dark slate `#13151A`
- Accent primary: Roman gold `#C9A84C`
- Accent secondary: Ice blue `#4CADCE` (for the forward-looking data)
- Accent tertiary: Aged bronze `#8B6914` (for the backward-looking history)
- Danger: `#E05252`
- Success: `#52E0A0`
- Text primary: `#E8E6E0`
- Text secondary: `#8A8780`

**Typography**:
- Display font: "Cinzel" (Roman-inspired serif for headers, the Janus name)
- Data font: "JetBrains Mono" (for numbers, traces, scores)
- Body font: "DM Sans" (for readable text)

**The "Two Faces" Visual Motif**:
- The main layout is split into two conceptual halves
- Left/forward side: live market data, agent actions, portfolio — blue-tinted
- Right/backward side: Phoenix traces, scores, history, corrections — gold-tinted
- A subtle vertical divider with a Janus face icon separates them

### Pages / Views

#### Page 1: The Arena (Main Dashboard)

The primary view. Shows the system running.

**Top bar**: Portfolio value, P&L %, cycle count, system status (RUNNING / CIRCUIT BREAKER / PAUSED)

**Left panel — The Forward Face**:
- Live portfolio positions with sparklines
- Current market prices (auto-refreshing)
- Active agent indicator (which agent is currently "thinking")
- Live trade execution feed

**Center — The Decision Feed**:
- Real-time stream of agent decisions
- Each entry shows: agent name, action taken, confidence, timestamp
- Color coded: green = approved, red = vetoed, amber = modified

**Right panel — The Backward Face**:
- Latest 5 judge scores (sparkline trend)
- Active constraint count
- Last Janus Loop run time
- Phoenix trace count

**Bottom — Market Shock Panel**:
- Preset scenario buttons (Oil Shock, Crypto Crash, etc.)
- Custom event text input
- Circuit Breaker toggle

#### Page 2: Agent Control Room

Deep view into each agent's current state.

**5 agent cards**, each showing:
- Current status
- Last decision
- Average judge score (this agent, last 20 cycles)
- Dimension breakdown radar chart (correctness, safety, etc.)
- Active constraints affecting this agent
- Link to Phoenix traces for this agent

#### Page 3: The Janus Loop

Shows the self-correction engine.

**Timeline of Janus Loop runs**: Each run shown as an event with:
- Trigger reason (scheduled / manual / alert)
- Patterns detected
- Constraints generated
- Performance delta (before vs after)

**Active Constraints Table**: All current behavioral constraints with:
- Which agent they apply to
- Performance improvement since activation
- Expiry countdown
- Manual override buttons

**Phoenix Experiment Viewer**: Embedded comparison of pre/post constraint performance from Phoenix

#### Page 4: Observability (Phoenix)

Phoenix UI embedded in an iframe, full-screen. Plus:
- Quick filters: "Show only learning events", "Show only HIGH severity fraud alerts"
- Score trend chart (built by us, using data proxied from Phoenix)

#### Page 5: Audit Log

Complete, filterable history of all decisions with:
- Full reasoning chains
- Judge scores per dimension
- Outcome (executed/vetoed/modified)
- Phoenix trace link per decision

---

## 11. The Demo Flow

The demo video must be ~3 minutes. Every second counts. This is the script:

### 0:00–0:20 — The Hook

Show the Janus logo. Voiceover:

> "Most AI systems just answer questions. Janus is different. It's a self-governing financial intelligence system — where AI agents not only make decisions, they audit themselves, score their own reasoning, and evolve their behavior based on what they got wrong."

Quick cut: show the two-panel dashboard running live.

### 0:20–0:50 — The System Running Normally

Show a decision cycle completing:
- Trading Agent proposes a trade
- Risk Agent approves with modification
- Regulator Agent executes
- Judge scores it: 7.8/10

Point to Phoenix panel: "Every decision is traced here — agent by agent, token by token."

### 0:50–1:30 — The Market Shock

Click "Oil Price Surge +40%".

Watch all agents react simultaneously:
- Trading Agent: "Rebalancing toward energy and commodities"
- Risk Agent: "VaR spike detected. Reducing leverage."
- Fraud Agent: "Unusual price movement in energy ETFs — monitoring for manipulation"
- Regulator Agent: "Risk within acceptable bounds. Approving with modified position sizes."

Judge evaluates: 5.2/10. Safety: 4/10. 

> "The Judge flagged this cycle as a learning event. Safety score too low."

### 1:30–2:00 — Phoenix in Detail

Click into the Phoenix trace for this cycle.

Show:
- The full reasoning chain
- The hallucination flag the Judge identified ("Trading Agent claimed energy stocks are immune to rate risk — this is factually incorrect.")
- The evaluation scores logged to Phoenix
- It gets added to the `janus_learning_events` dataset automatically

> "This isn't just logging. This is the system building its own memory of failure."

### 2:00–2:40 — The Janus Loop Fires

Click "Trigger Janus Loop Now."

Watch it:
1. Query Phoenix for recent learning events via MCP
2. Identify pattern: "Trading Agent overclaims asset relationships in shock scenarios"
3. Generate constraint: "When injecting market shock scenario, require Trading Agent to cite correlation data before making cross-asset claims"
4. Inject constraint into agent memory

Show the Phoenix Experiment created comparing before/after scores.

> "This is Janus looking backward — reading its own failures — and writing new rules for itself."

### 2:40–3:00 — After the Loop

Trigger another Oil Shock.

Same scenario — but now:
- Trading Agent's reasoning is more measured
- Judge score: 8.1/10. Safety: 8/10.
- No learning event flagged.

> "One loop run. 2.9 point improvement in safety score. Automatically. Without human intervention. That's Janus."

End on the two-face logo: one face forward, one face back.

---

## 12. Development Phases & Task Breakdown

### Phase 1: Foundation (Days 1–4)

**Goal**: All infrastructure running, agents sending traces to Phoenix.

| Task | Owner | Day |
|------|-------|-----|
| GCP project setup (Cloud Run, Firestore, Vertex AI) | Dev A | 1 |
| Phoenix self-hosted deployment on Cloud Run | Dev A | 1 |
| Repo setup, GitHub Actions CI/CD | Dev B | 1 |
| LangGraph project scaffold | Dev A | 2 |
| Basic Trading Agent (no tools yet, just LLM reasoning) | Dev A | 2 |
| Phoenix tracing instrumentation wired up | Dev A | 3 |
| Verify traces appear in Phoenix UI | Dev A | 3 |
| Next.js project setup, Tailwind, routing | Dev B | 2-3 |
| Firestore data models defined and seeded | Dev B | 3 |
| FastAPI scaffold with `/api/portfolio` and `/api/stream` (mock) | Dev B | 4 |

**Phase 1 Done Criteria**: A single Trading Agent running a loop, traces visible in Phoenix, frontend skeleton running.

---

### Phase 2: All Agents Live (Days 5–10)

**Goal**: Complete 5-agent pipeline running end-to-end.

| Task | Owner | Day |
|------|-------|-----|
| Risk Agent implementation | Dev A | 5 |
| Fraud Agent implementation | Dev A | 6 |
| Regulator Agent + Circuit Breaker logic | Dev A | 7 |
| LLM Judge implementation with all 5 scoring dimensions | Dev A | 8 |
| LangGraph graph connecting all 5 agents in correct order | Dev A | 9 |
| Phoenix Evaluations API integration (Judge scores → Phoenix) | Dev A | 9 |
| yfinance integration for real market data | Dev B | 5 |
| Alpha Vantage news integration | Dev B | 6 |
| Trade execution engine (simulated) + Firestore persistence | Dev B | 7 |
| Market Shock injection API endpoint | Dev B | 8 |
| SSE live stream endpoint wired to LangGraph events | Dev B | 9 |
| Frontend: Agent Control Room page | Dev B | 10 |

**Phase 2 Done Criteria**: Full 5-agent decision cycle runs, judge scores appear in Phoenix as evaluations, trades persist in Firestore.

---

### Phase 3: Janus Loop + Phoenix Deep Integration (Days 11–16)

**Goal**: Self-correction engine working, Phoenix Datasets and Experiments active.

| Task | Owner | Day |
|------|-------|-----|
| Meta-Agent implementation (reads Phoenix via MCP) | Dev A | 11-12 |
| Constraint generation logic | Dev A | 13 |
| Constraint injection into agent prompts | Dev A | 13 |
| Phoenix Dataset: `janus_learning_events` auto-population | Dev A | 14 |
| Phoenix Experiments: pre/post constraint comparison | Dev A | 14 |
| Janus Loop scheduler (runs every N cycles) | Dev A | 15 |
| Frontend: The Janus Loop page | Dev B | 11-12 |
| Frontend: Audit Log page | Dev B | 13 |
| Frontend: Phoenix Observability embedded page | Dev B | 14 |
| Portfolio P&L chart + sparklines | Dev B | 15 |
| Agent radar charts (dimension score breakdowns) | Dev B | 15 |
| Score trend charts (overall + per agent) | Dev B | 16 |

**Phase 3 Done Criteria**: Janus Loop fires, generates constraints, injects them, Phoenix Experiment shows improvement.

---

### Phase 4: Polish + Demo Prep (Days 17–21)

**Goal**: Production-quality UI, demo recorded, all edge cases handled.

| Task | Owner | Day |
|------|-------|-----|
| Full UI polish pass — fonts, colors, animations | Dev B | 17-18 |
| Mobile responsive check (not primary but good to have) | Dev B | 18 |
| Error handling and edge cases (empty portfolio, Phoenix down, etc.) | Dev A | 17 |
| Performance optimization (agent loop speed) | Dev A | 18 |
| All 4 preset market shock scenarios implemented and tested | Dev A | 19 |
| End-to-end test: full demo flow dry run | Both | 19 |
| Demo video recording | Both | 20 |
| Demo video editing | Dev B | 21 |
| README: complete setup instructions | Dev A | 21 |
| Open source license added to repo | Dev A | 21 |

---

### Phase 5: Submission (Days 22–23)

| Task | Owner | Day |
|------|-------|-----|
| Final production deploy (all services live) | Dev A | 22 |
| Devpost submission form completed | Both | 22 |
| Hosted project URL verified | Dev A | 22 |
| Repo public, license visible, demo video linked | Both | 22 |
| Final review of submission | Both | 23 |
| Submit | Both | 23 |

---

## 13. Team Division of Work

Work is split **by feature/vertical slice** — both devs own full-stack slices (backend API + frontend UI) for their assigned features. No one is "just frontend" or "just backend."

---

### Dev A: The Decision Engine

**You own everything related to agents making decisions and Phoenix observing them.**

| Feature | Backend (Python) | Frontend (Next.js) |
|---------|-----------------|-------------------|
| **All 5 agents** | LangGraph graph, agent prompts, tool definitions, routing logic | — |
| **Phoenix Tracing** | OpenTelemetry instrumentation, span hierarchy, trace logging | — |
| **LLM Judge** | Judge agent implementation, 5-dimension scoring logic | — |
| **Phoenix Evaluations** | Post-cycle eval logging to Phoenix API | — |
| **The Arena (main dashboard)** | `/api/portfolio`, `/api/trades`, `/api/stream` (SSE) | Page 1: live portfolio, decision feed, agent activity, circuit breaker button |
| **Audit Log** | `/api/cycles` (full cycle history with trace links) | Page 5: filterable decision history, reasoning chains, judge scores |
| **Market Shock injection** | `/api/market-shock` endpoint, price effect simulation | Market Shock panel on The Arena page |

**Dev A's critical path**: LangGraph graph working → agents traced in Phoenix → Judge scores appearing as evaluations → SSE stream feeding the frontend

---

### Dev B: The Intelligence Layer

**You own everything related to financial data, the self-correction brain, and the analytical views.**

| Feature | Backend (Python) | Frontend (Next.js) |
|---------|-----------------|-------------------|
| **Financial data layer** | yfinance integration, Alpha Vantage news, portfolio math (VaR, P&L, position sizing) | — |
| **Portfolio simulation engine** | Trade execution logic, Firestore portfolio state management | — |
| **Janus Loop (Meta-Agent)** | Phoenix MCP queries, pattern analysis, constraint generation + injection | — |
| **Constraint system** | `/api/constraints` CRUD, Firestore constraint storage, agent prompt injection | — |
| **Phoenix Datasets + Experiments** | `janus_learning_events` dataset population, pre/post experiment creation | — |
| **Agent Control Room** | `/api/agents` (per-agent state, scores, constraints) | Page 2: 5 agent cards, radar charts, score history per agent |
| **The Janus Loop page** | `/api/janus-loop/history`, `/api/janus-loop/trigger` | Page 3: loop timeline, constraint table, experiment viewer |
| **Observability page** | `/api/phoenix/traces` (proxy) | Page 4: embedded Phoenix iframe + score trend charts |

**Dev B's critical path**: yfinance data flowing → portfolio state in Firestore → Janus Loop querying Phoenix via MCP → constraints appearing and affecting agent behavior

---

### Shared Responsibilities

| Task | When |
|------|------|
| GCP project setup, Cloud Run services, Firestore init | Day 1 together |
| Agree on shared TypeScript types for API responses | Day 2 |
| Agree on Firestore schema (both read/write it) | Day 2 |
| End-to-end integration test (Dev A's stream → Dev B's UI) | Day 10 |
| Demo dry run | Day 19 |
| Demo video recording and editing | Day 20 |
| README, repo cleanup, Devpost submission | Day 22–23 |

---

### Dependency Map

The one critical dependency: **Dev B's frontend pages (Control Room, Janus Loop) need data that Dev A's agents produce.** Handle this by:

1. Dev B mocks the API responses locally until Day 10 integration
2. Agree on the API response shapes on Day 2 (write TypeScript interfaces together)
3. Dev B builds UI against mock data; swap to real endpoints at integration point

This way both devs are never blocked waiting for each other.

---

## 14. Submission Checklist

### Required by Hackathon

- [ ] Hosted project URL (live deployment accessible by judges)
- [ ] Open-source GitHub repository URL (public)
- [ ] Open source license file (MIT recommended — visible in repo About section)
- [ ] ~3 minute demo video (YouTube or Loom link)
- [ ] Track selection: **Arize**
- [ ] Completed Devpost submission form

### Quality Checks Before Submission

- [ ] All 5 agents run a complete cycle without errors
- [ ] Judge scores appear as evaluations in Phoenix
- [ ] Janus Loop fires and generates at least one constraint
- [ ] Market Shock scenarios all work correctly
- [ ] Circuit Breaker activates and releases correctly
- [ ] Phoenix UI accessible and showing real data
- [ ] Frontend loads in < 3 seconds on a standard connection
- [ ] All 5 pages navigate correctly
- [ ] Demo video shows the complete flow from market shock → judge failure → loop → improvement
- [ ] README contains clear setup instructions that a judge could follow

### Arize-Specific Checks

- [ ] Phoenix MCP server is meaningfully used (not just for logging — for querying and acting on data)
- [ ] Evaluations pipeline active (not just traces)
- [ ] Datasets feature used (`janus_learning_events`)
- [ ] Experiments feature used (pre/post constraint comparison)
- [ ] Hallucination detection demonstrated in demo (Fraud Agent reasoning inconsistency check)

---

## Appendix A: Key Differentiators Summary

| What most hackathon teams build | What Janus does |
|--------------------------------|-----------------|
| Agents that answer questions | Agents that execute decisions |
| Single agent | 5 specialized agents in a stateful graph |
| No evaluation | LLM Judge scoring 5 dimensions per cycle |
| Logs to console | Full OpenTelemetry traces in Phoenix |
| Static behavior | Dynamic behavior via self-correction loop |
| No memory of failures | Phoenix Dataset of all learning events |
| Uses MCP for show | Uses MCP to query, analyze, and act on telemetry |

## Appendix B: Name & Narrative

Lean into the mythology in the UI and the demo. The two-face metaphor is not decorative — it is the architecture:

- **The Forward Face**: real-time, market-aware, decision-executing
- **The Backward Face**: trace-reading, failure-analyzing, constraint-generating

Janus governed transitions. This system governs the transition from *wrong decision* to *right behavior*. Every time the system corrects itself, Janus makes a transition.

That narrative gives judges something to remember when they close the browser and compare 50 submissions.

---

*Document version 1.0 — Team Janus — May 2026*
