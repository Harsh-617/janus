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
import { Activity, AlertCircle, CheckCircle } from "lucide-react";

export default function ObservabilityPage() {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [phoenixReachable, setPhoenixReachable] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cyclesData = await fetchCycles(20);
        const cyclesArr = Array.isArray(cyclesData) ? cyclesData : (cyclesData as unknown as { cycles: DecisionCycle[] }).cycles || [];
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
        const response = await fetch(process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006", {
          mode: "no-cors",
        });
        setPhoenixReachable(true);
      } catch {
        setPhoenixReachable(false);
      }
    };

    checkPhoenix();
    const interval = setInterval(checkPhoenix, 30000);

    return () => clearInterval(interval);
  }, []);

  const chartData = Array.isArray(cycles) ? cycles
    .slice()
    .reverse()
    .map((cycle, index) => ({
      cycle: index + 1,
      Overall: cycle.judge_overall_score,
      Correctness: cycle.judge_correctness,
      Safety: cycle.judge_safety,
      "Hallucination Risk": 10 - cycle.judge_hallucination_risk, // Invert
      Compliance: cycle.judge_compliance,
      Explainability: cycle.judge_explainability,
    })) : [];

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-[var(--janus-text-primary)]">
              Observability
            </h1>
            <div className="flex items-center gap-2">
              {phoenixReachable === null ? (
                <Activity className="h-4 w-4 text-[var(--janus-text-muted)] animate-pulse" />
              ) : phoenixReachable ? (
                <>
                  <CheckCircle className="h-4 w-4 text-[var(--janus-success)]" />
                  <span className="text-xs text-[var(--janus-success)]">
                    Phoenix Connected
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-[var(--janus-danger)]" />
                  <span className="text-xs text-[var(--janus-danger)]">
                    Phoenix Offline
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--janus-text-muted)]">
            Live decision traces powered by Arize Phoenix
          </p>
        </div>

        {/* Score Trend Panel */}
        <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide mb-4">
            Judge Score Trends (Last 20 Cycles)
          </h2>

          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="animate-pulse text-[var(--janus-text-muted)]">
                Loading...
              </div>
            </div>
          ) : cycles.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-[var(--janus-text-muted)]">
              No cycle data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2028" />
                <XAxis
                  dataKey="cycle"
                  stroke="#8A8780"
                  tick={{ fill: "#8A8780", fontSize: 12 }}
                  label={{
                    value: "Cycle (last 20)",
                    position: "insideBottom",
                    offset: -5,
                    fill: "#8A8780",
                  }}
                />
                <YAxis
                  domain={[0, 10]}
                  stroke="#8A8780"
                  tick={{ fill: "#8A8780", fontSize: 12 }}
                  label={{
                    value: "Score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#8A8780",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#13151A",
                    border: "1px solid #1E2028",
                    borderRadius: "6px",
                  }}
                  labelStyle={{ color: "#E8E6E0" }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="Overall"
                  stroke="#C9A84C"
                  strokeWidth={3}
                  dot={{ fill: "#C9A84C", r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="Correctness"
                  stroke="#4CADCE"
                  strokeWidth={2}
                  dot={{ fill: "#4CADCE", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Safety"
                  stroke="#52E0A0"
                  strokeWidth={2}
                  dot={{ fill: "#52E0A0", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Hallucination Risk"
                  stroke="#E05252"
                  strokeWidth={2}
                  dot={{ fill: "#E05252", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Compliance"
                  stroke="#9B59B6"
                  strokeWidth={2}
                  dot={{ fill: "#9B59B6", r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="Explainability"
                  stroke="#E0A052"
                  strokeWidth={2}
                  dot={{ fill: "#E0A052", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Phoenix Iframe */}
        <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide mb-4">
            Arize Phoenix Traces
          </h2>

          {phoenixReachable === false ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-[var(--janus-warning)]" />
              <div className="text-center">
                <p className="text-[var(--janus-text-primary)] font-semibold mb-2">
                  Phoenix is not running
                </p>
                <p className="text-sm text-[var(--janus-text-muted)] mb-4">
                  Start Phoenix locally to view traces and evaluations
                </p>
                <div className="bg-[var(--janus-background)] border border-[var(--janus-border)] rounded p-4 text-left">
                  <p className="text-xs text-[var(--janus-text-muted)] mb-2">
                    Run this command:
                  </p>
                  <code className="text-xs text-[var(--janus-blue)] font-mono">
                    python backend/scripts/start_phoenix.py
                  </code>
                  <p className="text-xs text-[var(--janus-text-muted)] mt-3">
                    Then access Phoenix at:{" "}
                    <a
                      href={process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--janus-blue)] hover:underline"
                    >
                      {process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006"}
                    </a>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--janus-text-muted)] mb-4">
                Phoenix must be running locally. Start with:{" "}
                <code className="text-[var(--janus-blue)] font-mono">
                  python backend/scripts/start_phoenix.py
                </code>
              </p>
              <iframe
                src={process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006"}
                className="w-full border-0 rounded-lg bg-[var(--janus-background)]"
                style={{ minHeight: "500px" }}
                title="Arize Phoenix"
              />
            </>
          )}
        </div>
      </div>
  );
}
