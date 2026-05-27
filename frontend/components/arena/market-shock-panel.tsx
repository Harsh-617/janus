"use client";

import { useState, useEffect } from "react";
import {
  applyPresetMarketShock,
  clearMarketShock,
  fetchMarketShockStatus,
  runCycleOnce,
  startStream,
  stopStream,
  fetchStreamStatus,
} from "@/lib/api";
import { API_BASE } from "@/lib/constants";
import type { MarketShockStatus, StreamStatus } from "@/lib/types";

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
  const [nlInput, setNlInput] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    effects: Record<string, number>;
    interpreted_as: string;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [injectError, setInjectError] = useState<string | null>(null);
  const [nlFocused, setNlFocused] = useState(false);
  const [parseHover, setParseHover] = useState(false);
  const [circuitBreakerActive, setCircuitBreakerActive] = useState(false);

  const fetchStatuses = async () => {
    try {
      const [shock, stream] = await Promise.all([
        fetchMarketShockStatus(),
        fetchStreamStatus(),
      ]);
      setShockStatus(shock);
      setStreamStatus(stream);
    } catch {}
    try {
      const portfolioRes = await fetch(`${API_BASE}/api/portfolio`);
      if (portfolioRes.ok) {
        const portfolio = await portfolioRes.json();
        setCircuitBreakerActive(!!portfolio.circuit_breaker_active);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleParse = async () => {
    setIsParsing(true);
    setParsedPreview(null);
    setParseError(null);
    try {
      const res = await fetch(`${API_BASE}/api/market-shock/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: nlInput }),
      });
      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();
      setParsedPreview(data);
    } catch {
      setParseError("Failed to parse event. Try being more specific.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleInjectNL = async () => {
    if (!parsedPreview) return;
    setInjectError(null);
    try {
      const res = await fetch(`${API_BASE}/api/market-shock/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_effects: parsedPreview.effects,
          description: parsedPreview.interpreted_as,
        }),
      });
      if (!res.ok) throw new Error(`Inject failed: ${res.status}`);
      setNlInput("");
      setParsedPreview(null);
    } catch (err) {
      setInjectError(err instanceof Error ? err.message : "Failed to inject event.");
    }
  };

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
      await fetch(`${API_BASE}/api/circuit-breaker/${activate ? "activate" : "release"}`, {
        method: "POST",
      });
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

  const autoOn = !!streamStatus?.running;

  const SEP = (
    <div style={{ width: 1, height: 20, background: "#1C2128", flexShrink: 0 }} />
  );

  return (
    <div
      style={{
        background: "#0D1117",
        borderTop: "1px solid #1C2128",
        flexShrink: 0,
      }}
    >
      <style>{`
        @keyframes janus-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Natural Language Event section */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1C2128",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#8B949E",
            marginBottom: 6,
          }}
        >
          NATURAL LANGUAGE EVENT
        </div>

        {/* Input row */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="text"
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && nlInput.trim() && !isParsing) handleParse(); }}
            onFocus={() => setNlFocused(true)}
            onBlur={() => setNlFocused(false)}
            placeholder="e.g. China invades Taiwan..."
            style={{
              flex: 1,
              background: "#080A0C",
              border: `1px solid ${nlFocused ? "#3B82F6" : "#1C2128"}`,
              color: "#E6EDF3",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 3,
              outline: "none",
              transition: "border-color 0.1s",
            }}
          />
          <button
            onClick={handleParse}
            disabled={isParsing || !nlInput.trim()}
            onMouseEnter={() => setParseHover(true)}
            onMouseLeave={() => setParseHover(false)}
            style={{
              background: parseHover && !isParsing ? "#1A3A5C" : "#0D2137",
              border: "1px solid #3B82F6",
              color: "#3B82F6",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "6px 14px",
              borderRadius: 3,
              cursor: isParsing || !nlInput.trim() ? "not-allowed" : "pointer",
              opacity: isParsing || !nlInput.trim() ? 0.45 : 1,
              transition: "background 0.1s",
              whiteSpace: "nowrap",
            }}
          >
            PARSE
          </button>
        </div>

        {/* Thinking indicator */}
        {isParsing && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#8B949E",
              marginTop: 6,
              animation: "janus-blink 1s infinite",
            }}
          >
            JANUS IS THINKING...
          </div>
        )}

        {/* Error */}
        {parseError && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: "#F85149",
              marginTop: 6,
            }}
          >
            {parseError}
          </div>
        )}

        {/* Preview card */}
        {parsedPreview && (
          <div
            style={{
              background: "#0A1A0A",
              border: "1px solid #238636",
              borderRadius: 3,
              padding: 10,
              marginTop: 6,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#3FB950",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: "#3FB950",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                JANUS INTERPRETED:
              </span>
            </div>

            {/* Effects list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 10 }}>
              {Object.entries(parsedPreview.effects).map(([ticker, delta]) => {
                const pct = (delta * 100).toFixed(1);
                const sign = delta >= 0 ? "+" : "";
                const color = delta >= 0 ? "#3FB950" : "#F85149";
                return (
                  <div
                    key={ticker}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      maxWidth: 200,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color: "#E6EDF3",
                      }}
                    >
                      {ticker}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                        color,
                      }}
                    >
                      {sign}{pct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleInjectNL}
                style={{
                  background: "#0F2A1A",
                  border: "1px solid #238636",
                  color: "#3FB950",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "5px 12px",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                INJECT EVENT
              </button>
              <button
                onClick={() => { setParsedPreview(null); setInjectError(null); }}
                style={{
                  background: "transparent",
                  border: "1px solid #30363D",
                  color: "#8B949E",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "5px 12px",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                DISMISS
              </button>
            </div>
            {injectError && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#F85149",
                  marginTop: 6,
                }}
              >
                {injectError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Existing bar */}
      <div
        style={{
          height: 56,
          minHeight: 56,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "nowrap",
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
            onClick={() => handleCircuitBreaker(!circuitBreakerActive)}
            disabled={!!loading}
            style={
              circuitBreakerActive
                ? { color: "#3FB950", borderColor: "#3FB950", background: "#0A1A0A" }
                : { color: "#EF4444", borderColor: "#EF4444" }
            }
            onMouseEnter={(e) => {
              e.currentTarget.style.background = circuitBreakerActive ? "#0D2A0D" : "#1F0A0A";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = circuitBreakerActive ? "#0A1A0A" : "transparent";
            }}
          >
            {loading === "activate_cb" || loading === "release_cb" ? "…" : circuitBreakerActive ? "RELEASE" : "CIRCUIT BREAKER"}
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
    </div>
  );
}
