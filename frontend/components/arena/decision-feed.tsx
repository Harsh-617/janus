"use client";

import type { SSEEvent, AgentName } from "@/lib/types";
import { ScoreBadge } from "@/components/shared/score-badge";
import { formatDistanceToNow } from "date-fns";
import { useRef, useEffect } from "react";

interface DecisionFeedProps {
  events: SSEEvent[];
  connected: boolean;
}

type BadgeConfig = {
  background: string;
  color: string;
  border: string;
  label: string;
};

const AGENT_BADGE: Record<string, BadgeConfig> = {
  trading_agent: {
    background: "#0C2340",
    color: "#4CADCE",
    border: "1px solid #164060",
    label: "TRADING",
  },
  risk_agent: {
    background: "#1A1A00",
    color: "#EAB308",
    border: "1px solid #333300",
    label: "RISK",
  },
  fraud_agent: {
    background: "#200A0A",
    color: "#EF4444",
    border: "1px solid #400A0A",
    label: "FRAUD",
  },
  regulator_agent: {
    background: "#0A1A0A",
    color: "#22C55E",
    border: "1px solid #0A300A",
    label: "REGULATOR",
  },
  judge_agent: {
    background: "#1A0D28",
    color: "#A855F7",
    border: "1px solid #2D1545",
    label: "JUDGE",
  },
  meta_agent: {
    background: "#1A1A1A",
    color: "#8B949E",
    border: "1px solid #30363D",
    label: "META",
  },
};

function AgentBadge({ agent }: { agent: string }) {
  const cfg = AGENT_BADGE[agent] ?? {
    background: "#111820",
    color: "#8B949E",
    border: "1px solid #1C2128",
    label: (agent ?? "unknown").toUpperCase().replace(/_AGENT$/, ""),
  };
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "3px 8px",
        borderRadius: 3,
        background: cfg.background,
        color: cfg.color,
        border: cfg.border,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

function ThinkingDots() {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        color: "#4CADCE",
        fontStyle: "italic",
      }}
    >
      <span style={{ animation: "dotFade 1.2s 0s infinite" }}>.</span>
      <span style={{ animation: "dotFade 1.2s 0.3s infinite" }}>.</span>
      <span style={{ animation: "dotFade 1.2s 0.6s infinite" }}>.</span>
    </span>
  );
}

function formatTimestamp(ts: string): string {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return "just now";
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "…";
}

function renderContent(event: SSEEvent) {
  const type = event.type as string;

  if (type === "agent_thinking") {
    const d = (event as any).data ?? event;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <AgentBadge agent={d?.agent ?? ""} />
        <ThinkingDots />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#4CADCE",
            fontStyle: "italic",
          }}
        >
          analyzing...
        </span>
      </div>
    );
  }

  if (type === "trade_executed") {
    const d = (event as any).data ?? event;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <AgentBadge agent="trading_agent" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              color: "#E2E8F0",
            }}
          >
            {d.direction} {Number(d.quantity).toFixed(1)} {d.ticker} @{" "}
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              ${Number(d.price).toFixed(2)}
            </span>
          </div>
          {d.rationale && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#4B5563",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {truncate(d.rationale, 80)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "cycle_start") {
    const d = (event as any).data ?? event;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 3,
            background: "#0A1A2A",
            color: "#4CADCE",
            border: "1px solid #1C3A5A",
            flexShrink: 0,
          }}
        >
          CYCLE
        </span>
        <div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              color: "#E2E8F0",
            }}
          >
            Cycle #{d.cycle_number} started
          </div>
          {d.message && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#4B5563",
                marginTop: 3,
              }}
            >
              {truncate(d.message, 80)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "cycle_complete") {
    const d = (event as any).data ?? event;
    const cycleNum = d.cycle_number || null;
    const tradesCount = `${d.trades_executed} trade${d.trades_executed !== 1 ? "s" : ""}`;
    const cycleTitle = cycleNum
      ? `Cycle #${cycleNum} complete — ${tradesCount}`
      : `Cycle complete — ${tradesCount}`;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <AgentBadge agent="judge_agent" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: "#E2E8F0",
              }}
            >
              {cycleTitle}
            </span>
            {d.judge_score != null && <ScoreBadge score={d.judge_score} size="sm" />}
            {d.learning_event && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "2px 5px",
                  borderRadius: 3,
                  background: "#1F1400",
                  color: "#F59E0B",
                  border: "1px solid #3A2800",
                }}
              >
                LEARNING
              </span>
            )}
            {d.circuit_breaker && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "2px 5px",
                  borderRadius: 3,
                  background: "#1F0A0A",
                  color: "#EF4444",
                  border: "1px solid #3A0A0A",
                }}
              >
                CB TRIGGERED
              </span>
            )}
          </div>
          {d.critical_finding && (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                color: "#4B5563",
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {truncate(d.critical_finding, 100)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "cycle_error") {
    const d = (event as any).data ?? event;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 3,
            background: "#200A0A",
            color: "#EF4444",
            border: "1px solid #400A0A",
            flexShrink: 0,
          }}
        >
          ERROR
        </span>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            color: "#4B5563",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {truncate(d.error ?? "Unknown error", 100)}
        </div>
      </div>
    );
  }

  if (type === "circuit_breaker_activated") {
    const d = (event as any).data ?? event;
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 3,
            background: "#200A0A",
            color: "#EF4444",
            border: "1px solid #400A0A",
            flexShrink: 0,
          }}
        >
          CIRCUIT BREAKER
        </span>
        <div>
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              fontWeight: 500,
              color: "#EF4444",
            }}
          >
            Activated
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: "#4B5563",
              marginTop: 2,
            }}
          >
            {d.reason} — cooldown {d.cooldown_minutes}m
          </div>
        </div>
      </div>
    );
  }

  if (type === "connected") {
    return (
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#22C55E",
        }}
      >
        Connected to event stream
      </span>
    );
  }

  return null;
}

export function DecisionFeed({ events, connected }: DecisionFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayEvents = events.filter((e) => e.type !== "ping").slice(0, 40);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [events.length]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid #1C2128",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#4B5563",
          }}
        >
          DECISION FEED
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: connected ? "#4CADCE" : "#EF4444",
              flexShrink: 0,
              animation: connected ? "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.06em",
              color: connected ? "#4CADCE" : "#EF4444",
            }}
          >
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* Feed entries */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {displayEvents.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#4B5563",
              padding: 20,
              textAlign: "center",
            }}
          >
            No events yet. Waiting for agent activity...
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const content = renderContent(event);
            if (!content) return null;

            const isCycleStart = event.type === "cycle_start";
            return (
              <div
                key={`${event.type}-${event.timestamp}-${index}`}
                style={{
                  borderBottom: "1px solid #111820",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  minWidth: 0,
                  ...(isCycleStart && {
                    borderTop: "1px solid #2A2D35",
                    marginTop: "8px",
                    paddingTop: "8px",
                  }),
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {content}
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: "#2D3748",
                      marginTop: 5,
                    }}
                  >
                    {formatTimestamp(event.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes dotFade {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
