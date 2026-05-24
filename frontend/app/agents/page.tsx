"use client";

import { useState, useEffect } from "react";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { AgentCard } from "@/components/agents/agent-card";
import { LiveIndicator } from "@/components/shared/live-indicator";
import { Button } from "@/components/ui/button";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { fetchCycles, fetchJanusLoopStatus } from "@/lib/api";
import { API_BASE, AGENT_COLORS, AGENT_DISPLAY_NAMES } from "@/lib/constants";
import type {
  DecisionCycle,
  AgentName,
  BehavioralConstraint,
  DimensionScores,
  JanusLoopStatus,
} from "@/lib/types";
import { RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function formatLastAction(raw: string | undefined): string {
  if (!raw) return "No data yet";
  const trimmed = raw.trim();
  if (/^[A-Z_]+$/.test(trimmed)) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.action) return String(parsed.action);
    if (parsed.status) return String(parsed.status);
  } catch {
    const actionMatch = trimmed.match(/"action"\s*:\s*"([^"]+)"/);
    if (actionMatch) return actionMatch[1];
    const statusMatch = trimmed.match(/"status"\s*:\s*"([^"]+)"/);
    if (statusMatch) return statusMatch[1];
  }
  return "See audit log";
}

const AGENT_ORDER: AgentName[] = [
  "trading_agent",
  "risk_agent",
  "fraud_agent",
  "regulator_agent",
  "judge_agent",
];

export default function AgentsPage() {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [janusStatus, setJanusStatus] = useState<JanusLoopStatus | null>(null);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const { activeAgents, connected } = useAgentStream();

  const fetchAgentData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgentData(Array.isArray(data) ? data : data.agents || []);
      }
    } catch (error) {
      console.error("Failed to fetch /api/agents:", error);
    }
  };

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [cyclesData, statusData] = await Promise.all([
        fetchCycles(50),
        fetchJanusLoopStatus(),
        fetchAgentData(),
      ]);

      setCycles(Array.isArray(cyclesData) ? cyclesData : (cyclesData as any).cycles || []);
      setJanusStatus(statusData);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Failed to fetch agent data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchAgentData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const deriveAgentStats = (agentId: AgentName, agentDataParam: any[]) => {
    const agentApiData = agentDataParam.find((a) => a.agent_id === agentId);

    if (agentApiData) {
      const avgScore: number = agentApiData.avg_judge_score_last_20;
      const dimensionScores: DimensionScores = agentApiData.dimension_scores;
      const lastDecision: string = formatLastAction(agentApiData.last_decision);

      let stats: Record<string, string | number> = {};
      if (Array.isArray(cycles) && cycles.length > 0) {
        switch (agentId) {
          case "trading_agent":
            stats = {
              "Cycles": cycles.length,
              "Avg Score": avgScore.toFixed(1),
              "Learning Events": cycles.filter((c) => c.learning_event).length,
            };
            break;
          case "risk_agent":
            stats = {
              "Cycles": cycles.length,
              "Avg Safety": dimensionScores.safety.toFixed(1),
              "High Risk": cycles.filter((c) => c.judge_safety < 5).length,
            };
            break;
          case "fraud_agent": {
            const totalAlerts = cycles.reduce((sum, c) => sum + c.fraud_alerts_count, 0);
            stats = {
              "Total Alerts": totalAlerts,
              "Avg/Cycle": (totalAlerts / cycles.length).toFixed(1),
              "Critical": cycles.filter((c) => c.fraud_alerts_count > 2).length,
            };
            break;
          }
          case "regulator_agent":
            stats = {
              "EXECUTE": cycles.filter((c) => c.final_decision === "EXECUTE").length,
              "HOLD": cycles.filter((c) => c.final_decision === "HOLD").length,
              "HALT": cycles.filter((c) => c.final_decision === "HALT").length,
            };
            break;
          case "judge_agent":
            stats = {
              "Avg Score": avgScore.toFixed(1),
              "Learning Events": cycles.filter((c) => c.learning_event).length,
              "Low Scores": cycles.filter((c) => c.judge_overall_score < 6).length,
            };
            break;
        }
      }

      return { avgScore, dimensionScores, stats, lastDecision };
    }

    // Fall back to cycle-derived stats when no per-agent API data is available
    if (!Array.isArray(cycles) || cycles.length === 0) {
      return {
        avgScore: null,
        dimensionScores: null,
        stats: {},
        lastDecision: undefined,
      };
    }

    const avgScore =
      cycles.reduce((sum, c) => sum + c.judge_overall_score, 0) / cycles.length;

    const dimensionScores: DimensionScores = {
      correctness:
        cycles.reduce((sum, c) => sum + c.judge_correctness, 0) / cycles.length,
      safety:
        cycles.reduce((sum, c) => sum + c.judge_safety, 0) / cycles.length,
      hallucination_risk:
        cycles.reduce((sum, c) => sum + c.judge_hallucination_risk, 0) / cycles.length,
      compliance:
        cycles.reduce((sum, c) => sum + c.judge_compliance, 0) / cycles.length,
      explainability:
        cycles.reduce((sum, c) => sum + c.judge_explainability, 0) / cycles.length,
    };

    let stats: Record<string, string | number> = {};
    let lastDecision: string | undefined;

    switch (agentId) {
      case "trading_agent":
        stats = {
          "Cycles": cycles.length,
          "Avg Score": avgScore.toFixed(1),
          "Learning Events": cycles.filter((c) => c.learning_event).length,
        };
        lastDecision = "Proposed trades in last cycle";
        break;
      case "risk_agent":
        stats = {
          "Cycles": cycles.length,
          "Avg Safety": dimensionScores.safety.toFixed(1),
          "High Risk": cycles.filter((c) => c.judge_safety < 5).length,
        };
        lastDecision = "Risk assessment completed";
        break;
      case "fraud_agent": {
        const totalAlerts = cycles.reduce((sum, c) => sum + c.fraud_alerts_count, 0);
        stats = {
          "Total Alerts": totalAlerts,
          "Avg/Cycle": (totalAlerts / cycles.length).toFixed(1),
          "Critical": cycles.filter((c) => c.fraud_alerts_count > 2).length,
        };
        lastDecision = `${cycles[0]?.fraud_alerts_count || 0} alerts in last cycle`;
        break;
      }
      case "regulator_agent":
        stats = {
          "EXECUTE": cycles.filter((c) => c.final_decision === "EXECUTE").length,
          "HOLD": cycles.filter((c) => c.final_decision === "HOLD").length,
          "HALT": cycles.filter((c) => c.final_decision === "HALT").length,
        };
        lastDecision = `Last decision: ${cycles[0]?.final_decision || "N/A"}`;
        break;
      case "judge_agent":
        stats = {
          "Avg Score": avgScore.toFixed(1),
          "Learning Events": cycles.filter((c) => c.learning_event).length,
          "Low Scores": cycles.filter((c) => c.judge_overall_score < 6).length,
        };
        lastDecision = `Scored ${cycles[0]?.judge_overall_score.toFixed(1) || "N/A"} in last cycle`;
        break;
    }

    return { avgScore, dimensionScores, stats, lastDecision };
  };

  const getActiveConstraintsForAgent = (agentId: AgentName) => {
    if (!janusStatus) return [];
    return janusStatus.active_constraints.filter(
      (c) => c.target_agent === agentId && c.status === "ACTIVE"
    );
  };

  if (loading) {
    return (
      <LayoutWrapper>
        <div className="space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--janus-border)] rounded w-1/3"></div>
            <div className="h-4 bg-[var(--janus-border)] rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-96 bg-[var(--janus-surface)] rounded-lg"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-[var(--janus-text-primary)]">
              Agent Control Room
            </h1>
            <div className="flex items-center gap-4">
              <LiveIndicator active={connected} />
              <Button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                size="sm"
                variant="outline"
                className="border-[var(--janus-border)]"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-[var(--janus-text-muted)]">
            Real-time agent performance and behavioral constraints
          </p>
          <p className="text-xs text-[var(--janus-text-muted)] mt-2">
            Last refreshed: {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
          </p>
        </div>

        {/* Agent Cards Grid */}
        {cycles.length === 0 ? (
          <div className="flex items-center justify-center h-64 bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg">
            <div className="text-center">
              <p className="text-[var(--janus-text-muted)] mb-2">
                No cycle data available yet
              </p>
              <p className="text-xs text-[var(--janus-text-muted)]">
                Run a decision cycle to see agent performance metrics
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AGENT_ORDER.map((agentId) => {
              const { avgScore, dimensionScores, stats, lastDecision } =
                deriveAgentStats(agentId, agentData);
              const activeConstraints = getActiveConstraintsForAgent(agentId);

              return (
                <AgentCard
                  key={agentId}
                  agentId={agentId}
                  isThinking={activeAgents[agentId] || false}
                  avgScore={avgScore}
                  dimensionScores={dimensionScores}
                  activeConstraints={activeConstraints}
                  stats={stats}
                  lastDecision={lastDecision}
                />
              );
            })}
          </div>
        )}

        {/* Active Behavioral Constraints Table */}
        <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide mb-4">
            Active Behavioral Constraints
          </h2>

          {!janusStatus || janusStatus.active_constraints.length === 0 ? (
            <div className="text-center py-8 text-[var(--janus-text-muted)]">
              No active constraints. The Janus Loop will generate constraints
              after analyzing cycle patterns.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--janus-border)]">
                    <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide pb-3">
                      Target Agent
                    </th>
                    <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide pb-3">
                      Condition
                    </th>
                    <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide pb-3">
                      Rule
                    </th>
                    <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide pb-3">
                      Applied Cycles
                    </th>
                    <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide pb-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {janusStatus.active_constraints.map((constraint) => (
                    <tr
                      key={constraint.constraint_id}
                      className="border-b border-[var(--janus-border)] last:border-0"
                    >
                      <td className="py-3">
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded"
                          style={{
                            backgroundColor: constraint.target_agent
                              ? `${AGENT_COLORS[constraint.target_agent]}20`
                              : "rgba(128,128,128,0.12)",
                            color: constraint.target_agent
                              ? AGENT_COLORS[constraint.target_agent]
                              : "var(--janus-text-secondary)",
                          }}
                        >
                          {constraint.target_agent
                            ? AGENT_DISPLAY_NAMES[constraint.target_agent]
                            : "Unknown"}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-[var(--janus-text-secondary)]">
                        <span title={constraint.condition}>
                          {constraint.condition.length > 40
                            ? constraint.condition.substring(0, 40) + "..."
                            : constraint.condition}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-[var(--janus-text-secondary)]">
                        <span title={constraint.rule}>
                          {constraint.rule.length > 50
                            ? constraint.rule.substring(0, 50) + "..."
                            : constraint.rule}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-[var(--janus-text-secondary)] font-mono">
                        {constraint.performance_delta.cycles_active} /{" "}
                        {constraint.expires_after_cycles}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            constraint.status === "ACTIVE"
                              ? "bg-[var(--janus-success)]/20 text-[var(--janus-success)]"
                              : constraint.status === "EXPIRED"
                              ? "bg-[var(--janus-text-muted)]/20 text-[var(--janus-text-muted)]"
                              : "bg-[var(--janus-danger)]/20 text-[var(--janus-danger)]"
                          }`}
                        >
                          {constraint.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </LayoutWrapper>
  );
}
