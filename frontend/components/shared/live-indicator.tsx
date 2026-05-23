import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  active: boolean;
  label?: string;
}

export function LiveIndicator({ active, label }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 w-3">
        {active && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--janus-success)] opacity-75"></span>
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-3 w-3",
            active ? "bg-[var(--janus-success)]" : "bg-[var(--janus-text-muted)]"
          )}
        ></span>
      </div>
      {label && (
        <span
          className={cn(
            "text-sm font-medium",
            active ? "text-[var(--janus-success)]" : "text-[var(--janus-text-muted)]"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
