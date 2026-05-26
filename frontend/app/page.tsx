"use client";

import { AgentStatusBar } from "@/components/arena/agent-status-bar";
import { PortfolioPanel } from "@/components/arena/portfolio-panel";
import { DecisionFeed } from "@/components/arena/decision-feed";
import { MarketShockPanel } from "@/components/arena/market-shock-panel";
import { usePortfolio } from "@/hooks/use-portfolio";
import { useAgentStream } from "@/hooks/use-agent-stream";

export default function Arena() {
  const { portfolio } = usePortfolio();
  const { events, connected, activeAgents, lastCycle } = useAgentStream();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#080A0C",
      }}
    >
      {/* Agent status bar — 44px, never scrolls */}
      <AgentStatusBar
        activeAgents={activeAgents}
        lastCycle={lastCycle}
        connected={connected}
      />

      {/* Middle content area — scrolls */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Left column: Portfolio — 300px */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            height: "100%",
            borderRight: "1px solid #1C2128",
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <PortfolioPanel portfolio={portfolio} />
        </div>

        {/* Right column: Decision Feed — fills remaining width */}
        <div
          style={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DecisionFeed events={events} connected={connected} />
        </div>
      </div>

      {/* Bottom bar: Market Shock — 52px, never scrolls */}
      <MarketShockPanel />
    </div>
  );
}
