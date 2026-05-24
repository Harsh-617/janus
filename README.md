# JANUS
### The Self-Governing Autonomous Financial Intelligence System

> Janus is an autonomous financial intelligence system where AI agents trade,
> regulate, and investigate — then audit themselves, score their own decisions,
> and evolve their behavior based on what they got wrong.

Built for the **Google Cloud Rapid Agent Hackathon — Arize Track**

---

## What Is Janus

Janus takes its name from the Roman god of transitions and duality — depicted with two faces. The **forward face** looks ahead: it runs a live agent economy where five specialized AI agents trade a simulated portfolio, assess risk, detect fraud, enforce regulation, and evaluate every decision in real time. The **backward face** looks back: it reads its own trace history from Arize Phoenix, identifies failure patterns, and generates new behavioral constraints that are injected into agent prompts for the next cycle. The two faces are inseparable by design — neither can operate without the other.

The system is built around a five-agent pipeline orchestrated with LangGraph. Each decision cycle flows through the Trading Agent (proposes trades), the Risk Agent (validates VaR and exposure limits), the Fraud Intelligence Agent (detects manipulation and reasoning inconsistencies), the Regulator Agent (makes the final execute/hold/halt call), and the LLM Judge (scores the entire pipeline across five dimensions and flags cycles as learning events). Every agent call is traced end-to-end in Arize Phoenix with full OpenTelemetry instrumentation.

The **Janus Loop** is the self-correction engine that closes the feedback cycle. After every N decision cycles, a Meta-Agent queries Phoenix via MCP to retrieve recent failing traces and evaluation scores, identifies which behavioral patterns are driving low performance, generates 1–3 natural language constraints, and writes them to Firestore. On the next cycle, every agent reads the active constraints and injects them into its system prompt. Phoenix Experiments track before-and-after performance, making AI improvement measurable and visible to judges in the UI.

---

## Architecture

```
┌─────────────────────────────────┐
│          MARKET LAYER           │
│  yfinance prices + Alpha Vantage│
│  news + injected market shocks  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       JANUS AGENT PIPELINE      │
│  (LangGraph stateful graph)     │
│                                 │
│  Trading Agent                  │
│       → Risk Agent              │
│       → Fraud Agent             │
│       → Regulator Agent         │
│       → LLM Judge               │
└────────────────┬────────────────┘
                 │  OpenTelemetry traces
                 ▼
┌─────────────────────────────────┐
│       ARIZE PHOENIX LAYER       │
│  Traces · Evals · Datasets      │
│  Experiments · MCP Server       │
└────────────────┬────────────────┘
                 │  Phoenix MCP queries
                 ▼
┌─────────────────────────────────┐
│    JANUS LOOP (Backward Face)   │
│  Meta-Agent reads failures →    │
│  generates constraints →        │
│  injects into agent prompts     │
└────────────────┬────────────────┘
                 │  updated constraints
                 ▼
         back to agents ↑
```

| Component | Technology |
|-----------|------------|
| Agent Orchestration | LangGraph 0.2+ |
| LLM (Agents) | Groq llama-3.1-8b-instant (dev) / Gemini 2.0 Flash via Vertex AI (prod) |
| LLM (Judge) | Groq llama-3.3-70b-versatile (dev) / Gemini 2.0 Flash Pro (prod) |
| Agent Deployment | Vertex AI Agent Engine (Google Cloud Agent Builder) |
| Observability | Arize Phoenix (self-hosted on Cloud Run) |
| Phoenix MCP | Arize Phoenix MCP Server (JSON-RPC over HTTP) |
| Backend API | FastAPI on Cloud Run |
| Real-time Events | Server-Sent Events (SSE) |
| Portfolio State | Firestore |
| Graph Checkpointing | LangGraph Firestore Checkpointer |
| Market Data | yfinance + Alpha Vantage |
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Frontend Hosting | Vercel |

---

## The 5 Agents

| Agent | Role |
|-------|------|
| **Trading Agent** | Proposes trades based on market prices, news sentiment, and active behavioral constraints from the Janus Loop |
| **Risk Agent** | Validates VaR and risk constraints — vetoes trades that breach the 5% daily VaR threshold or single-asset concentration limits |
| **Fraud Agent** | Detects wash trading, front-running patterns, unusual concentration, and reasoning inconsistencies (hallucination detection in financial context) |
| **Regulator Agent** | Final gatekeeper — synthesizes Risk and Fraud signals into EXECUTE / HOLD / HALT; activates the circuit breaker on HIGH severity alerts |
| **LLM Judge** | Scores each decision cycle across 5 dimensions (Correctness, Safety, Hallucination Risk, Compliance, Explainability); flags low-scoring cycles as learning events that feed the Janus Loop |

---

## LLM Architecture Note

Janus is architected for **Gemini 2.0 Flash** via Google Vertex AI in
production. During development, [Groq](https://console.groq.com)
(llama-3.1-8b-instant for agents, llama-3.3-70b-versatile for the Judge)
is used as a drop-in replacement due to Vertex AI quota limitations on the
development account.

The system is LLM-agnostic by design. Switching to Gemini requires only
updating the API client and model strings in `backend/gemini_client.py`
and `backend/config.py`.

**Google Cloud services in use:**
- Firestore — portfolio state, trades, constraints, agent memory
- Cloud Run — backend API and Phoenix deployment (production)
- Vertex AI — intended LLM provider (Gemini 2.0 Flash)

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Google Cloud project with Firestore enabled
- Groq API key (free at [console.groq.com](https://console.groq.com))
- Alpha Vantage API key (free at [alphavantage.co](https://www.alphavantage.co))

### Backend Setup

```bash
# 1. Clone the repo
git clone https://github.com/Harsh-617/janus.git
cd janus

# 2. Navigate to the backend
cd backend

# 3. Create a virtual environment
python -m venv venv

# 4. Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 5. Install dependencies
pip install -r requirements.txt

# 6. Copy the example env file and fill in your keys
cp .env.example .env
# Edit .env with your GROQ_API_KEY, ALPHA_VANTAGE_API_KEY,
# GOOGLE_CLOUD_PROJECT, and any other required values

# 7. Start the backend
python main.py
```

The backend will be available at `http://localhost:8000`. Verify with:
```
GET http://localhost:8000/health
```

### Phoenix Setup (Observability)

In a separate terminal with the same virtual environment activated:

```bash
# 1. Start Phoenix
python scripts/start_phoenix.py

# 2. Open the Phoenix UI
# http://localhost:6006
```

Phoenix must be running before the backend to receive OpenTelemetry traces.

### Frontend Setup

```bash
# 1. Navigate to the frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Set the API URL
# If a .env.local.example exists: cp .env.local.example .env.local
# Otherwise create .env.local with:
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# 4. Start the dev server
npm run dev

# 5. Open the dashboard
# http://localhost:3000
```

### Reset Portfolio (Demo)

Before recording a demo or showing a clean run, reset the portfolio to its initial seed state:

```
POST http://localhost:8000/api/portfolio/reset
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health check |
| GET | `/api/portfolio` | Current portfolio state (positions, cash, P&L) |
| GET | `/api/portfolio/history` | Cycle-by-cycle portfolio value history for P&L chart |
| POST | `/api/portfolio/reset` | Reset portfolio to seed state (demo tool) |
| GET | `/api/trades` | Trade history with pagination (`?limit=N`) |
| GET | `/api/cycles` | Decision cycle history with judge scores (`?limit=N`) |
| GET | `/api/agents` | Per-agent state, average scores, and active constraints |
| GET | `/api/constraints` | All active behavioral constraints |
| GET | `/api/constraints/{id}` | Single constraint by ID |
| GET | `/api/stream` | SSE live agent activity stream |
| GET | `/api/stream/status` | Whether auto-cycling is running |
| POST | `/api/stream/run-once` | Trigger a single decision cycle immediately |
| POST | `/api/stream/start` | Start the auto-cycle scheduler |
| POST | `/api/stream/stop` | Pause the auto-cycle scheduler |
| POST | `/api/market-shock/preset/{scenario}` | Inject a preset market shock (`oil_shock`, `crypto_crash`, `fed_rate_hike`, `bank_run`) |
| POST | `/api/market-shock/clear` | Clear the active market shock |
| POST | `/api/circuit-breaker/activate` | Manually halt all trading |
| POST | `/api/circuit-breaker/release` | Resume trading after circuit breaker |
| GET | `/api/phoenix/traces` | Proxied Phoenix trace data for the dashboard |
| POST | `/api/janus-loop/trigger` | Manually trigger the self-correction loop |
| GET | `/api/janus-loop/history` | History of all Janus Loop runs and generated constraints |

---

## The Janus Loop

The Janus Loop is the self-correction engine — the backward face of the system. It runs automatically every N decision cycles (configurable via `JANUS_LOOP_INTERVAL_CYCLES` in `.env`) and can also be triggered manually from the dashboard or via the API.

**How it works:**

1. **Reads from Phoenix via MCP** — The Meta-Agent queries the Phoenix MCP server (JSON-RPC over HTTP) to fetch the last 20 evaluation records and the traces flagged as `learning_event = true`. It retrieves dimension score trends to identify which agent behaviors are underperforming.

2. **Generates constraints** — The Meta-Agent analyzes the failure patterns and produces 1–3 specific behavioral constraints written in natural language (e.g., "When news_volume > 5 headlines/hour AND market_volatility = HIGH, reduce position sizing by 50% and propose no more than 2 trades per cycle."). Constraints are timestamped, versioned, and stored in Firestore.

3. **Injects into agent prompts** — At the start of every decision cycle, each agent fetches the active constraints from Firestore and receives them as part of its system prompt under a "Current Behavioral Constraints from Janus Loop" header. The agents cannot ignore these constraints — they are part of the prompt.

4. **Tracks improvement with Phoenix Experiments** — Each Janus Loop run creates a Phoenix Experiment comparing before-constraint and after-constraint dimension scores. This makes improvement measurable: judges can see in the Phoenix UI that a specific constraint improved the Safety score by X% over the next N cycles.

This is not just logging. The system reads its own failure history, writes new rules for itself, and measures whether those rules worked.

---

## Hackathon Track

**Built for**: Google Cloud Rapid Agent Hackathon — Arize Track  
**Submission deadline**: June 12, 2026

---

## License

MIT
