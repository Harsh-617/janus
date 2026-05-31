"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface DataPoint {
  time: number;
  value: number;
}

interface PnlSparklineBarProps {
  portfolio: any;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PnlSparklineBar({ portfolio }: PnlSparklineBarProps) {
  const [renderedPoints, setRenderedPoints] = useState<DataPoint[]>(() => {
    try {
      const saved = sessionStorage.getItem("janus_sparkline");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (portfolio?.total_value == null) return;
    setRenderedPoints(prev => {
      const next = [...prev, { time: Date.now(), value: portfolio.total_value }];
      if (next.length > 60) next.shift();
      try {
        sessionStorage.setItem("janus_sparkline", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [portfolio?.total_value]);

  if (!portfolio) {
    return (
      <div
        style={{
          height: 64,
          background: "#0D1117",
          borderBottom: "1px solid #1C2128",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#4B5563",
          }}
        >
          Waiting for portfolio data...
        </span>
      </div>
    );
  }

  const hasEnough = renderedPoints.length >= 2;
  const first = renderedPoints[0]?.value ?? 0;
  const current = renderedPoints[renderedPoints.length - 1]?.value ?? 0;
  const change = current - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const positive = change >= 0;
  const lineColor = positive ? "#22C55E" : "#EF4444";

  const high = hasEnough ? Math.max(...renderedPoints.map((p) => p.value)) : null;
  const low = hasEnough ? Math.min(...renderedPoints.map((p) => p.value)) : null;

  return (
    <div
      style={{
        height: 64,
        background: "#0D1117",
        borderBottom: "1px solid #1C2128",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Left: session P&L label + value */}
      <div style={{ width: 160, flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#4B5563",
            marginBottom: 3,
          }}
        >
          P&L SESSION
        </div>
        {hasEnough ? (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: positive ? "#22C55E" : "#EF4444",
            }}
          >
            {positive ? "+" : ""}
            {formatValue(change)} ({positive ? "+" : ""}
            {changePct.toFixed(2)}%)
          </div>
        ) : (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: "#4B5563",
            }}
          >
            —
          </div>
        )}
      </div>

      {/* Center: sparkline chart */}
      <div style={{ flex: 1 }}>
        {hasEnough ? (
          <ResponsiveContainer width="100%" height={44}>
            <LineChart data={renderedPoints} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <XAxis dataKey="time" hide={true} />
              <YAxis hide={true} domain={["auto", "auto"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              width: "100%",
              height: 1,
              background: "#1C2128",
            }}
          />
        )}
      </div>

      {/* Right: high / low */}
      <div style={{ flexShrink: 0, textAlign: "right", width: 140 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#4B5563",
            }}
          >
            HIGH
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8B949E",
            }}
          >
            {high !== null ? formatValue(high) : "—"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#4B5563",
            }}
          >
            LOW
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8B949E",
            }}
          >
            {low !== null ? formatValue(low) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
