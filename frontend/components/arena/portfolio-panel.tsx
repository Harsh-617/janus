"use client";

import type { Portfolio } from "@/lib/types";
import { API_BASE } from "@/lib/constants";
import { useEffect, useState } from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

interface HistoryPoint {
  cycle: number | string;
  total_value: number;
  pnl_pct: number | null;
  timestamp: string;
}

interface PortfolioPanelProps {
  portfolio: Portfolio | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function Sparkline({ positive }: { positive: boolean }) {
  const stroke = positive ? "#22C55E" : "#EF4444";
  const points = positive
    ? "0,12 8,9 16,10 24,6 32,7 40,3"
    : "0,3 8,6 16,5 24,9 32,8 40,12";
  return (
    <svg width={40} height={16} style={{ display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 12px",
  borderBottom: "1px solid #111820",
  cursor: "default",
};

export function PortfolioPanel({ portfolio }: PortfolioPanelProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/portfolio/history`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #1C2128",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#4B5563",
          }}
        >
          PORTFOLIO
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#4CADCE",
              animation: "ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite",
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#4CADCE",
              letterSpacing: "0.05em",
            }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {!portfolio ? (
          /* Loading skeletons */
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  background: "#1C2128",
                  borderRadius: 3,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Summary section */}
            <div style={{ padding: 12, borderBottom: "1px solid #1C2128" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#4B5563",
                  marginBottom: 4,
                }}
              >
                TOTAL VALUE
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#E2E8F0",
                  lineHeight: 1.2,
                }}
              >
                {formatCurrency(portfolio.total_value)}
              </div>

              {/* P&L row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: portfolio.pnl_pct >= 0 ? "#22C55E" : "#EF4444" }}>
                  {portfolio.pnl_pct >= 0 ? "▲" : "▼"}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 18,
                    fontWeight: 600,
                    color: portfolio.pnl_pct >= 0 ? "#22C55E" : "#EF4444",
                  }}
                >
                  {formatPercent(portfolio.pnl_pct)}
                </span>
              </div>

              {/* Cash row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#4B5563",
                  }}
                >
                  CASH
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    color: "#8B949E",
                  }}
                >
                  {formatCurrency(portfolio.cash)}
                </span>
              </div>

              {/* Circuit breaker warning */}
              {portfolio.circuit_breaker_active && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "4px 8px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ color: "#EF4444", fontSize: 10 }}>⚠</span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "#EF4444",
                    }}
                  >
                    CIRCUIT BREAKER ACTIVE
                  </span>
                </div>
              )}
            </div>

            {/* Positions */}
            {Object.keys(portfolio.positions).length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#4B5563",
                }}
              >
                Waiting for portfolio data...
              </div>
            ) : (
              Object.entries(portfolio.positions).map(([ticker, position]) => {
                const positionValue = position.shares * position.current_price;
                const pnlPct = position.avg_cost
                  ? ((position.current_price - position.avg_cost) / position.avg_cost) * 100
                  : 0;
                const positive = pnlPct >= 0;

                return (
                  <div
                    key={ticker}
                    style={{
                      ...ROW_STYLE,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#0D1117")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {/* Left: ticker + shares */}
                    <div style={{ width: 64, flexShrink: 0 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#4CADCE",
                        }}
                      >
                        {ticker}
                      </div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11,
                          color: "#4B5563",
                          marginTop: 2,
                        }}
                      >
                        {position.shares} sh
                      </div>
                    </div>

                    {/* Middle: current price */}
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 14,
                        color: "#E2E8F0",
                        flex: 1,
                        textAlign: "center",
                      }}
                    >
                      {formatCurrency(position.current_price)}
                    </div>

                    {/* Right: total value + P&L */}
                    <div style={{ textAlign: "right", marginRight: 8 }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 14,
                          color: "#8B949E",
                        }}
                      >
                        {formatCurrency(positionValue)}
                      </div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          color: positive ? "#22C55E" : "#EF4444",
                          marginTop: 2,
                        }}
                      >
                        {formatPercent(pnlPct)}
                      </div>
                    </div>

                    {/* Sparkline */}
                    <Sparkline positive={positive} />
                  </div>
                );
              })
            )}

            {/* P&L chart */}
            <div style={{ borderTop: "1px solid #1C2128", padding: 12 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#C9A84C",
                  marginBottom: 8,
                }}
              >
                P&L OVER TIME
              </div>
              {history.length >= 1 ? (() => {
                const latestPnl = history[history.length - 1].pnl_pct ?? 0;
                const lineColor = latestPnl >= 0 ? "#22C55E" : "#EF4444";
                return (
                  <ResponsiveContainer width="100%" height={60}>
                    <LineChart
                      data={history}
                      margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                    >
                      <XAxis dataKey="cycle" hide />
                      <YAxis hide />
                      <ReferenceLine y={0} stroke="#1C2128" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0D1117",
                          border: "1px solid #1C2128",
                          borderRadius: 3,
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        labelStyle={{ color: "#4B5563" }}
                        formatter={(value) => {
                          const v = typeof value === "number" ? value : 0;
                          const sign = v >= 0 ? "+" : "";
                          return [`${sign}${v.toFixed(2)}%`, "P&L"];
                        }}
                        labelFormatter={(label) => `Cycle ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="pnl_pct"
                        stroke={lineColor}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                );
              })() : (
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "#4B5563",
                    margin: 0,
                  }}
                >
                  Waiting for data...
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
