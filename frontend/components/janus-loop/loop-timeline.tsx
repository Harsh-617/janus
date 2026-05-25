"use client";

interface LoopStatus {
  active_constraints: object[];
  constraint_count: number;
  recent_cycles_analyzed: number;
  learning_events_count: number;
  avg_judge_score: number;
  last_run_at?: string | null;
}

interface LoopTimelineProps {
  status: LoopStatus;
  onTrigger: () => void;
  isTriggering: boolean;
}


const STAGES = [
  "Query Phoenix",
  "Detect Patterns",
  "Generate Constraints",
  "Inject into Agents",
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function LoopTimeline({
  status,
  onTrigger,
  isTriggering,
}: LoopTimelineProps) {
  const stats = [
    { label: "Cycles Analyzed", value: status.recent_cycles_analyzed ?? 0 },
    { label: "Active Constraints", value: status.constraint_count ?? 0 },
    { label: "Avg Judge Score", value: (status.avg_judge_score ?? 0).toFixed(1) },
    { label: "Learning Events", value: status.learning_events_count ?? 0 },
  ];

  const lastRunText = status.last_run_at
    ? `Last run ${timeAgo(status.last_run_at)}`
    : "Never run";

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1 — Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-lg border px-4 py-4"
            style={{ background: "#13151A", borderColor: "#2A2D35" }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#C9A84C" }}
            >
              {label}
            </span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "#E8E6E0" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Section 2 — Trigger row */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border px-4 py-3"
        style={{ background: "#13151A", borderColor: "#2A2D35" }}
      >
        <span className="text-sm" style={{ color: "#8A8780" }}>
          {lastRunText}
        </span>
        <button
          onClick={onTrigger}
          disabled={isTriggering}
          className="rounded px-5 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "#C9A84C", color: "#0A0B0D" }}
        >
          {isTriggering ? "Running..." : "Trigger Janus Loop"}
        </button>
      </div>

      {/* Section 3 — Loop flow diagram */}
      <div
        className="rounded-lg border px-6 py-5"
        style={{ background: "#13151A", borderColor: "#2A2D35" }}
      >
        <p
          className="mb-4 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#C9A84C" }}
        >
          Loop Flow
        </p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-3">
              <div
                className="rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap"
                style={{
                  background: "#0A0B0D",
                  borderColor: "#C9A84C",
                  color: "#E8E6E0",
                }}
              >
                {stage}
              </div>
              {i < STAGES.length - 1 && (
                <span
                  className="text-lg font-bold select-none"
                  style={{ color: "#C9A84C" }}
                >
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
