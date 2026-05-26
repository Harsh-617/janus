"use client";

import { useState, useEffect } from "react";
import { AgentCard } from "@/components/agents/agent-card";
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
  const { activeAgents } = useAgentStream();

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
              "Learning": cycles.filter((c) => c.learning_event).length,
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
              "Execute": cycles.filter((c) => c.final_decision === "EXECUTE").length,
              "Hold": cycles.filter((c) => c.final_decision === "HOLD").length,
              "Halt": cycles.filter((c) => c.final_decision === "HALT").length,
            };
            break;
          case "judge_agent":
            stats = {
              "Avg Score": avgScore.toFixed(1),
              "Learning": cycles.filter((c) => c.learning_event).length,
              "Low Scores": cycles.filter((c) => c.judge_overall_score < 6).length,
            };
            break;
        }
      }

      return { avgScore, dimensionScores, stats, lastDecision };
    }

    if (!Array.isArray(cycles) || cycles.length === 0) {
      return { avgScore: null, dimensionScores: null, stats: {}, lastDecision: undefined };
    }

    const avgScore =
      cycles.reduce((sum, c) => sum + c.judge_overall_score, 0) / cycles.length;

    const dimensionScores: DimensionScores = {
      correctness: cycles.reduce((sum, c) => sum + c.judge_correctness, 0) / cycles.length,
      safety: cycles.reduce((sum, c) => sum + c.judge_safety, 0) / cycles.length,
      hallucination_risk:
        cycles.reduce((sum, c) => sum + c.judge_hallucination_risk, 0) / cycles.length,
      compliance: cycles.reduce((sum, c) => sum + c.judge_compliance, 0) / cycles.length,
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
          "Learning": cycles.filter((c) => c.learning_event).length,
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
          "Execute": cycles.filter((c) => c.final_decision === "EXECUTE").length,
          "Hold": cycles.filter((c) => c.final_decision === "HOLD").length,
          "Halt": cycles.filter((c) => c.final_decision === "HALT").length,
        };
        lastDecision = `Last decision: ${cycles[0]?.final_decision || "N/A"}`;
        break;
      case "judge_agent":
        stats = {
          "Avg Score": avgScore.toFixed(1),
          "Learning": cycles.filter((c) => c.learning_event).length,
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "#1C2128",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{ height: 480, background: "#0D1117" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Page Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#4B5563",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 4,
            }}
          >
            AGENT CONTROL ROOM
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#8B949E",
            }}
          >
            Real-time agent performance and behavioral constraints
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#4B5563",
            }}
          >
            {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
          </span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              background: "transparent",
              border: "none",
              cursor: refreshing ? "default" : "pointer",
              fontSize: 12,
              color: "#4B5563",
              padding: "2px 4px",
              lineHeight: 1,
              opacity: refreshing ? 0.4 : 1,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!refreshing) e.currentTarget.style.color = "#E2E8F0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#4B5563";
            }}
            aria-label="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1,
          background: "#1C2128",
        }}
      >
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

      {/* Active Behavioral Constraints Table */}
      {janusStatus && janusStatus.active_constraints.length > 0 && (
        <div
          style={{
            margin: "1px 0 0",
            background: "#0D1117",
            border: "1px solid #1C2128",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #1C2128",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#4B5563",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            ALL BEHAVIORAL CONSTRAINTS
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1C2128" }}>
                  {["Target Agent", "Condition", "Rule", "Applied Cycles", "Status"].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          textAlign: "left",
                          padding: "8px 14px",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 9,
                          color: "#4B5563",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          fontWeight: 400,
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {janusStatus.active_constraints.map((constraint) => {
                  const ta = constraint.target_agent;
                  const color = ta && AGENT_COLORS[ta] ? AGENT_COLORS[ta] : "#8B949E";
                  const name = ta
                    ? AGENT_DISPLAY_NAMES[ta] ??
                      ta.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
                    : "Unknown";

                  return (
                    <tr
                      key={constraint.constraint_id}
                      style={{ borderBottom: "1px solid #1C2128" }}
                    >
                      <td style={{ padding: "8px 14px" }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            fontWeight: 600,
                            color,
                            background: `${color}18`,
                            borderRadius: 3,
                            padding: "2px 6px",
                          }}
                        >
                          {name}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 11,
                          color: "#8B949E",
                          maxWidth: 200,
                        }}
                      >
                        <span title={constraint.condition}>
                          {constraint.condition.length > 40
                            ? constraint.condition.substring(0, 40) + "…"
                            : constraint.condition}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 11,
                          color: "#8B949E",
                          maxWidth: 260,
                        }}
                      >
                        <span title={constraint.rule}>
                          {constraint.rule.length > 50
                            ? constraint.rule.substring(0, 50) + "…"
                            : constraint.rule}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 14px",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          color: "#8B949E",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {constraint.performance_delta.cycles_active} /{" "}
                        {constraint.expires_after_cycles}
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            fontWeight: 600,
                            borderRadius: 3,
                            padding: "2px 6px",
                            ...(constraint.status === "ACTIVE"
                              ? { background: "#22C55E18", color: "#22C55E" }
                              : constraint.status === "EXPIRED"
                              ? { background: "#4B556318", color: "#4B5563" }
                              : { background: "#EF444418", color: "#EF4444" }),
                          }}
                        >
                          {constraint.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
