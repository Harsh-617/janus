"use client";

import { Fragment, useState } from "react";
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

type CycleWithExtra = DecisionCycle & {
  decisions?: Record<string, Record<string, unknown>>;
  trades_executed?: Array<Record<string, unknown>>;
};

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  trading_agent: "Trading Agent",
  risk_agent: "Risk Agent",
  fraud_agent: "Fraud Agent",
  regulator_agent: "Regulator Agent",
  judge_agent: "Judge Agent",
  llm_judge: "LLM Judge",
  meta_agent: "Meta Agent",
};

function formatAgentName(key: string): string {
  return (
    AGENT_DISPLAY_NAMES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getDecisionBadgeClass(decision: string): string {
  const upper = decision.toUpperCase();
  if (["EXECUTE", "APPROVE", "CLEAR"].includes(upper))
    return "bg-[#1a3a2a] text-[#52E0A0] border border-[#52E0A0]/30";
  if (["HALT", "VETO", "HIGH"].includes(upper))
    return "bg-[#3a1a1a] text-[#E05252] border border-[#E05252]/30";
  if (["HOLD", "MODIFY", "MEDIUM", "REBALANCE"].includes(upper))
    return "bg-[#3a2a1a] text-[#E0A052] border border-[#E0A052]/30";
  return "bg-[var(--janus-border)] text-[var(--janus-text-secondary)] border border-[var(--janus-border)]";
}

function extractDecisionText(data: Record<string, unknown>): string | null {
  for (const key of ["decision", "action", "alert_level", "final_decision", "status"]) {
    if (typeof data[key] === "string") return data[key] as string;
  }
  return null;
}

function extractRationale(data: Record<string, unknown>): string | null {
  for (const key of ["rationale", "reasoning", "explanation", "analysis", "summary", "thesis", "verdict", "reason", "critical_finding"]) {
    if (typeof data[key] === "string" && (data[key] as string).length > 0) return data[key] as string;
  }
  return null;
}

const PHOENIX_BASE_URL =
  process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006";

function sanitizeCriticalFinding(text: string): string {
  if (text.includes("429") || text.toLowerCase().includes("rate limit")) {
    return "Rate limit — Judge could not evaluate this cycle";
  }
  return text;
}

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
      { name: "Hallucination", score: 10 - cycle.judge_hallucination_risk },
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

  const renderReasoningChain = (cycle: CycleWithExtra) => {
    const decisions = cycle.decisions ?? null;
    const tradesExecuted = cycle.trades_executed ?? null;

    const cycleDate = new Date(cycle.timestamp);
    const reasoningAvailableSince = new Date("2026-05-24");
    const isOldCycle = cycleDate < reasoningAvailableSince;
    const allNoData =
      !decisions ||
      Object.keys(decisions).length === 0 ||
      Object.values(decisions).every(
        (d) => extractRationale(d as Record<string, unknown>) === null
      );
    const showOldCycleNote = isOldCycle && allNoData;

    const judgeDimensions = [
      { name: "Correctness", score: cycle.judge_correctness },
      { name: "Safety", score: cycle.judge_safety },
      { name: "Hallucination Risk", score: cycle.judge_hallucination_risk },
      { name: "Compliance", score: cycle.judge_compliance },
      { name: "Explainability", score: cycle.judge_explainability },
    ];

    return (
      <div
        className="space-y-5 rounded-b-lg"
        style={{
          background: "#13151A",
          borderLeft: "4px solid #C9A84C",
          padding: "20px",
        }}
      >
        {/* Heading */}
        <div className="text-sm font-semibold" style={{ color: "#C9A84C" }}>
          Reasoning Chain
        </div>

        {showOldCycleNote && (
          <p
            className="text-xs italic rounded px-3 py-2 border"
            style={{
              color: "var(--janus-text-muted)",
              borderColor: "var(--janus-border)",
            }}
          >
            Detailed reasoning available for cycles after 2026-05-24. Earlier cycles show summary only.
          </p>
        )}

        {/* Per-agent decision blocks */}
        <div className="space-y-3">
          {decisions && Object.keys(decisions).length > 0 ? (
            Object.entries(decisions).map(([agentKey, agentData]) => {
              const decisionText = extractDecisionText(agentData);
              const rationale = extractRationale(agentData);
              return (
                <div key={agentKey} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--janus-text-primary)]">
                      {formatAgentName(agentKey)}
                    </span>
                    {decisionText && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded font-mono",
                          getDecisionBadgeClass(decisionText)
                        )}
                      >
                        {decisionText}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-xs font-mono p-3 rounded"
                    style={{
                      background: "#0A0B0D",
                      color: "var(--janus-text-secondary)",
                    }}
                  >
                    {rationale ?? "No reasoning data"}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-[var(--janus-text-muted)] italic">
              No per-agent reasoning data available for this cycle.
            </p>
          )}
        </div>

        {/* Judge Evaluation */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[var(--janus-text-muted)] uppercase tracking-wide">
            Judge Evaluation
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-bold font-mono"
              style={{ color: "#C9A84C" }}
            >
              {cycle.judge_overall_score.toFixed(1)}
            </span>
            <span className="text-xs text-[var(--janus-text-muted)]">
              / 10 overall
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {judgeDimensions.map((dim) => {
              const colorScore =
                dim.name === "Hallucination Risk"
                  ? 10 - dim.score
                  : dim.score;
              return (
                <div key={dim.name} className="text-center">
                  <div
                    className="text-sm font-mono font-semibold"
                    style={{ color: getDimensionColor(colorScore) }}
                  >
                    {dim.score.toFixed(1)}
                  </div>
                  <div className="text-xs text-[var(--janus-text-muted)] mt-0.5 leading-tight">
                    {dim.name}
                  </div>
                </div>
              );
            })}
          </div>
          {cycle.critical_finding && (
            <p
              className="text-xs italic border-l-2 pl-3"
              style={{
                color: "var(--janus-text-secondary)",
                borderColor: "var(--janus-border)",
              }}
            >
              {sanitizeCriticalFinding(cycle.critical_finding)}
            </p>
          )}
          {cycle.recommended_constraint && (
            <div className="text-xs">
              <span className="text-[var(--janus-text-muted)] uppercase tracking-wide">
                Recommended Constraint:{" "}
              </span>
              <span className="text-[var(--janus-text-secondary)]">
                {cycle.recommended_constraint}
              </span>
            </div>
          )}
        </div>

        {/* Trades Executed */}
        {tradesExecuted && tradesExecuted.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--janus-text-muted)] uppercase tracking-wide">
              Trades Executed
            </div>
            <div className="space-y-1">
              {tradesExecuted.map((trade, i) => {
                const direction = trade.direction as string | undefined;
                const ticker = trade.ticker as string | undefined;
                const quantity = trade.quantity as number | undefined;
                const price =
                  trade.price != null
                    ? `$${Number(trade.price).toFixed(2)}`
                    : null;
                const totalValue =
                  trade.total_value != null
                    ? `$${Number(trade.total_value).toLocaleString()}`
                    : null;
                return (
                  <div
                    key={i}
                    className="text-xs font-mono text-[var(--janus-text-secondary)]"
                  >
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          direction === "BUY" ? "#52E0A0" : "#E05252",
                      }}
                    >
                      {direction ?? "TRADE"}
                    </span>{" "}
                    {quantity} {ticker}
                    {price && ` @ ${price}`}
                    {totalValue && ` — total ${totalValue}`}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phoenix trace link */}
        {cycle.phoenix_trace_id && (
          <div
            className="pt-2 border-t"
            style={{ borderColor: "var(--janus-border)" }}
          >
            <a
              href={PHOENIX_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline underline-offset-2 transition-opacity hover:opacity-80"
              style={{ color: "#C9A84C" }}
              onClick={(e) => e.stopPropagation()}
            >
              Open Phoenix →
            </a>
          </div>
        )}
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
              <th className="text-left text-xs text-[var(--janus-text-muted)] uppercase tracking-wide p-3">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCycles.map((cycle, index) => {
              const isExpanded = expandedRow === cycle.cycle_id;
              const isEven = index % 2 === 0;

              return (
                <Fragment key={cycle.cycle_id}>
                  <tr
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
                        Cycle #{cycle.cycle_number}
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
                        title={sanitizeCriticalFinding(cycle.critical_finding)}
                      >
                        {(() => {
                          const text = sanitizeCriticalFinding(cycle.critical_finding);
                          return text.length > 80 ? text.substring(0, 80) + "..." : text;
                        })()}
                      </span>
                    </td>
                    <td className="p-3">
                      {cycle.market_shock_active && (
                        <Flame className="h-4 w-4 text-[var(--janus-warning)]" />
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRow(isExpanded ? null : cycle.cycle_id);
                        }}
                        className="flex items-center text-[var(--janus-text-muted)] hover:text-[var(--janus-gold)] transition-colors"
                        aria-label={isExpanded ? "Collapse" : "View Details"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      className={cn(
                        "border-b border-[var(--janus-border)]",
                        isEven ? "bg-[var(--janus-background)]" : ""
                      )}
                    >
                      <td colSpan={10} className="px-4 pb-4">
                        {renderReasoningChain(cycle as CycleWithExtra)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
