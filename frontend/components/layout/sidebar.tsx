"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Arena",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="1" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="1" y="10" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="10" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/agents",
    label: "Agents",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="5.5" cy="9" r="1.5" fill="currentColor" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
        <circle cx="12.5" cy="9" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/janus-loop",
    label: "Janus Loop",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/observability",
    label: "Observability",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="11" width="3" height="6" rx="0.5" fill="currentColor" />
        <rect x="5.5" y="7" width="3" height="10" rx="0.5" fill="currentColor" />
        <rect x="10" y="4" width="3" height="13" rx="0.5" fill="currentColor" />
        <rect x="14.5" y="1" width="3" height="16" rx="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/audit",
    label: "Audit",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line x1="3" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="3" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const LIVE_DOT_ROUTES = new Set(["/", "/agents"]);

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 52,
        height: "100vh",
        flexShrink: 0,
        background: "#0D1117",
        borderRight: "1px solid #1C2128",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 12,
        gap: 4,
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 20 }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Janus">
          <circle cx="14" cy="14" r="13" stroke="#C9A84C" strokeWidth="1" />
          <line x1="14" y1="1" x2="14" y2="27" stroke="#1C2128" strokeWidth="1.5" />
          <circle cx="9" cy="13" r="2" fill="#4CADCE" />
          <circle cx="19" cy="13" r="2" fill="#C9A84C" />
        </svg>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        const showDot = isActive && LIVE_DOT_ROUTES.has(href);

        return (
          <Link
            key={href}
            href={href}
            title={label}
            style={{
              position: "relative",
              width: 36,
              height: 36,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: isActive ? "#C9A84C" : "#4B5563",
              background: isActive ? "#161B22" : "transparent",
              border: isActive ? "1px solid #2D2415" : "1px solid transparent",
            }}
          >
            {icon}
            {showDot && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#C9A84C",
                }}
              />
            )}
          </Link>
        );
      })}
    </aside>
  );
}
