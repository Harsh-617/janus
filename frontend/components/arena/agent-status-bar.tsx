"use client";

import { cn } from "@/lib/utils";
import { AGENT_DISPLAY_NAMES, AGENT_COLORS } from "@/lib/constants";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { ScoreBadge } from "@/components/shared/score-badge";
import type { AgentName, CycleCompleteEvent } from "@/lib/types";

interface AgentStatusBarProps {
  activeAgents: Record<AgentName, boolean>;
  lastCycle: CycleCompleteEvent["data"] | null;
  connected: boolean;
}

const AGENT_ORDER: AgentName[] = [
  "trading_agent",
  "risk_agent",
  "fraud_agent",
  "regulator_agent",
  "judge_agent",
];

export function AgentStatusBar({
  activeAgents,
  lastCycle,
  connected,
}: AgentStatusBarProps) {
  const getAgentStatus = (agent: AgentName): string => {
    if (activeAgents[agent]) {
      return "Analyzing...";
    }
    return "Idle";
  };

  const getAgentScore = (agent: AgentName): number | null => {
    if (!lastCycle) return null;
    
    // Map agent names to judge score fields
    const scoreMap: Record<string, number | undefined> = {
      judge_agent: lastCycle.judge_score,
    };
    
    return scoreMap[agent] ?? null;
  };

  return (
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide">
          Agent Status
        </h2>
        <LiveIndicator active={connected} label={connected ? "Connected" : "Disconnected"} />
      </div>

      <div className="grid grid-cols-5 gap-3">
        {AGENT_ORDER.map((agent) => {
          const isActive = activeAgents[agent];
          const status = getAgentStatus(agent);
          const score = getAgentScore(agent);
          const color = AGENT_COLORS[agent];

          return (
            <div
              key={agent}
              className={cn(
                "flex flex-col gap-2 p-3 rounded-md border transition-all",
                isActive
                  ? "border-[var(--janus-blue)] bg-[var(--janus-blue)]/10"
                  : "border-[var(--janus-border)] bg-[var(--janus-background)]"
              )}
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {isActive && (
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--janus-blue)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--janus-blue)]"></span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-[var(--janus-text-primary)] mb-1">
                  {AGENT_DISPLAY_NAMES[agent]}
                </div>
                <div
                  className={cn(
                    "text-xs",
                    isActive
                      ? "text-[var(--janus-blue)]"
                      : "text-[var(--janus-text-muted)]"
                  )}
                >
                  {status}
                </div>
              </div>

              {score !== null && (
                <div className="mt-1">
                  <ScoreBadge score={score} size="sm" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
