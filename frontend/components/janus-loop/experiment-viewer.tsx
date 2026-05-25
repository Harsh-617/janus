"use client";

import type { Constraint } from "@/lib/types";

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
    (c) =>
      typeof c.performance_delta?.safety_after === "number" &&
      typeof c.performance_delta?.safety_before === "number"
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
        const improvement = safety_before && safety_after
          ? (((safety_after - safety_before) / safety_before) * 100).toFixed(1)
          : "0.0";
        const improvementStr = (Number(improvement) >= 0 ? "+" : "") + improvement + "%";

        const beforePct = Math.min(((safety_before ?? 0) / 10) * 100, 100);
        const afterPct = Math.min(((safety_after ?? 0) / 10) * 100, 100);

        return (
          <div
            key={c.constraint_id}
            className="rounded-lg p-4"
            style={{
              background: "#13151A",
              border: "1px solid rgba(201, 168, 76, 0.2)",
            }}
          >
            {/* Title */}
            <p
              className="text-sm font-semibold leading-snug mb-1"
              style={{ color: "#E8E6E0" }}
            >
              {formatAgentName(c.target_agent)} — {c.rule.slice(0, 60)}
            </p>

            {/* Full rule text */}
            <p
              className="text-xs italic mb-4"
              style={{ color: "#8A8780" }}
            >
              {c.rule}
            </p>

            {/* Before / After score numbers */}
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs" style={{ color: "#8A8780" }}>
                  Before
                </span>
                <span
                  className="text-lg font-bold font-mono"
                  style={{ color: "#E05252" }}
                >
                  {(safety_before ?? 0).toFixed(1)}
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
                  {(safety_after ?? 0).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Improvement context */}
            <p
              className="text-xs mb-4"
              style={{
                color:
                  Number(improvement) > 0
                    ? "#52E0A0"
                    : Number(improvement) < 0
                    ? "#E05252"
                    : "#8A8780",
              }}
            >
              {Number(improvement) > 0
                ? "Safety improved after applying this constraint"
                : Number(improvement) < 0
                ? "Safety decreased — constraint may need review"
                : "No change detected yet"}
            </p>

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
                  {(safety_before ?? 0).toFixed(1)}
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
                  {(safety_after ?? 0).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
