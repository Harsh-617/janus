"use client";

import { useEffect, useRef, useState } from "react";
import type { Constraint } from "@/lib/types";

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

export default function JanusLoopPage() {
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const triggerBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchStatus(): Promise<LoopStatus> {
    const res = await fetch(`${BASE_URL}/api/janus-loop/status`);
    if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
    return res.json();
  }

  async function fetchHistory(): Promise<Constraint[]> {
    const res = await fetch(`${BASE_URL}/api/janus-loop/history`);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    const data = await res.json();
    return data.constraints ?? [];
  }

  async function fetchAll() {
    const [s, c] = await Promise.all([fetchStatus(), fetchHistory()]);
    setStatus(s);
    setConstraints(c);
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
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  async function handleTrigger() {
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerMessage("Janus Loop triggered — analyzing telemetry and generating constraints...");
    try {
      await fetch(`${BASE_URL}/api/janus-loop/trigger`, { method: "POST" });
    } catch {
      // continue regardless — refetch will reveal any changes
    }
    await new Promise((r) => setTimeout(r, 5_000));
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#080A0C", color: "#E2E8F0", overflow: "hidden" }}>

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

      {/* ── LOOP STATUS ROW ── */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1C2128", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <span style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase" }}>Last run</span>
          {" "}
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#8B949E" }}>
            {status?.last_run_at ? timeAgo(status.last_run_at) : "Never"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {STAGES.map((stage, i) => (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: "#4B5563", padding: "3px 8px", border: "1px solid #1C2128", borderRadius: 3, background: "#080A0C", whiteSpace: "nowrap" }}>
                {stage}
              </div>
              {i < STAGES.length - 1 && (
                <span style={{ fontFamily: MONO, fontSize: 10, color: "#2D3748" }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT COLUMN — Constraints */}
        <div style={{ flex: 1, borderRight: "1px solid #1C2128", overflowY: "auto" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 14px", borderBottom: "1px solid #1C2128" }}>
            ACTIVE CONSTRAINTS
          </div>

          {constraints.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 14px", fontFamily: MONO, fontSize: 11, color: "#4B5563", textAlign: "center" }}>
              No active constraints. Run the Janus Loop to generate behavioral rules.
            </div>
          ) : (
            constraints.map((c) => {
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
