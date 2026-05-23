"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "@/components/shared/status-indicator";
import { ScoreBadge } from "@/components/shared/score-badge";
import type { DecisionCycle } from "@/lib/types";
import { ChevronDown, ChevronUp, Check, Minus, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AuditTableProps {
  cycles: DecisionCycle[];
  loading: boolean;
}

type SortField = "score" | "cycle" | "timestamp";
type SortDirection = "asc" | "desc";

export function AuditTable({ cycles, loading }: AuditTableProps) {
  const [sortField, setSortField] = useState<SortField>("cycle");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedCycles = [...cycles].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortField) {
      case "score":
        aVal = a.judge_overall_score;
        bVal = b.judge_overall_score;
        break;
      case "cycle":
        aVal = a.cycle_number;
        bVal = b.cycle_number;
        break;
      case "timestamp":
        aVal = new Date(a.timestamp).getTime();
        bVal = new Date(b.timestamp).getTime();
        break;
      default:
        return 0;
    }

    return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
  });

  const getDimensionColor = (score: number) => {
    if (score >= 6) return "#52E0A0";
    if (score >= 4) return "#E0A052";
    return "#E05252";
  };

  const renderDimensionBars = (cycle: DecisionCycle) => {
    const dimensions = [
      { name: "Correctness", score: cycle.judge_correctness },
      { name: "Safety", score: cycle.judge_safety },
      {
        name: "Hallucination",
        score: 10 - cycle.judge_hallucination_risk,
      },
      { name: "Compliance", score: cycle.judge_compliance },
      { name: "Explainability", score: cycle.judge_explainability },
    ];

    return (
      <div className="flex gap-1">
        {dimensions.map((dim) => (
          <div
            key={dim.name}
            className="relative group"
            title={`${dim.name}: ${dim.score.toFixed(1)}`}
          >
            <div className="w-10 h-1 bg-[var(--janus-border)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(dim.score / 10) * 100}%`,
                  backgroundColor: getDimensionColor(dim.score),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg overflow-hidden">
        <div className="animate-pulse space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-12 bg-[var(--janus-border)] rounded"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-12 text-center">
        <p className="text-[var(--janus-text-muted)]">
          No decision cycles yet. The system will start logging cycles once
          agents begin running.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--janus-surface)] border-b border-[var(--janus-border)]">
            <tr>
              <th
                className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3 cursor-pointer hover:text-[var(--janus-text-primary)]"
                onClick={() => handleSort("cycle")}
              >
                <div className="flex items-center gap-1">
                  Cycle
                  {sortField === "cycle" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Decision
              </th>
              <th
                className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3 cursor-pointer hover:text-[var(--janus-text-primary)]"
                onClick={() => handleSort("score")}
              >
                <div className="flex items-center gap-1">
                  Score
                  {sortField === "score" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </div>
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Dimensions
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Trades
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Fraud
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Learning
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Critical Finding
              </th>
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Shock
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCycles.map((cycle, index) => {
              const isExpanded = expandedRow === cycle.cycle_id;
              const isEven = index % 2 === 0;

              return (
                <>
                  <tr
                    key={cycle.cycle_id}
                    className={cn(
                      "border-b border-[var(--janus-border)] cursor-pointer hover:bg-[var(--janus-border)]/50 transition-colors",
                      isEven ? "bg-[var(--janus-background)]" : ""
                    )}
                    onClick={() =>
                      setExpandedRow(isExpanded ? null : cycle.cycle_id)
                    }
                  >
                    <td className="p-3">
                      <div className="text-xs font-mono text-[var(--janus-text-primary)]">
                        {cycle.cycle_id.substring(0, 8)}...
                      </div>
                      <div className="text-xs text-[var(--janus-text-muted)]">
                        {formatDistanceToNow(new Date(cycle.timestamp), {
                          addSuffix: true,
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <StatusIndicator status={cycle.final_decision} />
                    </td>
                    <td className="p-3">
                      <ScoreBadge score={cycle.judge_overall_score} size="sm" />
                    </td>
                    <td className="p-3">{renderDimensionBars(cycle)}</td>
                    <td className="p-3">
                      <span className="text-sm font-mono text-[var(--janus-text-primary)]">
                        {cycle.trades_executed_count}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "text-sm font-mono",
                          cycle.fraud_alerts_count > 0
                            ? "text-[var(--janus-warning)]"
                            : "text-[var(--janus-text-muted)]"
                        )}
                      >
                        {cycle.fraud_alerts_count}
                      </span>
                    </td>
                    <td className="p-3">
                      {cycle.learning_event ? (
                        <Check className="h-4 w-4 text-[var(--janus-success)]" />
                      ) : (
                        <Minus className="h-4 w-4 text-[var(--janus-text-muted)]" />
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className="text-xs text-[var(--janus-text-secondary)]"
                        title={cycle.critical_finding}
                      >
                        {cycle.critical_finding.length > 80
                          ? cycle.critical_finding.substring(0, 80) + "..."
                          : cycle.critical_finding}
                      </span>
                    </td>
                    <td className="p-3">
                      {cycle.market_shock_active && (
                        <Flame className="h-4 w-4 text-[var(--janus-warning)]" />
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      className={cn(
                        "border-b border-[var(--janus-border)]",
                        isEven ? "bg-[var(--janus-background)]" : ""
                      )}
                    >
                      <td colSpan={9} className="p-4">
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="text-[var(--janus-text-muted)] uppercase text-xs tracking-wide">
                              Full Critical Finding:
                            </span>
                            <p className="text-[var(--janus-text-secondary)] mt-1">
                              {cycle.critical_finding}
                            </p>
                          </div>
                          {cycle.recommended_constraint && (
                            <div>
                              <span className="text-[var(--janus-text-muted)] uppercase text-xs tracking-wide">
                                Recommended Constraint:
                              </span>
                              <p className="text-[var(--janus-text-secondary)] mt-1">
                                {cycle.recommended_constraint}
                              </p>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-4 pt-2">
                            <div>
                              <span className="text-[var(--janus-text-muted)] text-xs">
                                Circuit Breaker:
                              </span>
                              <p className="text-[var(--janus-text-primary)] font-mono">
                                {cycle.circuit_breaker_activated ? "Yes" : "No"}
                              </p>
                            </div>
                            <div>
                              <span className="text-[var(--janus-text-muted)] text-xs">
                                Phoenix Trace:
                              </span>
                              <p className="text-[var(--janus-blue)] font-mono text-xs">
                                {cycle.phoenix_trace_id.substring(0, 16)}...
                              </p>
                            </div>
                            <div>
                              <span className="text-[var(--janus-text-muted)] text-xs">
                                Cycle Number:
                              </span>
                              <p className="text-[var(--janus-text-primary)] font-mono">
                                {cycle.cycle_number}
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
