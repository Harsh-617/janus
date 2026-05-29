"use client";

import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import AgentChatDrawer from "./agent-chat-drawer";
import { API_BASE } from "@/lib/constants";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [alertBanner, setAlertBanner] = useState<{
    type: "FRAUD" | "CIRCUIT_BREAKER";
    message: string;
  } | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const eventSource = new EventSource(`${API_BASE}/api/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);

          if (parsed.type === "circuit_breaker_activated") {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            setAlertBanner({ type: "CIRCUIT_BREAKER", message: parsed.data?.reason ?? "Circuit breaker activated" });
            setBannerVisible(true);
            dismissTimerRef.current = setTimeout(() => setBannerVisible(false), 10000);
          }

          if (parsed.type === "cycle_complete" && parsed.data?.critical_finding) {
            if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
            setAlertBanner({ type: "FRAUD", message: parsed.data?.critical_finding });
            setBannerVisible(true);
            dismissTimerRef.current = setTimeout(() => setBannerVisible(false), 10000);
          }

          window.dispatchEvent(new CustomEvent('janus-sse', { detail: parsed }));
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setTimeout(() => {
          connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      eventSourceRef.current?.close();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar />

        {/* Alert banner */}
        <div style={{ overflow: "hidden", transition: "height 0.3s ease", height: bannerVisible ? "48px" : "0px" }}>
          <div
            style={{
              height: "48px",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              background: "#1F0A0A",
              borderBottom: "1px solid #EF4444",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                background: "#EF4444",
                borderRadius: "50%",
                animation: "pulse-dot 1.5s infinite",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "#EF4444",
                fontWeight: 600,
                letterSpacing: "0.1em",
                flexShrink: 0,
              }}
            >
              {alertBanner?.type}
            </span>
            <span style={{ color: "#4B1818", flexShrink: 0 }}>—</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                color: "#FCA5A5",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {alertBanner?.message}
            </span>
            <button
              onClick={() => setBannerVisible(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#8B949E",
                fontSize: "14px",
                cursor: "pointer",
                padding: "4px 8px",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#E6EDF3"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8B949E"; }}
            >
              ✕
            </button>
          </div>
        </div>

        <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {children}
        </main>
      </div>
      <AgentChatDrawer />
    </div>
  );
}
