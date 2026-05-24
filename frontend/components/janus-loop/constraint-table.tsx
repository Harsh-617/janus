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

interface ConstraintTableProps {
  constraints: Constraint[];
}

function formatAgentName(raw: string): string {
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function ConstraintTable({ constraints }: ConstraintTableProps) {
  if (constraints.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border p-12 text-sm"
        style={{
          background: "#13151A",
          borderColor: "#2A2D35",
          color: "var(--janus-text-muted, #6B7280)",
        }}
      >
        No constraints generated yet.
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ background: "#13151A", borderColor: "#2A2D35" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#1A1D24" }}>
              {[
                "Agent",
                "Condition",
                "Rule",
                "Status",
                "Safety Δ",
                "Cycles Active",
                "Generated",
              ].map((col) => (
                <th
                  key={col}
                  className="text-left text-xs uppercase tracking-wide px-4 py-3 font-semibold whitespace-nowrap"
                  style={{ color: "#C9A84C" }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {constraints.map((c, i) => {
              const { safety_before, safety_after, cycles_active } =
                c.performance_delta;
              const hasDelta = safety_after !== null;
              const delta = hasDelta ? safety_after! - safety_before : null;

              return (
                <tr
                  key={c.constraint_id}
                  className="transition-colors"
                  style={{
                    borderTop: i === 0 ? "none" : `1px solid #2A2D35`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "#1E2028";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "transparent";
                  }}
                >
                  {/* Agent */}
                  <td
                    className="px-4 py-3 whitespace-nowrap font-medium"
                    style={{ color: "var(--janus-text-primary, #F0F0F0)" }}
                  >
                    {formatAgentName(c.target_agent)}
                  </td>

                  {/* Condition — monospace, truncated at 40 */}
                  <td className="px-4 py-3">
                    <span
                      className="font-mono text-xs"
                      title={c.condition}
                      style={{ color: "var(--janus-text-secondary, #A0A0B0)" }}
                    >
                      {truncate(c.condition, 40)}
                    </span>
                  </td>

                  {/* Rule — truncated at 80 */}
                  <td
                    className="px-4 py-3 max-w-xs"
                    style={{ color: "var(--janus-text-secondary, #A0A0B0)" }}
                  >
                    <span title={c.rule}>{truncate(c.rule, 80)}</span>
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
                      style={
                        c.status === "ACTIVE"
                          ? {
                              background: "rgba(52, 211, 153, 0.15)",
                              color: "#34D399",
                              border: "1px solid rgba(52, 211, 153, 0.3)",
                            }
                          : {
                              background: "rgba(107, 114, 128, 0.15)",
                              color: "#9CA3AF",
                              border: "1px solid rgba(107, 114, 128, 0.3)",
                            }
                      }
                    >
                      {c.status}
                    </span>
                  </td>

                  {/* Safety Δ */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                    {hasDelta ? (
                      <span style={{ color: "#34D399" }}>
                        {safety_before.toFixed(1)} → {safety_after!.toFixed(1)}{" "}
                        ({delta! >= 0 ? "+" : ""}
                        {delta!.toFixed(1)})
                      </span>
                    ) : (
                      <span style={{ color: "var(--janus-text-muted, #6B7280)" }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Cycles Active */}
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--janus-text-primary, #F0F0F0)" }}
                  >
                    {cycles_active}
                  </td>

                  {/* Generated */}
                  <td
                    className="px-4 py-3 whitespace-nowrap text-xs"
                    style={{ color: "var(--janus-text-muted, #6B7280)" }}
                  >
                    {formatDate(c.generated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
