"use client";

import { useEffect, useRef, useState } from "react";
import { fetchConstraints } from "@/lib/api";
import type { BehavioralConstraint, ConstraintConflict } from "@/lib/types";
import ImprovementCurveChart from "@/components/janus-loop/improvement-curve-chart";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LoopStatus {
  active_constraints: Constraint[];
  constraint_count: number;
  recent_cycles_analyzed: number;
  learning_events_count: number;
  avg_judge_score: number;
  last_run_at?: string | null;
}

const AGENT_PALETTE: Record<string, { bg: string; color: string; border: string }> = {
  trading_agent:   { bg: "#0A1A2A", color: "#60A5FA", border: "#1E3A5F" },
  risk_agent:      { bg: "#2A0A0A", color: "#F87171", border: "#5F1F1F" },
  fraud_agent:     { bg: "#1A0A2A", color: "#A78BFA", border: "#3A1F5F" },
  regulator_agent: { bg: "#0A2A2A", color: "#22D3EE", border: "#1F5F5F" },
  judge_agent:     { bg: "#2A2A0A", color: "#FBBF24", border: "#5F5F1F" },
  meta_agent:      { bg: "#0A2A1A", color: "#34D399", border: "#1F5F3A" },
};

function agentColors(name: string) {
  return AGENT_PALETTE[name] ?? { bg: "#1A1A2A", color: "#9CA3AF", border: "#2A2A3A" };
}

function formatAgentName(raw: string): string {
  return raw.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 8.0) return "#22C55E";
  if (score >= 6.0) return "#F59E0B";
  return "#EF4444";
}

const STAGES = ["Query Phoenix", "Detect Patterns", "Generate Constraints", "Inject into Agents"];

const MONO = "'JetBrains Mono', 'Fira Mono', monospace";

function StepNode({ label, index, isActive }: { label: string; index: number; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          padding: "10px 20px",
          border: `1px solid ${isActive || hovered ? "#C9A84C" : "#1C2128"}`,
          borderRadius: 4,
          background: "#080A0C",
          boxShadow: isActive ? "0 0 8px rgba(201, 168, 76, 0.3)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 9, color: "#2D3748", textTransform: "uppercase" }}>
          {String(index + 1).padStart(2, "0")}
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 500,
            color: hovered ? "#E2E8F0" : "#8B949E",
            transition: "color 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export default function JanusLoopPage() {
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [constraints, setConstraints] = useState<BehavioralConstraint[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderForm, setBuilderForm] = useState({ target_agent: "", condition: "", rule: "", rationale: "" });
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderSuccess, setBuilderSuccess] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ is_valid: boolean; reason: string; suggestions: Array<{ condition: string; rule: string; rationale: string }> } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [conflicts, setConflicts] = useState<ConstraintConflict[]>([]);

  const triggerBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchStatus(): Promise<LoopStatus> {
    const res = await fetch(`${BASE_URL}/api/janus-loop/status`);
    if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
    return res.json();
  }

  async function fetchConflicts(): Promise<ConstraintConflict[]> {
    const res = await fetch(`${BASE_URL}/api/constraints/conflicts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.conflicts ?? [];
  }

  async function fetchAll() {
    const [s, items, cf] = await Promise.all([fetchStatus(), fetchConstraints(), fetchConflicts()]);
    setStatus(s);
    setConstraints(items.filter((c) => c.status?.toUpperCase() === "ACTIVE"));
    setConflicts(cf);
  }

  async function handleResolveConflict(
    conflictId: string,
    action: "ACCEPT_RECOMMENDATION" | "SUSPEND_A" | "SUSPEND_B" | "SUSPEND_BOTH" | "DISMISS"
  ) {
    try {
      const res = await fetch(`${BASE_URL}/api/constraints/conflicts/${conflictId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) return;
      setConflicts((prev) => prev.filter((c) => c.conflict_id !== conflictId));
    } catch {
      // silent
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchAll();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    const poll = setInterval(async () => {
      try {
        const s = await fetchStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // silent — don't disrupt the UI on poll failure
      }
    }, 10_000);
    const constraintsPoll = setInterval(async () => {
      try {
        const items = await fetchConstraints();
        if (!cancelled) setConstraints(items.filter((c) => c.status?.toUpperCase() === "ACTIVE"));
      } catch {
        // silent
      }
    }, 30_000);
    const conflictPoll = setInterval(async () => {
      try {
        const cf = await fetchConflicts();
        if (!cancelled) setConflicts(cf);
      } catch {
        // silent
      }
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(constraintsPoll);
      clearInterval(conflictPoll);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  async function handleValidateAndInject() {
    if (!builderForm.condition || !builderForm.rule || !builderForm.rationale) {
      setBuilderError("All fields are required.");
      return;
    }
    setIsValidating(true);
    setValidationResult(null);
    setBuilderError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/constraints/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(builderForm),
      });
      const result = await res.json();
      setValidationResult(result);
      if (result.is_valid) {
        await handleInjectConstraint();
      }
    } catch (e) {
      console.error(e);
      setBuilderError("Something went wrong. Please try again.");
    }
    setIsValidating(false);
  }

  async function handleInjectConstraint() {
    setBuilderLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...builderForm,
          target_agent: builderForm.target_agent || "trading_agent",
        }),
      });
      if (!res.ok) throw new Error(`POST /api/constraints failed: ${res.status}`);
      setBuilderSuccess(true);
      setBuilderForm({ target_agent: "", condition: "", rule: "", rationale: "" });
      await fetchAll();
      successTimerRef.current = setTimeout(() => setBuilderSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      setBuilderError("Something went wrong. Please try again.");
    }
    setBuilderLoading(false);
  }

  async function handleTrigger() {
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerMessage("Janus Loop triggered — analyzing telemetry and generating constraints...");
    try {
      await fetch(`${BASE_URL}/api/janus-loop/trigger`, { method: "POST" });
    } catch {
      // continue regardless — refetch will reveal any changes
    }
    await new Promise((r) => setTimeout(r, 2_000));
    try {
      await fetchAll();
    } catch {
      // ignore
    }
    setIsTriggering(false);
    if (triggerBannerTimerRef.current) clearTimeout(triggerBannerTimerRef.current);
    triggerBannerTimerRef.current = setTimeout(() => setTriggerMessage(null), 8_000);
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080A0C" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "#4B5563", letterSpacing: "0.1em" }}>
          LOADING JANUS LOOP...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#080A0C" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "#EF4444" }}>{error}</span>
      </div>
    );
  }

  const avgScore = status?.avg_judge_score ?? 0;
  const experiments = constraints.filter(
    (c) =>
      typeof c.performance_delta?.safety_after === "number" &&
      typeof c.performance_delta?.safety_before === "number"
  );
  const loopHistory = status?.last_run_at
    ? [{ time: status.last_run_at, count: status.constraint_count ?? 0 }]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#080A0C", color: "#E2E8F0" }}>
      <style>{`
        @keyframes pulseDot {
          0%   { transform: translateX(0); }
          100% { transform: translateX(54px); }
        }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1C2128", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#C9A84C", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            JANUS LOOP
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#8B949E", marginTop: 2 }}>
            Self-Correction Engine — The Backward Face
          </div>
        </div>
        <button
          onClick={handleTrigger}
          disabled={isTriggering}
          style={{
            border: "1px solid #C9A84C",
            color: "#C9A84C",
            background: "transparent",
            fontFamily: MONO,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "6px 16px",
            borderRadius: 3,
            cursor: isTriggering ? "not-allowed" : "pointer",
            opacity: isTriggering ? 0.6 : 1,
          }}
          onMouseEnter={(e) => { if (!isTriggering) (e.currentTarget as HTMLButtonElement).style.background = "#130F00"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          {isTriggering ? "RUNNING..." : "Trigger Janus Loop"}
        </button>
      </div>

      {/* ── TRIGGER BANNER ── */}
      {triggerMessage && (
        <div style={{ padding: "7px 20px", background: "#130F00", borderBottom: "1px solid #C9A84C", flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#C9A84C" }}>{triggerMessage}</span>
        </div>
      )}

      {/* ── STATS BAR ── */}
      <div style={{ display: "flex", height: 56, borderBottom: "1px solid #1C2128", flexShrink: 0 }}>
        <div style={{ flex: 1, borderRight: "1px solid #1C2128", padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>ANALYSIS WINDOW</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 600, color: "#E2E8F0", marginTop: 2 }}>
            Last {status?.recent_cycles_analyzed ?? 20}
          </div>
        </div>
        <div style={{ flex: 1, borderRight: "1px solid #1C2128", padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>ACTIVE CONSTRAINTS</div>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: "#C9A84C", marginTop: 2 }}>
            {status?.constraint_count ?? 0}
          </div>
        </div>
        <div style={{ flex: 1, borderRight: "1px solid #1C2128", padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>AVG JUDGE SCORE</div>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: scoreColor(avgScore), marginTop: 2 }}>
            {avgScore.toFixed(1)}
          </div>
        </div>
        <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>LEARNING EVENTS</div>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: "#EF4444", marginTop: 2 }}>
            {status?.learning_events_count ?? 0}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", marginTop: 1 }}>cycles scoring below 6.0</div>
        </div>
      </div>

      {/* ── IMPROVEMENT CURVE CHART ── */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <ImprovementCurveChart />
      </div>

      {/* ── LOOP STATUS ROW ── */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1C2128", background: "#0D1117", display: "flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ position: "absolute", left: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase" }}>Last run</span>
          {" "}
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#8B949E" }}>
            {status?.last_run_at ? timeAgo(status.last_run_at) : "Never"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, flex: 1 }}>
          {STAGES.map((stage, i) => (
            <div key={stage} style={{ display: "flex", alignItems: "center" }}>
              <StepNode label={stage} index={i} isActive={isTriggering} />
              {i < STAGES.length - 1 && (
                <div style={{ width: 60, display: "flex", alignItems: "center", position: "relative" }}>
                  <div style={{ height: 1, flex: 1, background: "#1C2128" }} />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: isTriggering ? "#22C55E" : "#C9A84C",
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      marginTop: -3,
                      animationName: "pulseDot",
                      animationDuration: "1.5s",
                      animationTimingFunction: "ease-in-out",
                      animationDelay: `${i * 0.5}s`,
                      animationIterationCount: "infinite",
                    }}
                  />
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#C9A84C" }}>{">"}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── CONSTRAINT CONFLICTS ── */}
      {conflicts.length > 0 && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1C2128", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Cinzel', 'Trajan Pro', serif", fontSize: 11, color: "#C9A84C", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
            CONSTRAINT CONFLICTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {conflicts.map((conflict) => {
              const isHigh = conflict.severity === "HIGH";
              return (
                <div
                  key={conflict.conflict_id}
                  style={{
                    background: isHigh ? "#1F0A0A" : "#13151A",
                    border: `1px solid ${isHigh ? "rgba(224,82,82,0.4)" : "rgba(201,168,76,0.4)"}`,
                    borderRadius: 4,
                    padding: 16,
                  }}
                >
                  {/* Row 1: severity badge + conflict type */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, borderRadius: 3, padding: "2px 7px",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      ...(isHigh
                        ? { background: "#3A0A0A", color: "#EF4444", border: "1px solid rgba(239,68,68,0.5)" }
                        : conflict.severity === "MEDIUM"
                          ? { background: "#1F1800", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.5)" }
                          : { background: "#1A1A1A", color: "#6B7280", border: "1px solid #2A2A2A" }
                      ),
                    }}>
                      {conflict.severity}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {conflict.conflict_type.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#C9D1D9", marginBottom: 10, lineHeight: 1.5 }}>
                    {conflict.description}
                  </div>

                  {/* Constraint pills */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <div style={{ background: "#080A0C", border: "1px solid #1C2128", borderRadius: 3, padding: "5px 10px", flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: "#4B5563", textTransform: "uppercase", marginBottom: 2 }}>
                        #{conflict.constraint_a_id.slice(-8)}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conflict.constraint_a_rule || "—"}
                      </div>
                    </div>
                    <div style={{ background: "#080A0C", border: "1px solid #1C2128", borderRadius: 3, padding: "5px 10px", flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: "#4B5563", textTransform: "uppercase", marginBottom: 2 }}>
                        #{conflict.constraint_b_id.slice(-8)}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conflict.constraint_b_rule || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation box */}
                  {conflict.resolution && (
                    <div style={{ background: "#0D1117", border: "1px solid #1C2128", borderRadius: 3, padding: "8px 12px", marginBottom: 10 }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", marginBottom: 4 }}>
                        RECOMMENDATION: {conflict.resolution.recommendation}
                      </div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#8B949E", lineHeight: 1.5 }}>
                        {conflict.resolution.reasoning}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleResolveConflict(conflict.conflict_id, "ACCEPT_RECOMMENDATION")}
                      style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", padding: "5px 12px", borderRadius: 3, border: "1px solid #1A4A1A", background: "#0A1F0A", color: "#22C55E", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0F2F0F"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0A1F0A"; }}
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => handleResolveConflict(conflict.conflict_id, "SUSPEND_BOTH")}
                      style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", padding: "5px 12px", borderRadius: 3, border: "1px solid rgba(239,68,68,0.4)", background: "#1F0A0A", color: "#EF4444", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2F0F0F"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1F0A0A"; }}
                    >
                      SUSPEND BOTH
                    </button>
                    <button
                      onClick={() => handleResolveConflict(conflict.conflict_id, "DISMISS")}
                      style={{ fontFamily: MONO, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", padding: "5px 12px", borderRadius: 3, border: "1px solid #2A2A2A", background: "#1A1A1A", color: "#6B7280", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#222222"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1A1A1A"; }}
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* LEFT COLUMN — Constraints */}
        <div style={{ flex: 1, borderRight: "1px solid #1C2128", overflowY: "auto" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 14px", borderBottom: "1px solid #1C2128" }}>
            ACTIVE CONSTRAINTS
          </div>

          {constraints.filter((c) => c.status === "ACTIVE").length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 14px", fontFamily: MONO, fontSize: 11, color: "#4B5563", textAlign: "center" }}>
              No active constraints. Run the Janus Loop to generate behavioral rules.
            </div>
          ) : (
            constraints.filter((c) => c.status === "ACTIVE").map((c) => {
              const isExpanded = expandedRow === c.constraint_id;
              const { safety_before, safety_after, cycles_active } = c.performance_delta ?? {};
              const hasDelta = typeof safety_before === "number" && typeof safety_after === "number";
              const delta = hasDelta ? (safety_after! - safety_before!) : null;
              const ac = agentColors(c.target_agent);
              const toggleExpand = () => setExpandedRow(isExpanded ? null : c.constraint_id);

              return (
                <div
                  key={c.constraint_id}
                  style={{ padding: "12px 14px", borderBottom: "1px solid #111820" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#0D1117"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  {/* Row 1: agent badge + condition + expand */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, background: ac.bg, color: ac.color, border: `1px solid ${ac.border}`, borderRadius: 3, padding: "1px 5px", whiteSpace: "nowrap", flexShrink: 0, textTransform: "uppercase" }}>
                      {formatAgentName(c.target_agent)}
                    </span>
                    <span
                      onClick={toggleExpand}
                      style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8B949E", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isExpanded ? "normal" : "nowrap", cursor: "pointer" }}
                    >
                      {c.condition}
                    </span>
                    <span onClick={toggleExpand} style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563", cursor: "pointer", flexShrink: 0 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* Row 2: rule text + expand */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span
                      onClick={toggleExpand}
                      style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#E2E8F0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isExpanded ? "normal" : "nowrap", cursor: "pointer" }}
                    >
                      {c.rule}
                    </span>
                    <span onClick={toggleExpand} style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563", cursor: "pointer", flexShrink: 0 }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>

                  {/* Row 3: status badge + delta + cycles + date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, borderRadius: 3, padding: "1px 6px", textTransform: "uppercase",
                      ...(c.status === "ACTIVE"
                        ? { background: "#0A1F0A", color: "#22C55E", border: "1px solid #0A3A0A" }
                        : { background: "#1A1A1A", color: "#6B7280", border: "1px solid #2A2A2A" }
                      ),
                    }}>
                      {c.status}
                    </span>
                    {hasDelta ? (
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "#C9A84C" }}>
                        {(safety_before ?? 0).toFixed(1)} → {(safety_after ?? 0).toFixed(1)}{" "}
                        ({delta !== null && delta >= 0 ? "+" : ""}{(delta ?? 0).toFixed(1)})
                      </span>
                    ) : (
                      <span style={{ fontFamily: MONO, fontSize: 11, color: "#4B5563" }}>—</span>
                    )}
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>
                      {cycles_active} cycles
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>
                      {formatDate(c.generated_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* ── BUILD CONSTRAINT ── */}
          <div id="build-constraint-section" style={{ padding: "0 14px" }}>
            <div
              onClick={() => {
                const opening = !builderOpen;
                setBuilderOpen(opening);
                if (opening) setTimeout(() => {
                  const el = document.getElementById("build-constraint-section");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #1C2128", cursor: "pointer" }}
            >
              <span style={{ fontFamily: MONO, fontSize: 11, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                BUILD CONSTRAINT
              </span>
              <span style={{ fontSize: 12, color: "#4B5563" }}>{builderOpen ? "▾" : "▸"}</span>
            </div>

            {builderOpen && (
              <div style={{ paddingBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>TARGET AGENT</div>
                  <select
                    value={builderForm.target_agent || "trading_agent"}
                    onChange={(e) => setBuilderForm({ ...builderForm, target_agent: e.target.value })}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#1C2128"; }}
                    style={{ background: "#080A0C", border: "1px solid #1C2128", color: "#E6EDF3", fontFamily: MONO, fontSize: 12, padding: "6px 10px", borderRadius: 3, width: "100%" }}
                  >
                    <option value="trading_agent">Trading Agent</option>
                    <option value="risk_agent">Risk Agent</option>
                    <option value="fraud_agent">Fraud Intelligence Agent</option>
                    <option value="regulator_agent">Regulator Agent</option>
                    <option value="judge_agent">LLM Judge</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>CONDITION</div>
                  <input
                    type="text"
                    value={builderForm.condition}
                    onChange={(e) => { setBuilderError(null); setValidationResult(null); setBuilderForm({ ...builderForm, condition: e.target.value }); }}
                    placeholder="e.g. when proposed trade exceeds 30% of portfolio"
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#1C2128"; }}
                    style={{ background: "#080A0C", border: "1px solid #1C2128", color: "#E6EDF3", fontFamily: MONO, fontSize: 12, padding: "6px 10px", borderRadius: 3, width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>RULE</div>
                  <input
                    type="text"
                    value={builderForm.rule}
                    onChange={(e) => { setBuilderError(null); setValidationResult(null); setBuilderForm({ ...builderForm, rule: e.target.value }); }}
                    placeholder="e.g. reduce position size by 50%"
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#1C2128"; }}
                    style={{ background: "#080A0C", border: "1px solid #1C2128", color: "#E6EDF3", fontFamily: MONO, fontSize: 12, padding: "6px 10px", borderRadius: 3, width: "100%", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", textTransform: "uppercase", marginBottom: 3 }}>RATIONALE</div>
                  <textarea
                    rows={2}
                    value={builderForm.rationale}
                    onChange={(e) => { setBuilderError(null); setValidationResult(null); setBuilderForm({ ...builderForm, rationale: e.target.value }); }}
                    placeholder="e.g. historical data shows aggressive sizing increases risk"
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#1C2128"; }}
                    style={{ background: "#080A0C", border: "1px solid #1C2128", color: "#E6EDF3", fontFamily: MONO, fontSize: 12, padding: "6px 10px", borderRadius: 3, width: "100%", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>

                <button
                  onClick={handleValidateAndInject}
                  disabled={isValidating || builderLoading}
                  onMouseEnter={(e) => { if (!isValidating && !builderLoading) (e.currentTarget as HTMLButtonElement).style.background = "#1F1800"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#130F00"; }}
                  style={{ background: "#130F00", border: "1px solid #C9A84C", color: "#C9A84C", fontFamily: MONO, fontSize: 11, textTransform: "uppercase", padding: "7px 16px", borderRadius: 3, cursor: (isValidating || builderLoading) ? "not-allowed" : "pointer", width: "fit-content", opacity: (isValidating || builderLoading) ? 0.6 : 1 }}
                >
                  {isValidating ? "VALIDATING..." : "INJECT CONSTRAINT"}
                </button>

                {validationResult && !validationResult.is_valid && (
                  <div style={{ background: "#1F0A0A", border: "1px solid #EF4444", borderRadius: 3, padding: 10, marginTop: 8 }}>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: "#EF4444" }}>
                      {"⚠ TOO VAGUE "}
                      <span style={{ color: "#FCA5A5" }}>{validationResult.reason}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "#8B949E", marginTop: 8 }}>
                      SUGGESTED ALTERNATIVES:
                    </div>
                    {validationResult.suggestions.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setBuilderForm({ ...builderForm, condition: s.condition, rule: s.rule, rationale: s.rationale });
                          setValidationResult(null);
                        }}
                        style={{ background: "#0D1117", border: "1px solid #1C2128", borderRadius: 3, padding: 8, marginTop: 4, cursor: "pointer" }}
                      >
                        <div style={{ fontFamily: MONO, fontSize: 10 }}>
                          <span style={{ color: "#8B949E" }}>{"IF: "}</span>
                          <span style={{ color: "#E6EDF3" }}>{s.condition}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 10, marginTop: 2 }}>
                          <span style={{ color: "#8B949E" }}>{"THEN: "}</span>
                          <span style={{ color: "#E6EDF3" }}>{s.rule}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {builderSuccess && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "#3FB950" }}>
                    ✓ CONSTRAINT INJECTED — ACTIVE ON NEXT CYCLE
                  </span>
                )}
                {builderError && (
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "#EF4444" }}>
                    {builderError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ width: 320, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Section 1 — Loop History */}
          <div style={{ borderBottom: "1px solid #1C2128" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 14px", borderBottom: "1px solid #1C2128" }}>
              LOOP HISTORY
            </div>
            {loopHistory.length === 0 ? (
              <div style={{ padding: "20px 14px", fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>
                No loop runs yet.
              </div>
            ) : (
              loopHistory.map((entry, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #111820" }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563" }}>
                    {timeAgo(entry.time)}
                  </div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#E2E8F0", marginTop: 3 }}>
                    Generated {entry.count} constraints
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Section 2 — Phoenix Experiments */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 14px", borderBottom: "1px solid #1C2128" }}>
              PHOENIX EXPERIMENTS
            </div>
            {experiments.length === 0 ? (
              <div style={{ padding: "20px 14px", fontFamily: MONO, fontSize: 10, color: "#4B5563" }}>
                No experiments yet.
              </div>
            ) : (
              experiments.map((c) => {
                const { safety_before, safety_after } = c.performance_delta;
                return (
                  <div key={c.constraint_id} style={{ padding: "10px 14px", borderBottom: "1px solid #111820" }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#E2E8F0", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {formatAgentName(c.target_agent)} — {c.rule.slice(0, 45)}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 12, color: "#C9A84C", marginBottom: 6 }}>
                      {(safety_before ?? 0).toFixed(1)} → {(safety_after ?? 0).toFixed(1)}
                    </div>
                    <span style={{
                      fontFamily: MONO, fontSize: 9, borderRadius: 3, padding: "1px 6px", textTransform: "uppercase",
                      ...(c.status === "ACTIVE"
                        ? { background: "#0A1F0A", color: "#22C55E", border: "1px solid #0A3A0A" }
                        : { background: "#1A1A1A", color: "#6B7280", border: "1px solid #2A2A2A" }
                      ),
                    }}>
                      {c.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
