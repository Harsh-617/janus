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
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide">
          Agent Status
        </h2>
        <LiveIndicator active={connected} label={connected ? "Connected" : "Disconnected"} />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {AGENT_ORDER.map((agent) => {
          const isActive = activeAgents[agent];
          const status = getAgentStatus(agent);
          const score = getAgentScore(agent);
          const color = AGENT_COLORS[agent];

          return (
            <div
              key={agent}
              className={cn(
                "flex items-center gap-2 py-2 px-3 rounded-md border transition-all",
                isActive
                  ? "border-[var(--janus-blue)] bg-[var(--janus-blue)]/10"
                  : "border-[var(--janus-border)] bg-[var(--janus-background)]"
              )}
            >
              <div className="flex-shrink-0 relative">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--janus-blue)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--janus-blue)]"></span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--janus-text-primary)] truncate">
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

              {score !== null && <ScoreBadge score={score} size="sm" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
