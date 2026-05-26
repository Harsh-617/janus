"use client";

import { AGENT_DISPLAY_NAMES, AGENT_COLORS } from "@/lib/constants";
import { ScoreBadge } from "@/components/shared/score-badge";
import { RadarChartComponent } from "./radar-chart";
import type { AgentName, BehavioralConstraint, DimensionScores } from "@/lib/types";

interface AgentCardProps {
  agentId: AgentName;
  isThinking: boolean;
  avgScore: number | null;
  dimensionScores: DimensionScores | null;
  activeConstraints: BehavioralConstraint[];
  stats: Record<string, string | number>;
  lastDecision?: string;
}

const AGENT_DOT_COLORS: Record<string, string> = {
  trading_agent: "#4CADCE",
  risk_agent: "#F59E0B",
  fraud_agent: "#EF4444",
  regulator_agent: "#22C55E",
  judge_agent: "#A855F7",
};

const DIMENSION_LABELS = [
  { key: "correctness", label: "CORRECT" },
  { key: "safety", label: "SAFETY" },
  { key: "hallucination_risk", label: "HALLUC", invert: true },
  { key: "compliance", label: "COMPLY" },
  { key: "explainability", label: "EXPLAIN" },
] as const;

function scoreColor(v: number): string {
  if (v >= 7) return "#22C55E";
  if (v >= 5) return "#F59E0B";
  return "#EF4444";
}

function statValueColor(index: number, value: string | number): string {
  if (index === 2) return "#EF4444";
  if (index === 1) {
    const n = parseFloat(String(value));
    if (!isNaN(n) && n >= 0 && n <= 10) return scoreColor(n);
  }
  return "#E2E8F0";
}

export function AgentCard({
  agentId,
  isThinking,
  avgScore,
  dimensionScores,
  activeConstraints,
  stats,
  lastDecision,
}: AgentCardProps) {
  const agentColor = AGENT_DOT_COLORS[agentId] ?? AGENT_COLORS[agentId];
  const agentName = AGENT_DISPLAY_NAMES[agentId];
  const statsEntries = Object.entries(stats).slice(0, 3);

  return (
    <div
      style={{
        background: "#0D1117",
        border: "1px solid #1C2128",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: agentColor,
              flexShrink: 0,
              boxShadow: isThinking ? `0 0 0 3px ${agentColor}33` : "none",
            }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: "#E2E8F0",
            }}
          >
            {agentName}
          </span>
        </div>
        {avgScore !== null && <ScoreBadge score={avgScore} size="md" />}
      </div>

      {/* SCORE DIMENSIONS ROW */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          gap: 8,
        }}
      >
        {DIMENSION_LABELS.map(({ key, label, invert }) => {
          const raw = dimensionScores ? (dimensionScores as Record<string, number>)[key] : null;
          const display = raw !== null ? (invert ? 10 - raw : raw) : null;
          const color = display !== null ? scoreColor(display) : "#4B5563";
          const fillPct = display !== null ? (display / 10) * 100 : 0;

          return (
            <div
              key={key}
              style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "#4B5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color,
                }}
              >
                {display !== null ? display.toFixed(1) : "—"}
              </span>
              <div
                style={{
                  height: 3,
                  background: "#1C2128",
                  borderRadius: 1,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${fillPct}%`,
                    background: color,
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* RADAR CHART */}
      <div style={{ padding: "0 14px", height: 200, flexShrink: 0 }}>
        <RadarChartComponent scores={dimensionScores} agentColor={agentColor} />
      </div>

      {/* STATS ROW */}
      {statsEntries.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #1C2128",
            borderBottom: "1px solid #1C2128",
            display: "flex",
          }}
        >
          {statsEntries.map(([label, value], i) => (
            <div
              key={label}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRight: i < statsEntries.length - 1 ? "1px solid #1C2128" : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "#4B5563",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  fontWeight: 600,
                  color: statValueColor(i, value),
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CONSTRAINTS SECTION */}
      <div style={{ padding: "10px 14px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: activeConstraints.length > 0 ? 8 : 4,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#4B5563",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            ACTIVE CONSTRAINTS
          </span>
          <span
            style={{
              background: "#1C2128",
              color: "#8B949E",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              borderRadius: 3,
              padding: "1px 6px",
              lineHeight: 1.5,
            }}
          >
            {activeConstraints.length}
          </span>
        </div>
        {activeConstraints.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {activeConstraints.map((constraint) => (
              <div
                key={constraint.constraint_id}
                className="line-clamp-2"
                style={{
                  padding: "6px 8px",
                  background: "#080A0C",
                  border: "1px solid #1C2128",
                  borderRadius: 3,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  color: "#8B949E",
                }}
                title={constraint.rule}
              >
                {constraint.rule}
              </div>
            ))}
          </div>
        ) : (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#4B5563",
            }}
          >
            No active constraints
          </span>
        )}
      </div>

      {/* LAST ACTION */}
      {lastDecision && (
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #1C2128",
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#4B5563",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              flexShrink: 0,
            }}
          >
            LAST ACTION
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8B949E",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {lastDecision}
          </span>
        </div>
      )}
    </div>
  );
}
