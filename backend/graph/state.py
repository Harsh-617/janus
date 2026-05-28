from __future__ import annotations

import operator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Annotated, Any

from typing_extensions import TypedDict


@dataclass
class TradeProposal:
    ticker: str
    direction: str  # "BUY" | "SELL" | "HOLD"
    quantity: float
    rationale: str
    confidence: float = 0.0


@dataclass
class RiskReport:
    decision: str  # "APPROVE" | "MODIFY" | "VETO"
    current_var: float = 0.0
    proposed_var: float = 0.0
    verdict: str = ""
    modifications: str = ""
    vetoed_trades: list = field(default_factory=list)
    modified_trades: list = field(default_factory=list)


@dataclass
class FraudAlert:
    alert_type: str
    severity: str  # "LOW" | "MEDIUM" | "HIGH"
    description: str
    flagged_trade_id: str = ""
    recommendation: str = ""


@dataclass
class RegulatorDecision:
    final_decision: str  # "EXECUTE" | "HOLD" | "HALT"
    circuit_breaker_activated: bool = False
    cooldown_minutes: int = 0
    reason: str = ""
    audit_trail_id: str = ""
    resume_conditions: list = field(default_factory=list)


@dataclass
class JudgeScore:
    cycle_id: str
    overall_score: float
    correctness: float
    safety: float
    hallucination_risk: float
    compliance: float
    explainability: float
    critical_finding: str = ""
    learning_event: bool = False
    learning_event_reason: str = ""
    recommended_constraint: str = ""


class JanusState(TypedDict):
    # Cycle metadata
    cycle_id: str
    cycle_number: int
    timestamp: str

    # Market context (injected at cycle start)
    portfolio: dict
    market_prices: dict
    news_headlines: list[str]
    market_shock_active: bool
    market_shock_description: str

    # Behavioral constraints from Janus Loop
    active_constraints: list[str]

    # Agent outputs (each agent writes its section)
    trading_proposal: dict | None
    trading_thesis: str
    trading_confidence: float

    risk_report: dict | None

    fraud_alerts: list[dict]
    fraud_investigation_open: bool

    regulator_decision: dict | None

    judge_scores: dict | None

    # Execution result
    trades_executed: list[dict]
    execution_errors: list[str]

    # Phoenix trace references
    phoenix_trace_id: str
    phoenix_span_id: str  # real OTel span ID (16-char hex) for annotation linking
    cycle_span: Any  # holds the root span reference

    # Flow control
    pipeline_halted: bool
    halt_reason: str


def create_initial_state(
    cycle_id: str,
    cycle_number: int,
    portfolio: dict,
) -> JanusState:
    return JanusState(
        cycle_id=cycle_id,
        cycle_number=cycle_number,
        timestamp=datetime.now(timezone.utc).isoformat(),
        portfolio=portfolio,
        market_prices={},
        news_headlines=[],
        market_shock_active=False,
        market_shock_description="",
        active_constraints=[],
        trading_proposal=None,
        trading_thesis="",
        trading_confidence=0.0,
        risk_report=None,
        fraud_alerts=[],
        fraud_investigation_open=False,
        regulator_decision=None,
        judge_scores=None,
        trades_executed=[],
        execution_errors=[],
        phoenix_trace_id="",
        phoenix_span_id="",
        cycle_span=None,
        pipeline_halted=False,
        halt_reason="",
    )