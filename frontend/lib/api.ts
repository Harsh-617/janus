import { API_BASE } from "./constants";
import type {
  Portfolio,
  Trade,
  DecisionCycle,
  BehavioralConstraint,
  JanusLoopStatus,
  JanusLoopHistory,
  MarketShockScenario,
  MarketShockStatus,
  StreamStatus,
  HealthStatus,
  ScoresOverTimeResponse,
  PortfolioComparison,
  CycleExplainResponse,
  ConstraintConflict,
} from "./types";

const cache = new Map<string, { data: unknown; timestamp: number }>();

function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return Promise.resolve(entry.data as T);
  }
  return fetcher().then((data) => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}

export async function fetchPortfolio(): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolio`);
  if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTrades(limit: number = 50): Promise<Trade[]> {
  const res = await fetch(`${API_BASE}/api/trades?limit=${limit}`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json().then((d) => d.trades);
}

export async function fetchCycles(limit: number = 20): Promise<DecisionCycle[]> {
  const res = await fetch(`${API_BASE}/api/cycles?limit=${limit}`);
  if (!res.ok) throw new Error(`Cycles fetch failed: ${res.status}`);
  return res.json().then((d) => d.cycles);
}

export function fetchAgents(): Promise<unknown[]> {
  return cached("agents", 10_000, () =>
    fetch(`${API_BASE}/api/agents`).then((r) => {
      if (!r.ok) throw new Error(`Agents fetch failed: ${r.status}`);
      return r.json();
    })
  );
}

export function fetchConstraints(): Promise<BehavioralConstraint[]> {
  return cached("constraints", 15_000, () =>
    fetch(`${API_BASE}/api/constraints`).then((r) => {
      if (!r.ok) throw new Error(`Constraints fetch failed: ${r.status}`);
      return r.json().then((d) => d.constraints);
    })
  );
}

export async function fetchStreamStatus(): Promise<StreamStatus> {
  const res = await fetch(`${API_BASE}/api/stream/status`);
  if (!res.ok) throw new Error(`Stream status fetch failed: ${res.status}`);
  return res.json();
}

export async function runCycleOnce(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/stream/run-once`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Run cycle failed: ${res.status}`);
  return res.json();
}

export async function startStream(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/stream/start`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Start stream failed: ${res.status}`);
  return res.json();
}

export async function stopStream(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/stream/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Stop stream failed: ${res.status}`);
  return res.json();
}

export async function fetchJanusLoopStatus(): Promise<JanusLoopStatus> {
  const res = await fetch(`${API_BASE}/api/janus-loop/status`);
  if (!res.ok) throw new Error(`Janus loop status fetch failed: ${res.status}`);
  return res.json();
}

export function fetchJanusLoopHistory(limit: number = 20): Promise<JanusLoopHistory[]> {
  return cached("janus-loop-history", 30_000, () =>
    fetch(`${API_BASE}/api/janus-loop/history?limit=${limit}`).then((r) => {
      if (!r.ok) throw new Error(`Janus loop history fetch failed: ${r.status}`);
      return r.json().then((d) => d.constraints);
    })
  );
}

export async function triggerJanusLoop(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/janus-loop/trigger`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Trigger Janus loop failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketShockScenarios(): Promise<
  MarketShockScenario[]
> {
  const res = await fetch(`${API_BASE}/api/market-shock/scenarios`);
  if (!res.ok)
    throw new Error(`Market shock scenarios fetch failed: ${res.status}`);
  return res.json().then((d) => d.scenarios);
}

export async function applyPresetMarketShock(
  scenarioId: string
): Promise<{ message: string }> {
  const res = await fetch(
    `${API_BASE}/api/market-shock/preset/${scenarioId}`,
    {
      method: "POST",
    }
  );
  if (!res.ok)
    throw new Error(`Apply preset market shock failed: ${res.status}`);
  return res.json();
}

export async function applyCustomMarketShock(shocks: {
  [ticker: string]: number;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/market-shock/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shocks }),
  });
  if (!res.ok)
    throw new Error(`Apply custom market shock failed: ${res.status}`);
  return res.json();
}

export async function clearMarketShock(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/market-shock/clear`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Clear market shock failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketShockStatus(): Promise<MarketShockStatus> {
  const res = await fetch(`${API_BASE}/api/market-shock/status`);
  if (!res.ok)
    throw new Error(`Market shock status fetch failed: ${res.status}`);
  return res.json();
}

export async function activateCircuitBreaker(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/circuit-breaker/activate`, {
    method: "POST",
  });
  if (!res.ok)
    throw new Error(`Activate circuit breaker failed: ${res.status}`);
  return res.json();
}

export async function releaseCircuitBreaker(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/circuit-breaker/release`, {
    method: "POST",
  });
  if (!res.ok)
    throw new Error(`Release circuit breaker failed: ${res.status}`);
  return res.json();
}

export async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchScoresOverTime(
  dimension: string = "safety",
  window: number = 10
): Promise<ScoresOverTimeResponse> {
  const res = await fetch(
    `${API_BASE}/api/cycles/scores-over-time?dimension=${dimension}&window=${window}`
  );
  if (!res.ok) throw new Error(`Scores over time fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPortfolioComparison(): Promise<PortfolioComparison> {
  const res = await fetch(`${API_BASE}/api/portfolio/comparison`);
  if (!res.ok) throw new Error(`Portfolio comparison fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCycleExplain(cycleId: string): Promise<CycleExplainResponse> {
  const res = await fetch(`${API_BASE}/api/cycles/${cycleId}/explain`);
  if (!res.ok) throw new Error(`Cycle explain fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchConstraintConflicts(): Promise<ConstraintConflict[]> {
  const res = await fetch(`${API_BASE}/api/constraints/conflicts`);
  if (!res.ok) throw new Error(`Conflicts fetch failed: ${res.status}`);
  return res.json().then((d) => d.conflicts);
}

export async function resolveConflict(
  conflictId: string,
  action: "ACCEPT_RECOMMENDATION" | "SUSPEND_A" | "SUSPEND_B" | "SUSPEND_BOTH" | "DISMISS"
): Promise<{ status: string; action_taken: string }> {
  const res = await fetch(`${API_BASE}/api/constraints/conflicts/${conflictId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`Resolve conflict failed: ${res.status}`);
  return res.json();
}
