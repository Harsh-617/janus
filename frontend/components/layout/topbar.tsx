"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Power, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Portfolio } from "@/lib/types";
import {
  runCycleOnce,
  activateCircuitBreaker,
  releaseCircuitBreaker,
} from "@/lib/api";

interface TopbarProps {
  portfolio: Portfolio | null;
}

export function Topbar({ portfolio }: TopbarProps) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCycle = async () => {
    try {
      setIsRunning(true);
      await runCycleOnce();
    } catch (error) {
      console.error("Failed to run cycle:", error);
    } finally {
      setTimeout(() => setIsRunning(false), 2000);
    }
  };

  const handleCircuitBreakerToggle = async () => {
    try {
      if (portfolio?.circuit_breaker_active) {
        await releaseCircuitBreaker();
      } else {
        await activateCircuitBreaker();
      }
    } catch (error) {
      console.error("Failed to toggle circuit breaker:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getSystemStatus = () => {
    if (!portfolio) return { label: "LOADING", color: "text-[var(--janus-text-muted)]" };
    if (portfolio.circuit_breaker_active)
      return { label: "CIRCUIT BREAKER", color: "text-[var(--janus-danger)]" };
    if (portfolio.risk_mode === "HALTED")
      return { label: "HALTED", color: "text-[var(--janus-danger)]" };
    if (portfolio.risk_mode === "CRISIS")
      return { label: "CRISIS MODE", color: "text-[var(--janus-warning)]" };
    return { label: "LIVE", color: "text-[var(--janus-success)]" };
  };

  const status = getSystemStatus();

  return (
    <header className="h-16 bg-[var(--janus-surface)] border-b border-[var(--janus-border)] px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div>
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-1">
            Portfolio Value
          </div>
          <div className="text-2xl font-bold text-[var(--janus-gold)] font-mono">
            {portfolio ? formatCurrency(portfolio.total_value) : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-1">
            P&L
          </div>
          <div
            className={cn(
              "text-2xl font-bold font-mono",
              portfolio && portfolio.pnl_pct >= 0
                ? "text-[var(--janus-success)]"
                : "text-[var(--janus-danger)]"
            )}
          >
            {portfolio ? formatPercent(portfolio.pnl_pct) : "—"}
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-1">
            Cycles
          </div>
          <div className="text-2xl font-bold text-[var(--janus-text-primary)] font-mono">
            {portfolio?.cycle_count ?? 0}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide">
            Status
          </div>
          <span
            className={cn(
              "text-sm font-bold uppercase tracking-wider",
              status.color
            )}
          >
            {status.label}
          </span>
        </div>

        <Button
          onClick={handleRunCycle}
          disabled={isRunning || portfolio?.circuit_breaker_active}
          size="sm"
          className="bg-[var(--janus-blue)] hover:bg-[var(--janus-blue)]/80 text-white"
        >
          <Play className="h-4 w-4 mr-2" />
          Run Cycle
        </Button>

        <Button
          onClick={handleCircuitBreakerToggle}
          disabled={!portfolio}
          size="sm"
          variant="outline"
          className={cn(
            "border-[var(--janus-border)]",
            portfolio?.circuit_breaker_active
              ? "bg-[var(--janus-danger)]/20 text-[var(--janus-danger)] hover:bg-[var(--janus-danger)]/30"
              : "text-[var(--janus-text-secondary)] hover:text-[var(--janus-text-primary)]"
          )}
        >
          {portfolio?.circuit_breaker_active ? (
            <>
              <Power className="h-4 w-4 mr-2" />
              Release
            </>
          ) : (
            <>
              <PowerOff className="h-4 w-4 mr-2" />
              Circuit Breaker
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
