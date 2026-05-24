"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { usePortfolio } from "@/hooks/use-portfolio";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { portfolio, refetch } = usePortfolio();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar portfolio={portfolio} onCircuitBreakerToggle={refetch} />
        <main className="flex-1 overflow-y-auto bg-[var(--janus-background)] p-4 pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
