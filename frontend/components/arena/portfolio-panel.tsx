"use client";

import { cn } from "@/lib/utils";
import type { Portfolio } from "@/lib/types";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
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

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#4CADCE",
  Finance: "#C9A84C",
  Energy: "#E0A052",
  Healthcare: "#52E0A0",
  "Consumer Goods": "#9B59B6",
  Commodities: "#8B6914",
  Crypto: "#E05252",
  Bonds: "#4A4845",
};

export function PortfolioPanel({ portfolio }: PortfolioPanelProps) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    fetch("/api/portfolio/history")
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {});
  }, []);

  if (!portfolio) {
    return (
      <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6 h-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--janus-border)] rounded w-3/4"></div>
          <div className="h-6 bg-[var(--janus-border)] rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-4 bg-[var(--janus-border)] rounded"></div>
            <div className="h-4 bg-[var(--janus-border)] rounded"></div>
            <div className="h-4 bg-[var(--janus-border)] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

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

  // Calculate allocation data for chart
  const allocationData = Object.entries(portfolio.positions).map(
    ([ticker, position]) => {
      const positionValue = position.shares * position.current_price;
      const percentage = (positionValue / portfolio.total_value) * 100;
      return {
        name: ticker,
        value: percentage,
        color: SECTOR_COLORS[position.sector] || "#4CADCE",
      };
    }
  );

  // Sort by value descending
  allocationData.sort((a, b) => b.value - a.value);

  return (
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6 h-full flex flex-col">
      <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide mb-6">
        Portfolio
      </h2>

      {/* Total Value */}
      <div className="mb-6">
        <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-2">
          Total Value
        </div>
        <div className="text-4xl font-bold text-[var(--janus-gold)] font-mono">
          {formatCurrency(portfolio.total_value)}
        </div>
      </div>

      {/* P&L */}
      <div className="mb-6">
        <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-2">
          P&L
        </div>
        <div className="flex items-center gap-2">
          {portfolio.pnl_pct >= 0 ? (
            <TrendingUp className="h-5 w-5 text-[var(--janus-success)]" />
          ) : (
            <TrendingDown className="h-5 w-5 text-[var(--janus-danger)]" />
          )}
          <span
            className={cn(
              "text-2xl font-bold font-mono",
              portfolio.pnl_pct >= 0
                ? "text-[var(--janus-success)]"
                : "text-[var(--janus-danger)]"
            )}
          >
            {formatPercent(portfolio.pnl_pct)}
          </span>
        </div>
      </div>

      {/* Cash Position */}
      <div className="mb-6">
        <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-2">
          Cash
        </div>
        <div className="text-lg font-semibold text-[var(--janus-text-primary)] font-mono">
          {formatCurrency(portfolio.cash)}
        </div>
      </div>

      {/* Circuit Breaker Status */}
      {portfolio.circuit_breaker_active && (
        <div className="mb-6 p-3 bg-[var(--janus-danger)]/20 border border-[var(--janus-danger)]/30 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--janus-danger)]" />
            <span className="text-sm font-semibold text-[var(--janus-danger)] uppercase">
              Circuit Breaker Active
            </span>
          </div>
        </div>
      )}

      {/* Positions List */}
      <div className="mb-6 flex-1 overflow-y-auto">
        <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-3">
          Positions
        </div>
        <div className="space-y-2">
          {Object.entries(portfolio.positions).map(([ticker, position]) => {
            const positionValue = position.shares * position.current_price;
            const sectorColor = SECTOR_COLORS[position.sector] || "#4CADCE";

            return (
              <div
                key={ticker}
                className="flex items-center justify-between p-2 rounded bg-[var(--janus-background)] border border-[var(--janus-border)]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: sectorColor }}
                  />
                  <div>
                    <div className="text-sm font-semibold text-[var(--janus-text-primary)]">
                      {ticker}
                    </div>
                    <div className="text-xs text-[var(--janus-text-muted)]">
                      {position.shares} shares
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-[var(--janus-blue)]">
                    {formatCurrency(position.current_price)}
                  </div>
                  <div className="text-xs text-[var(--janus-text-muted)] font-mono">
                    {formatCurrency(positionValue)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portfolio Allocation Chart */}
      {allocationData.length > 0 && (
        <div>
          <div className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide mb-3">
            Allocation
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={allocationData}
              layout="vertical"
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={50} tick={{ fill: "#8A8780", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#13151A",
                  border: "1px solid #1E2028",
                  borderRadius: "6px",
                }}
                labelStyle={{ color: "#E8E6E0" }}
                formatter={(value: number) => `${value.toFixed(1)}%`}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {allocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L Sparkline */}
      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#C9A84C" }}>
          P&L Over Time
        </div>
        {history.length < 2 ? (
          <div className="text-xs text-[var(--janus-text-muted)]">
            Not enough data for chart yet
          </div>
        ) : (() => {
          const latestPnl = history[history.length - 1].pnl_pct ?? 0;
          const lineColor = latestPnl >= 0 ? "#52E0A0" : "#E05252";
          return (
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={history} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis dataKey="cycle" hide />
                <YAxis hide />
                <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#13151A",
                    border: "1px solid #1E2028",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#E8E6E0" }}
                  formatter={(value: number) => {
                    const sign = value >= 0 ? "+" : "";
                    return [`${sign}${value.toFixed(2)}%`, "P&L"];
                  }}
                  labelFormatter={(label) => `Cycle ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="pnl_pct"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          );
        })()}
      </div>
    </div>
  );
}
