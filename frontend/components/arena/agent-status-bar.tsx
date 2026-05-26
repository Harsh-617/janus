"use client";

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

const SHORT_NAMES: Record<AgentName, string> = {
  trading_agent: "Trading",
  risk_agent: "Risk",
  fraud_agent: "Fraud",
  regulator_agent: "Regulator",
  judge_agent: "Judge",
  meta_agent: "Meta",
};

function getDotColor(isActive: boolean): string {
  if (isActive) return "#22C55E";
  return "#4CADCE";
}

export function AgentStatusBar({
  activeAgents,
  connected,
}: AgentStatusBarProps) {
  return (
    <div
      style={{
        background: "#0D1117",
        borderBottom: "1px solid #1C2128",
        height: 48,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Left label */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#4B5563",
        }}
      >
        AGENTS
      </span>

      {/* Vertical separator */}
      <div style={{ width: 1, height: 20, background: "#1C2128", flexShrink: 0 }} />

      {/* Agent items */}
      {AGENT_ORDER.map((agent, idx) => {
        const isActive = !!activeAgents[agent];
        const dotColor = getDotColor(isActive);

        return (
          <div key={agent} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Status dot */}
              <div style={{ position: "relative", width: 6, height: 6, flexShrink: 0 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dotColor,
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                />
                {isActive && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#22C55E",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      animation: "ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite",
                      opacity: 0.6,
                    }}
                  />
                )}
              </div>

              {/* Agent name */}
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#E2E8F0",
                }}
              >
                {SHORT_NAMES[agent]}
              </span>

              {/* Status text */}
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12,
                  color: isActive ? "#4CADCE" : "#4B5563",
                }}
              >
                {isActive ? "analyzing..." : "idle"}
              </span>
            </div>

            {/* Separator between items (not after last) */}
            {idx < AGENT_ORDER.length - 1 && (
              <div style={{ width: 1, height: 20, background: "#1C2128", flexShrink: 0 }} />
            )}
          </div>
        );
      })}

      {/* Right side: connection status */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: connected ? "#22C55E" : "#EF4444",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: connected ? "#22C55E" : "#EF4444",
          }}
        >
          {connected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
