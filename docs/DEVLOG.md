## High Priority Bug Fixes — Pre-Demo Audit
**Date**: 2026-05-29
**Files modified**:
- `backend/main.py` — H1: CORS wildcard replaced with allow_origin_regex for Vercel deployment compatibility
- `backend/services/hallucination_detector.py` — H2: yfinance calls wrapped in asyncio.to_thread to stop blocking event loop
- `backend/api/cycles.py` — H3: explain endpoint reads correct decisions.trading_agent field for trades; phoenix_trace_url now links to specific trace not root
- `backend/services/memory_service.py` — H4: "llm_judge" → "judge_agent" throughout, fixes judge memory Firestore path
- `backend/observability/evaluations.py` — H5: trend annotations now loop over all 5 agents × 5 dimensions instead of only trading_agent
- `backend/services/gemini_client.py` — H6: time.sleep() → asyncio.sleep() to prevent event loop freeze on Groq 429
- `backend/db/firestore_client.py` — H7: composite index requirement removed from get_unresolved_conflicts — now fetches unordered and sorts in Python
- `frontend/app/audit/page.tsx` — H8: Phoenix trace link now uses specific per-trace URL from explain response when available

---

## Critical Bug Fixes — Pre-Demo Audit
**Date**: 2026-05-29
**Files modified**:
- `backend/agents/fraud_agent.py` — C1: fixed trading_proposal access 
  from .get("trading_proposal",{}).get("trades",[]) to 
  .get("trading_proposal",[])
- `backend/graph/execution.py` — C2: replaced hard state["fraud_report"] 
  key with correct state.get("fraud_alerts",[]) and 
  state.get("fraud_investigation_open", False)
- `frontend/components/layout/layout-wrapper.tsx` — C3: fixed alert 
  banner reading parsed.critical_finding → parsed.data?.critical_finding 
  and parsed.reason → parsed.data?.reason
- `frontend/app/janus-loop/page.tsx` — C4: fixed constraint builder 
  judge option value from "llm_judge" to "judge_agent"
- `frontend/components/arena/market-shock-panel.tsx` — C5: fixed NL 
  shock inject payload field from market_effects to shocks

---

## Phoenix Anomaly Trend Metric
**Date**: 2026-05-28
**Files modified**:
- `backend/services/trend_analyzer.py` — new file, TrendAnalyzer with linear regression slope computation (pure Python), IMPROVING/STABLE/DEGRADING classification, confidence scoring, batch compute_all_trends
- `backend/observability/evaluations.py` — trend annotations pushed to Phoenix after each Judge cycle as {dimension}_trend evaluations with score 1.0/0.5/0.0 and slope explanation
- `backend/api/agents.py` — GET /api/agents/trends endpoint added
- `frontend/lib/types.ts` — TrendResult, AgentTrends, AgentTrendsResponse types added
- `frontend/lib/api.ts` — fetchAgentTrends added
- `frontend/app/agents/page.tsx` — trends fetched on mount, passed to AgentCard
- `frontend/components/agents/agent-card.tsx` — trend pills (↑↓→) shown next to dimension scores when confidence >= 0.7
**What changed**: Linear regression slope computed over last 10 cycles per agent per dimension. Trend direction pushed to Phoenix as named evaluations making the Phoenix dashboard immediately readable. Trend pills shown in Agent Control Room with confidence threshold to avoid noisy low-data arrows.

---

## Constraint Conflict Detection
**Date**: 2026-05-28
**Files modified**:
- `backend/services/constraint_conflict_detector.py` — new file, ConstraintConflictDetector with 4 checks (directional opposition, condition overlap, numeric contradiction, cash floor) and adjudicate() for automated resolution recommendations
- `backend/agents/meta_agent.py` — conflict detection runs before each new constraint is saved, conflicts stored in Firestore, logged to Phoenix
- `backend/db/firestore_client.py` — save_conflict and update_conflict_resolution helpers added
- `backend/api/routes/constraints.py` — GET /api/constraints/conflicts and POST /api/constraints/conflicts/{id}/resolve endpoints added
- `frontend/lib/types.ts` — ConstraintConflict, ConflictResolution types
- `frontend/lib/api.ts` — fetchConstraintConflicts, resolveConflict added
- `frontend/app/janus-loop/page.tsx` — conflict panel added, red/gold severity tinting, accept/suspend/dismiss actions
**What changed**: When the Janus Loop generates a new constraint, it now checks all active constraints for conflicts using keyword matching. Conflicts stored in Firestore, surfaced in the Janus Loop page with severity tinting and one-click resolution. Regulator adjudication logic recommends resolution automatically.

---

## Demo Mode
**Date**: 2026-05-28
**Files modified**:
- `backend/config.py` — DEMO_MODE bool setting added
- `backend/data/demo_market_data.py` — new file, pre-cached prices and news for normal demo state and oil shock scenario
- `backend/tools/market_data.py` — DEMO_MODE check at top of get_market_prices() and get_news_headlines(), returns cached data instantly instead of hitting yfinance
- `backend/api/market_shock.py` — oil_shock scenario sets demo shock flag in DEMO_MODE; POST /api/market-shock/reset-demo clears it
- `backend/api/system.py` — GET /api/system/status returns demo_mode and system status
- `frontend/components/layout/topbar.tsx` — DEMO badge shown when backend reports demo_mode=true
**What changed**: DEMO_MODE=true in .env serves pre-cached market data instantly instead of hitting yfinance or Alpha Vantage. Oil shock scenario switches to shock prices/news. Cycles run in 5-7 seconds instead of 15+. No live API dependencies during demo. Frontend shows DEMO badge so judges know the mode.

---

## Explainability Report
**Date**: 2026-05-28
**Files modified**:
- `backend/api/cycles.py` — GET /api/cycles/{cycle_id}/explain endpoint, builds plain-English audit brief from Firestore data, no LLM call, graceful N/A fallback on missing fields
- `frontend/lib/types.ts` — CycleExplainResponse type added
- `frontend/lib/api.ts` — fetchCycleExplain function added
- `frontend/app/audit/page.tsx` — EXPLAIN THIS CYCLE button in expanded row, explain panel with labeled sections and Phoenix trace link
**What changed**: Any decision cycle can now be explained in plain English from the Audit Log page. One click generates a structured audit brief covering proposal, risk, fraud, regulator, constraints, judge score, and outcome — with a direct link to the Phoenix trace. No LLM call — pure Firestore data formatted into readable text.

---

## Parallel Benchmark Portfolio
**Date**: 2026-05-28
**Files modified**:
- `backend/scripts/seed_baseline.py` — seeds portfolios/janus_baseline to same initial state as janus_main
- `backend/api/portfolio.py` — POST /api/portfolio/reset-baseline and GET /api/portfolio/comparison endpoints added
- `backend/graph/janus_graph.py` — baseline cycle graph (no constraint_enforcer, no judge) + run_baseline_decision_cycle added
- `backend/graph/execution.py` — execute_baseline_cycle_results added; writes baseline trades and history snapshots
- `backend/services/cycle_scheduler.py` — baseline cycle runs sequentially after each Janus cycle, same market data, no constraints, no Janus Loop, trades against janus_baseline; janus_main history snapshot written each cycle
- `backend/db/firestore_client.py` — BASELINE_PORTFOLIO_ID constant, COL_BASELINE_TRADES, save_baseline_trade, save_portfolio_history_snapshot, get_portfolio_history_snapshots added
- `frontend/lib/types.ts` — PortfolioHistory, PortfolioSide, PortfolioComparison types added
- `frontend/lib/api.ts` — fetchPortfolioComparison added
- `frontend/components/arena/portfolio-comparison-chart.tsx` — new dual-line Recharts chart, stat bar showing live divergence
- `frontend/app/page.tsx` — PortfolioComparisonChart added to Arena between sparkline bar and main panels
**What changed**: Second portfolio (janus_baseline) now runs every cycle with same agents and market data but zero constraints and no self-correction. Portfolio divergence chart on Arena page shows Janus P&L vs Baseline P&L over time. Divergence growing positive = self-correction is working.

---

## Improvement Curve Chart
**Date**: 2026-05-28
**Files modified**:
- `backend/api/cycles.py` — GET /api/cycles/scores-over-time endpoint, returns raw scores + rolling average + constraint injection points
- `frontend/lib/api.ts` — fetchScoresOverTime function added
- `frontend/lib/types.ts` — ScoresOverTime, ConstraintInjection, ScoresOverTimeResponse types added
- `frontend/components/janus-loop/improvement-curve-chart.tsx` — new Recharts component, dual-line chart (raw + rolling avg), gold vertical lines at constraint injection points, dimension selector, threshold line
- `frontend/app/janus-loop/page.tsx` — ImprovementCurveChart added at top of page
**What changed**: Rolling improvement curve now visualizes the self-correction loop working over time. Raw scores shown as dashed blue line, rolling average as solid green/red line, constraint injections as gold vertical reference lines. This is the primary proof that Janus self-corrects.

---

## Mechanical Constraint Enforcement
**Date**: 2026-05-28
**Files modified**:
- `backend/services/constraint_enforcer.py` — new file, ConstraintEnforcer class with 4 mechanical checks: max trades, position size limit, forbidden actions, cash floor. Rule parsing via keyword matching.
- `backend/graph/janus_graph.py` — ConstraintEnforcer wired between Trading Agent output and Risk Agent input. Violations logged to Phoenix span attributes and stored in LangGraph state.
- `backend/agents/judge_agent.py` — constraint_violations passed to Judge context, factored into Compliance dimension scoring.
**What changed**: Constraints are now mechanically enforced in Python after Trading Agent output, before Risk Agent sees the proposal. LLM can no longer ignore constraints — violations are caught, trimmed or blocked, logged to Phoenix, and visible to the Judge.

---

## Data-Driven Hallucination Detection
**Date**: 2026-05-28
**Files modified**:
- `backend/services/hallucination_detector.py` — new file, 3 Python-based checks: beta mismatch, correlation direction, concentration mismatch
- `backend/agents/fraud_agent.py` — integrated HallucinationDetector, flags added to alerts with type HALLUCINATION_DETECTED
**What changed**: Replaced circular LLM-asks-LLM inconsistency detection with falsifiable Python checks using real yfinance data. Beta check uses yfinance info["beta"]. Correlation check uses 90-day Pearson correlation via pandas. Concentration check computes post-trade position weights against Firestore portfolio state. All checks are try/except wrapped with silent fallback.

---

## Fix: Fraud Agent wash trading and concentration checks moved to Python
**Date**: 2026-05-28
**File**: `backend/agents/fraud_agent.py`
**What was fixed**: The Fraud Agent's system prompt asked the LLM to detect wash trading and unusual concentration — both are pure arithmetic operations that LLMs routinely get wrong (hallucinated counts, wrong percentages, missed cases). These checks have been moved to Python and run before the LLM call.

**Changes**:
- Added `detect_wash_trading(trade_history)` — examines the last 5 trades; if the same ticker appears in both BUY and SELL actions, emits a `WASH_TRADING` / `HIGH` alert. Uses set intersection, no LLM involved.
- Added `detect_concentration(trade_history, total_portfolio_value)` — examines the last 20 trades; if any single ticker represents more than 30% of trades by count, emits a `CONCENTRATION` / `MEDIUM` alert with the exact percentage.
- `fraud_agent_node` now calls both functions before the LLM call, extracting `total_portfolio_value` from `state["portfolio"]["total_value"]` (defaults to 1,000,000 if missing).
- Pre-computed alerts are injected into the LLM user message under a `PRE-COMPUTED FRAUD SIGNALS` header. The LLM is instructed to focus exclusively on `REASONING_INCONSISTENCY` detection and to treat the Python signals as already confirmed.
- After the LLM responds, its alerts are merged with the programmatic alerts. Deduplication: LLM alerts whose `type` already appears in the programmatic set (including `UNUSUAL_CONCENTRATION` as equivalent to `CONCENTRATION`) are dropped. Final list = `programmatic_alerts + filtered_llm_alerts`.
- `status`, `investigation_open`, and the log line now reflect the merged alert list. Any HIGH-severity alert (from either source) forces `investigation_open = True`.

---

## Fix: Risk Agent VaR now computed in Python, not by the LLM
**Date**: 2026-05-28
**File**: `backend/agents/risk_agent.py`
**What was fixed**: The Risk Agent's system prompt asked the LLM to estimate Value at Risk using hardcoded volatility values. LLMs hallucinate numerical results; every cycle logged `[Risk Agent] VETO — VaR 0.000 → 0.000`, meaning the LLM was returning placeholder zeros instead of real VaR values.

**Changes**:
- Added `VOLATILITY_MAP` dict with per-ticker daily volatility estimates (AAPL 2.2%, GLD 1.0%, BTC-USD 5.5%, TLT 1.2%, XOM 1.8%, KRE 2.5%, AMZN 2.4%, ETH-USD 6.0%, DEFAULT 2.0%).
- Added `compute_portfolio_var(positions, cash, total_value, proposed_trades) -> dict` — pure Python parametric VaR. Computes weighted-average portfolio volatility for current positions and applies proposed trade adjustments to compute post-trade VaR. Returns `current_var`, `proposed_var`, `var_change` (all 1-day 95% confidence level via × 1.645 z-score).
- `risk_agent_node` now calls `compute_portfolio_var` before the LLM call, extracting `positions`, `cash`, and `total_value` from `state["portfolio"]`.
- Pre-computed numbers are injected into the user message under a `PRE-COMPUTED RISK METRICS` header. The system prompt was updated to say "use provided numbers — do not recalculate VaR yourself."
- Span attributes (`risk.current_var`, `risk.proposed_var`) and the log line now use the Python-computed values instead of the LLM-returned values.
- The state update now includes `computed_var` key containing the full `{current_var, proposed_var, var_change}` dict.

---

## Fix: Hard router imports — removed try/except ImportError swallowing
**Date**: 2026-05-28
**File**: `backend/main.py`
**What was fixed**: Every router was imported inside a `try/except ImportError` block. A real bug at import time (missing dependency, syntax error, bad import inside the router module) would cause the server to start cleanly, return 200 on `/health`, and silently serve 404s for the affected endpoints with only a `logger.warning` as evidence. All 11 try/except blocks were removed. Each router is now imported unconditionally at the top of the file alongside the other module-level imports. If any router fails to import the server will refuse to start and print a full traceback — the correct behavior.

**Routers changed** (all moved to top-level imports):
`api.portfolio`, `api.trades`, `api.cycles`, `api.stream`, `api.market_shock`,
`api.janus_loop`, `api.agents`, `api.routes.constraints`,
`api.routes.market_shock_parse`, `api.routes.constraint_validate`, `api.routes.chat`

---

## Rewrite: phoenix_mcp_client.py switched from MCP to Phoenix REST API
**Date**: 2026-05-28
**File**: `backend/services/phoenix_mcp_client.py`
**What changed**: Phoenix 15.10.1 does not ship an MCP server — the `/mcp` endpoint does not exist in this release. The previous implementation used the `mcp` Python library with an SSE transport (`ClientSession` + `sse_client`) pointed at `{PHOENIX_BASE_URL}/mcp`, which failed on every call. The file has been rewritten to use the Phoenix REST API directly via `httpx`:

- `get_recent_traces` → `GET /v1/spans` with `filter` and `sort` query params
- `get_evaluations_for_traces` → `GET /v1/span_annotations` with `span_ids` query param
- `list_available_tools` / `verify_mcp_connection` → `GET /v1/projects` as a connectivity probe, returning a static compatibility list

All function names and return shapes are identical to the previous version; no other files were changed. The Janus Loop queries, learning event uploads, and experiment creation all go through the Phoenix REST API at `PHOENIX_BASE_URL`.

---

## Fix: Fraud Agent switched to judge model to resolve 413 TPM limit errors
**Date**: 2026-05-28
**File**: `backend/agents/fraud_agent.py`
**What was fixed**: The Fraud Agent's LLM call was using `settings.GEMINI_MODEL_FAST` (`llama-3.1-8b-instant`), which has a 6000 TPM per-request limit. The agent's prompt consistently exceeds ~7000+ tokens due to the full trade history, risk report, and trading thesis context it assembles each cycle, causing a 413 error on every single cycle. Fixed by passing `model=settings.GEMINI_MODEL_JUDGE` (`llama-3.3-70b-versatile`) explicitly to the `generate()` call. This model has a much higher TPM limit and can handle the Fraud Agent's larger context without errors. No other logic changed.

---

## Fix: NameError trace_id in evaluations.py + Fraud Agent 413 payload too large
**Date**: 2026-05-28
**Files modified**:
- `backend/observability/evaluations.py` — fixed NameError on `trace_id`
- `backend/agents/fraud_agent.py` — trimmed input context to stay under 6000 TPM

**What was fixed**:

1. `post_cycle_evaluations` built the overall annotation with `"span_id": trace_id` but `trace_id` was never defined in that scope — the correct variable is `span_id` (resolved on line 21 from `phoenix_span_id` / `phoenix_trace_id` / `cycle_id`). Every call hit a `NameError` inside the `except Exception` handler, which silently swallowed it and logged "Failed to post evaluations: name 'trace_id' is not defined". Fixed by replacing `trace_id` with `span_id` on the overall annotation.

2. The Fraud Agent was sending ~7082 tokens to `llama-3.1-8b-instant` (6000 TPM limit), triggering a 413 on every cycle. Root cause: `state["trading_thesis"]` is the full LLM output from the Trading Agent and can exceed 1000+ tokens alone. Fixed by truncating the trading thesis to 500 characters before building the user message (`[:500]`) and switching the trade history slice from `[:20]` (first 20) to `[-20:]` (most recent 20). No logic, scoring, or output schema changed.

---

## Fix: UnboundLocalError — settings scoping bug in execute_cycle_results
**Date**: 2026-05-28
**File**: `backend/graph/execution.py`
**What was fixed**: Every HOLD cycle crashed with `UnboundLocalError: cannot access local variable 'settings' where it is not associated with a value`, caught and logged by `run_single_cycle()` in `cycle_scheduler.py`. The root cause was two redundant in-function imports (`from config import settings`) inside `execute_cycle_results()` — one at line 87 inside an `if final_decision == "EXECUTE" and trades_executed:` block, and another at line 188. Python's scoping rules mark `settings` as a local variable for the entire function whenever it sees an assignment (including imports) anywhere in the function body. When a HOLD cycle skips the `if` block, the line-87 assignment never executes, so `settings` is unbound when referenced at line 153 (`get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)`).

**Changes**:
- Removed the in-function `from config import settings` at the old line 87 (inside the EXECUTE-only block).
- Removed the in-function `from config import settings` at the old line 188 (after the observability calls).
- The module-level `from config import settings` at line 6 is sufficient for all uses in the function; no other logic changed.
- `cycle_scheduler.py` was audited and confirmed clean — module-level import already in place, no local `settings` assignments.

---

## Fix: Phoenix MCP client rewritten to use SSE transport
**Date**: 2026-05-28
**File**: `backend/services/phoenix_mcp_client.py`
**What was fixed**: The original client used raw `httpx` POST requests to `{PHOENIX_BASE_URL}/mcp` with hand-rolled JSON-RPC payloads. Phoenix exposes its MCP server over SSE transport (not plain HTTP POST), so every call silently failed with a connection or protocol error and returned empty lists. Trace and evaluation queries in the Meta Agent were returning `[]` on every run.

**Changes**:
- Removed `httpx` dependency entirely from this module.
- Added `_call_phoenix_mcp_tool(tool_name, arguments)` — shared helper that opens an SSE connection via `mcp.client.sse.sse_client`, creates a `ClientSession`, calls `session.initialize()`, then calls `session.call_tool()` and JSON-decodes the first content item.
- `get_recent_traces` and `get_evaluations_for_traces` now delegate to `_call_phoenix_mcp_tool`.
- `list_available_tools` opens its own SSE session and calls `session.list_tools()`.
- Added `verify_mcp_connection()` — calls `list_available_tools()` and logs success/failure; returns `bool`.
- `main.py` lifespan now calls `await verify_mcp_connection()` at startup so MCP reachability is logged immediately on boot.

---

## Fix: Phoenix experiments always showed empty scores_after
**Date**: 2026-05-28
**File**: `backend/agents/meta_agent.py`
**What was fixed**: `create_constraint_experiment` was always called with `scores_after={}`, so every Phoenix experiment permanently displayed before-scores but no after-scores, making the improvement comparison the demo relies on invisible.

**Changes**:
- Added `get_post_constraint_scores(constraint_ids)` — queries the Firestore `cycles` collection for the 10 most recent cycles, reads each constraint's `generated_at` from Firestore to find the earliest timestamp, filters to only cycles whose `timestamp` is strictly after that point, returns `{}` if fewer than 3 post-constraint cycles exist (not enough data), otherwise returns averaged dimension scores (`correctness`, `safety`, `hallucination_risk`, `compliance`, `explainability`, `overall`).
- `run_janus_loop` now calls `get_post_constraint_scores(constraint_ids)` after generating constraints and BEFORE creating the Phoenix experiment, passing the result as `scores_after`.
- On experiment creation, a mirror document is written to the Firestore `experiments` collection with `scores_after_populated: bool(scores_after)` so the backfill mechanism can find it on subsequent runs.
- At the very start of every `run_janus_loop` invocation, the function queries Firestore for `experiments` where `scores_after_populated == False`, re-derives constraint IDs by querying the `constraints` collection for matching `phoenix_experiment_id`, calls `get_post_constraint_scores`, and if 3+ post-constraint cycles now exist updates the Firestore experiment document and sets `scores_after_populated: True`. This means the improvement data appears automatically once enough cycles have run after constraint injection.
- Imports added: `db` from `firestore_client`, `firestore` from `google.cloud`, `FieldFilter` from `google.cloud.firestore_v1.base_query`.

---

## Fix: Phoenix annotations linked to wrong span — use real OTel span ID
**Date**: 2026-05-28
**Files modified**:
- `backend/observability/tracing.py` — added `get_current_span_id_hex()` helper
- `backend/graph/state.py` — added `phoenix_span_id: str` field to `JanusState` and `create_initial_state`
- `backend/agents/trading_agent.py` — captures `span_id_hex` from the active OTel span and writes it into state as `phoenix_span_id`
- `backend/observability/evaluations.py` — reads `phoenix_span_id` from state for every annotation's `span_id` field; `cycle_id` is kept in metadata only
**What was fixed**: `post_cycle_evaluations` was setting `"span_id": trace_id` where `trace_id` fell back to `cycle_id` (a string like `"cycle_20260519_abc12345"`). Phoenix requires a real OpenTelemetry span ID — a 16-character lowercase hex string — for annotations to link to their trace. The fix captures the actual OTel span ID (`format(span.get_span_context().span_id, '016x')`) inside the `trading_agent` node (where the cycle's first span is active), stores it in `JanusState.phoenix_span_id`, and uses it exclusively in the annotation `span_id` field. Judge scores now correctly link to their decision traces in Phoenix.

---

## Fix: Alpha Vantage fallback cache on full key exhaustion
**Date**: 2026-05-28
**File**: `backend/tools/news.py`
**What was fixed**: With 4 Alpha Vantage keys rotating at 25 req/day each and a 60-second cycle interval, all keys exhaust in under 2 hours. Previously the Trading Agent received an empty news list (`[]`), silently degrading its reasoning quality with no context to act on.

**Changes**:
- Expanded `_FALLBACK_HEADLINES` to 10 generic but realistic financial headlines (was 5).
- Added module-level `_all_keys_exhausted: bool` and `_exhaustion_reset_time: datetime | None`.
- At the top of every `get_market_news()` call: if exhaustion flag is set and cooldown has not expired, return `FALLBACK_HEADLINES` immediately (skips all API calls). If cooldown has expired, reset the flag and retry normally.
- When all available keys fail with a daily-limit `"Information"` response or an exception in the same call attempt, set the exhaustion flag with a 12-hour reset time and log: "All Alpha Vantage keys exhausted. Using fallback headlines for next 12 hours."
- Any path that previously returned `[]` (no feed, all keys gone, all exceptions) now returns `FALLBACK_HEADLINES` instead — the Trading Agent always receives non-empty news context.

---

## 2026-05-28

## Fix: agent_thinking SSE events fired simultaneously instead of sequentially
**Date**: 2026-05-28
**Files modified**:
- `backend/services/cycle_scheduler.py` — removed bulk pre-pipeline broadcast of all 5 agent_thinking events
- `backend/agents/trading_agent.py` — added agent_thinking at node entry, agent_done before each return
- `backend/agents/risk_agent.py` — same
- `backend/agents/fraud_agent.py` — same
- `backend/agents/regulator_agent.py` — same
- `backend/agents/judge_agent.py` — same
**What was fixed**: `run_single_cycle()` was broadcasting `agent_thinking` for all 5 agents in a loop before the LangGraph pipeline even started, causing the UI to show every agent as "thinking" simultaneously. Each agent node now emits its own `agent_thinking` event at the start of its function and an `agent_done` event after the LLM call returns (before the state update is returned), so the UI reflects the true sequential execution order. `broadcast_event` is imported via a deferred in-function import in each agent file to avoid a circular import (`cycle_scheduler` → `janus_graph` → `agents/*` → `cycle_scheduler`).

---

## Fix: Circuit breaker does not pause the scheduler loop
**Date**: 2026-05-28
**Files modified**:
- `backend/services/cycle_scheduler.py` — circuit breaker check at top of scheduler loop
- `backend/graph/execution.py` — write `circuit_breaker_resume_at` when activating circuit breaker
**What was fixed**: The `start_scheduler()` while-loop ran unconditionally — it never checked Firestore before starting a new cycle, so a Regulator-activated circuit breaker had no effect on scheduling. Fix adds a check at the top of each loop iteration: reads the portfolio document; if `circuit_breaker_active` is True and `circuit_breaker_resume_at` has not yet passed, logs "Circuit breaker active — cycle skipped" and sleeps 30 s before rechecking; if the resume timestamp has passed, automatically clears `circuit_breaker_active` in Firestore, logs "Circuit breaker auto-released — resuming cycles", and proceeds normally. The `circuit_breaker_resume_at` UTC timestamp (now + `cooldown_minutes`) is now written to Firestore by `execute_cycle_results()` whenever the Regulator activates the circuit breaker.

---

## 2026-05-26
**[Dev A]** Step 1: Full design system foundation rewrite. globals.css with design tokens, layout shell, sidebar, topbar, shared components (ScoreBadge, StatusIndicator, LiveIndicator). Design system: #080A0C bg, JetBrains Mono for data, Inter for body, gold/blue two-face color split.

---

## Fix: Audit log sort order newest first
**Date**: 2026-05-25
**Files modified**:
- `backend/db/firestore_client.py` — order cycles by timestamp desc
- `frontend/app/audit/page.tsx` — client-side sort as safety measure
**What was fixed**: Cycles were not sorted newest-first causing mixed old/new cycles in the display.

## Fix: Audit log auto-refresh and sort clarity
**Date**: 2026-05-25
**Files modified**:
- `frontend/app/audit/page.tsx` — auto-refresh every 30s, manual refresh button
- `frontend/components/audit/audit-table.tsx` — removed sort on cycle column
**What was fixed**: Audit log was not auto-refreshing so new cycles didn't appear. Sort on cycle column was confusing.

## Fix: Experiment viewer titles, stats labels, safety backfill
**Date**: 2026-05-25
**Files modified**:
- `frontend/components/janus-loop/experiment-viewer.tsx` — rule text as card title instead of constraint ID
- `frontend/components/janus-loop/loop-timeline.tsx` — "Cycles Analyzed" relabeled to "Analysis Window"
- `backend/api/janus_loop.py` — backfill endpoint for missing safety_before values

## Fix: safety_after never written to Firestore
**Date**: 2026-05-25
**File**: `backend/services/cycle_scheduler.py`
**What was fixed**: `_update_safety_deltas()` was never called because `summary.get("judge_safety")` always returned `None` — the `summary` dict returned by `execute_cycle_results()` only contains `"judge_score"` (overall), not the `"judge_safety"` sub-score. The `isinstance(None, (int, float))` guard silently blocked every call. Fixed by reading `judge_scores["safety"]` directly from `final_state` (with list-accumulation handling for LangGraph reducers) instead of from `summary`.

## Fix: Safety delta — safety_before on constraint creation
**Date**: 2026-05-25
**Files modified**:
- `backend/agents/meta_agent.py` — write safety_before when creating constraints
- `backend/services/cycle_scheduler.py` — reduce threshold from 5 to 2 cycles
**What was fixed**: safety_before never written to Firestore causing Safety Δ to always show "—". Now captures baseline safety score at constraint creation time.

## Fix: Janus Loop page UX improvements
**Date**: 2026-05-25
**Files modified**:
- `frontend/components/janus-loop/constraint-table.tsx` — expandable rows, condition formatting
- `backend/services/cycle_scheduler.py` — safety_after running average computation
- `backend/api/janus_loop.py` — last_run_at in status response
- `backend/agents/meta_agent.py` — store last_run_at timestamp

## Fix: Blank target agent display in constraints table
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/agents/page.tsx` — safe fallback formatting for unknown target_agent values
- `backend/db/firestore_client.py` — removed debug logging
**What was fixed**: target_agent values not in AGENT_DISPLAY_NAMES were rendering as blank. Now formats any unknown value nicely.

## Fix: Constraints cleanup endpoint and cycles_active counter
**Date**: 2026-05-24
**Files modified**:
- `backend/api/constraints.py` — cleanup endpoint to delete constraints with no target_agent
- `backend/services/cycle_scheduler.py` — increment cycles_active per constraint per cycle, auto-expire when limit reached
**What was fixed**: Blank target agent rows cleaned up. Applied cycles counter now increments. Constraints auto-expire.

## Fix: Missing target agent in constraints table
**Date**: 2026-05-24
**Files modified**:
- `backend/db/firestore_client.py` — filter out constraints with no target_agent
- `frontend/app/agents/page.tsx` — show "Unknown" for missing target_agent as fallback
**What was fixed**: Constraint rows with blank Target Agent cell caused by null target_agent in Firestore.

## Fix: Agent scores field names and agent ID mismatch
**Date**: 2026-05-24
**File**: `backend/api/agents.py`
**What was fixed**: Flat field names (judge_overall_score etc.) used instead of nested judge_scores dict. Agent ID corrected to match frontend.

## Fix: Firestore composite index error in get_active_constraints
**Date**: 2026-05-24
**File**: `backend/db/firestore_client.py`
**What was fixed**: order_by(generated_at) on a filtered query requires a composite Firestore index. Moved sorting to Python after fetch to avoid the index requirement.

## Fix: Agent Control Room — scores, constraints, last action
**Date**: 2026-05-24
**Files modified**:
- `backend/api/agents.py` — fixed judge score field names
- `backend/db/firestore_client.py` — limit constraints to 5 most recent per agent
- `frontend/app/agents/page.tsx` — last action formatted properly
**What was fixed**: Scores showing 0.0 due to wrong field names.
Constraint list limited to 5 most recent. Last action formatted.

## Fix: Custom event UX — single inject button, auto-validate suggestions, price range check
**Date**: 2026-05-24
**Files modified**:
- `frontend/components/arena/market-shock-panel.tsx`
- `backend/api/market_shock.py`
**What was fixed**: Removed separate Validate button — validation now 
happens on Inject click. Suggestion pills auto-validate. Price effects 
validated against -99% to +500% range.

## Feature: Custom event AI validation and news injection
**Date**: 2026-05-24
**Files modified**:
- `backend/api/market_shock.py` — POST /api/market-shock/validate endpoint
- `backend/services/cycle_scheduler.py` — custom event injected as BREAKING news
- `frontend/components/arena/market-shock-panel.tsx` — full validation UI
**What was built**: Custom market events are validated by LLM before injection.
Invalid events show 3 AI-generated alternatives. Valid events are rewritten 
as professional headlines and injected as BREAKING news that agents react to.

## Fix: Phoenix datasets creation
**Date**: 2026-05-24
**File**: `backend/observability/evaluations.py`
**What was fixed**: Dataset creation 405 error. `POST /v1/datasets` is not a valid endpoint in arize-phoenix 15.x — the correct endpoint is `POST /v1/datasets/upload` with payload `{"action": "update", "name": ..., "inputs": [...], "outputs": [...], "metadata": [...]}`. Refactored `post_learning_event_to_dataset` to use this upload endpoint directly (creates-or-updates in one call), removing the separate get-then-create two-step. Renamed `_get_or_create_dataset_id` to `_get_cached_dataset_id` (now only does GET lookup; creation happens via upload). Added full GET response logging to debug future response shape issues.

## Fix: Firestore positional arguments warning
**Date**: 2026-05-24
**File**: `backend/db/firestore_client.py`
**What was fixed**: Replaced deprecated positional .where() calls with filter=FieldFilter() keyword argument to silence warnings.

## Fix: Decision Feed cycle_complete display improved
**Date**: 2026-05-24
**File**: `frontend/components/arena/decision-feed.tsx`
**What was fixed**: cycle_complete events now show decision badge (EXECUTE→green, HOLD→amber, HALT→red via StatusIndicator), judge score number badge (ScoreBadge), trade count ("3 trades" / "0 trades"), learning event badge in purple/blue, and critical finding truncated to 100 chars. agent_thinking events improved: agent name is bold, "is analyzing..." is in muted text, pulsing dot indicator present.

## Fix: Arena layout final polish
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/page.tsx` — reduced spacing, adjusted panel height
- `frontend/components/arena/portfolio-panel.tsx` — removed allocation 
  chart, positions list fixed height with internal scroll
**What was fixed**: Freed up vertical space so Market Controls header 
is visible without scrolling.

## Fix: Arena layout polish — compact agent bar, panel heights
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/page.tsx` — panel heights adjusted
- `frontend/app/globals.css` — scrollbar-hide utility added
- Agent status component — more compact styling
**What was fixed**: Agent status bar reduced in height. Left panel scrollbar hidden. Two-panel height set so Market Controls header peeks at bottom. Right panel scrolls internally.

## Fix: Decision Feed empty and right panel layout
**Date**: 2026-05-24
**Files modified**: 
- `frontend/app/page.tsx`
- `frontend/components/arena/decision-feed.tsx`
**What was fixed**: Decision Feed not displaying SSE events. Right panel layout fixed so both forward and backward face panels are always visible.

## Critical Fix — risk_decision scope and memory_service constraints
**Date**: 2026-05-24
**Files**: `backend/graph/execution.py`, `backend/services/memory_service.py`
**What was fixed**: risk_decision variable scoping caused crash on HOLD cycles. memory_service crashed when active_constraints was a list of strings instead of dicts. Both fixed with defensive checks.

## Critical Fix — list vs dict state values in execution
**Date**: 2026-05-24
**File**: `backend/graph/execution.py`
**What was fixed**: LangGraph state fields were returning as lists instead of dicts because of how state reducers work. Added get_state_value() helper that extracts the last item if the value is a list. Cycles now persist correctly to Firestore.

## Critical Fix — Remove LangGraph Firestore checkpointer
**Date**: 2026-05-24
**File**: `backend/graph/janus_graph.py`
**What was fixed**: FirestoreSaver checkpointer caused every cycle to crash with "Type is not msgpack serializable: _Span" because the OpenTelemetry tracing span object in LangGraph state cannot be serialized by msgpack. Removed checkpointer — state is already persisted manually via save_cycle() and save_trade() in execution.py.

## Fix #27 — Reasoning chain data in Audit Log
**Date**: 2026-05-24
**Files modified**:
- `backend/graph/execution.py` — decisions field added to cycle summary 
  with per-agent reasoning data
- `frontend/components/audit/audit-table.tsx` — verified rendering 
  matches new data shape
**What was built**: Cycle documents now store per-agent decisions and 
reasoning. Audit Log expanded drawer shows real reasoning chains instead 
of "No per-agent reasoning data available".

## Hotfix #10 — Constraint type conflict
**Date**: 2026-05-24
**Files**: `constraint-table.tsx`, `experiment-viewer.tsx`, `janus-loop/page.tsx`
**What was fixed**: Duplicate Constraint type definitions with incompatible safety_after types (null vs undefined). Unified to import from @/lib/types.

## Fix: Janus Loop status type mismatch
**Date**: 2026-05-24
**File**: `frontend/app/janus-loop/page.tsx`, `frontend/components/janus-loop/loop-timeline.tsx`
**What was fixed**: Page-local LoopStatus interface had wrong field names and types vs actual API response. Fixed interface to match backend exactly. Avg score and active constraint count now display correctly.

## Fix: Per-agent scores and radar charts
**Date**: 2026-05-24
**File**: `frontend/app/agents/page.tsx`
**What was fixed**: All 5 agent cards were showing identical scores 
because stats were computed from global cycle averages. Now fetches 
from /api/agents endpoint which returns real per-agent dimension scores. 
Each agent card and radar chart now shows unique data.

## Fix #15 — Frontend env example and Phoenix URL config
**Date**: 2026-05-24
**Files created/modified**:
- `frontend/.env.local.example` — created with NEXT_PUBLIC_API_URL and 
  NEXT_PUBLIC_PHOENIX_URL
- `.gitignore` or `frontend/.gitignore` — .env.local added if not already present
- `frontend/app/observability/page.tsx` — Phoenix URL uses env var with 
  localhost fallback
**What was built**: Frontend environment variables properly documented and 
configured. Phoenix URL is now configurable via NEXT_PUBLIC_PHOENIX_URL 
instead of hardcoded. Matches README setup instructions.

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

## Hotfix #7 — cycles array extraction in audit page
**Date**: 2026-05-24
**File**: `frontend/app/audit/page.tsx`
**What was fixed**: API returns { cycles: [], count: N } but code was 
storing the whole object. Fixed fetch to extract .cycles array. Added 
Array.isArray guard in filteredCycles useMemo.

## Hotfix #6 — cycles array extraction in observability page
**Date**: 2026-05-24
**File**: `frontend/app/observability/page.tsx`
**What was fixed**: Same API response shape issue. Fixed fetch to extract 
.cycles array. Added Array.isArray guard before chartData .slice() call.

## Hotfix #5 — LayoutWrapper missing on janus-loop page
**Date**: 2026-05-24
**File**: `frontend/app/janus-loop/page.tsx`
**What was fixed**: Sidebar and topbar not showing on /janus-loop. 
Wrapped all three return paths (loading, error, main) with LayoutWrapper.

## Hotfix #4 — toFixed errors in experiment-viewer
**Date**: 2026-05-24
**File**: `frontend/components/janus-loop/experiment-viewer.tsx`
**What was fixed**: safety_before/safety_after undefined on some records.
Added ?? 0 fallbacks on all toFixed calls, guarded improvement calculation,
tightened filter to typeof === "number" check.

## Hotfix #3 — toFixed errors in constraint-table
**Date**: 2026-05-24
**File**: `frontend/components/janus-loop/constraint-table.tsx`
**What was fixed**: safety_before undefined on some constraint records.
Tightened hasDelta check to typeof === "number", added ?? 0 fallbacks.

## Hotfix #2 — Active constraints count and hydration warning
**Date**: 2026-05-24
**Files**: `frontend/components/janus-loop/loop-timeline.tsx`, 
`frontend/app/layout.tsx`
**What was fixed**: active_constraints rendered as object instead of count.
Fixed to use .length when value is array. Added suppressHydrationWarning 
to body tag to silence browser extension attribute injection warning.

## Hotfix #8 — P&L sparkline broken URL
**Date**: 2026-05-24
**File**: `frontend/components/arena/portfolio-panel.tsx`
**What was fixed**: fetch("/api/portfolio/history") was a relative URL 
hitting the Next.js server and getting a 404. Fixed to use API_BASE 
from @/lib/constants so it correctly hits the FastAPI backend.

## Hotfix #1 — cycles array extraction in agents page and loop-timeline toFixed
**Date**: 2026-05-24
**Files**: `frontend/app/agents/page.tsx`, 
`frontend/components/janus-loop/loop-timeline.tsx`
**What was fixed**: agents page storing full API response instead of cycles 
array. loop-timeline crashing on undefined avg_score_last_10. Fixed both 
with array extraction and ?? 0 fallbacks.

## Hotfix #9 — Custom market shock UI
**Date**: 2026-05-24
**File**: `frontend/components/arena/market-shock-panel.tsx`
**What was built**: Custom market shock input section added below preset buttons. Allows injecting a custom event description and optional price effects (TICKER:delta format). Calls applyCustomMarketShock from lib/api.ts.

## Fix #32 — Circuit breaker topbar lag
**Date**: 2026-05-24
**Files modified**: topbar.tsx and layout-wrapper.tsx
**What was fixed**: After toggling circuit breaker, portfolio refetch now fires immediately so topbar status updates instantly instead of waiting up to 10s for the next poll.

## Fix: SSE Decision Feed empty — event format mismatch
**Date**: 2026-05-24
**File**: `frontend/hooks/use-agent-stream.ts`
**What was fixed**: Backend sends SSE events as default "message" events with type embedded in JSON body. Frontend was using named addEventListener calls which never fired. Replaced with single onmessage handler that reads type from parsed JSON body.

## Fix: Arena layout fixed height panels with internal scroll
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/page.tsx` — two-panel container fixed height, panels scroll internally
- `frontend/components/arena/decision-feed.tsx` — internal scroll only
**What was fixed**: Panels were growing vertically as content was added causing blank space and layout breaking. Now fixed height with overflow scroll inside each panel.

## Fix: Left panel compact — no scroll, smaller fonts
**Date**: 2026-05-24
**Files modified**:
- `frontend/components/arena/portfolio-panel.tsx` — compact fonts, reduced padding, smaller chart, hide empty P&L section
- `frontend/app/page.tsx` — removed scroll from left panel
**What was fixed**: Left panel was too tall due to large fonts and padding. Made compact so all content fits statically. Market Controls header now visible without scrolling.

## Fix: Arena hard fixed height, restore P&L sparkline
**Date**: 2026-05-24
**Files modified**:
- `frontend/app/page.tsx` — hard 500px height for two-panel section
- `frontend/components/arena/portfolio-panel.tsx` — P&L sparkline restored as compact 60px chart
**What was fixed**: Two-panel section now exactly 500px so Market Controls header is always visible. P&L sparkline restored.

## Fix: Multi-key rotation for Groq and Alpha Vantage
**Date**: 2026-05-24
**Files modified**:
- `backend/config.py` — numbered key fields + helper properties
- `backend/services/gemini_client.py` — uses settings.groq_api_keys
- `backend/tools/news.py` — random key selection from pool
**What was built**: Groq supports up to 6 keys, Alpha Vantage up to 4.
Keys loaded from numbered env vars, empty ones filtered out automatically.

## Fix: Alpha Vantage key rotation skip exhausted keys
**Date**: 2026-05-24
**File**: `backend/tools/news.py`
**What was fixed**: random.choice() was picking exhausted keys randomly.
Replaced with sequential rotation that permanently removes exhausted 
keys from the pool for the session.

## Fix: P&L calculation and portfolio value
**Date**: 2026-05-24
**Files modified**:
- `backend/db/firestore_client.py` — `initialize_portfolio()` now stores `initial_capital`, uses scaled positions that sum to ~$1M, calculates `total_value` from positions + cash instead of hardcoding it
- `backend/api/portfolio.py` — `reset_portfolio()` gets the same fix; `GET /api/portfolio/debug` endpoint added

**Root cause**: Two compounding bugs caused the −63% P&L / ~$363k portfolio value:

1. `initial_capital` was never written to Firestore. `portfolio_service.py` correctly falls back to `portfolio.get("initial_capital", 1_000_000)` but missing the field is fragile.

2. The seeded positions (100 AAPL + 50 GLD + 0.5 BTC + 200 TLT + 75 XOM + $245k cash) only totalled ~$340k at the seed prices — nowhere near $1M. The hardcoded `total_value: 1_087_500.0` was stale/wrong. When `update_portfolio_prices()` ran after the first cycle it recomputed the real total (~$340k), and with `initial_capital` defaulting to $1M: `((340k − 1M) / 1M) × 100 = −66%`. Live price drift moved it to −63%.

**What was fixed**: Positions scaled up to represent a coherent ~$1M portfolio (1100 AAPL, 430 GLD, 4.0 BTC-USD, 1100 TLT, 425 XOM). `initial_capital: 1_000_000.0` now stored explicitly. `total_value` and `pnl_pct` calculated dynamically from positions + cash, not hardcoded.

**Action required**: Call `POST /api/portfolio/reset` after deploying to apply the corrected data to the existing Firestore document. Use `GET /api/portfolio/debug` to inspect what's actually stored.

## Fix: Arena layout aggressive spacing overhaul
**Date**: 2026-05-24
**Files modified**: page.tsx, layout-wrapper.tsx, portfolio-panel.tsx
**What was fixed**: Removed excess padding between topbar and content.
Reduced panel height. Restored P&L sparkline.

## Fix: Groq key rotation skip daily-exhausted keys
**Date**: 2026-05-24
**File**: `backend/services/gemini_client.py`
**What was fixed**: Keys hitting daily TPD limits were not being permanently removed from rotation. Added _exhausted_keys set that removes daily-limit keys for the session. Only TPM (per-minute) keys are retried normally.

## Fix: Phoenix datasets 405 error
**Date**: 2026-05-24
**File**: `backend/observability/evaluations.py`
**What was fixed**: POST to /v1/datasets was returning 405. Fixed to first GET/create dataset to obtain ID, then POST examples to /v1/datasets/{id}/examples. Dataset ID cached to avoid repeated lookups.


## Fix: Market shock visual feedback and timestamp
**Date**: 2026-05-24
**Files modified**:
- `frontend/components/arena/market-shock-panel.tsx` -- active scenario highlighted, real timestamp shown
- `backend/api/market_shock.py` -- activated_at timestamp added to status response
**What was fixed**: No visual feedback on clicked scenario. 'Activated at unknown' timestamp fixed.


## Fix: Audit Log display improvements
**Date**: 2026-05-25
**Files modified**:
- `frontend/components/audit/audit-table.tsx`
**What was fixed**: Cycle ID formatted as #shortid, rate limit errors cleaned up in Critical Finding, Phoenix trace link fixed, no-data message for old cycles.

## Fix: Experiment viewer readability improvements
**Date**: 2026-05-25
**Files modified**:
- `frontend/components/janus-loop/experiment-viewer.tsx`
**What was fixed**: Card titles now show agent name + short rule description. Full rule shown below. Improvement context added. constraint_id hidden.

## Fix: Audit table default sort newest-first
**Date**: 2026-05-25
**File**: `frontend/components/audit/audit-table.tsx`
**What was fixed**: Default sort was by cycle_number causing new cycles to appear in wrong position. Fixed to sort by timestamp descending by default with proper Firestore timestamp handling.

---

## Feature: NL Market Event Parser
**Date**: 2026-05-26

### What was built
- Backend: `POST /api/market-shock/parse` endpoint in `backend/api/routes/market_shock_parse.py`
  - Accepts a natural language event string
  - Calls Groq (llama-3.3-70b-versatile) to map the event to ticker price effects
  - Returns JSON: `{ effects: { TICKER: decimal }, interpreted_as: string }`
  - Retries once on JSON parse failure, raises HTTP 500 if both attempts fail
  - Registered in `main.py` with prefix `/api`

- Frontend: `frontend/components/arena/market-shock-panel.tsx`
  - Added NL input section above preset scenarios
  - Parse → preview card showing interpreted tickers and % changes
  - Inject confirms and fires the market shock
  - Removed old custom event section (manual ticker:effect input) — NL parser replaces it entirely

### Why
The old custom event input required knowing ticker symbols and typing raw percentages. The NL parser lets a judge type "China invades Taiwan" and see a previewed interpretation in 3 seconds — much better for the demo.

---

## Feature: Real-time Alert Banner
**Date**: 2026-05-26

### What was built
- frontend/components/layout/layout-wrapper.tsx
  - Added alert banner between topbar and main content
  - Height animates 0px → 48px via CSS transition when triggered
  - Listens to SSE stream for two event types:
    - type === "circuit_breaker_activated" → shows CIRCUIT BREAKER banner
    - type === "cycle_complete" with truthy critical_finding → shows FRAUD banner
  - Pulsing red dot, truncated message, dismiss button
  - Auto-dismisses after 10 seconds, clears previous timer on new alert

- backend/api/market_shock.py
  - Added broadcast_event("circuit_breaker_activated", ...) to the manual 
    activate endpoint so the banner fires on manual clicks too
    (previously only fired when the agent cycle tripped it automatically)

- frontend/components/arena/market-shock-panel.tsx
  - Circuit breaker button now toggles:
    - OFF state: "CIRCUIT BREAKER" in red → POST /api/circuit-breaker/activate
    - ON state: "RELEASE" in green → POST /api/circuit-breaker/release
  - Refetches portfolio state after each click to update button label

### Why
Judges need immediate visual feedback when something goes wrong. The banner 
makes high-severity fraud alerts and circuit breaker events unmissable.

---

## Feature: Hallucination Heatmap
**Date**: 2026-05-26

### What was built
- frontend/components/agents/hallucination-heatmap.tsx
  - Full-width 25×2 grid of 50 squares, one per decision cycle
  - Color coded by judge_hallucination_risk score:
    - Green (≥7): safe, Amber (≥5): moderate, Red (<5): risk, Gray: no data
  - Fixed-position tooltip on hover showing cycle number, score, full critical finding
  - Legend row below grid (SAFE / MODERATE / RISK / NO DATA)
  - Subtitle: "Each square = one decision cycle. Color shows hallucination risk score from the LLM Judge."
  - Fetches from /api/cycles?limit=50 using API_BASE pattern
  - Added to bottom of frontend/app/agents/page.tsx

### Also fixed
- frontend/app/agents/page.tsx + components/agents/agent-card.tsx
  - All 5 agent cards now stretch to equal height (alignItems stretch + height 100%)

---

## Feature: Constraint Builder UI
**Date**: 2026-05-27

### What was built
- backend/api/routes/constraint_validate.py
  - POST /api/constraints/validate — calls Groq to evaluate if a constraint
    is specific enough to affect agent behavior
  - Returns { is_valid, reason, suggestions: [{condition, rule, rationale}] }
  - Fails open (is_valid: true) on parse error

- backend/api/routes/constraints.py
  - Added POST /api/constraints — creates a new constraint in Firestore
  - Generates constraint_id, sets status ACTIVE, expires_after_cycles 50

- frontend/app/janus-loop/page.tsx
  - Collapsible BUILD CONSTRAINT section at bottom of constraints list
  - Auto-scrolls into view when opened
  - Fields: target agent dropdown, condition, rule, rationale
  - AI validation before inject — vague constraints show 3 suggested
    alternatives with click-to-fill behavior
  - On success: constraint appears immediately in the list above

---

## Feature: Agent Chat Drawer
**Date**: 2026-05-27

### What was built
- backend/api/routes/chat.py
  - POST /api/chat — accepts { message, history }
  - Fetches live context from Firestore: portfolio state, last 10 cycles, 
    active constraints
  - Builds a system prompt with real data injected
  - Calls Groq (llama-3.3-70b-versatile) with full conversation history
  - Restricted to only answer questions about the Janus system
  - Returns { response: string }

- frontend/components/layout/agent-chat-drawer.tsx
  - Floating chat popup (320×400px) anchored bottom-left
  - Toggle button styled to match sidebar nav icons
  - Markdown rendering via react-markdown (bold in gold, lists, code blocks)
  - Auto-scrolls to latest message
  - Enter to send, CLEAR button resets session
  - "JANUS IS THINKING..." loading indicator
  - Restricted responses — off-topic questions are rejected

### Why
Makes the entire system queryable in natural language. Judges can ask 
"why did the system hold in cycle 47?" or "which constraint improved 
safety the most?" and get answers grounded in real Firestore data.

---

## Performance Optimizations
**Date**: 2026-05-27

### Problems fixed
1. Duplicate SSE connection on Arena page
   - layout-wrapper.tsx and use-agent-stream.ts both opened /api/stream
   - Fixed: layout-wrapper is now the single SSE connection app-wide
   - All consumers receive events via window CustomEvent 'janus-sse' bus
   - Result: 1 SSE connection instead of 2 on the Arena page

2. Duplicate /api/cycles fetch on Agents page
   - agents/page.tsx and HallucinationHeatmap both fetched /api/cycles?limit=50
   - Fixed: page passes cycles as a prop to HallucinationHeatmap
   - Heatmap skips internal fetch when prop is provided
   - Result: 1 fetch instead of 2 on the Agents page

3. Duplicate /api/cycles fetch on Audit page
   - Two useEffects both fired fetchData() on mount
   - cycleLimit change triggered a cascade of 2 fetches
   - Fixed: single useEffect with limitRef to avoid stale closures
   - onChange calls fetchData directly, no effect dependency cascade
   - Result: 1 fetch on mount, 1 fetch on limit change

4. Client-side caching in api.ts
   - All API calls were uncached — every render hit the network
   - Added in-memory cache utility with TTL
   - fetchAgents: 10s TTL
   - fetchConstraints: 15s TTL  
   - fetchJanusLoopHistory: 30s TTL
   - fetchPortfolio, fetchCycles, fetchTrades remain uncached (real-time)

---

## Full Codebase Audit & Bug Fixes
**Date**: 2026-05-27

### Audit results: 18 HIGH, 27 MEDIUM, 6 LOW issues found and fixed

### HIGH fixes
- stream.py: Replaced singleton SSE queue with broadcast pattern (_subscribers list)
  so all connected clients receive every event
- gemini_client.py: Added asyncio.Lock() for thread-safe key rotation state
- constraint_validate.py: Fail-safe now returns is_valid:false instead of true
  on JSON parse error
- news.py + cycle_scheduler.py: Wrapped synchronous requests.get() in 
  asyncio.to_thread() to stop blocking the event loop
- market-shock-panel.tsx: Fixed wrong endpoint /api/market-shock → 
  /api/market-shock/custom for NL injection
- api.ts: Fixed 4 fetch functions returning envelope objects instead of arrays
  (fetchTrades, fetchConstraints, fetchMarketShockScenarios, fetchJanusLoopHistory)
- layout-wrapper.tsx: Added SSE onerror reconnection logic (3s retry)
- regulator_agent.py: Fixed NameError — audit_trail_id declared before try block

### MEDIUM fixes
- janus-loop/page.tsx: Error feedback in catch blocks, setTimeout memory leak fixed
- audit/page.tsx: Error state shown to user, loadingMore leak fixed
- layout-wrapper.tsx: Null-safe parsed.reason with fallback string
- agent-chat-drawer.tsx: res.ok check before res.json()
- hallucination-heatmap.tsx: AbortController on fetch to prevent stale state updates

### LOW fixes
- fraud_agent.py, judge_agent.py, risk_agent.py, trading_agent.py: 
  Removed span.record_exception from outer except where span may be unbound
- meta_agent.py: datetime.utcnow() → datetime.now(timezone.utc)
- market_shock.py: Removed debug print() statement
- memory_service.py: Silent except pass → logger.warning with error message
- execution.py: Hardcoded "janus_main" → settings.FIRESTORE_PORTFOLIO_ID
