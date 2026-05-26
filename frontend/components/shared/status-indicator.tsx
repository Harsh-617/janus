interface StatusIndicatorProps {
  status: string;
}

function getStatusStyle(status: string): { dotColor: string; labelColor: string; pulse: boolean } {
  switch (status.toUpperCase()) {
    case "RUNNING":
    case "ACTIVE":
    case "EXECUTE":
      return { dotColor: "#22C55E", labelColor: "#22C55E", pulse: false };
    case "THINKING":
    case "PROCESSING":
      return { dotColor: "#4CADCE", labelColor: "#4CADCE", pulse: true };
    case "MODIFIED":
    case "ALERT":
    case "WARNING":
      return { dotColor: "#F59E0B", labelColor: "#F59E0B", pulse: false };
    case "VETO":
    case "HALT":
    case "ERROR":
    case "CIRCUIT BREAKER":
      return { dotColor: "#EF4444", labelColor: "#EF4444", pulse: false };
    default:
      return { dotColor: "#4B5563", labelColor: "#8B949E", pulse: false };
  }
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const { dotColor, labelColor, pulse } = getStatusStyle(status);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
          animation: pulse ? "janus-pulse 2s ease-in-out infinite" : "none",
        }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: labelColor,
          lineHeight: 1,
        }}
      >
        {status}
      </span>
    </div>
  );
}
