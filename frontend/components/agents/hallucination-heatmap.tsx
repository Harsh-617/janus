"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "@/lib/constants";
import type { DecisionCycle } from "@/lib/types";

type Cycle = Pick<DecisionCycle, "cycle_id" | "cycle_number" | "judge_hallucination_risk" | "critical_finding">;

function getSquareStyle(score: number | undefined): {
  background: string;
  border: string;
  borderColor: string;
} {
  if (score === undefined) {
    return { background: "#0D1117", border: "1px solid #1C2128", borderColor: "#1C2128" };
  }
  if (score >= 7) {
    return { background: "#0F2A1A", border: "1px solid #238636", borderColor: "#238636" };
  }
  if (score >= 5) {
    return { background: "#2A1F00", border: "1px solid #C9A84C", borderColor: "#C9A84C" };
  }
  return { background: "#2A0A0A", border: "1px solid #EF4444", borderColor: "#EF4444" };
}

function Square({
  cycle,
  onEnter,
  onLeave,
}: {
  cycle: Cycle | undefined;
  onEnter: (e: React.MouseEvent<HTMLDivElement>, cycle: Cycle) => void;
  onLeave: () => void;
}) {
  const score = cycle?.judge_hallucination_risk;
  const { background, border } = getSquareStyle(score);

  return (
    <div
      style={{
        height: 28,
        background,
        border,
        borderRadius: 2,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => cycle && onEnter(e, cycle)}
      onMouseLeave={onLeave}
    />
  );
}

interface HallucinationHeatmapProps {
  cycles?: DecisionCycle[];
}

export default function HallucinationHeatmap({ cycles: cyclesProp }: HallucinationHeatmapProps) {
  const [fetchedCycles, setFetchedCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(cyclesProp === undefined);
  const [error, setError] = useState(false);
  const [hoveredCycle, setHoveredCycle] = useState<Cycle | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const cycles: Cycle[] = cyclesProp ?? fetchedCycles;

  const handleEnter = (e: React.MouseEvent<HTMLDivElement>, cycle: Cycle) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCycle(cycle);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };

  const handleLeave = () => {
    setHoveredCycle(null);
    setTooltipPos(null);
  };

  useEffect(() => {
    if (cyclesProp !== undefined) return;
    fetch(`${API_BASE}/api/cycles?limit=50`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setFetchedCycles(data.cycles);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Heatmap fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, [cyclesProp]);

  const cells: (Cycle | undefined)[] = Array.from({ length: 50 }, (_, i) => cycles[i]);

  return (
    <div
      style={{
        marginTop: 24,
        borderTop: "1px solid #1C2128",
        paddingTop: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8B949E",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            HALLUCINATION HISTORY
          </span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#4B5563" }}>
            Each square = one decision cycle. Color shows hallucination risk score from the LLM Judge.
          </span>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#4B5563",
          }}
        >
          LAST 50 CYCLES
        </span>
      </div>

      {loading && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#4B5563",
          }}
        >
          LOADING HALLUCINATION DATA...
        </div>
      )}

      {error && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#EF4444",
          }}
        >
          FAILED TO LOAD
        </div>
      )}

      {hoveredCycle && tooltipPos && (() => {
        const score = hoveredCycle.judge_hallucination_risk;
        const { borderColor } = getSquareStyle(score);
        const finding = hoveredCycle.critical_finding || "No finding";
        return (
          <div
            style={{
              position: "fixed",
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translateX(-50%) translateY(-100%)",
              zIndex: 9999,
              background: "#161B22",
              border: "1px solid #30363D",
              borderRadius: 3,
              padding: "6px 8px",
              width: 320,
              whiteSpace: "normal",
              pointerEvents: "none",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
            }}
          >
            <div style={{ color: "#8B949E" }}>CYCLE #{hoveredCycle.cycle_number}</div>
            <div style={{ color: borderColor }}>
              HALLUCINATION: {score !== undefined ? `${score}/10` : "N/A"}
            </div>
            <div style={{ color: "#8B949E" }}>{finding}</div>
          </div>
        );
      })()}

      {!loading && !error && (
        <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(25, 1fr)",
            gap: 3,
            overflow: "visible",
          }}
        >
          {cells.map((cycle, i) => (
            <Square key={i} cycle={cycle} onEnter={handleEnter} onLeave={handleLeave} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {[
            { color: "#3FB950", label: "SAFE ≥7" },
            { color: "#C9A84C", label: "MODERATE ≥5" },
            { color: "#EF4444", label: "RISK <5" },
            { color: "#4B5563", label: "NO DATA" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color }}>{label}</span>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
