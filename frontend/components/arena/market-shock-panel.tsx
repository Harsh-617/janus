"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyPresetMarketShock,
  applyCustomMarketShock,
  clearMarketShock,
  fetchMarketShockStatus,
  activateCircuitBreaker,
  releaseCircuitBreaker,
  runCycleOnce,
  startStream,
  stopStream,
  fetchStreamStatus,
} from "@/lib/api";
import {
  Zap,
  TrendingDown,
  DollarSign,
  Building,
  AlertTriangle,
  Power,
  PowerOff,
  Play,
  Pause,
  X,
  Loader2,
} from "lucide-react";
import type { MarketShockStatus, StreamStatus } from "@/lib/types";

const PRESET_SCENARIOS = [
  {
    id: "oil_shock",
    name: "Oil Shock",
    description: "Energy prices surge 40%, market volatility spikes",
    icon: Zap,
  },
  {
    id: "crypto_crash",
    name: "Crypto Crash",
    description: "Bitcoin drops 60%, crypto positions collapse",
    icon: TrendingDown,
  },
  {
    id: "fed_rate_hike",
    name: "Fed Rate Hike",
    description: "Emergency rate increase, bonds rally, tech sells off",
    icon: DollarSign,
  },
  {
    id: "bank_run",
    name: "Bank Run",
    description: "Financial sector panic, flight to safety",
    icon: Building,
  },
];

export function MarketShockPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [shockStatus, setShockStatus] = useState<MarketShockStatus | null>(
    null
  );
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [customDescription, setCustomDescription] = useState("");
  const [customEffects, setCustomEffects] = useState("");
  const [customMessage, setCustomMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStatuses = async () => {
    try {
      const [shock, stream] = await Promise.all([
        fetchMarketShockStatus(),
        fetchStreamStatus(),
      ]);
      setShockStatus(shock);
      setStreamStatus(stream);
    } catch (error) {
      console.error("Failed to fetch statuses:", error);
    }
  };

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePresetShock = async (scenarioId: string) => {
    try {
      setLoading(scenarioId);
      await applyPresetMarketShock(scenarioId);
      await fetchStatuses();
    } catch (error) {
      console.error("Failed to apply market shock:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleClearShock = async () => {
    try {
      setLoading("clear");
      await clearMarketShock();
      await fetchStatuses();
    } catch (error) {
      console.error("Failed to clear market shock:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleCircuitBreaker = async (activate: boolean) => {
    try {
      setLoading(activate ? "activate_cb" : "release_cb");
      if (activate) {
        await activateCircuitBreaker();
      } else {
        await releaseCircuitBreaker();
      }
      await fetchStatuses();
    } catch (error) {
      console.error("Failed to toggle circuit breaker:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleRunCycle = async () => {
    try {
      setLoading("run_cycle");
      await runCycleOnce();
    } catch (error) {
      console.error("Failed to run cycle:", error);
    } finally {
      setTimeout(() => setLoading(null), 2000);
    }
  };

  const handleCustomShock = async () => {
    let parsedEffects: { [ticker: string]: number } = {};
    if (customEffects.trim()) {
      try {
        for (const part of customEffects.split(",")) {
          const [ticker, delta] = part.trim().split(":");
          if (!ticker || delta === undefined) throw new Error("bad format");
          const value = parseFloat(delta);
          if (isNaN(value)) throw new Error("bad number");
          parsedEffects[ticker.trim().toUpperCase()] = value;
        }
      } catch {
        parsedEffects = {};
      }
    }
    try {
      setLoading("custom");
      setCustomMessage(null);
      await applyCustomMarketShock(parsedEffects);
      setCustomDescription("");
      setCustomEffects("");
      setCustomMessage({ type: "success", text: "Event injected successfully." });
      setTimeout(() => setCustomMessage(null), 4000);
    } catch (error) {
      setCustomMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Injection failed.",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleToggleStream = async () => {
    try {
      setLoading("toggle_stream");
      if (streamStatus?.running) {
        await stopStream();
      } else {
        await startStream();
      }
      await fetchStatuses();
    } catch (error) {
      console.error("Failed to toggle stream:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6">
      <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide mb-6">
        Market Controls
      </h2>

      {/* Active Shock Alert */}
      {shockStatus?.active && (
        <div className="mb-6 p-4 bg-[var(--janus-warning)]/20 border border-[var(--janus-warning)]/30 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--janus-warning)] mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-[var(--janus-warning)] mb-1">
                  Market Shock Active: {shockStatus.scenario_name}
                </div>
                <div className="text-xs text-[var(--janus-text-secondary)]">
                  Activated at{" "}
                  {shockStatus.activated_at
                    ? new Date(shockStatus.activated_at).toLocaleTimeString()
                    : "unknown"}
                </div>
              </div>
            </div>
            <Button
              onClick={handleClearShock}
              disabled={loading === "clear"}
              size="sm"
              variant="outline"
              className="border-[var(--janus-warning)] text-[var(--janus-warning)] hover:bg-[var(--janus-warning)]/10"
            >
              {loading === "clear" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preset Scenarios */}
        <div>
          <h3 className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-3">
            Preset Scenarios
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_SCENARIOS.map((scenario) => {
              const Icon = scenario.icon;
              const isLoading = loading === scenario.id;

              return (
                <Button
                  key={scenario.id}
                  onClick={() => handlePresetShock(scenario.id)}
                  disabled={!!loading}
                  variant="outline"
                  className={cn(
                    "h-auto flex-col items-start p-3 border-[var(--janus-border)] hover:border-[var(--janus-warning)] hover:bg-[var(--janus-warning)]/10",
                    isLoading && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 w-full">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--janus-warning)]" />
                    ) : (
                      <Icon className="h-4 w-4 text-[var(--janus-warning)]" />
                    )}
                    <span className="text-xs font-semibold text-[var(--janus-text-primary)]">
                      {scenario.name}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--janus-text-muted)] text-left">
                    {scenario.description}
                  </p>
                </Button>
              );
            })}
          </div>
        </div>

        {/* System Controls */}
        <div className="space-y-4">
          {/* Circuit Breaker */}
          <div>
            <h3 className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-3">
              Circuit Breaker
            </h3>
            <div className="flex gap-2">
              <Button
                onClick={() => handleCircuitBreaker(true)}
                disabled={!!loading}
                variant="outline"
                className="flex-1 border-[var(--janus-danger)] text-[var(--janus-danger)] hover:bg-[var(--janus-danger)]/10"
              >
                {loading === "activate_cb" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PowerOff className="h-4 w-4 mr-2" />
                )}
                Activate
              </Button>
              <Button
                onClick={() => handleCircuitBreaker(false)}
                disabled={!!loading}
                variant="outline"
                className="flex-1 border-[var(--janus-success)] text-[var(--janus-success)] hover:bg-[var(--janus-success)]/10"
              >
                {loading === "release_cb" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                Release
              </Button>
            </div>
          </div>

          {/* Cycle Controls */}
          <div>
            <h3 className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-3">
              Cycle Controls
            </h3>
            <div className="space-y-2">
              <Button
                onClick={handleRunCycle}
                disabled={!!loading}
                className="w-full bg-[var(--janus-blue)] hover:bg-[var(--janus-blue)]/80 text-white"
              >
                {loading === "run_cycle" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Single Cycle
              </Button>
              <Button
                onClick={handleToggleStream}
                disabled={!!loading}
                variant="outline"
                className={cn(
                  "w-full",
                  streamStatus?.running
                    ? "border-[var(--janus-warning)] text-[var(--janus-warning)] hover:bg-[var(--janus-warning)]/10"
                    : "border-[var(--janus-success)] text-[var(--janus-success)] hover:bg-[var(--janus-success)]/10"
                )}
              >
                {loading === "toggle_stream" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : streamStatus?.running ? (
                  <Pause className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {streamStatus?.running ? "Stop Auto-Cycle" : "Start Auto-Cycle"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-6 border-t border-[#C9A84C]/30" />

      {/* Custom Event */}
      <div>
        <h3 className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-3">
          Custom Event
        </h3>
        <div className="space-y-2">
          <input
            type="text"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="Describe a market event..."
            className="w-full rounded-md px-3 py-2 text-sm bg-[#13151A] text-[var(--janus-text-primary)] placeholder:text-[var(--janus-text-muted)] border border-[var(--janus-border)] outline-none focus:border-[#C9A84C] transition-colors"
          />
          <input
            type="text"
            value={customEffects}
            onChange={(e) => setCustomEffects(e.target.value)}
            placeholder="e.g. AAPL:-0.10,GLD:+0.15 (optional)"
            className="w-full rounded-md px-3 py-2 text-sm bg-[#13151A] text-[var(--janus-text-primary)] placeholder:text-[var(--janus-text-muted)] border border-[var(--janus-border)] outline-none focus:border-[#C9A84C] transition-colors"
          />
          <Button
            onClick={handleCustomShock}
            disabled={!customDescription.trim() || loading === "custom"}
            className="w-full bg-[#C9A84C] hover:bg-[#C9A84C]/80 text-[#13151A] font-semibold disabled:opacity-50"
          >
            {loading === "custom" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Injecting...
              </>
            ) : (
              "Inject Event"
            )}
          </Button>
          {customMessage && (
            <p
              className={cn(
                "text-xs mt-1",
                customMessage.type === "success"
                  ? "text-[var(--janus-success)]"
                  : "text-[var(--janus-danger)]"
              )}
            >
              {customMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
