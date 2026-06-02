"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "@/hooks/use-portfolio";
import { useCycles } from "@/hooks/use-cycles";
import { API_BASE } from "@/lib/constants";

const CYCLE_INTERVAL = 120;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const SEP = (
  <div
    style={{
      width: 1,
      height: 16,
      background: "#1C2128",
      flexShrink: 0,
    }}
  />
);

interface MetricProps {
  label: string;
  value: React.ReactNode;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#4B5563",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

export function Topbar() {
  const { portfolio } = usePortfolio();
  const { cycles } = useCycles(10);
  const [countdown, setCountdown] = useState(CYCLE_INTERVAL);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stream/status`);
        const data = await res.json();
        if (data.next_cycle_in_seconds !== undefined) {
          setCountdown(data.next_cycle_in_seconds);
        }
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/system/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.demo_mode) setDemoMode(true); })
      .catch(() => {});
  }, []);

  const isCircuitBreaker = portfolio?.circuit_breaker_active ?? false;

  const statusLabel = !portfolio
    ? "LOADING"
    : isCircuitBreaker
    ? "CIRCUIT BREAKER"
    : "RUNNING";

  const statusColor = !portfolio
    ? "#4B5563"
    : isCircuitBreaker
    ? "#EF4444"
    : "#22C55E";

  const avgScore =
    cycles.length > 0
      ? cycles.reduce((sum, c) => sum + (c.judge_overall_score ?? 0), 0) / cycles.length
      : null;

  const pnl = portfolio?.pnl_pct ?? null;
  const pnlColor =
    pnl === null ? "#E2E8F0" : pnl >= 0 ? "#22C55E" : "#EF4444";

  return (
    <header
      style={{
        height: 40,
        background: "#0D1117",
        borderBottom: "1px solid #1C2128",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* JANUS wordmark */}
      <span
        className="cinzel"
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "0.18em",
          color: "#C9A84C",
          userSelect: "none",
        }}
      >
        JANUS
      </span>

      {SEP}

      {/* DEMO badge */}
      {demoMode && (
        <span
          style={{
            background: "rgba(201,168,76,0.2)",
            color: "#C9A84C",
            border: "1px solid rgba(201,168,76,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          DEMO
        </span>
      )}

      {/* Status pill */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: statusColor,
            flexShrink: 0,
            animation: isCircuitBreaker ? "none" : "janus-pulse 2s ease-in-out infinite",
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {SEP}

      {/* Metrics */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, flex: 1, margin: "0 8px" }}>
        <Metric
          label="PORTFOLIO"
          value={
            <span style={{ color: "#E2E8F0" }}>
              {portfolio ? formatCurrency(portfolio.total_value) : "—"}
            </span>
          }
        />

        <Metric
          label="P&L"
          value={
            <span style={{ color: pnlColor }}>
              {pnl !== null ? formatPct(pnl) : "—"}
            </span>
          }
        />

        <Metric
          label="CYCLE"
          value={
            <span style={{ color: "#C9A84C" }}>
              {portfolio?.cycle_count ?? "—"}
            </span>
          }
        />

        <Metric
          label="AVG SCORE"
          value={
            <span style={{ color: "#C9A84C" }}>
              {avgScore !== null ? avgScore.toFixed(1) : "—"}
            </span>
          }
        />
      </div>

      {/* Countdown */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#4B5563",
          border: "1px solid #1C2128",
          borderRadius: 4,
          padding: "2px 8px",
          userSelect: "none",
        }}
      >
        Next cycle in {formatCountdown(countdown)}
      </div>
    </header>
  );
}
