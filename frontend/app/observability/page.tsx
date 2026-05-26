"use client";

import { useState, useEffect } from "react";
import { fetchCycles } from "@/lib/api";
import type { DecisionCycle } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const PHOENIX_URL =
  process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006";

const PHOENIX_CATEGORIES = [
  { label: "Traces", key: "traces" },
  { label: "Evaluations", key: "evals" },
  { label: "Datasets", key: "datasets" },
  { label: "Experiments", key: "experiments" },
  { label: "Playground", key: "playground" },
];

function PhoenixNavItem({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: isActive ? "8px 14px 8px 12px" : "8px 14px",
        borderBottom: "1px solid #111820",
        borderLeft: isActive ? "2px solid #4CADCE" : "2px solid transparent",
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        color: isActive ? "#E2E8F0" : hovered ? "#E2E8F0" : "#8B949E",
        cursor: "pointer",
        background: hovered && !isActive ? "#0D1117" : "transparent",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      <span>{label}</span>
      {count != null && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#4B5563",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export default function ObservabilityPage() {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [phoenixReachable, setPhoenixReachable] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("traces");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cyclesData = await fetchCycles(20);
        const cyclesArr = Array.isArray(cyclesData)
          ? cyclesData
          : (cyclesData as unknown as { cycles: DecisionCycle[] }).cycles || [];
        setCycles(cyclesArr);
      } catch (error) {
        console.error("Failed to fetch cycles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkPhoenix = async () => {
      try {
        await fetch(PHOENIX_URL, { mode: "no-cors" });
        setPhoenixReachable(true);
      } catch {
        setPhoenixReachable(false);
      }
    };

    checkPhoenix();
    const interval = setInterval(checkPhoenix, 30000);
    return () => clearInterval(interval);
  }, []);

  const chartData = Array.isArray(cycles)
    ? cycles
        .slice()
        .reverse()
        .map((cycle, index) => ({
          cycle: index + 1,
          Overall: cycle.judge_overall_score,
          Safety: cycle.judge_safety,
          Correctness: cycle.judge_correctness,
          Compliance: cycle.judge_compliance,
          Explainability: cycle.judge_explainability,
          "Hallucination Risk": 10 - cycle.judge_hallucination_risk,
        }))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Page Header */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#4B5563",
            }}
          >
            Observability
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#8B949E",
              marginTop: 3,
            }}
          >
            Live decision traces powered by Arize Phoenix
          </div>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }}
        >
          {phoenixReachable === null ? (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#4B5563",
              }}
            >
              checking...
            </span>
          ) : phoenixReachable ? (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22C55E",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#22C55E",
                }}
              >
                Phoenix Connected
              </span>
            </>
          ) : (
            <>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#EF4444",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#EF4444",
                }}
              >
                Phoenix Disconnected
              </span>
            </>
          )}
        </div>
      </div>

      {/* Section 1: Score Trends */}
      <div style={{ borderBottom: "1px solid #1C2128" }}>
        <div
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid #1C2128",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#4B5563",
            }}
          >
            Judge Score Trends
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#2D3748",
            }}
          >
            LAST 20 CYCLES
          </span>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          {loading ? (
            <div
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#4B5563",
              }}
            >
              Loading...
            </div>
          ) : cycles.length === 0 ? (
            <div
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#4B5563",
              }}
            >
              No cycle data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 20, bottom: 8, left: 10 }}
              >
                <CartesianGrid stroke="#1C2128" strokeDasharray="3 3" />
                <XAxis
                  dataKey="cycle"
                  tick={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fill: "#4B5563",
                  }}
                  axisLine={{ stroke: "#1C2128" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    fill: "#4B5563",
                  }}
                  axisLine={{ stroke: "#1C2128" }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1117",
                    border: "1px solid #1C2128",
                    borderRadius: 3,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    boxShadow: "none",
                  }}
                  labelStyle={{ color: "#8B949E" }}
                  itemStyle={{ color: "#8B949E", fontSize: 10 }}
                  cursor={{ stroke: "#1C2128", strokeWidth: 1 }}
                />
                <Legend
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#4B5563' }}
                  verticalAlign="top"
                  align="left"
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="Overall"
                  stroke="#C9A84C"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Safety"
                  stroke="#22C55E"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Correctness"
                  stroke="#4CADCE"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Compliance"
                  stroke="#A855F7"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Explainability"
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Hallucination Risk"
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Section 2: Phoenix Traces */}
      <div style={{ display: "flex", minHeight: 500 }}>
        {/* Left nav */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid #1C2128",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 14px",
              borderBottom: "1px solid #1C2128",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#4B5563",
            }}
          >
            Arize Phoenix Traces
          </div>
          {PHOENIX_CATEGORIES.map((cat) => (
            <PhoenixNavItem
              key={cat.key}
              label={cat.label}
              count={
                cat.key === "traces" && cycles.length > 0
                  ? cycles.length
                  : undefined
              }
              isActive={activeCategory === cat.key}
              onClick={() => setActiveCategory(cat.key)}
            />
          ))}
        </div>

        {/* Right: iframe */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {phoenixReachable === false ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: 32,
              }}
            >
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "#8B949E",
                }}
              >
                Phoenix must be running locally.
              </span>
              <code
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#4CADCE",
                  background: "#0D1117",
                  border: "1px solid #1C2128",
                  borderRadius: 3,
                  padding: "2px 8px",
                }}
              >
                python backend/scripts/start_phoenix.py
              </code>
            </div>
          ) : (
            <iframe
              src={PHOENIX_URL}
              style={{
                width: "100%",
                flex: 1,
                minHeight: 500,
                border: "none",
                background: "#080A0C",
              }}
              title="Arize Phoenix"
            />
          )}
        </div>
      </div>
    </div>
  );
}
