"use client";

import { useState, useEffect } from "react";
import type { SSEEvent, AgentName, CycleCompleteEvent } from "@/lib/types";

const MAX_EVENTS = 50;

export function useAgentStream() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Record<AgentName, boolean>>(
    {} as Record<AgentName, boolean>
  );
  const [lastCycle, setLastCycle] = useState<CycleCompleteEvent["data"] | null>(
    null
  );
  const [cycleCount, setCycleCount] = useState(0);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const parsed = e.detail;
      try {
        const eventType = parsed.type;

        if (eventType === "connected") {
          setConnected(true);
          return;
        }

        if (eventType === "ping") return;

        const event: SSEEvent = {
          type: eventType,
          timestamp: parsed.timestamp || new Date().toISOString(),
          data: parsed.data || parsed,
          ...parsed,
        };

        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));

        if (eventType === "cycle_start") {
          setActiveAgents({} as Record<AgentName, boolean>);
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

    window.addEventListener('janus-sse', handler as EventListener);
    return () => window.removeEventListener('janus-sse', handler as EventListener);
  }, []);

  return { events, connected, activeAgents, lastCycle, cycleCount };
}
