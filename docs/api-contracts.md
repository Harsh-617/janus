# Janus — API Contracts
> Single source of truth for all data shapes between backend and frontend.
> Backend Pydantic models in `backend/models/schemas.py` must match these exactly.
> Frontend TypeScript interfaces in `frontend/lib/types.ts` must match these exactly.

---

## REST Endpoints

### GET /api/portfolio
Returns current portfolio state.

**Response:**
```typescript
interface Portfolio {
  portfolio_id: string;
  created_at: string;
  initial_capital: number;
  cash: number;
  total_value: number;
  pnl_pct: number;
  positions: {
    [ticker: string]: {
      shares: number;
      avg_cost: number;
      current_price: number;
      pnl_pct: number;
    };
  };
  trade_count: number;
  cycle_count: number;
  circuit_breaker_active: boolean;
  risk_mode: "NORMAL" | "ELEVATED" | "CRISIS";
}
```

---

### GET /api/trades
Returns paginated trade history.

**Query params:** `?limit=20&offset=0`

**Response:**
```typescript
interface TradesResponse {
  trades: Trade[];
  total: number;
}

interface Trade {
  trade_id: string;
  cycle_id: string;
  timestamp: string;
  action: "BUY" | "SELL" | "HOLD";
  ticker: string;
  quantity: number;
  price: number;
  total_value: number;
  proposed_by: "trading_agent";
  approved_by: string[];
  vetoed_by: string | null;
  judge_score: number | null;
  phoenix_trace_id: string | null;
  executed: boolean;
}
```

---

### GET /api/cycles
Returns decision cycle history with judge scores.

**Query params:** `?limit=20&offset=0`

**Response:**
```typescript
interface CyclesResponse {
  cycles: DecisionCycle[];
  total: number;
}

interface DecisionCycle {
  cycle_id: string;
  timestamp: string;
  trading_proposal: TradingProposal;
  risk_decision: RiskDecision;
  fraud_alerts: FraudAlert[];
  regulator_decision: RegulatorDecision;
  judge_scores: JudgeScores | null;
  final_outcome: "EXECUTED" | "MODIFIED" | "VETOED" | "HALTED";
  phoenix_trace_id: string | null;
}

interface JudgeScores {
  cycle_id: string;
  overall_score: number;
  dimension_scores: {
    correctness: number;
    safety: number;
    hallucination_risk: number;
    compliance: number;
    explainability: number;
  };
  critical_finding: string | null;
  learning_event: boolean;
  learning_event_reason: string | null;
  recommended_constraint: string | null;
}
```

---

### GET /api/constraints
Returns all active behavioral constraints.

**Response:**
```typescript
interface ConstraintsResponse {
  constraints: BehavioralConstraint[];
}

interface BehavioralConstraint {
  constraint_id: string;
  generated_at: string;
  generated_by: string;
  target_agent: AgentName;
  condition: string;
  rule: string;
  rationale: string;
  status: "ACTIVE" | "EXPIRED" | "OVERRIDDEN";
  performance_delta: {
    safety_before: number | null;
    safety_after: number | null;
    cycles_active: number;
  };
  expires_after_cycles: number;
  phoenix_experiment_id: string | null;
}

type AgentName =
  | "trading_agent"
  | "risk_agent"
  | "fraud_agent"
  | "regulator_agent"
  | "judge_agent"
  | "meta_agent";
```

---

### GET /api/agents
Returns per-agent state and performance.

**Response:**
```typescript
interface AgentsResponse {
  agents: AgentState[];
}

interface AgentState {
  agent_id: AgentName;
  display_name: string;
  status: "IDLE" | "THINKING" | "DONE" | "ERROR";
  last_decision: string | null;
  last_decision_at: string | null;
  avg_judge_score_last_20: number | null;
  dimension_scores_avg: {
    correctness: number;
    safety: number;
    hallucination_risk: number;
    compliance: number;
    explainability: number;
  } | null;
  active_constraints: string[];
  learning_events_last_10: number;
  trend: "IMPROVING" | "DECLINING" | "STABLE" | null;
}
```

---

### POST /api/market-shock
Injects a market shock event.

**Request:**
```typescript
interface MarketShockRequest {
  scenario_id: "oil_shock" | "crypto_crash" | "fed_rate_hike" | "bank_run" | "custom";
  custom_description?: string;   // required if scenario_id = "custom"
  custom_effects?: {             // required if scenario_id = "custom"
    [ticker: string]: number;    // e.g. { "AAPL": -0.08 }
  };
}
```

**Response:**
```typescript
interface MarketShockResponse {
  shock_id: string;
  applied_at: string;
  effects_applied: { [ticker: string]: number };
  message: string;
}
```

---

### POST /api/circuit-breaker
Manually trigger or release the circuit breaker.

**Request:**
```typescript
interface CircuitBreakerRequest {
  action: "ACTIVATE" | "RELEASE";
  reason?: string;
}
```

**Response:**
```typescript
interface CircuitBreakerResponse {
  circuit_breaker_active: boolean;
  changed_at: string;
  reason: string;
}
```

---

### POST /api/janus-loop/trigger
Manually trigger the self-correction loop.

**Response:**
```typescript
interface JanusLoopTriggerResponse {
  loop_run_id: string;
  triggered_at: string;
  status: "STARTED";
}
```

---

### GET /api/janus-loop/history
Returns history of all Janus Loop runs.

**Response:**
```typescript
interface JanusLoopHistoryResponse {
  runs: JanusLoopRun[];
}

interface JanusLoopRun {
  loop_run_id: string;
  triggered_at: string;
  trigger_reason: "SCHEDULED" | "MANUAL" | "ALERT";
  cycles_analyzed: number;
  patterns_detected: string[];
  constraints_generated: string[];   // constraint_ids
  performance_delta: {
    avg_score_before: number;
    avg_score_after: number | null;
  };
  phoenix_experiment_id: string | null;
  status: "COMPLETE" | "RUNNING" | "FAILED";
}
```

---

## SSE Stream — GET /api/stream

The live event stream. Frontend connects via `EventSource('/api/stream')`.

Each event has a `type` field. Frontend should handle all of these:

```typescript
type StreamEvent =
  | AgentActivityEvent
  | CycleCompleteEvent
  | TradeExecutedEvent
  | CircuitBreakerEvent
  | JanusLoopEvent
  | PortfolioUpdateEvent;

interface AgentActivityEvent {
  type: "agent_activity";
  agent_id: AgentName;
  status: "THINKING" | "DONE" | "ERROR";
  message: string;
  cycle_id: string;
  timestamp: string;
}

interface CycleCompleteEvent {
  type: "cycle_complete";
  cycle_id: string;
  outcome: "EXECUTED" | "MODIFIED" | "VETOED" | "HALTED";
  judge_score: number | null;
  timestamp: string;
}

interface TradeExecutedEvent {
  type: "trade_executed";
  trade: Trade;
  timestamp: string;
}

interface CircuitBreakerEvent {
  type: "circuit_breaker";
  active: boolean;
  reason: string;
  timestamp: string;
}

interface JanusLoopEvent {
  type: "janus_loop";
  status: "STARTED" | "COMPLETE";
  constraints_generated?: number;
  timestamp: string;
}

interface PortfolioUpdateEvent {
  type: "portfolio_update";
  portfolio: Portfolio;
  timestamp: string;
}
```

---

## Shared Sub-types

```typescript
interface TradingProposal {
  action: "BUY" | "SELL" | "HOLD" | "REBALANCE";
  trades: {
    ticker: string;
    direction: "BUY" | "SELL";
    quantity: number;
    rationale: string;
  }[];
  thesis: string;
  confidence: number;
}

interface RiskDecision {
  decision: "APPROVE" | "MODIFY" | "VETO";
  modified_trades?: TradingProposal["trades"];
  vetoed_trades?: TradingProposal["trades"];
  risk_report: {
    current_var: number;
    proposed_var: number;
    verdict: string;
    modifications: string | null;
  };
}

interface FraudAlert {
  type: "WASH_TRADING" | "FRONT_RUNNING" | "UNUSUAL_CONCENTRATION" | "REASONING_INCONSISTENCY" | "ABNORMAL_VELOCITY";
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  flagged_trade_id: string | null;
  recommendation: string;
}

interface RegulatorDecision {
  final_decision: "EXECUTE" | "HOLD" | "HALT";
  circuit_breaker_activated: boolean;
  cooldown_minutes: number | null;
  reason: string;
  audit_trail_id: string;
  resume_conditions: string[];
}
```