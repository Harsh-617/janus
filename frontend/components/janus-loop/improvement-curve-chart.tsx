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
  ResponsiveContainer,
} from "recharts";
import { fetchScoresOverTime } from "@/lib/api";
import type { ScoresOverTimeResponse, ScoresOverTime } from "@/lib/types";

const MONO = "'JetBrains Mono', 'Fira Mono', monospace";

const DIMENSIONS = [
  { key: "safety", label: "Safety" },
  { key: "overall", label: "Overall" },
  { key: "correctness", label: "Correctness" },
  { key: "hallucination_risk", label: "Hallucination" },
  { key: "compliance", label: "Compliance" },
  { key: "explainability", label: "Explainability" },
];

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: ScoresOverTime }>;
}

function CustomTooltip({ active, payload, rollingColor }: TooltipPayload & { rollingColor: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#1A1D23",
        border: "1px solid #2A2D35",
        padding: "8px 12px",
        borderRadius: 4,
        fontFamily: MONO,
      }}
    >
      <div style={{ fontSize: 10, color: "#8B949E", marginBottom: 4 }}>
        Cycle {d.cycle_number}
      </div>
      <div style={{ fontSize: 11, color: "#4CADCE" }}>
        Raw: {d.raw_score?.toFixed(1)}
      </div>
      <div style={{ fontSize: 11, color: rollingColor }}>
        Rolling Avg: {d.rolling_avg?.toFixed(1)}
      </div>
    </div>
  );
}

export default function ImprovementCurveChart({ window: rollingWindow = 10 }: { window?: number }) {
  const [dimension, setDimension] = useState("safety");
  const [data, setData] = useState<ScoresOverTimeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchScoresOverTime(dimension, rollingWindow)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dimension, rollingWindow]);

  const chartData = data?.data ?? [];
  const injections = data?.constraint_injections ?? [];
  const hasEnoughData = chartData.length >= 5;

  const firstRolling = chartData[0]?.rolling_avg ?? 0;
  const lastRolling = chartData[chartData.length - 1]?.rolling_avg ?? 0;
  const rollingColor = lastRolling >= firstRolling ? "#52E0A0" : "#E05252";

  const tickInterval = Math.max(0, Math.floor(chartData.length / 8) - 1);

  return (
    <div
      style={{
        background: "#13151A",
        border: "1px solid #2A2D35",
        borderRadius: 6,
        padding: 24,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 13,
            color: "#C9A84C",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          SELF-CORRECTION IMPROVEMENT CURVE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563", marginTop: 3 }}>
          Rolling {rollingWindow}-cycle average by dimension
        </div>
      </div>

      {/* Dimension selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {DIMENSIONS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDimension(d.key)}
            style={{
              background: dimension === d.key ? "#C9A84C" : "#1A1D23",
              color: dimension === d.key ? "#080A0C" : "#8B949E",
              border: `1px solid ${dimension === d.key ? "#C9A84C" : "#2A2D35"}`,
              fontFamily: MONO,
              fontSize: 10,
              padding: "4px 10px",
              borderRadius: 3,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      {loading ? (
        <div
          style={{
            height: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>LOADING...</span>
        </div>
      ) : !hasEnoughData ? (
        <div
          style={{
            height: 320,
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
            Run more cycles to see the improvement curve
          </span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 24, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1C2128" />
            <XAxis
              dataKey="cycle_number"
              label={{
                value: "cycle",
                position: "insideBottomRight",
                offset: -5,
                style: { fontSize: "10px", fill: "#8A8780" },
              }}
              tick={{ fontSize: 10, fill: "#8A8780" }}
              interval={tickInterval}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontFamily: MONO, fontSize: 9, fill: "#4B5563" }}
              width={28}
            />
            <Tooltip content={(props: any) => <CustomTooltip {...props} rollingColor={rollingColor} />} />

            {/* Quality threshold */}
            <ReferenceLine
              y={6}
              stroke="#8A8780"
              strokeDasharray="4 4"
              label={{
                value: "Threshold",
                fill: "#8A8780",
                fontSize: 9,
                fontFamily: MONO,
                position: "insideTopRight",
              }}
            />

            {/* Constraint injection verticals */}
            {injections.map((inj) => (
              <ReferenceLine
                key={inj.constraint_id}
                x={inj.cycle_number}
                stroke="#C9A84C"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                strokeWidth={1}
              />
            ))}

            {/* Raw score — thin dashed blue */}
            <Line
              type="monotone"
              dataKey="raw_score"
              stroke="#4CADCE"
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeDasharray="3 3"
              dot={false}
              name="Raw Score"
            />

            {/* Rolling average — thick solid green/red */}
            <Line
              type="monotone"
              dataKey="rolling_avg"
              stroke={rollingColor}
              strokeWidth={2.5}
              dot={false}
              name="Rolling Avg"
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginTop: 12,
          fontFamily: MONO,
          fontSize: 10,
          color: "#4B5563",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="20" height="10">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#4CADCE" strokeWidth="1.5" strokeDasharray="3 3" strokeOpacity="0.6" />
          </svg>
          raw score
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="20" height="10">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#52E0A0" strokeWidth="2.5" />
          </svg>
          rolling avg
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="12" height="10">
            <line x1="6" y1="0" x2="6" y2="10" stroke="#C9A84C" strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
          constraint injected
        </span>
      </div>
    </div>
  );
}
