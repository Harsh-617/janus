// Core types
export interface Portfolio {
  portfolio_id: string;
  cash: number;
  total_value: number;
  pnl_pct: number;
  positions: Record<string, PositionData>;
  trade_count: number;
  cycle_count: number;
  circuit_breaker_active: boolean;
  risk_mode: "NORMAL" | "ELEVATED" | "CRISIS" | "HALTED";
}

export interface PositionData {
  shares: number;
  avg_cost: number;
  current_price: number;
  sector: string;
}

export interface Trade {
  trade_id: string;
  cycle_id: string;
  timestamp: string;
  ticker: string;
  direction: "BUY" | "SELL";
  quantity: number;
  rationale: string;
  confidence: number;
  proposed_by: string;
  judge_score: number;
  phoenix_trace_id: string;
  executed: boolean;
}

export interface DecisionCycle {
  cycle_id: string;
  cycle_number: number;
  timestamp: string;
  final_decision: "EXECUTE" | "HOLD" | "HALT";
  circuit_breaker_activated: boolean;
  trades_executed_count: number;
  judge_overall_score: number;
  judge_correctness: number;
  judge_safety: number;
  judge_hallucination_risk: number;
  judge_compliance: number;
  judge_explainability: number;
  learning_event: boolean;
  critical_finding: string;
  recommended_constraint: string;
  fraud_alerts_count: number;
  phoenix_trace_id: string;
  market_shock_active: boolean;
}

export interface BehavioralConstraint {
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
}

export type AgentName =
  | "trading_agent"
  | "risk_agent"
  | "fraud_agent"
  | "regulator_agent"
  | "judge_agent"
  | "meta_agent";

// SSE event types
export interface SSEBaseEvent {
  type: string;
  timestamp: string;
}

export interface CycleCompleteEvent extends SSEBaseEvent {
  type: "cycle_complete";
  data: {
    cycle_id: string;
    final_decision: string;
    trades_executed: number;
    judge_score: number;
    learning_event: boolean;
    circuit_breaker: boolean;
    critical_finding: string;
  };
}

export interface AgentThinkingEvent extends SSEBaseEvent {
  type: "agent_thinking";
  data: { agent: AgentName; cycle_id: string };
}

export interface CycleStartEvent extends SSEBaseEvent {
  type: "cycle_start";
  data: { cycle_id: string; cycle_number: number; message: string };
}

export interface CycleErrorEvent extends SSEBaseEvent {
  type: "cycle_error";
  data: { cycle_id: string; error: string };
}

export interface CircuitBreakerActivatedEvent extends SSEBaseEvent {
  type: "circuit_breaker_activated";
  data: { cycle_id: string; reason: string; cooldown_minutes: number };
}

export interface ConnectedEvent extends SSEBaseEvent {
  type: "connected";
  data: Record<string, never>;
}

export interface PingEvent extends SSEBaseEvent {
  type: "ping";
  data: Record<string, never>;
}

export type SSEEvent =
  | CycleCompleteEvent
  | AgentThinkingEvent
  | CycleStartEvent
  | CycleErrorEvent
  | CircuitBreakerActivatedEvent
  | ConnectedEvent
  | PingEvent;

export interface Constraint {
  constraint_id: string;
  generated_at: string;
  target_agent: string;
  condition: string;
  rule: string;
  rationale: string;
  status: "ACTIVE" | "EXPIRED";
  performance_delta: {
    safety_before: number;
    safety_after: number | null;
    cycles_active: number;
  };
  expires_after_cycles: number;
  generated_by: string;
}

// Janus loop types
export interface JanusLoopStatus {
  active_constraints: BehavioralConstraint[];
  constraint_count: number;
  recent_cycles_analyzed: number;
  learning_events_count: number;
  avg_judge_score: number;
}

export interface JanusLoopHistory {
  cycle_id: string;
  timestamp: string;
  learning_event: boolean;
  constraint_generated: boolean;
  judge_score: number;
  critical_finding: string;
}

export interface MarketShockScenario {
  id: string;
  name: string;
  description: string;
}

export interface MarketShockStatus {
  active: boolean;
  scenario_id: string | null;
  scenario_name: string | null;
  activated_at: string | null;
}

// Score dimensions
export interface DimensionScores {
  correctness: number;
  safety: number;
  hallucination_risk: number;
  compliance: number;
  explainability: number;
}

// Stream status
export interface StreamStatus {
  running: boolean;
  cycle_count: number;
  last_cycle_at: string | null;
}

// Health check
export interface HealthStatus {
  status: string;
  timestamp: string;
}

// Improvement curve
export interface ScoresOverTime {
  cycle_number: number;
  cycle_id: string;
  raw_score: number;
  rolling_avg: number;
  timestamp: string;
}

export interface ConstraintInjection {
  cycle_number: number;
  constraint_id: string;
  rule: string;
  target_agent: string;
}

export interface ScoresOverTimeResponse {
  dimension: string;
  window: number;
  data: ScoresOverTime[];
  constraint_injections: ConstraintInjection[];
}

export interface PortfolioHistory {
  cycle: number;
  total_value: number;
  pnl_pct: number;
}

export interface PortfolioSide {
  portfolio_id: string;
  label: string;
  initial_capital: number;
  current_value: number;
  pnl_pct: number;
  cycle_count: number;
  history: PortfolioHistory[];
}

export interface ConflictResolution {
  recommendation: "PREFER_NEWER" | "PREFER_STRICTER" | "SUSPEND_BOTH" | "MANUAL_REVIEW";
  reasoning: string;
  action: string;
}

export interface ConstraintConflict {
  conflict_id: string;
  constraint_a_id: string;
  constraint_a_rule: string;
  constraint_b_id: string;
  constraint_b_rule: string;
  conflict_type: "DIRECTIONAL_OPPOSITION" | "CONDITION_OVERLAP" | "NUMERIC_CONTRADICTION";
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  detected_at: string;
  resolved: boolean;
  resolution: ConflictResolution | null;
}

export interface ConflictsResponse {
  conflicts: ConstraintConflict[];
  total: number;
}

export interface PortfolioComparison {
  janus: PortfolioSide;
  baseline: PortfolioSide;
  divergence_pct: number;
}

export interface TrendResult {
  trend: string;
  slope: number | null;
  confidence: number;
  data_points: number;
  latest_score: number;
  earliest_score: number;
}

export interface AgentTrends {
  [dimension: string]: TrendResult;
}

export interface AgentTrendsResponse {
  [agentId: string]: AgentTrends;
}

export interface CycleExplainResponse {
  cycle_id: string;
  timestamp: string;
  brief: string;
  proposal_summary: string;
  risk_summary: string;
  fraud_summary: string;
  regulator_summary: string;
  constraint_summary: string;
  judge_summary: string;
  outcome: string;
  phoenix_trace_id: string | null;
  phoenix_trace_url: string | null;
}
