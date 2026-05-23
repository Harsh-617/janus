"use client";

import { useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/constants";
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

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`${API_BASE}/api/stream`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource.close();

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      eventSource.addEventListener("connected", (e) => {
        const event: SSEEvent = {
          type: "connected",
          data: {},
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      });

      eventSource.addEventListener("ping", (e) => {
        const event: SSEEvent = {
          type: "ping",
          data: {},
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      });

      eventSource.addEventListener("cycle_start", (e) => {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          type: "cycle_start",
          data,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        setActiveAgents({} as Record<AgentName, boolean>);
      });

      eventSource.addEventListener("agent_thinking", (e) => {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          type: "agent_thinking",
          data,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        setActiveAgents((prev) => ({ ...prev, [data.agent]: true }));
      });

      eventSource.addEventListener("cycle_complete", (e) => {
        const data = JSON.parse(e.data);
        const event: CycleCompleteEvent = {
          type: "cycle_complete",
          data,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        setActiveAgents({} as Record<AgentName, boolean>);
        setLastCycle(data);
        setCycleCount((prev) => prev + 1);
      });

      eventSource.addEventListener("cycle_error", (e) => {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          type: "cycle_error",
          data,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        setActiveAgents({} as Record<AgentName, boolean>);
      });

      eventSource.addEventListener("circuit_breaker_activated", (e) => {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          type: "circuit_breaker_activated",
          data,
          timestamp: new Date().toISOString(),
        };
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      });
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return { events, connected, activeAgents, lastCycle, cycleCount };
}
