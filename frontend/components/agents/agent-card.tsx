"use client";

import { cn } from "@/lib/utils";
import { AGENT_DISPLAY_NAMES, AGENT_COLORS } from "@/lib/constants";
import { ScoreBadge } from "@/components/shared/score-badge";
import { RadarChartComponent } from "./radar-chart";
import type { AgentName, BehavioralConstraint, DimensionScores } from "@/lib/types";
import { Activity } from "lucide-react";

interface AgentCardProps {
  agentId: AgentName;
  isThinking: boolean;
  avgScore: number | null;
  dimensionScores: DimensionScores | null;
  activeConstraints: BehavioralConstraint[];
  stats: Record<string, string | number>;
  lastDecision?: string;
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
  const agentColor = AGENT_COLORS[agentId];
  const agentName = AGENT_DISPLAY_NAMES[agentId];

  return (
    <div
      className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6 flex flex-col gap-4"
      style={{ borderLeftWidth: "4px", borderLeftColor: agentColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: agentColor }}
          />
          <h3 className="text-sm font-semibold text-[var(--janus-text-primary)]">
            {agentName}
          </h3>
        </div>
        {isThinking && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--janus-blue)]/20 border border-[var(--janus-blue)]/30">
            <Activity className="h-3 w-3 text-[var(--janus-blue)] animate-pulse" />
            <span className="text-xs font-semibold text-[var(--janus-blue)] uppercase">
              Thinking
            </span>
          </div>
        )}
      </div>

      {/* Overall Score */}
      <div>
        <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-2">
          Overall Score
        </div>
        {avgScore !== null ? (
          <ScoreBadge score={avgScore} size="lg" />
        ) : (
          <span className="text-sm text-[var(--janus-text-muted)]">
            No data yet
          </span>
        )}
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center">
        <RadarChartComponent scores={dimensionScores} agentColor={agentColor} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(stats).map(([key, value]) => (
          <div
            key={key}
            className="p-2 rounded bg-[var(--janus-background)] border border-[var(--janus-border)]"
          >
            <div className="text-xs text-[var(--janus-text-muted)] mb-1">
              {key}
            </div>
            <div className="text-sm font-semibold text-[var(--janus-text-primary)] font-mono">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Active Constraints */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide">
            Active Constraints
          </span>
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded",
              activeConstraints.length > 0
                ? "bg-[var(--janus-gold)]/20 text-[var(--janus-gold)]"
                : "bg-[var(--janus-border)] text-[var(--janus-text-muted)]"
            )}
          >
            {activeConstraints.length}
          </span>
        </div>
        {activeConstraints.length > 0 && (
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {activeConstraints.map((constraint) => (
              <div
                key={constraint.constraint_id}
                className="text-xs text-[var(--janus-text-secondary)] p-2 rounded bg-[var(--janus-background)] border border-[var(--janus-border)]"
                title={constraint.rule}
              >
                {constraint.rule.length > 60
                  ? constraint.rule.substring(0, 60) + "..."
                  : constraint.rule}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last Decision */}
      {lastDecision && (
        <div>
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-2">
            Last Action
          </div>
          <div className="text-xs text-[var(--janus-text-secondary)]">
            {lastDecision.length > 80
              ? lastDecision.substring(0, 80) + "..."
              : lastDecision}
          </div>
        </div>
      )}
    </div>
  );
}
