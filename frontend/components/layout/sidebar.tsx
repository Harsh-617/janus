"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Bot,
  RefreshCw,
  Activity,
  FileText,
} from "lucide-react";
import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { LiveIndicator } from "@/components/shared/live-indicator";

const navItems = [
  { href: "/", label: "The Arena", icon: LayoutDashboard },
  { href: "/agents", label: "Agent Control Room", icon: Bot },
  { href: "/janus-loop", label: "Janus Loop", icon: RefreshCw },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/audit", label: "Audit Log", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isHealthy, setIsHealthy] = useState(false);

  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        await checkHealth();
        setIsHealthy(true);
      } catch {
        setIsHealthy(false);
      }
    };

    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-[200px] h-screen bg-[var(--janus-surface)] border-r border-[var(--janus-border)] flex flex-col">
      <div className="p-6 border-b border-[var(--janus-border)]">
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[var(--janus-gold)]"
          >
            <circle cx="8" cy="8" r="3" fill="currentColor" />
            <circle cx="16" cy="8" r="3" fill="currentColor" />
            <path
              d="M12 12 L8 16 L12 20 L16 16 L12 12Z"
              fill="currentColor"
            />
          </svg>
          <h1 className="text-xl font-bold font-cinzel text-[var(--janus-gold)] tracking-wider">
            JANUS
          </h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--janus-gold)]/20 text-[var(--janus-gold)]"
                  : "text-[var(--janus-text-secondary)] hover:text-[var(--janus-text-primary)] hover:bg-[var(--janus-border)]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--janus-border)]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--janus-text-muted)]">
            Backend
          </span>
          <LiveIndicator active={isHealthy} />
        </div>
      </div>
    </aside>
  );
}
