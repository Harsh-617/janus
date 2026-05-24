"use client";

interface LoopStatus {
  active_constraints: number;
  total_constraints: number;
  loop_run_count: number;
  last_run_at: string | null;
  avg_score_last_10: number;
  learning_events_last_10: number;
}

interface LoopTimelineProps {
  status: LoopStatus;
  onTrigger: () => void;
  isTriggering: boolean;
}

function minutesAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff === 1) return "1 minute ago";
  return `${diff} minutes ago`;
}

const STAGES = [
  "Query Phoenix",
  "Detect Patterns",
  "Generate Constraints",
  "Inject into Agents",
];

export function LoopTimeline({
  status,
  onTrigger,
  isTriggering,
}: LoopTimelineProps) {
  const stats = [
    { label: "Loop Runs", value: status.loop_run_count },
    { label: "Active Constraints", value: status.active_constraints },
    { label: "Avg Score (last 10)", value: status.avg_score_last_10.toFixed(1) },
    { label: "Learning Events (last 10)", value: status.learning_events_last_10 },
  ];

  const lastRunText = status.last_run_at
    ? `Last run: ${minutesAgo(status.last_run_at)}`
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
