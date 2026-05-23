import { cn } from "@/lib/utils";
import { SCORE_THRESHOLDS } from "@/lib/constants";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= SCORE_THRESHOLDS.pass) return "bg-[var(--janus-success)]/20 text-[var(--janus-success)] border-[var(--janus-success)]/30";
    if (score >= SCORE_THRESHOLDS.warn) return "bg-[var(--janus-warning)]/20 text-[var(--janus-warning)] border-[var(--janus-warning)]/30";
    return "bg-[var(--janus-danger)]/20 text-[var(--janus-danger)] border-[var(--janus-danger)]/30";
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-mono font-semibold",
        getScoreColor(score),
        sizeClasses[size]
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}
