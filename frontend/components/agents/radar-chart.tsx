"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { DimensionScores } from "@/lib/types";

interface RadarChartComponentProps {
  scores: DimensionScores | null;
  agentColor: string;
}

export function RadarChartComponent({
  scores,
  agentColor,
}: RadarChartComponentProps) {
  if (!scores) {
    return (
      <div className="flex items-center justify-center h-[200px] w-[200px]">
        <span className="text-xs text-[var(--janus-text-muted)]">
          No data yet
        </span>
      </div>
    );
  }

  const data = [
    { dimension: "Correctness", score: scores.correctness, fullMark: 10 },
    { dimension: "Safety", score: scores.safety, fullMark: 10 },
    {
      dimension: "Hallucination",
      score: 10 - scores.hallucination_risk,
      fullMark: 10,
    }, // Invert so higher is better
    { dimension: "Compliance", score: scores.compliance, fullMark: 10 },
    { dimension: "Explainability", score: scores.explainability, fullMark: 10 },
  ];

  return (
    <ResponsiveContainer width={200} height={200}>
      <RadarChart data={data}>
        <PolarGrid stroke="#1E2028" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "#8A8780", fontSize: 10 }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke={agentColor}
          fill={agentColor}
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
