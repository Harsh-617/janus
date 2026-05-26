interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function getScoreStyle(score: number) {
  if (score >= 7) {
    return {
      background: "#0A1F0A",
      color: "#22C55E",
      border: "1px solid #0A3A0A",
    };
  }
  if (score >= 5) {
    return {
      background: "#1A1500",
      color: "#C9A84C",
      border: "1px solid #332A00",
    };
  }
  return {
    background: "#1F0A0A",
    color: "#EF4444",
    border: "1px solid #3A0A0A",
  };
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const colorStyle = getScoreStyle(score);

  const sizeStyle =
    size === "sm"
      ? { fontSize: 10, padding: "2px 6px" }
      : { fontSize: 13, padding: "3px 10px" };

  return (
    <span
      style={{
        ...colorStyle,
        ...sizeStyle,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        borderRadius: 3,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {score.toFixed(1)}
    </span>
  );
}
