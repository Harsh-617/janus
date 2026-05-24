## Fix #14 — Complete README
**Date**: 2026-05-24
**File modified**: `README.md`
**What was built**: Full project README with setup instructions, architecture
overview, agent descriptions, API endpoint table, and Janus Loop explanation.
Ready for hackathon submission.

## Fix #13 — Constraint phoenix_experiment_id writeback
**Date**: 2026-05-24
**Files modified**:
- `backend/db/firestore_client.py` — update_constraint() function added
- `backend/agents/meta_agent.py` — experiment ID now awaited and written 
  back to each constraint record in Firestore
**What was built**: After each Janus Loop run, the Phoenix experiment ID is 
written back to all constraint records it covers. Constraint records now 
fully match PRD schema including phoenix_experiment_id field.

## Fix #12 — Gemini dual-architecture documentation
**Date**: 2026-05-24
**Files modified**:
- `backend/gemini_client.py` — architecture note comment block added at top
- `README.md` — LLM Architecture Note section added explaining Groq for dev,
  Gemini for production, and Google Cloud services in use
**What was built**: Clear documentation of the dual-architecture approach so 
judges understand Gemini is the intended production LLM and Groq is a 
development substitute.

## Fix #11 — app/arena/page.tsx redirect
**Date**: 2026-05-24
**File modified**: `frontend/app/arena/page.tsx`
**What was built**: /arena now redirects to / where the real Arena page lives. Prevents blank page if anyone navigates to /arena directly.

## Fix #10 — Reasoning chain expansion in Audit Log
**Date**: 2026-05-24
**File modified**: `frontend/app/audit/page.tsx`
**What was built**: Each audit log row now has an expand button that reveals the full reasoning chain — per-agent decisions with rationale, judge evaluation with all 5 dimension scores, trades executed, and a clickable Phoenix trace link. One row expanded at a time.

## Fix #8 — Agent memory writes
**Date**: 2026-05-24
**Files created/modified**:
- `backend/services/memory_service.py` — update_agent_memories() updates all 
  5 agent memory records after every cycle
- `backend/graph/execution.py` — calls update_agent_memories() at end of 
  execute_cycle_results()
**What was built**: Agent memory records now written to Firestore after every 
cycle. Tracks active constraints per agent, performance trend, and behavioral 
notes from learning events. Matches PRD agent memory schema.

## Fix #7 — Trade record missing fields
**Date**: 2026-05-24
**File modified**: `backend/graph/execution.py`
**What was built**: Trade records now include price (from market_data state), total_value (price × quantity), approved_by (list of approving agents), and vetoed_by (agent that vetoed or null). Matches PRD trade record schema exactly.

## Fix #6 — Janus two-face divider
**Date**: 2026-05-24
**Files created/modified**:
- `frontend/components/layout/janus-divider.tsx` — vertical divider with two-face SVG icon in gold
- `frontend/app/page.tsx` — divider inserted between panels, subtle blue/gold tinting added, forward/backward face labels added
**What was built**: Visual two-face motif implemented on the Arena page. Left panel has ice blue tint (forward face), right panel has gold tint (backward face), separated by a vertical Janus divider with SVG icon. Matches PRD Section 10 design spec.

## Fix #5 — DM Sans body font
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/layout.tsx` — DM_Sans imported from next/font/google, added to html className
- `frontend/app/globals.css` — DM Sans set as primary body font with Geist fallback
**What was built**: DM Sans loaded and set as the default body font across the entire frontend, matching the PRD typography spec. Geist retained as fallback.

## Fix #4 — Cinzel font for headers
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/layout.tsx` — Cinzel imported from next/font/google, added to html className
- `frontend/app/globals.css` — font-cinzel CSS variable and utility class added
- `frontend/components/layout/sidebar.tsx` — font-cinzel applied to JANUS brand heading
- `frontend/app/janus-loop/page.tsx` — font-cinzel applied to page title (replaced font-serif)
**What was built**: Cinzel (Roman-inspired serif) loaded and applied to all Janus brand headings and page titles, matching the PRD visual identity spec.

## Fix #3 — /api/constraints endpoint
**Date**: 2026-05-24
**Files modified**:
- `backend/api/routes/constraints.py` — GET /api/constraints and GET /api/constraints/{constraint_id} endpoints implemented
- `backend/main.py` — constraints router registered
**What was built**: Dedicated constraints endpoint returning all active constraints with count and timestamp. Single constraint lookup by ID with 404 handling.

## Fix #2 — Phoenix MCP Server integration
**Date**: 2026-05-24
**Files created/modified**:
- `backend/services/phoenix_mcp_client.py` — JSON-RPC MCP client for Phoenix
- `backend/agents/meta_agent.py` — queries Phoenix MCP at start of every loop run
**What was built**: Meta-agent now queries Phoenix via MCP (JSON-RPC over HTTP) 
on every Janus Loop run. Lists available tools to verify connectivity, fetches 
recent learning event traces. Falls back gracefully if Phoenix MCP is offline.
Satisfies PRD Section 6.5 MCP requirement.

## Fix #1 — AGENT_COLORS/AGENT_DISPLAY_NAMES import bug
**Date**: 2026-05-24
**File**: `frontend/app/agents/page.tsx`
**What was fixed**: Added missing import for AGENT_COLORS and AGENT_DISPLAY_NAMES
from @/lib/constants. These were used on lines 292-297 without being imported,
causing a ReferenceError crash when active constraints were present on the
Agent Control Room page.

## Fix #9 — Portfolio P&L sparkline
**Date**: 2026-05-24
**Files modified**:
- `backend/api/portfolio.py` — added GET /api/portfolio/history endpoint returning cycle-by-cycle portfolio value and P&L history
- `frontend/components/arena/portfolio-panel.tsx` — added P&L sparkline LineChart using Recharts, fetches from /api/portfolio/history on mount
**What was built**: Time-series P&L chart showing portfolio performance across cycles. Green line when profitable, red when negative. Tooltip on hover.

## Fix #8 — Phoenix Experiments
**Date**: 2026-05-24
**Files modified**:
- `backend/services/phoenix_service.py` — creates named Phoenix Experiment after each Janus Loop run with before/after score comparison
- `backend/agents/meta_agent.py` — calls create_constraint_experiment after constraints are generated
**What was built**: Every Janus Loop run now creates a Phoenix Experiment capturing the pre-constraint dimension scores. Experiment visible in Phoenix UI under the Experiments tab.

## Fix #7 — /api/agents endpoint
**Date**: 2026-05-24
**Files modified**:
- `backend/api/agents.py` — GET /api/agents returning per-agent state, scores, and active constraints aggregated from Firestore
- `backend/main.py` — agents router registered
**What was built**: Dedicated agents endpoint. Aggregates last 20 cycles to compute per-agent avg judge score and dimension scores. Returns active constraints per agent and circuit breaker status.

## Fix #6 — Alpha Vantage news integration
**Date**: 2026-05-24
**Files modified**:
- `backend/tools/news.py` — implemented with Alpha Vantage NEWS_SENTIMENT API, fallback to hardcoded headlines on failure or rate limit
- `backend/services/cycle_scheduler.py` — replaced hardcoded news strings with get_market_news() call using live ticker list
**What was built**: Live news headline fetching from Alpha Vantage. Graceful fallback if API is unavailable or rate limited.

## Fix #5 — yfinance real market data
**Date**: 2026-05-24
**Files modified**:
- `backend/tools/market_data.py` — implemented with yfinance, fallback to hardcoded prices on failure
- `backend/services/cycle_scheduler.py` — replaced get_mock_market_data() call with get_live_market_data()
**What was built**: Live market price fetching via yfinance for 8 tickers. Graceful fallback if yfinance is unavailable. Single-ticker helper function also added.

## Fix #4 — janus-loop/page.tsx
**Date**: 2026-05-24
**File**: `frontend/app/janus-loop/page.tsx`
**What was built**: Main Janus Loop page. Fetches status + constraint history on mount, polls status every 10s, handles trigger flow with banner message, wires LoopTimeline + ConstraintTable + ExperimentViewer together.

## Fix #3 — experiment-viewer.tsx
**Date**: 2026-05-24
**File**: `frontend/components/janus-loop/experiment-viewer.tsx`
**What was built**: Experiment viewer showing pre/post safety score comparison per constraint. Renders before/after numbers, improvement %, and visual bar comparison. Empty state when no data yet.

## Fix #2 — loop-timeline.tsx
**Date**: 2026-05-24
**File**: `frontend/components/janus-loop/loop-timeline.tsx`
**What was built**: Loop stats row (4 boxes), trigger button with loading state, last run time, and 4-stage loop flow diagram.

## Fix #1 — constraint-table.tsx
**Date**: 2026-05-24
**File**: `frontend/components/janus-loop/constraint-table.tsx`
**What was built**: Constraints table component showing agent, condition, rule, status badge, safety delta, cycles active, and generated date. Handles empty state.

## Step 22 — Real trade execution and portfolio position updates
**Date**: 2026-05-24
**Files created**:
- `backend/services/portfolio_service.py` — Portfolio position update logic
- `backend/services/trade_service.py` — Trade history analysis utilities
**Files modified**:
- `backend/graph/execution.py` — Added portfolio position updates after trade execution
**What was built**:
Real trade execution that updates portfolio positions (shares, avg_cost, current_price) and cash balance when Regulator issues EXECUTE. Portfolio service applies each executed trade: BUY adds shares and updates weighted average cost, SELL removes shares and closes position if balance reaches zero. Handles cash constraints (adjusts BUY quantity if insufficient funds) and position constraints (caps SELL at owned shares). Updates all position prices from market_prices in state. Recalculates total_value and pnl_pct after each trade. Trade service provides summary statistics (ticker frequency, buy/sell ratio, avg confidence) for fraud detection. Price updates run at end of every cycle regardless of trades.

**Key decisions**:
- Portfolio updates are resilient: failures logged as warnings, never crash the cycle
- BUY with insufficient cash: adjust quantity to max affordable, log adjustment
- SELL without position or exceeding shares: cap at owned shares or skip with warning
- Weighted average cost calculation: (existing_shares * existing_avg_cost + trade_value) / new_shares
- Position closed when shares <= 0.001 (essentially zero after SELL)
- All monetary values rounded to 2 decimals, share quantities to 4 decimals (for fractional BTC/ETH)
- Prices updated for all positions at end of cycle using market_prices from state
- New positions get sector from SECTOR_MAP (Technology, Energy, Commodities, Crypto, Bonds, etc.)
- Portfolio service imported inside execute_cycle_results to avoid circular imports
- Trade execution happens after save_trade but before cycle record persistence

**Notes for team**:
- Verify with: POST /api/portfolio/reset → POST /api/stream/run-once → GET /api/portfolio (cash should change)
- Check logs for "[PortfolioService] BUY/SELL ..." messages showing trade application
- Portfolio positions now reflect actual trading activity, not just static seed data
- P&L percentage calculated as ((total_value - initial_capital) / initial_capital) * 100
- Trade service get_trade_summary() available for fraud agent pattern analysis
- No agent files modified — all changes in services and execution layers

## Step 21 — Observability and Audit Log pages
**Date**: 2026-05-24
**Files created**:
- `frontend/app/observability/page.tsx` — Observability page with Phoenix iframe and score trends
- `frontend/app/audit/page.tsx` — Audit log page with filters and cycle history
- `frontend/components/audit/audit-table.tsx` — Sortable audit table with expandable rows
**What was built**:
Observability page embeds Arize Phoenix UI in iframe (http://localhost:6006) with reachability check. Shows score trend chart with 6 lines (Overall, Correctness, Safety, Hallucination Risk, Compliance, Explainability) using Recharts LineChart for last 20 cycles. Polls cycles every 30s. Displays setup instructions if Phoenix is offline. Audit Log page provides complete cycle history with search (cycle ID or finding text), decision filter (ALL/EXECUTE/HOLD/HALT), learning events checkbox, and cycle limit dropdown (10/20/50/100). Audit table shows 9 columns: Cycle (ID + timestamp), Decision badge, Score badge, Dimensions (5 mini progress bars with hover tooltips), Trades count, Fraud alerts count, Learning event checkmark, Critical finding (truncated), Market shock flame icon. Table features sortable columns (Score, Cycle, Timestamp), zebra striping, sticky header, expandable rows showing full critical finding and recommended constraint, and Load More button.

**Key decisions**:
- Phoenix reachability checked via fetch with no-cors mode, polls every 30s
- Score trend chart inverts hallucination_risk (10 - score) so higher is better on all dimensions
- Chart uses thick gold line for Overall (strokeWidth=3), thinner lines for dimensions (strokeWidth=2)
- Audit table dimension bars are 4px tall, 40px wide, colored by threshold: >=6 green, >=4 amber, <4 red
- Sorting: click column header toggles asc/desc, default is cycle number descending (newest first)
- Row expansion shows full critical finding, recommended constraint, circuit breaker status, Phoenix trace ID, cycle number
- All filtering/sorting done client-side after fetching data
- Search filters by cycle_id OR critical_finding text (case-insensitive)
- Load More increases limit by 50 and re-fetches from API
- Empty state shows explanatory text when no cycles exist

**Notes for team**:
- Phoenix must be running locally for iframe to work — page shows setup instructions if offline
- Audit table uses zebra striping (alternating bg colors) for readability with dense data
- Dimension bars use title attribute for hover tooltips (native browser tooltip)
- Table is fully responsive with horizontal scroll on small screens
- Expandable rows toggle on click anywhere in the row
- Loading skeleton shows 5 grey rows while fetching data

## Step 20 — Agent Control Room page
**Date**: 2026-05-24
**Files created**:
- `frontend/app/agents/page.tsx` — Agent Control Room page with performance metrics
- `frontend/components/agents/agent-card.tsx` — Individual agent card with scores and constraints
- `frontend/components/agents/radar-chart.tsx` — Radar chart for 5 judge dimensions
**What was built**:
Agent Control Room page displaying real-time performance metrics for all 5 agents. Each agent card shows overall score badge, radar chart of 5 judge dimensions (correctness, safety, hallucination risk, compliance, explainability), agent-specific stats (e.g., Trading Agent shows cycles/avg score/learning events; Fraud Agent shows total alerts/avg per cycle/critical count), active constraints count with hover details, and last action text. Page derives all metrics from cycles API response (no dedicated /api/agents endpoint). Bottom section displays active behavioral constraints table with columns for target agent, condition, rule, applied cycles, and status. Refresh button and last refreshed timestamp at top.

**Key decisions**:
- Derive agent stats from cycles data: avg scores calculated across all cycles, dimension scores averaged from judge_* fields
- Agent-specific stats tailored per agent: Trading shows trades/confidence, Risk shows safety scores, Fraud shows alert counts, Regulator shows decision distribution (EXECUTE/HOLD/HALT), Judge shows its own scoring metrics
- Radar chart inverts hallucination_risk (10 - score) so higher is better on all dimensions
- Active constraints filtered per agent, shown in scrollable list with truncated rule text and title tooltips
- "Thinking" badge appears when agent is active in SSE stream (pulsing animation)
- Cards have left border in agent color (4px) for visual identity
- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
- Loading skeleton shows grey boxes while fetching data
- Empty state with explanatory text when no cycles exist yet

**Notes for team**:
- Page polls cycles (limit=50) and Janus Loop status on mount, manual refresh button available
- All agent metrics derived from cycle history — no separate agent state tracking needed
- Constraints table shows all active constraints with color-coded status badges
- Radar chart uses Recharts PolarGrid/PolarAngleAxis with dark theme styling
- Agent cards are self-contained components, easy to extend with additional metrics

## Step 19 — The Arena dashboard page
**Date**: 2026-05-24
**Files created**:
- `frontend/components/arena/agent-status-bar.tsx` — Horizontal bar showing all 5 agents with live status
- `frontend/components/arena/portfolio-panel.tsx` — Portfolio state with positions, allocation chart
- `frontend/components/arena/decision-feed.tsx` — Live SSE event stream with formatted event cards
- `frontend/components/arena/market-shock-panel.tsx` — Market shock scenarios and system controls
**Files modified**:
- `frontend/app/page.tsx` — Replaced placeholder with Arena dashboard
- `frontend/package.json` — Added date-fns dependency

**What was built**:
The Arena — main dashboard page showing real-time system activity. Agent status bar displays all 5 agents with pulsing indicators when thinking, color-coded by agent type. Portfolio panel shows total value in gold, P&L with trend arrows, cash position, positions list with sector dots, and horizontal bar chart for allocation using Recharts. Decision feed displays last 20 SSE events with type-specific icons and formatting (cycle_start, agent_thinking, cycle_complete with judge scores, cycle_error, circuit_breaker_activated). Market shock panel provides 4 preset scenarios (oil shock, crypto crash, fed rate hike, bank run), active shock alert with clear button, circuit breaker controls, and cycle controls (run single cycle, start/stop auto-cycle).

**Key decisions**:
- Layout: agent status bar at top, portfolio (1/3 width) + decision feed (2/3 width) in middle, market controls at bottom
- Agent status bar shows pulsing blue indicator when agent is actively thinking, idle state otherwise
- Portfolio allocation chart uses horizontal Recharts BarChart with sector colors, percentage tooltips
- Decision feed auto-formats timestamps using date-fns formatDistanceToNow ("2s ago")
- Event cards show different content based on type: cycle_complete shows decision badge + score badge + trade count + learning event flag + critical finding (truncated to 100 chars)
- Market shock panel polls /api/market-shock/status and /api/stream/status every 10s to stay in sync
- All buttons show loading spinners during API calls, disabled state prevents double-clicks
- Mobile responsive: panels stack vertically on small screens using flex-col

**Notes for team**:
- The Arena is now the default route at / — sidebar navigation works correctly
- SSE stream auto-reconnects if connection drops, decision feed updates in real time
- Portfolio allocation chart only renders if positions exist (avoids empty chart error)
- Ping events filtered out of decision feed to reduce noise
- Circuit breaker and market shock states sync between topbar and market shock panel
- date-fns added to package.json for relative timestamp formatting

## Step 18 — Frontend foundation (types, API, hooks, layout)
**Date**: 2026-05-23
**Files created**:
- `frontend/lib/types.ts` — All TypeScript interfaces for API contracts
- `frontend/lib/constants.ts` — Agent colors, decision colors, thresholds
- `frontend/lib/api.ts` — Typed fetch functions for all backend endpoints
- `frontend/hooks/use-portfolio.ts` — Portfolio polling hook (10s interval)
- `frontend/hooks/use-cycles.ts` — Cycles polling hook (30s interval)
- `frontend/hooks/use-agent-stream.ts` — SSE stream hook with auto-reconnect
- `frontend/components/layout/sidebar.tsx` — Navigation sidebar with health check
- `frontend/components/layout/topbar.tsx` — Portfolio stats + system controls
- `frontend/components/layout/layout-wrapper.tsx` — Main layout composition
- `frontend/components/shared/live-indicator.tsx` — Pulsing status dot
- `frontend/components/shared/score-badge.tsx` — Judge score badge with color coding
- `frontend/components/shared/status-indicator.tsx` — Decision status badge
**Files modified**:
- `frontend/app/layout.tsx` — Added JetBrains Mono font, dark mode, Janus branding
- `frontend/app/globals.css` — Extended with Janus design system CSS variables

**What was built**:
Complete frontend foundation implementing the Janus design system (Roman gold #C9A84C for historical data, ice blue #4CADCE for live data, near-black #0A0B0D background). All TypeScript types match backend API contracts. Custom hooks handle polling and SSE streaming with automatic reconnection. Layout system with sidebar navigation, topbar showing portfolio value/P&L/cycle count, and system controls (Run Cycle button, Circuit Breaker toggle). Shared components for live indicators, score badges, and status badges follow the design system color palette.

**Key decisions**:
- SSE hook maintains last 50 events, tracks active agents, auto-reconnects on disconnect
- Portfolio and cycles hooks use polling (10s and 30s) instead of SSE for simpler state management
- Dark mode forced via className="dark" on html tag — no light mode toggle needed
- Sidebar shows backend health status via /health endpoint polling every 30s
- All colors use CSS variables (--janus-*) for consistency and easy theming
- Score badges use thresholds: >=6 green (pass), >=4 amber (warn), <4 red (fail)
- Layout wrapper is client component that composes sidebar + topbar + scrollable content area

**Notes for team**:
- Pages (Arena, Agents, Janus Loop, Observability, Audit) will use LayoutWrapper to get consistent chrome
- SSE events array is newest-first for easy display in activity feeds
- Circuit breaker toggle calls POST /api/circuit-breaker/activate or /release based on current state
- Run Cycle button is disabled when circuit breaker is active or while a cycle is running

## Step 17 — Phoenix local setup
**Date**: 2026-05-21
**Files created**:
- `backend/scripts/start_phoenix.py`
- `backend/scripts/README.md`
**What was built**:
Local Phoenix script. Run before the backend — Phoenix listens on 
localhost:6006 and receives all OpenTelemetry traces automatically.

**Startup order**:
1. Terminal 1: python scripts/start_phoenix.py
2. Terminal 2: python main.py
3. Browser: http://localhost:6006

## Step 16 — agents/meta_agent.py (Janus Loop)
**Date**: 2026-05-20
**Files created**: `backend/agents/meta_agent.py`
**Files modified**: `backend/services/cycle_scheduler.py`
**What was built**:
Janus Loop Meta Agent — reads last 20 cycles from Firestore, identifies
failure patterns across 5 judge dimensions, generates 1-3 behavioral
constraints and saves them to Firestore. Fires automatically every
JANUS_LOOP_INTERVAL_CYCLES cycles (default: 10). Also triggerable
manually via POST /api/janus-loop/trigger.

**Key decisions**:
- Requires minimum 3 cycles and at least 1 learning event to run
- Constraints saved to Firestore are automatically picked up by agents
  on the next cycle (cycle_scheduler fetches them via get_active_constraints)
- temperature=0.4 — balanced between creative constraint generation
  and consistent JSON output
- maybe_run_janus_loop() called after every cycle in the scheduler

**Demo flow**:
- Run 10+ cycles → Janus Loop fires automatically
- Or: POST /api/janus-loop/trigger → fires immediately
- Check GET /api/janus-loop/history → see generated constraints
- Next cycle logs will show constraints being applied

## Fix — Seed portfolio positions + slow cycle interval
**Date**: 2026-05-20
**Files modified**: backend/db/firestore_client.py, backend/config.py
**What changed**:
- Portfolio seed now includes 5 starting positions (AAPL, GLD, BTC-USD, 
  TLT, XOM) with realistic prices. Empty portfolio caused Regulator to 
  always HOLD since there was nothing to trade.
- Cycle interval increased from 30s to 60s to reduce Groq 429 rate 
  limiting errors.
**Action required**:
  After restarting server, call POST /api/portfolio/reset to apply 
  the new seed data to the existing Firestore portfolio.

## Fix — Groq multi-key rotation
**Date**: 2026-05-20
**Files modified**: backend/services/gemini_client.py, backend/config.py
**What changed**:
Added round-robin rotation across multiple Groq API keys. Each LLM 
call uses the next key in the cycle, multiplying effective rate limits 
by the number of keys. Falls back to single GROQ_API_KEY if 
GROQ_API_KEYS is not set.

## Step 15 — api/market_shock.py + api/janus_loop.py
**Date**: 2026-05-20
**Files created**:
- `backend/api/market_shock.py`
- `backend/api/janus_loop.py`
**What was built**:
Market shock API with 4 preset scenarios (oil shock, crypto crash, 
fed rate hike, bank run) plus custom shock injection. Circuit breaker
manual activate/release endpoints. Janus Loop trigger endpoint and
status/history endpoints.

**Key decisions**:
- Preset scenarios have hardcoded price effects matching the PRD spec
- Circuit breaker release restarts the scheduler automatically
- janus_loop trigger calls run_janus_loop() which doesn't exist yet 
  (Step 17) — import is inside the function so server still boots

**Demo endpoints**:
  POST /api/market-shock/preset/oil_shock    → trigger oil shock
  POST /api/market-shock/preset/crypto_crash → trigger crypto crash
  POST /api/market-shock/clear               → return to normal
  POST /api/circuit-breaker/activate         → halt trading
  POST /api/circuit-breaker/release          → resume trading
  POST /api/janus-loop/trigger               → run self-correction

## Step 14 complete — Pipeline verified working
**Date**: 2026-05-20
**Status**: All 5 agents running end-to-end with Groq LLM
**Verified behaviors**:
- Trading Agent: REBALANCE proposals with 3 trades per cycle
- Risk Agent: APPROVE/MODIFY/VETO with VaR calculations
- Fraud Agent: Detecting reasoning inconsistency alerts
- Regulator Agent: Final EXECUTE/HOLD/HALT decisions
- Judge: Scoring 5.8-6.2/10, flagging learning events correctly
- Cycles persisting to Firestore
- Groq rate limiting handled with automatic retries
**Remaining**: Phoenix not running locally yet, trades not executing 
(Regulator HOLDing due to empty portfolio positions)

## Fix — Switch to Groq API (free tier)
**Date**: 2026-05-20
**Files modified**: backend/services/gemini_client.py, backend/config.py
**What changed**:
Switched from google-genai Vertex AI SDK to Groq API (free tier).
Vertex AI publisher models return 404, generativelanguage.googleapis.com
has no quota. Groq is free, no credit card required, fast inference.
Using llama-3.1-8b-instant for agents (speed) and llama-3.3-70b-versatile
for the Judge (quality). Variable names kept as GEMINI_MODEL_* to avoid
touching all 5 agent files.

## Fix — Switch to google-genai SDK with Vertex AI mode
**Date**: 2026-05-20
**Files created**: backend/services/gemini_client.py
**Files modified**: All 5 backend/agents/*.py, backend/config.py
**What changed**:
Replaced LangChain ChatVertexAI and ChatGoogleGenerativeAI wrappers with
the google-genai SDK using vertexai=True mode. This uses the service 
account credentials (GOOGLE_APPLICATION_CREDENTIALS) and routes through
aiplatform.googleapis.com which bills to the GCP project credits.
The generativelanguage.googleapis.com API key approach was permanently 
stuck on free-tier quota (limit: 0) regardless of billing status.

## Fix — Switch to ChatGoogleGenerativeAI with GCP-linked API key
**Date**: 2026-05-20
**Files modified**: All 5 backend/agents/*.py, backend/config.py
**What changed**:
ChatVertexAI returns 404 regardless of model name — the LangChain 
Vertex AI wrapper is deprecated and broken for new models. Switched 
to ChatGoogleGenerativeAI with a Google AI Studio API key linked to 
the janus-496816 GCP project. This uses GCP billing credits instead 
of the zero-quota free tier.

## Fix — Revert to Vertex AI with gemini-2.0-flash-001
**Date**: 2026-05-20
**Files modified**: All 5 backend/agents/*.py, backend/config.py
**What changed**:
Reverted from ChatGoogleGenerativeAI back to ChatVertexAI.
Google AI Studio free tier had limit:0 quota. Using Vertex AI with
gemini-2.0-flash-001 which is confirmed available in the project's
Model Garden. Cost from $25 GCP credits will be negligible for demo.

## Fix — .gitignore and .env.example cleanup
**Date**: 2026-05-20
**Files modified**:
- `.gitignore` — comprehensive ignore rules added for __pycache__, 
  venv, .env, service-account.json, Next.js build artifacts, logs
- `backend/.env.example` — updated to reflect all current Settings 
  fields including GOOGLE_API_KEY

## Fix — Migrate ChatVertexAI → ChatGoogleGenerativeAI
**Date**: 2026-05-20
**Files modified**:
- All 5 backend/agents/*.py files
- backend/config.py
**What changed**:
Switched all agents from langchain-google-vertexai (ChatVertexAI) to
langchain-google-genai (ChatGoogleGenerativeAI). Vertex AI publisher 
model endpoint returned 404 for gemini-2.0-flash-001. Direct Google 
Generative AI API is simpler — uses GOOGLE_API_KEY instead of Vertex AI 
service account credentials.
**Action required**:
Set GOOGLE_API_KEY in backend/.env with a real key from 
https://aistudio.google.com/app/apikey

## Step 14 — services/cycle_scheduler.py + api/stream.py
**Date**: 2026-05-20
**Files created**:
- `backend/services/cycle_scheduler.py`
- `backend/api/stream.py`
**Files modified**: `backend/main.py`
**What was built**:
Cycle scheduler that runs decision cycles every N seconds and broadcasts
events to an asyncio Queue. SSE endpoint at GET /api/stream that streams
all events to the frontend in real time. Manual cycle trigger at 
POST /api/stream/run-once for demo control.

**Key decisions**:
- Global asyncio.Queue (maxsize=500) as the event bus — simple, no Redis needed
- Queue drops oldest event when full (LRU-style) — never blocks agents
- Keepalive ping every 15s prevents SSE connection timeout through proxies
- Scheduler auto-starts on app startup — system is live immediately
- run-once endpoint lets us manually trigger cycles during the demo 
  without waiting for the timer

**Demo control flow**:
  POST /api/stream/run-once     → trigger one cycle immediately
  POST /api/stream/start        → start auto-cycling
  POST /api/stream/stop         → pause cycling
  GET  /api/stream/status       → check if running

## Step 13 — api/portfolio.py + api/trades.py + api/cycles.py
**Date**: 2026-05-20
**Files created**:
- `backend/api/portfolio.py`
- `backend/api/trades.py`  
- `backend/api/cycles.py`
**What was built**:
Three FastAPI routers exposing portfolio state, trade history, and cycle
history to the frontend. Portfolio reset endpoint for demo resets between
runs. Pagination via limit query param on trades and cycles.

**Key decisions**:
- Portfolio reset endpoint is demo-critical: lets us wipe state and show 
  a clean run for the video recording
- All endpoints are read-only except portfolio reset — the agents own 
  all writes, the API just reads
- Query param validation (ge=1, le=200) prevents runaway Firestore reads

**Verify after running server**:
  GET http://localhost:8000/api/portfolio  → portfolio state
  GET http://localhost:8000/api/trades     → empty list initially
  GET http://localhost:8000/api/cycles     → empty list initially

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

## Fix #9 — LangGraph Firestore checkpointing
**Date**: 2026-05-24
**Files modified**:
- `backend/graph/janus_graph.py` — FirestoreSaver added to graph compilation, falls back to no checkpointer on error; thread_id config added to graph ainvoke call
**What was built**: LangGraph graph state now persisted to Firestore between cycles via FirestoreSaver (from langgraph-checkpoint-firestore 0.1.7). Each cycle gets its own thread_id (`janus_cycle_{cycle_id}`). Matches PRD spec for stateful graph with checkpointing.

**Notes**:
- The installed package exports `FirestoreSaver`, not `FirestoreCheckpointer` — uses `project_id` constructor arg, not a `client` arg
- `compiled_graph.ainvoke()` is called inside `run_decision_cycle()` in `janus_graph.py`, so both the checkpointer init and the config injection live in that file
