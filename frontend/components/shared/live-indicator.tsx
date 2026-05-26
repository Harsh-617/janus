interface LiveIndicatorProps {
  label?: string;
}

export function LiveIndicator({ label }: LiveIndicatorProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          width: 6,
          height: 6,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "#4CADCE",
            animation: "janus-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
            opacity: 0.75,
          }}
        />
        <span
          style={{
            position: "relative",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#4CADCE",
          }}
        />
      </span>
      {label && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#4CADCE",
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
