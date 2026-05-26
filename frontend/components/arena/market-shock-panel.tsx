"use client";

import { useState, useEffect } from "react";
import {
  applyPresetMarketShock,
  clearMarketShock,
  fetchMarketShockStatus,
  activateCircuitBreaker,
  releaseCircuitBreaker,
  runCycleOnce,
  startStream,
  stopStream,
  fetchStreamStatus,
} from "@/lib/api";
import { API_BASE } from "@/lib/constants";
import type { MarketShockStatus, StreamStatus } from "@/lib/types";

interface ValidationResult {
  valid: boolean;
  headline: string;
  reason: string;
  suggestions: string[];
}

function parseEffectsPreview(effects: string): {
  preview: string;
  isValid: boolean;
  hasRangeError: boolean;
} {
  if (!effects.trim()) return { preview: "", isValid: true, hasRangeError: false };
  try {
    const items: string[] = [];
    for (const part of effects.split(",")) {
      const [ticker, delta] = part.trim().split(":");
      if (!ticker || delta === undefined) throw new Error();
      const value = parseFloat(delta);
      if (isNaN(value)) throw new Error();
      if (value < -0.99 || value > 5.0) {
        const pct = Math.round(value * 100);
        const sign = pct >= 0 ? "+" : "";
        return {
          preview: `Invalid: ${ticker.trim().toUpperCase()} ${sign}${pct}% exceeds max (-99% to +500%)`,
          isValid: false,
          hasRangeError: true,
        };
      }
      const pct = Math.round(value * 100);
      items.push(`${ticker.trim().toUpperCase()} ${pct >= 0 ? "+" : ""}${pct}%`);
    }
    return { preview: items.join(" | "), isValid: true, hasRangeError: false };
  } catch {
    return { preview: "Invalid format", isValid: false, hasRangeError: false };
  }
}

const PRESET_SCENARIOS = [
  { id: "oil_shock", label: "OIL SURGE" },
  { id: "crypto_crash", label: "CRYPTO CRASH" },
  { id: "fed_rate_hike", label: "FED HIKE" },
  { id: "bank_run", label: "BANK RUN" },
];

const BTN: React.CSSProperties = {
  padding: "5px 14px",
  border: "1px solid #1C2128",
  borderRadius: 3,
  background: "transparent",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#8B949E",
  cursor: "pointer",
  transition: "background 0.1s, color 0.1s, border-color 0.1s",
  whiteSpace: "nowrap" as const,
};

function BarButton({
  children,
  onClick,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BTN,
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </button>
  );
}

export function MarketShockPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [shockStatus, setShockStatus] = useState<MarketShockStatus | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customEffects, setCustomEffects] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchStatuses = async () => {
    try {
      const [shock, stream] = await Promise.all([
        fetchMarketShockStatus(),
        fetchStreamStatus(),
      ]);
      setShockStatus(shock);
      setStreamStatus(stream);
    } catch {}
  };

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePresetShock = async (scenarioId: string) => {
    setActiveScenario(scenarioId);
    try {
      setLoading(scenarioId);
      await applyPresetMarketShock(scenarioId);
      await fetchStatuses();
    } catch {
      setActiveScenario(null);
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
    } catch {}
    finally {
      setLoading(null);
    }
  };

  const handleRunCycle = async () => {
    try {
      setLoading("run_cycle");
      await runCycleOnce();
    } catch {}
    finally {
      setTimeout(() => setLoading(null), 2000);
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
    } catch {}
    finally {
      setLoading(null);
    }
  };

  const handleInjectEvent = async () => {
    const descLen = customDescription.length;
    const effectsPreview = parseEffectsPreview(customEffects);
    if (descLen < 10 || effectsPreview.hasRangeError) return;

    let headline = customDescription;

    if (!validationResult?.valid) {
      setIsValidating(true);
      setValidationResult(null);
      setValidationError(null);
      try {
        const res = await fetch(`${API_BASE}/api/market-shock/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: customDescription }),
        });
        if (!res.ok) throw new Error(`Validation failed: ${res.status}`);
        const result: ValidationResult = await res.json();
        setValidationResult(result);
        setIsValidating(false);
        if (!result.valid) return;
        headline = result.headline || customDescription;
      } catch (e) {
        setValidationError(e instanceof Error ? e.message : "Validation failed.");
        setIsValidating(false);
        return;
      }
    } else {
      headline = validationResult.headline || customDescription;
    }

    let parsedEffects: Record<string, number> = {};
    if (customEffects.trim()) {
      try {
        for (const part of customEffects.split(",")) {
          const [ticker, delta] = part.trim().split(":");
          if (!ticker || delta === undefined) throw new Error();
          const value = parseFloat(delta);
          if (isNaN(value)) throw new Error();
          parsedEffects[ticker.trim().toUpperCase()] = value;
        }
      } catch {
        parsedEffects = {};
      }
    }

    try {
      setLoading("inject");
      const res = await fetch(`${API_BASE}/api/market-shock/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: headline, effects: parsedEffects }),
      });
      if (!res.ok) throw new Error(`Injection failed: ${res.status}`);
      setCustomDescription("");
      setCustomEffects("");
      setValidationResult(null);
      setValidationError(null);
      setShowCustom(false);
      await fetchStatuses();
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : "Injection failed.");
    } finally {
      setLoading(null);
    }
  };

  const effectsPreview = parseEffectsPreview(customEffects);
  const descLen = customDescription.length;
  const autoOn = !!streamStatus?.running;

  const SEP = (
    <div style={{ width: 1, height: 20, background: "#1C2128", flexShrink: 0 }} />
  );

  return (
    <div
      style={{
        background: "#0D1117",
        borderTop: "1px solid #1C2128",
        height: showCustom ? "auto" : 56,
        minHeight: 56,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        flexWrap: showCustom ? "wrap" : "nowrap",
      }}
    >
      {/* MARKET SHOCK label */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#4B5563",
          flexShrink: 0,
        }}
      >
        MARKET SHOCK
      </span>

      {SEP}

      {/* Preset buttons */}
      {PRESET_SCENARIOS.map((s) => {
        const isActive = activeScenario === s.id;
        return (
          <BarButton
            key={s.id}
            onClick={() => handlePresetShock(s.id)}
            disabled={!!loading}
            style={
              isActive
                ? { borderColor: "#C9A84C", color: "#C9A84C" }
                : undefined
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "#161B22";
                e.currentTarget.style.color = "#E2E8F0";
                e.currentTarget.style.borderColor = "#30363D";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#8B949E";
                e.currentTarget.style.borderColor = "#1C2128";
              }
            }}
          >
            {loading === s.id ? "…" : s.label}
          </BarButton>
        );
      })}

      {SEP}

      {/* Custom toggle + inline form */}
      <BarButton
        onClick={() => setShowCustom((v) => !v)}
        style={{ color: "#4CADCE", borderColor: "#164060" }}
      >
        + CUSTOM
      </BarButton>

      {showCustom && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
            paddingBottom: showCustom ? 6 : 0,
          }}
        >
          <input
            type="text"
            value={customDescription}
            onChange={(e) => {
              setCustomDescription(e.target.value);
              setValidationResult(null);
              setValidationError(null);
            }}
            placeholder="Describe market event..."
            maxLength={200}
            style={{
              background: "#080A0C",
              border: `1px solid ${validationError ? "#EF4444" : "#30363D"}`,
              color: "#E2E8F0",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              borderRadius: 3,
              padding: "3px 8px",
              width: 220,
              outline: "none",
            }}
          />
          <input
            type="text"
            value={customEffects}
            onChange={(e) => setCustomEffects(e.target.value)}
            placeholder="AAPL:-0.10,GLD:+0.15 (opt)"
            style={{
              background: "#080A0C",
              border: `1px solid ${effectsPreview.hasRangeError ? "#EF4444" : "#30363D"}`,
              color: "#E2E8F0",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              borderRadius: 3,
              padding: "3px 8px",
              width: 180,
              outline: "none",
            }}
          />
          <BarButton
            onClick={handleInjectEvent}
            disabled={descLen < 10 || isValidating || loading === "inject" || effectsPreview.hasRangeError}
            style={{ color: "#4CADCE", borderColor: "#164060" }}
          >
            {isValidating ? "VALIDATING…" : loading === "inject" ? "INJECTING…" : "INJECT"}
          </BarButton>
          {validationError && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#EF4444",
              }}
            >
              {validationError}
            </span>
          )}
          {customEffects.trim() && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: effectsPreview.isValid ? "#22C55E" : "#EF4444",
              }}
            >
              {effectsPreview.preview}
            </span>
          )}
        </div>
      )}

      {/* Right side: cycle controls */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#4B5563",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          CYCLE CONTROLS
        </span>

        <BarButton
          onClick={handleRunCycle}
          disabled={!!loading}
          style={{ color: "#4CADCE", borderColor: "#164060" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#0C2340";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {loading === "run_cycle" ? "RUNNING…" : "RUN CYCLE"}
        </BarButton>

        <BarButton
          onClick={handleToggleStream}
          disabled={loading === "toggle_stream"}
          style={
            autoOn
              ? { color: "#22C55E", borderColor: "#0A3A0A" }
              : { color: "#8B949E", borderColor: "#1C2128" }
          }
          onMouseEnter={(e) => {
            e.currentTarget.style.background = autoOn ? "#051A05" : "#161B22";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {loading === "toggle_stream" ? "…" : autoOn ? "AUTO ON" : "AUTO"}
        </BarButton>

        {SEP}

        <BarButton
          onClick={() => handleCircuitBreaker(true)}
          disabled={!!loading}
          style={{ color: "#EF4444", borderColor: "#3A0A0A" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#1F0A0A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {loading === "activate_cb" ? "…" : "CIRCUIT BREAKER"}
        </BarButton>

        {shockStatus?.active && (
          <BarButton
            onClick={async () => {
              setLoading("clear");
              try {
                await clearMarketShock();
                setActiveScenario(null);
                await fetchStatuses();
              } catch {}
              finally {
                setLoading(null);
              }
            }}
            disabled={loading === "clear"}
            style={{ color: "#F59E0B", borderColor: "#3A2800" }}
          >
            {loading === "clear" ? "…" : "CLEAR SHOCK"}
          </BarButton>
        )}
      </div>
    </div>
  );
}
