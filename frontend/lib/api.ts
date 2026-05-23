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
} from "./types";

export async function fetchPortfolio(): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolio`);
  if (!res.ok) throw new Error(`Portfolio fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTrades(limit: number = 50): Promise<Trade[]> {
  const res = await fetch(`${API_BASE}/api/trades?limit=${limit}`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCycles(limit: number = 20): Promise<DecisionCycle[]> {
  const res = await fetch(`${API_BASE}/api/cycles?limit=${limit}`);
  if (!res.ok) throw new Error(`Cycles fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchConstraints(): Promise<BehavioralConstraint[]> {
  const res = await fetch(`${API_BASE}/api/constraints`);
  if (!res.ok) throw new Error(`Constraints fetch failed: ${res.status}`);
  return res.json();
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

export async function fetchJanusLoopHistory(
  limit: number = 20
): Promise<JanusLoopHistory[]> {
  const res = await fetch(`${API_BASE}/api/janus-loop/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Janus loop history fetch failed: ${res.status}`);
  return res.json();
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
  return res.json();
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
