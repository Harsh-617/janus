import { cn } from "@/lib/utils";
import { DECISION_COLORS } from "@/lib/constants";

interface StatusIndicatorProps {
  status:
    | "EXECUTE"
    | "HOLD"
    | "HALT"
    | "APPROVE"
    | "VETO"
    | "MODIFY"
    | "CLEAR"
    | "ALERT";
  className?: string;
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "EXECUTE":
      case "APPROVE":
      case "CLEAR":
        return "bg-[var(--janus-success)]/20 text-[var(--janus-success)] border-[var(--janus-success)]/30";
      case "HOLD":
      case "MODIFY":
        return "bg-[var(--janus-warning)]/20 text-[var(--janus-warning)] border-[var(--janus-warning)]/30";
      case "HALT":
      case "VETO":
      case "ALERT":
        return "bg-[var(--janus-danger)]/20 text-[var(--janus-danger)] border-[var(--janus-danger)]/30";
      default:
        return "bg-[var(--janus-text-muted)]/20 text-[var(--janus-text-muted)] border-[var(--janus-text-muted)]/30";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        getStatusStyle(status),
        className
      )}
    >
      {status}
    </span>
  );
}
