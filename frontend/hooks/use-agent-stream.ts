"use client";

import { useState, useEffect } from "react";
import type { SSEEvent, AgentName, CycleCompleteEvent } from "@/lib/types";
import { sseManager } from "@/lib/sse-manager";

const MAX_EVENTS = 50;

export function useAgentStream() {
  const [events, setEvents] = useState<SSEEvent[]>(() => {
    try {
      const saved = sessionStorage.getItem("janus_decision_feed")
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  });
  const [connected, setConnected] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Record<AgentName, boolean>>(
    {} as Record<AgentName, boolean>
  );
  const [lastCycle, setLastCycle] = useState<CycleCompleteEvent["data"] | null>(
    null
  );
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    const handleConnection = (isConnected: boolean) => {
      setConnected(isConnected);
    };
    sseManager.addConnectionListener(handleConnection);

    const handleMessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventType = parsed.type;

        if (eventType === "connected") {
          setConnected(true);
          return;
        }

        if (eventType === "ping") return;

        // Skip baseline cycle events — they run in background
        if (parsed.is_baseline === true ||
            parsed.is_baseline === "true" ||
            parsed.is_baseline === "True" ||
            parsed.data?.is_baseline === true) return;

        const event: SSEEvent = {
          type: eventType,
          timestamp: parsed.timestamp || new Date().toISOString(),
          data: parsed.data || parsed,
          ...parsed,
        };

        if (eventType === "cycle_complete") {
          setEvents((prev) => {
            // Remove ALL agent_thinking events — they are all stale
            // when a cycle completes
            const filtered = prev.filter(e => e.type !== "agent_thinking");
            const updated = [event, ...filtered].slice(0, MAX_EVENTS);
            try {
              sessionStorage.setItem("janus_decision_feed",
                                     JSON.stringify(updated));
            } catch {}
            return updated;
          });
        } else {
          setEvents((prev) => {
            const updated = [event, ...prev].slice(0, MAX_EVENTS)
            try {
              sessionStorage.setItem("janus_decision_feed", JSON.stringify(updated))
            } catch {}
            return updated
          });
        }

        if (eventType === "cycle_start") {
          setActiveAgents({} as Record<AgentName, boolean>);
          // Remove all agent_thinking events from previous cycle
          setEvents((prev) => {
            const filtered = prev.filter(e => e.type !== "agent_thinking");
            try {
              sessionStorage.setItem("janus_decision_feed",
                                     JSON.stringify(filtered));
            } catch {}
            return filtered;
          });
        }

        if (eventType === "agent_thinking") {
          const agentId = parsed.data?.agent_id || parsed.data?.agent || parsed.agent_id || parsed.agent;
          if (agentId) {
            setActiveAgents((prev) => ({ ...prev, [agentId]: true }));
          }
        }

        if (eventType === "cycle_complete") {
          const data = parsed.data || parsed;
          setActiveAgents({} as Record<AgentName, boolean>);
          setLastCycle(data);
          setCycleCount((prev) => prev + 1);
        }

        if (eventType === "cycle_error") {
          setActiveAgents({} as Record<AgentName, boolean>);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    sseManager.addListener(handleMessage);
    return () => {
      sseManager.removeConnectionListener(handleConnection);
      sseManager.removeListener(handleMessage);
    };
  }, []);

  return { events, connected, activeAgents, lastCycle, cycleCount };
}
