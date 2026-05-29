"use client";

import { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { fetchCycles, fetchCycleExplain } from "@/lib/api";
import type { DecisionCycle, CycleExplainResponse } from "@/lib/types";
import { StatusIndicator } from "@/components/shared/status-indicator";
import { ScoreBadge } from "@/components/shared/score-badge";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CycleWithExtra = DecisionCycle & {
  decisions?: Record<string, Record<string, unknown>>;
  trades_executed?: Array<Record<string, unknown>>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  trading_agent: "Trading Agent",
  risk_agent: "Risk Agent",
  fraud_agent: "Fraud Agent",
  regulator_agent: "Regulator Agent",
  judge_agent: "Judge Agent",
  llm_judge: "LLM Judge",
  meta_agent: "Meta Agent",
};

const PHOENIX_BASE_URL =
  process.env.NEXT_PUBLIC_PHOENIX_URL || "http://localhost:6006";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAgentName(key: string): string {
  return (
    AGENT_DISPLAY_NAMES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function getDecisionBadgeStyle(decision: string): React.CSSProperties {
  const upper = decision.toUpperCase();
  if (["EXECUTE", "APPROVE", "CLEAR"].includes(upper))
    return {
      background: "#0A1F0A",
      color: "#22C55E",
      border: "1px solid rgba(82,224,160,0.3)",
    };
  if (["HALT", "VETO", "HIGH"].includes(upper))
    return {
      background: "#1F0A0A",
      color: "#EF4444",
      border: "1px solid rgba(224,82,82,0.3)",
    };
  if (["HOLD", "MODIFY", "MEDIUM", "REBALANCE"].includes(upper))
    return {
      background: "#1A1500",
      color: "#F59E0B",
      border: "1px solid rgba(245,158,11,0.3)",
    };
  return {
    background: "#1C2128",
    color: "#8B949E",
    border: "1px solid #1C2128",
  };
}

function extractDecisionText(data: Record<string, unknown>): string | null {
  for (const key of [
    "decision",
    "action",
    "alert_level",
    "final_decision",
    "status",
  ]) {
    if (typeof data[key] === "string") return data[key] as string;
  }
  return null;
}

function extractRationale(data: Record<string, unknown>): string | null {
  for (const key of [
    "rationale",
    "reasoning",
    "explanation",
    "analysis",
    "summary",
    "thesis",
    "verdict",
    "reason",
    "critical_finding",
  ]) {
    if (typeof data[key] === "string" && (data[key] as string).length > 0)
      return data[key] as string;
  }
  return null;
}

function sanitizeCriticalFinding(text: string): string {
  if (text.includes("429") || text.toLowerCase().includes("rate limit")) {
    return "Rate limit — Judge could not evaluate this cycle";
  }
  return text;
}

function getDimensionColor(score: number): string {
  if (score >= 7) return "#22C55E";
  if (score >= 5) return "#C9A84C";
  return "#EF4444";
}

function getTimestamp(c: DecisionCycle): number {
  const t = (c as any).timestamp || (c as any).created_at;
  if (!t) return 0;
  if (typeof t === "string") return new Date(t).getTime();
  if (typeof t === "number") return t;
  if (t._seconds) return t._seconds * 1000;
  if (t.seconds) return t.seconds * 1000;
  return new Date(t).getTime();
}

function formatTimestamp(c: DecisionCycle): string {
  const ts = getTimestamp(c);
  if (!ts) return "—";
  return formatDistanceToNow(new Date(ts), { addSuffix: true });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RefreshButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? "#30363D" : "#1C2128"}`,
        color: hovered ? "#E2E8F0" : "#8B949E",
        background: "transparent",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "4px 10px",
        borderRadius: 3,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        transition: "border-color 0.1s, color 0.1s",
      }}
    >
      <RefreshCw style={{ width: 10, height: 10 }} />
      Refresh
    </button>
  );
}

function DimensionBars({ cycle }: { cycle: DecisionCycle }) {
  const dimensions = [
    { name: "Correctness", score: cycle.judge_correctness },
    { name: "Safety", score: cycle.judge_safety },
    { name: "Hallucination", score: 10 - cycle.judge_hallucination_risk },
    { name: "Compliance", score: cycle.judge_compliance },
    { name: "Explainability", score: cycle.judge_explainability },
  ];
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {dimensions.map((dim) => (
        <div
          key={dim.name}
          title={`${dim.name}: ${dim.score.toFixed(1)}`}
          style={{
            width: 24,
            height: 3,
            background: "#1C2128",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${(dim.score / 10) * 100}%`,
              background: getDimensionColor(dim.score),
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ReasoningChain({ cycle }: { cycle: CycleWithExtra }) {
  const decisions = cycle.decisions ?? null;
  const tradesExecuted = cycle.trades_executed ?? null;

  const cycleTs = getTimestamp(cycle);
  const cycleDate = cycleTs ? new Date(cycleTs) : new Date(0);
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
      style={{
        background: "#0D1117",
        borderLeft: "3px solid #C9A84C",
        padding: "12px 20px",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#C9A84C",
          marginBottom: 12,
        }}
      >
        Reasoning Chain
      </div>

      {showOldCycleNote && (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontStyle: "italic",
            color: "#8B949E",
            border: "1px solid #1C2128",
            borderRadius: 3,
            padding: "6px 10px",
            marginBottom: 12,
          }}
        >
          Detailed reasoning available for cycles after 2026-05-24. Earlier
          cycles show summary only.
        </p>
      )}

      {/* Per-agent blocks */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}
      >
        {decisions && Object.keys(decisions).length > 0 ? (
          Object.entries(decisions).map(([agentKey, agentData]) => {
            const decisionText = extractDecisionText(agentData);
            const rationale = extractRationale(agentData);
            return (
              <div key={agentKey}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: "#E2E8F0",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {formatAgentName(agentKey)}
                  </span>
                  {decisionText && (
                    <span
                      style={{
                        ...getDecisionBadgeStyle(decisionText),
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        padding: "1px 6px",
                        borderRadius: 3,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {decisionText}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: "#8B949E",
                    background: "#080A0C",
                    padding: "8px 12px",
                    borderRadius: 3,
                    border: "1px solid #1C2128",
                  }}
                >
                  {rationale ?? "No reasoning data"}
                </div>
              </div>
            );
          })
        ) : (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontStyle: "italic",
              color: "#8B949E",
            }}
          >
            No per-agent reasoning data available for this cycle.
          </p>
        )}
      </div>

      {/* Judge Evaluation */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#4B5563",
            marginBottom: 8,
          }}
        >
          Judge Evaluation
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: "#C9A84C",
            }}
          >
            {cycle.judge_overall_score.toFixed(1)}
          </span>
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              color: "#4B5563",
            }}
          >
            / 10 overall
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {judgeDimensions.map((dim) => {
            const colorScore =
              dim.name === "Hallucination Risk" ? 10 - dim.score : dim.score;
            return (
              <div key={dim.name} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 13,
                    fontWeight: 600,
                    color: getDimensionColor(colorScore),
                  }}
                >
                  {dim.score.toFixed(1)}
                </div>
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 10,
                    color: "#4B5563",
                    marginTop: 2,
                  }}
                >
                  {dim.name}
                </div>
              </div>
            );
          })}
        </div>
        {cycle.critical_finding && (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontStyle: "italic",
              color: "#8B949E",
              borderLeft: "2px solid #1C2128",
              paddingLeft: 10,
              marginBottom: 8,
            }}
          >
            {sanitizeCriticalFinding(cycle.critical_finding)}
          </p>
        )}
        {cycle.recommended_constraint && (
          <div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#4B5563",
              }}
            >
              Recommended Constraint:{" "}
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "#8B949E",
              }}
            >
              {cycle.recommended_constraint}
            </span>
          </div>
        )}
      </div>

      {/* Trades Executed */}
      {tradesExecuted && tradesExecuted.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#4B5563",
              marginBottom: 6,
            }}
          >
            Trades Executed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: "#8B949E",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: direction === "BUY" ? "#22C55E" : "#EF4444",
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
        <div style={{ borderTop: "1px solid #1C2128", paddingTop: 10 }}>
          <a
            href={`${PHOENIX_BASE_URL}/traces/${cycle.phoenix_trace_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#4CADCE",
              textDecoration: "none",
            }}
          >
            View in Phoenix →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Explain panel ────────────────────────────────────────────────────────────

function ExplainPanel({ data }: { data: CycleExplainResponse }) {
  const sections: { label: string; content: string }[] = [
    { label: "PROPOSAL", content: data.proposal_summary },
    { label: "RISK", content: data.risk_summary },
    { label: "FRAUD", content: data.fraud_summary },
    { label: "REGULATOR", content: data.regulator_summary },
    { label: "CONSTRAINTS", content: data.constraint_summary },
    { label: "JUDGE", content: data.judge_summary },
    { label: "OUTCOME", content: data.outcome },
  ];

  return (
    <div
      style={{
        background: "#0A0B0D",
        border: "1px solid #2A2D35",
        borderRadius: 4,
        padding: 16,
        marginTop: 12,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#C9A84C",
          marginBottom: 14,
        }}
      >
        {data.brief}
      </div>

      {sections.map(({ label, content }) => (
        <div key={label} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#C9A84C",
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontSize: 12,
              color: "#E8E6E0",
              lineHeight: 1.6,
            }}
          >
            {content || "N/A"}
          </div>
        </div>
      ))}

      <div
        style={{
          marginTop: 12,
          borderTop: "1px solid #2A2D35",
          paddingTop: 10,
        }}
      >
        <a
          href={data.phoenix_trace_url || PHOENIX_BASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#4CADCE",
            textDecoration: "none",
          }}
        >
          {data.phoenix_trace_url ? "VIEW TRACE IN PHOENIX →" : "OPEN PHOENIX →"}
        </a>
      </div>
    </div>
  );
}

// ─── Table headers ─────────────────────────────────────────────────────────────

const TABLE_COLS = [
  "CYCLE",
  "DECISION",
  "SCORE",
  "DIMENSIONS",
  "TRADES",
  "FRAUD",
  "LEARNING",
  "CRITICAL FINDING",
  "SHOCK",
  "DETAILS",
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [limit, setLimit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);
  const limitRef = useRef(limit);
  limitRef.current = limit;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<
    "ALL" | "EXECUTE" | "HOLD" | "HALT"
  >("ALL");
  const [showLearningOnly, setShowLearningOnly] = useState(false);
  const [cycleLimit, setCycleLimit] = useState<10 | 20 | 50 | 100>(50);

  // Table states
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"score" | "cycle" | "timestamp">(
    "timestamp"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Explain state per cycle
  const [explainState, setExplainState] = useState<
    Record<string, { loading: boolean; data: CycleExplainResponse | null; open: boolean }>
  >({});

  const handleExplain = async (cycleId: string) => {
    const current = explainState[cycleId];
    if (current?.open) {
      setExplainState((prev) => ({
        ...prev,
        [cycleId]: { ...prev[cycleId], open: false },
      }));
      return;
    }
    if (current?.data) {
      setExplainState((prev) => ({
        ...prev,
        [cycleId]: { ...prev[cycleId], open: true },
      }));
      return;
    }
    setExplainState((prev) => ({
      ...prev,
      [cycleId]: { loading: true, data: null, open: true },
    }));
    try {
      const data = await fetchCycleExplain(cycleId);
      setExplainState((prev) => ({
        ...prev,
        [cycleId]: { loading: false, data, open: true },
      }));
    } catch {
      setExplainState((prev) => ({
        ...prev,
        [cycleId]: { loading: false, data: null, open: false },
      }));
    }
  };

  const fetchData = async (newLimit?: number) => {
    try {
      if (newLimit) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const raw = await fetchCycles(newLimit ?? limitRef.current);
      const rawCycles = Array.isArray(raw) ? raw : (raw as any).cycles || [];
      const sorted = [...rawCycles].sort(
        (a, b) => getTimestamp(b) - getTimestamp(a)
      );
      setCycles(sorted);
      setFetchError(false);
      if (newLimit) setLimit(newLimit);
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
      setFetchError(true);
      setLoadingMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredCycles = useMemo(() => {
    if (!Array.isArray(cycles)) return [];
    return cycles.filter((cycle) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = cycle.cycle_id.toLowerCase().includes(query);
        const matchesFinding = cycle.critical_finding
          .toLowerCase()
          .includes(query);
        if (!matchesId && !matchesFinding) return false;
      }
      if (decisionFilter !== "ALL" && cycle.final_decision !== decisionFilter)
        return false;
      if (showLearningOnly && !cycle.learning_event) return false;
      return true;
    });
  }, [cycles, searchQuery, decisionFilter, showLearningOnly]);

  const sortedCycles = useMemo(() => {
    return [...filteredCycles].sort((a, b) => {
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
        default:
          aVal = getTimestamp(a);
          bVal = getTimestamp(b);
          break;
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [filteredCycles, sortField, sortDirection]);

  const handleSort = (field: "score" | "cycle" | "timestamp") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleLoadMore = () => {
    fetchData(limit + 50);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Page Header */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#4B5563",
            }}
          >
            Audit Log
          </div>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#8B949E",
              marginTop: 3,
            }}
          >
            Complete history of all decision cycles
          </div>
        </div>
        <div style={{ paddingTop: 2 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#4B5563",
            }}
          >
            Showing {filteredCycles.length} of {cycles.length} cycles
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: "1px solid #1C2128",
          background: "#0D1117",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search cycle ID or finding..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#4CADCE")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#1C2128")}
          style={{
            background: "#080A0C",
            border: "1px solid #1C2128",
            color: "#E2E8F0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            borderRadius: 3,
            padding: "5px 10px",
            width: 200,
            outline: "none",
          }}
        />

        <select
          value={decisionFilter}
          onChange={(e) =>
            setDecisionFilter(
              e.target.value as "ALL" | "EXECUTE" | "HOLD" | "HALT"
            )
          }
          style={{
            background: "#080A0C",
            border: "1px solid #1C2128",
            color: "#E2E8F0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            borderRadius: 3,
            padding: "5px 10px",
            width: 140,
            outline: "none",
            appearance: "none",
          }}
        >
          <option value="ALL">All Decisions</option>
          <option value="EXECUTE">EXECUTE</option>
          <option value="HOLD">HOLD</option>
          <option value="HALT">HALT</option>
        </select>

        <select
          value={cycleLimit}
          onChange={(e) => {
            const newLimit = Number(e.target.value) as 10 | 20 | 50 | 100;
            setCycleLimit(newLimit);
            setLimit(newLimit);
            fetchData(newLimit);
          }}
          style={{
            background: "#080A0C",
            border: "1px solid #1C2128",
            color: "#E2E8F0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            borderRadius: 3,
            padding: "5px 10px",
            width: 140,
            outline: "none",
            appearance: "none",
          }}
        >
          <option value={10}>10 cycles</option>
          <option value={20}>20 cycles</option>
          <option value={50}>50 cycles</option>
          <option value={100}>100 cycles</option>
        </select>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showLearningOnly}
            onChange={(e) => setShowLearningOnly(e.target.checked)}
            style={{ accentColor: "#C9A84C", cursor: "pointer" }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              color: "#8B949E",
            }}
          >
            Learning events only
          </span>
        </label>

        <RefreshButton onClick={() => fetchData()} />
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div
          style={{
            padding: "6px 20px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#EF4444",
          }}
        >
          FAILED TO LOAD — RETRYING...
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                background: "#0D1117",
                borderRadius: 3,
              }}
            />
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            color: "#4B5563",
          }}
        >
          No decision cycles yet. The system will start logging cycles once
          agents begin running.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "#0D1117",
                  borderBottom: "1px solid #1C2128",
                }}
              >
                {TABLE_COLS.map((col, i) => (
                  <th
                    key={col}
                    onClick={() => {
                      if (col === "SCORE") handleSort("score");
                      else if (col === "CYCLE") handleSort("cycle");
                    }}
                    style={{
                      padding:
                        i === 0
                          ? "6px 10px 6px 20px"
                          : i === TABLE_COLS.length - 1
                          ? "6px 20px 6px 10px"
                          : "6px 10px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#4B5563",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      cursor:
                        col === "SCORE" || col === "CYCLE"
                          ? "pointer"
                          : "default",
                      userSelect: "none",
                    }}
                  >
                    {col}
                    {col === "SCORE" &&
                      sortField === "score" &&
                      (sortDirection === "asc" ? " ↑" : " ↓")}
                    {col === "CYCLE" &&
                      sortField === "cycle" &&
                      (sortDirection === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCycles.map((cycle) => {
                const isExpanded = expandedRow === cycle.cycle_id;
                const hasShock = (cycle as any).market_shock_active;
                const fraudCount = cycle.fraud_alerts_count;

                return (
                  <Fragment key={cycle.cycle_id}>
                    <tr
                      style={{
                        borderBottom: "1px solid #111820",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : cycle.cycle_id)
                      }
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#0D1117")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {/* CYCLE */}
                      <td
                        style={{
                          padding: "10px 10px 10px 20px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            color: "#4CADCE",
                          }}
                        >
                          #{cycle.cycle_id.slice(-8)}
                        </div>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            color: "#4B5563",
                            marginTop: 2,
                          }}
                        >
                          {formatTimestamp(cycle)}
                        </div>
                      </td>

                      {/* DECISION */}
                      <td style={{ padding: "10px" }}>
                        <StatusIndicator status={cycle.final_decision} />
                      </td>

                      {/* SCORE */}
                      <td style={{ padding: "10px" }}>
                        <ScoreBadge score={cycle.judge_overall_score} size="sm" />
                      </td>

                      {/* DIMENSIONS */}
                      <td style={{ padding: "10px" }}>
                        <DimensionBars cycle={cycle} />
                      </td>

                      {/* TRADES */}
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            color: "#8B949E",
                          }}
                        >
                          {cycle.trades_executed_count}
                        </span>
                      </td>

                      {/* FRAUD */}
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            color: fraudCount > 0 ? "#EF4444" : "#4B5563",
                          }}
                        >
                          {fraudCount}
                        </span>
                      </td>

                      {/* LEARNING */}
                      <td style={{ padding: "10px" }}>
                        {cycle.learning_event ? (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                              color: "#C9A84C",
                            }}
                          >
                            ✓
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                              color: "#2D3748",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* CRITICAL FINDING */}
                      <td
                        style={{
                          padding: "10px",
                          maxWidth: 260,
                          overflow: "hidden",
                        }}
                      >
                        <span
                          title={sanitizeCriticalFinding(
                            cycle.critical_finding
                          )}
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                            color: "#8B949E",
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {sanitizeCriticalFinding(cycle.critical_finding)}
                        </span>
                      </td>

                      {/* SHOCK */}
                      <td style={{ padding: "10px", whiteSpace: "nowrap" }}>
                        {hasShock ? (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 9,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "#F59E0B",
                              background: "#1A1100",
                              border: "1px solid rgba(245,158,11,0.3)",
                              borderRadius: 3,
                              padding: "1px 6px",
                            }}
                          >
                            SHOCK
                          </span>
                        ) : (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12,
                              color: "#2D3748",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* DETAILS */}
                      <td
                        style={{
                          padding: "10px 20px 10px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(
                              isExpanded ? null : cycle.cycle_id
                            );
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            color: "#4B5563",
                            padding: 0,
                            display: "inline-block",
                            transform: isExpanded ? "rotate(180deg)" : "none",
                            transition: "transform 0.15s",
                          }}
                          aria-label={isExpanded ? "Collapse" : "View Details"}
                        >
                          ▼
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ borderBottom: "1px solid #1C2128" }}>
                        <td colSpan={10} style={{ padding: 0 }}>
                          <ReasoningChain cycle={cycle as CycleWithExtra} />
                          <div
                            style={{
                              background: "#0D1117",
                              borderLeft: "3px solid #C9A84C",
                              padding: "8px 20px 16px",
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExplain(cycle.cycle_id);
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "rgba(201,168,76,0.1)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "transparent")
                              }
                              style={{
                                border: "1px solid #C9A84C",
                                color: "#C9A84C",
                                background: "transparent",
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                padding: "4px 12px",
                                borderRadius: 3,
                                cursor: explainState[cycle.cycle_id]?.loading
                                  ? "default"
                                  : "pointer",
                              }}
                            >
                              {explainState[cycle.cycle_id]?.loading
                                ? "GENERATING..."
                                : explainState[cycle.cycle_id]?.open &&
                                  explainState[cycle.cycle_id]?.data
                                ? "CLOSE EXPLAIN"
                                : "EXPLAIN THIS CYCLE"}
                            </button>
                            {explainState[cycle.cycle_id]?.open &&
                              explainState[cycle.cycle_id]?.data && (
                                <ExplainPanel
                                  data={explainState[cycle.cycle_id].data!}
                                />
                              )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More */}
      {!loading && cycles.length > 0 && cycles.length >= limit && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "16px 20px",
          }}
        >
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              border: "1px solid #1C2128",
              color: "#8B949E",
              background: "transparent",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "6px 16px",
              borderRadius: 3,
              cursor: loadingMore ? "default" : "pointer",
              opacity: loadingMore ? 0.5 : 1,
            }}
          >
            {loadingMore ? "Loading..." : `Load More (showing ${limit})`}
          </button>
        </div>
      )}
    </div>
  );
}
