"use client";

interface PerformanceDelta {
  safety_before: number;
  safety_after: number | null;
  cycles_active: number;
}

interface Constraint {
  constraint_id: string;
  generated_at: string;
  target_agent: string;
  condition: string;
  rule: string;
  rationale: string;
  status: "ACTIVE" | "EXPIRED";
  performance_delta: PerformanceDelta;
  expires_after_cycles: number;
  generated_by: string;
}

interface ExperimentViewerProps {
  constraints: Constraint[];
}

function formatAgentName(raw: string): string {
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ExperimentViewer({ constraints }: ExperimentViewerProps) {
  const completed = constraints.filter(
    (c) => c.performance_delta.safety_after !== null
  );

  if (completed.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border p-12 text-sm text-center"
        style={{
          background: "#13151A",
          borderColor: "#2A2D35",
          color: "#8A8780",
        }}
      >
        No experiment data yet — constraints improve with cycles.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {completed.map((c) => {
        const { safety_before, safety_after } = c.performance_delta;
        const after = safety_after!;
        const improvement = ((after - safety_before) / Math.max(safety_before, 0.01)) * 100;
        const improvementStr =
          (improvement >= 0 ? "+" : "") + improvement.toFixed(1) + "%";

        const beforePct = Math.min((safety_before / 10) * 100, 100);
        const afterPct = Math.min((after / 10) * 100, 100);

        return (
          <div
            key={c.constraint_id}
            className="rounded-lg p-4"
            style={{
              background: "#13151A",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: "#C9A84C" }}
              >
                {c.constraint_id}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: "#F0F0F0" }}
              >
                {formatAgentName(c.target_agent)}
              </span>
            </div>

            {/* Rule text */}
            <p
              className="text-xs italic mb-4"
              style={{ color: "#8A8780" }}
            >
              {c.rule}
            </p>

            {/* Before / After score numbers */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs" style={{ color: "#8A8780" }}>
                  Before
                </span>
                <span
                  className="text-lg font-bold font-mono"
                  style={{ color: "#E05252" }}
                >
                  {safety_before.toFixed(1)}
                </span>
              </div>

              <span
                className="text-sm font-bold"
                style={{ color: "#52E0A0" }}
              >
                {improvementStr}
              </span>

              <div className="flex items-baseline gap-1.5">
                <span className="text-xs" style={{ color: "#8A8780" }}>
                  After
                </span>
                <span
                  className="text-lg font-bold font-mono"
                  style={{ color: "#52E0A0" }}
                >
                  {after.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Visual bar comparison */}
            <div className="flex flex-col gap-2">
              {/* Before bar */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs w-10 shrink-0 text-right"
                  style={{ color: "#8A8780" }}
                >
                  Before
                </span>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ background: "#1E2028", height: 8 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${beforePct}%`,
                      background: "#E05252",
                    }}
                  />
                </div>
                <span
                  className="text-xs w-8 shrink-0 font-mono"
                  style={{ color: "#E05252" }}
                >
                  {safety_before.toFixed(1)}
                </span>
              </div>

              {/* After bar */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs w-10 shrink-0 text-right"
                  style={{ color: "#8A8780" }}
                >
                  After
                </span>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ background: "#1E2028", height: 8 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${afterPct}%`,
                      background: "#52E0A0",
                    }}
                  />
                </div>
                <span
                  className="text-xs w-8 shrink-0 font-mono"
                  style={{ color: "#52E0A0" }}
                >
                  {after.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
