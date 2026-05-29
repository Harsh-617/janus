"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchPortfolioComparison } from "@/lib/api";
import type { PortfolioComparison, PortfolioHistory } from "@/lib/types";

const MONO = "'JetBrains Mono', 'Fira Mono', monospace";
const COLOR_JANUS = "#52E0A0";
const COLOR_BASELINE = "#8A8780";
const COLOR_GOLD = "#C9A84C";
const COLOR_BORDER = "#2A2D35";

interface ChartPoint {
  cycle: number;
  janus_pnl: number;
  baseline_pnl: number;
}

function buildChartData(
  janusHistory: PortfolioHistory[],
  baselineHistory: PortfolioHistory[]
): ChartPoint[] {
  const byJanus = new Map(janusHistory.map((h) => [h.cycle, h.pnl_pct]));
  const byBaseline = new Map(baselineHistory.map((h) => [h.cycle, h.pnl_pct]));
  const allCycles = Array.from(
    new Set([...byJanus.keys(), ...byBaseline.keys()])
  ).sort((a, b) => a - b);
  return allCycles.map((cycle) => ({
    cycle,
    janus_pnl: byJanus.get(cycle) ?? 0,
    baseline_pnl: byBaseline.get(cycle) ?? 0,
  }));
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function ComparisonTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const janus = payload.find((p) => p.name === "janus")?.value ?? 0;
  const baseline = payload.find((p) => p.name === "baseline")?.value ?? 0;
  const divergence = janus - baseline;

  return (
    <div
      style={{
        background: "#1A1D23",
        border: `1px solid ${COLOR_BORDER}`,
        padding: "10px 14px",
        borderRadius: 4,
        fontFamily: MONO,
      }}
    >
      <div style={{ fontSize: 10, color: "#8B949E", marginBottom: 6 }}>
        Cycle {label}
      </div>
      <div style={{ fontSize: 11, color: COLOR_JANUS, marginBottom: 2 }}>
        Janus: {janus >= 0 ? "+" : ""}{janus.toFixed(2)}%
      </div>
      <div style={{ fontSize: 11, color: COLOR_BASELINE, marginBottom: 4 }}>
        Baseline: {baseline >= 0 ? "+" : ""}{baseline.toFixed(2)}%
      </div>
      <div
        style={{
          fontSize: 11,
          color: divergence >= 0 ? COLOR_GOLD : "#E05252",
          borderTop: `1px solid ${COLOR_BORDER}`,
          paddingTop: 4,
        }}
      >
        Divergence: {divergence >= 0 ? "+" : ""}{divergence.toFixed(2)}%
      </div>
    </div>
  );
}


function CustomLegend() {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        marginTop: 10,
        fontFamily: MONO,
        fontSize: 10,
        justifyContent: "center",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="20" height="10">
          <line x1="0" y1="5" x2="20" y2="5" stroke={COLOR_JANUS} strokeWidth="2" />
        </svg>
        <span style={{ color: COLOR_JANUS }}>JANUS (Self-Correcting)</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="20" height="10">
          <line
            x1="0"
            y1="5"
            x2="20"
            y2="5"
            stroke={COLOR_BASELINE}
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />
        </svg>
        <span style={{ color: COLOR_BASELINE }}>BASELINE</span>
      </span>
    </div>
  );
}

export default function PortfolioComparisonChart() {
  const [data, setData] = useState<PortfolioComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetchPortfolioComparison()
        .then((d) => { if (alive) setData(d); })
        .catch(console.error)
        .finally(() => { if (alive) setLoading(false); });
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const chartData = data
    ? buildChartData(data.janus.history, data.baseline.history)
    : [];
  console.log("chartData:", chartData?.slice(0, 3));
  const hasEnoughData = chartData.length >= 3;

  return (
    <div
      style={{
        background: "#13151A",
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: 8,
        padding: 24,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Header with inline stats */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: COLOR_GOLD, letterSpacing: "0.1em" }}>
            PORTFOLIO DIVERGENCE
          </div>
          <div style={{ fontSize: 10, color: "#8A8780", marginTop: 2 }}>
            Janus self-correction vs unconstrained baseline
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#8A8780", fontFamily: "monospace" }}>JANUS P&amp;L</div>
            <div style={{ fontSize: 13, color: COLOR_JANUS, fontFamily: MONO, fontWeight: 600 }}>
              {data ? `${data.janus.pnl_pct >= 0 ? "+" : ""}${data.janus.pnl_pct.toFixed(2)}%` : "--"}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: COLOR_BORDER }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#8A8780", fontFamily: "monospace" }}>DIVERGENCE</div>
            <div style={{ fontSize: 13, color: (data?.divergence_pct ?? 0) >= 0 ? COLOR_GOLD : "#E05252", fontFamily: MONO, fontWeight: 600 }}>
              {data ? `${data.divergence_pct >= 0 ? "+" : ""}${data.divergence_pct.toFixed(2)}%` : "--"}
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: COLOR_BORDER }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "#8A8780", fontFamily: "monospace" }}>BASELINE P&amp;L</div>
            <div style={{ fontSize: 13, color: COLOR_BASELINE, fontFamily: MONO, fontWeight: 600 }}>
              {data ? `${data.baseline.pnl_pct >= 0 ? "+" : ""}${data.baseline.pnl_pct.toFixed(2)}%` : "--"}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>
            LOADING...
          </span>
        </div>
      ) : !hasEnoughData ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: "#4B5563",
              textAlign: "center",
            }}
          >
            Run more cycles to see divergence
          </span>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div style={{ width: "100%", height: "160px", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 16, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1C2128" />
                <XAxis
                  dataKey="cycle"
                  tick={{ fontFamily: MONO, fontSize: 9, fill: "#4B5563" }}
                  label={{
                    value: "Cycle",
                    position: "insideBottomRight",
                    offset: -4,
                    fill: "#4B5563",
                    fontSize: 9,
                    fontFamily: MONO,
                  }}
                />
                <YAxis
                  tick={{ fontFamily: MONO, fontSize: 9, fill: "#4B5563" }}
                  width={36}
                  tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                />
                <Tooltip content={(props: any) => <ComparisonTooltip {...props} />} />
                <ReferenceLine y={0} stroke={COLOR_BORDER} strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="janus_pnl"
                  name="janus"
                  stroke={COLOR_JANUS}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: COLOR_JANUS }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline_pnl"
                  name="baseline"
                  stroke={COLOR_BASELINE}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 3, fill: COLOR_BASELINE }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <CustomLegend />
        </>
      )}
    </div>
  );
}
