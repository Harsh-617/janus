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

export function RadarChartComponent({ scores, agentColor }: RadarChartComponentProps) {
  if (!scores) {
    return (
      <div className="flex items-center justify-center h-[200px] w-full">
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#4B5563" }}>
          NO DATA
        </span>
      </div>
    );
  }

  const data = [
    { dimension: "CORRECT", score: scores.correctness, fullMark: 10 },
    { dimension: "SAFETY", score: scores.safety, fullMark: 10 },
    { dimension: "HALLUC", score: 10 - scores.hallucination_risk, fullMark: 10 },
    { dimension: "COMPLY", score: scores.compliance, fullMark: 10 },
    { dimension: "EXPLAIN", score: scores.explainability, fullMark: 10 },
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} style={{ background: "transparent" }}>
        <PolarGrid stroke="#1C2128" strokeWidth={1} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "#4B5563", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke={agentColor}
          fill={agentColor}
          fillOpacity={0.15}
          strokeWidth={1.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
