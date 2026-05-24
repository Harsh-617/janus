"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { AgentStatusBar } from "@/components/arena/agent-status-bar";
import { PortfolioPanel } from "@/components/arena/portfolio-panel";
import { DecisionFeed } from "@/components/arena/decision-feed";
import { MarketShockPanel } from "@/components/arena/market-shock-panel";
import { JanusDivider } from "@/components/layout/janus-divider";
import { usePortfolio } from "@/hooks/use-portfolio";
import { useCycles } from "@/hooks/use-cycles";
import { useAgentStream } from "@/hooks/use-agent-stream";

export default function Arena() {
  const { portfolio } = usePortfolio();
  const { cycles } = useCycles();
  const { events, connected, activeAgents, lastCycle } = useAgentStream();

  return (
    <LayoutWrapper>
      <div className="space-y-6">
        {/* Agent Status Bar */}
        <AgentStatusBar
          activeAgents={activeAgents}
          lastCycle={lastCycle}
          connected={connected}
        />

        {/* Main Layout: Forward Face | Divider | Backward Face */}
        <div className="flex gap-0 min-h-[600px]">
          {/* Left: Portfolio Panel — Forward Face */}
          <div className="flex-1 flex flex-col">
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4CADCE" }}>
              ◀ THE FORWARD FACE
            </p>
            <div className="flex-1" style={{ background: "linear-gradient(to bottom, rgba(76, 173, 206, 0.03), transparent)" }}>
              <PortfolioPanel portfolio={portfolio} />
            </div>
          </div>

          {/* Janus Divider */}
          <div className="w-10 flex-shrink-0">
            <JanusDivider />
          </div>

          {/* Right: Decision Feed — Backward Face */}
          <div className="flex-[2] flex flex-col">
            <p className="text-[10px] uppercase tracking-widest mb-2 text-right" style={{ color: "#C9A84C" }}>
              THE BACKWARD FACE ▶
            </p>
            <div className="flex-1" style={{ background: "linear-gradient(to bottom, rgba(201, 168, 76, 0.03), transparent)" }}>
              <DecisionFeed events={events} connected={connected} />
            </div>
          </div>
        </div>

        {/* Market Shock Panel */}
        <MarketShockPanel />
      </div>
    </LayoutWrapper>
  );
}
