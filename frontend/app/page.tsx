"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { AgentStatusBar } from "@/components/arena/agent-status-bar";
import { PortfolioPanel } from "@/components/arena/portfolio-panel";
import { DecisionFeed } from "@/components/arena/decision-feed";
import { MarketShockPanel } from "@/components/arena/market-shock-panel";
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

        {/* Main Grid: Portfolio + Decision Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
          {/* Portfolio Panel - Left */}
          <div className="lg:col-span-1">
            <PortfolioPanel portfolio={portfolio} />
          </div>

          {/* Decision Feed - Center/Right */}
          <div className="lg:col-span-2">
            <DecisionFeed events={events} connected={connected} />
          </div>
        </div>

        {/* Market Shock Panel */}
        <MarketShockPanel />
      </div>
    </LayoutWrapper>
  );
}
