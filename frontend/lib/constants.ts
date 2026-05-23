export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  trading_agent: "Trading Agent",
  risk_agent: "Risk Agent",
  fraud_agent: "Fraud Intelligence",
  regulator_agent: "Regulator",
  judge_agent: "LLM Judge",
  meta_agent: "Janus Loop",
};

export const AGENT_COLORS: Record<string, string> = {
  trading_agent: "#4CADCE",
  risk_agent: "#C9A84C",
  fraud_agent: "#E05252",
  regulator_agent: "#8B6914",
  judge_agent: "#52E0A0",
  meta_agent: "#9B59B6",
};

export const DECISION_COLORS = {
  EXECUTE: "#52E0A0",
  HOLD: "#C9A84C",
  HALT: "#E05252",
};

export const SCORE_THRESHOLDS = { pass: 6, warn: 4 };
