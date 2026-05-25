"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { LoopTimeline } from "@/components/janus-loop/loop-timeline";
import { ConstraintTable } from "@/components/janus-loop/constraint-table";
import { ExperimentViewer } from "@/components/janus-loop/experiment-viewer";
import type { Constraint } from "@/lib/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LoopStatus {
  active_constraints: Constraint[];
  constraint_count: number;
  recent_cycles_analyzed: number;
  learning_events_count: number;
  avg_judge_score: number;
  last_run_at?: string | null;
}


export default function JanusLoopPage() {
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // silent — don't disrupt the UI on a poll failure
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
    setTriggerMessage(
      "Janus Loop triggered — analyzing telemetry and generating constraints..."
    );

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
    triggerBannerTimerRef.current = setTimeout(() => {
      setTriggerMessage(null);
    }, 8_000);
  }

  if (isLoading) {
    return (
      <LayoutWrapper>
        <div className="flex items-center justify-center min-h-screen">
          <p style={{ color: "#8A8780" }}>Loading Janus Loop data...</p>
        </div>
      </LayoutWrapper>
    );
  }

  if (error) {
    return (
      <LayoutWrapper>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-red-500">{error}</p>
        </div>
      </LayoutWrapper>
    );
  }

  return (
    <LayoutWrapper>
    <div
      className="px-6 py-8 max-w-6xl mx-auto"
      style={{ color: "#E8E6E0" }}
    >
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-bold font-cinzel tracking-wide mb-1"
          style={{ color: "#C9A84C" }}
        >
          The Janus Loop
        </h1>
        <p className="text-sm mb-4" style={{ color: "#8A8780" }}>
          Self-Correction Engine — The Backward Face of Janus
        </p>
        <div className="h-px w-24" style={{ background: "#C9A84C" }} />
      </div>

      {/* Trigger banner */}
      {triggerMessage && (
        <div
          className="w-full text-center px-6 py-3 mb-6 rounded text-sm font-medium"
          style={{ background: "#C9A84C", color: "#0A0B0D" }}
        >
          {triggerMessage}
        </div>
      )}

      {/* Loop Timeline */}
      {status && (
        <div className="mb-10">
          <LoopTimeline
            status={status}
            onTrigger={handleTrigger}
            isTriggering={isTriggering}
          />
        </div>
      )}

      {/* Active Constraints */}
      <div className="mb-10">
        <h2
          className="text-lg font-semibold uppercase tracking-widest mb-4"
          style={{ color: "#C9A84C" }}
        >
          Active Constraints
        </h2>
        <ConstraintTable constraints={constraints} />
      </div>

      {/* Experiment Results */}
      <div>
        <h2
          className="text-lg font-semibold uppercase tracking-widest mb-4"
          style={{ color: "#C9A84C" }}
        >
          Experiment Results
        </h2>
        <ExperimentViewer constraints={constraints} />
      </div>
    </div>
    </LayoutWrapper>
  );
}
