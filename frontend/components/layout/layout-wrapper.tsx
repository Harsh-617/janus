"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar />
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
