from fastapi import APIRouter
from pydantic import BaseModel
from services.cycle_scheduler import set_market_shock, get_scheduler_status, broadcast_event
from db.firestore_client import save_portfolio, get_portfolio
from config import settings
from datetime import datetime, timezone
import logging

router = APIRouter()

_active_shock_meta: dict = {"activated_at": None, "scenario_id": None, "scenario_name": None}

PRESET_SCENARIOS = {
    "oil_shock": {
        "name": "Oil Price Surge",
        "description": "Geopolitical conflict drives oil up 40%",
        "effects": {"XOM": 0.18, "GLD": 0.12, "AAPL": -0.08, "TLT": -0.05},
    },
    "crypto_crash": {
        "name": "Crypto Black Swan",
        "description": "Major exchange collapse triggers 60% crypto selloff",
        "effects": {"BTC-USD": -0.60, "GLD": 0.15, "AAPL": -0.05},
    },
    "fed_rate_hike": {
        "name": "Emergency Fed Rate Hike",
        "description": "+150bps surprise hike shocks bond markets",
        "effects": {"TLT": -0.12, "AAPL": -0.10, "GLD": 0.08, "XOM": 0.05},
    },
    "bank_run": {
        "name": "Regional Bank Crisis",
        "description": "Contagion fears spread through banking sector",
        "effects": {"KRE": -0.35, "GLD": 0.20, "AMZN": -0.08, "TLT": 0.10},
    },
}

class CustomShockRequest(BaseModel):
    description: str
    effects: dict = {}

class ValidateEventRequest(BaseModel):
    description: str
    price_effects: dict = {}

@router.post("/market-shock/validate")
async def validate_event(request: ValidateEventRequest):
    """Validate and improve a custom event description using the LLM."""
    import json
    from services.gemini_client import generate

    system_prompt = "You are a financial news validator. Respond only with valid JSON, no markdown."
    user_message = (
        f"Analyze this event description and determine if it is a realistic financial market event.\n\n"
        f"Event: '{request.description}'\n\n"
        "Respond ONLY with valid JSON in this exact format:\n"
        "{\n"
        '  "valid": true,\n'
        '  "headline": "Rewritten as professional financial news headline (only if valid)",\n'
        '  "reason": "Why it is or is not valid (one sentence)",\n'
        '  "suggestions": []\n'
        "}\n\n"
        "A valid event must:\n"
        "- Be a realistic event that could affect financial markets\n"
        "- Be specific enough to suggest price movements\n"
        "- Not be apocalyptic, fictional, or impossible\n\n"
        "If valid, suggestions should be empty [].\n"
        "If invalid, headline should be empty string and suggestions should contain 3 alternative events."
    )

    try:
        raw = await generate(
            system_prompt=system_prompt,
            user_message=user_message,
            temperature=0.3,
        )
        text = raw.strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:-1])
        result = json.loads(text)
        if request.price_effects:
            warnings = []
            for ticker, value in request.price_effects.items():
                if not isinstance(value, (int, float)) or value < -0.99 or value > 5.0:
                    warnings.append(f"{ticker}: {value} is out of valid range (-0.99 to 5.0)")
            if warnings:
                result["price_effects_warning"] = "; ".join(warnings)
        return result
    except Exception as e:
        logging.warning(f"[MarketShock] Validation LLM call failed: {e}")
        return {"valid": True, "headline": request.description, "reason": "", "suggestions": []}

@router.get("/market-shock/scenarios")
async def list_scenarios():
    """List all preset market shock scenarios."""
    return {"scenarios": [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in PRESET_SCENARIOS.items()
    ]}

@router.post("/market-shock/preset/{scenario_id}")
async def trigger_preset_shock(scenario_id: str):
    """Trigger a preset market shock scenario."""
    if scenario_id not in PRESET_SCENARIOS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    scenario = PRESET_SCENARIOS[scenario_id]
    set_market_shock(
        active=True,
        description=scenario["description"],
        effects=scenario["effects"],
    )
    if settings.DEMO_MODE and scenario_id == "oil_shock":
        from tools.market_data import set_demo_shock
        set_demo_shock(True)
    _active_shock_meta["activated_at"] = datetime.now(timezone.utc).isoformat()
    _active_shock_meta["scenario_id"] = scenario_id
    _active_shock_meta["scenario_name"] = scenario["name"]
    logging.info(f"[MarketShock] Preset triggered: {scenario_id}")
    return {
        "status": "shock_activated",
        "scenario": scenario_id,
        "name": scenario["name"],
        "description": scenario["description"],
        "effects": scenario["effects"],
    }

@router.post("/market-shock/custom")
async def trigger_custom_shock(request: CustomShockRequest):
    """Trigger a custom market shock event."""
    set_market_shock(
        active=True,
        description=request.description,
        effects=request.effects,
    )
    _active_shock_meta["activated_at"] = datetime.now(timezone.utc).isoformat()
    _active_shock_meta["scenario_id"] = None
    _active_shock_meta["scenario_name"] = "Custom Event"
    logging.info(f"[MarketShock] Custom shock triggered: {request.description}")
    return {"status": "shock_activated", "description": request.description}

@router.post("/market-shock/reset-demo")
async def reset_demo_shock():
    """Clear demo shock flag, reverting to normal demo prices."""
    if settings.DEMO_MODE:
        from tools.market_data import set_demo_shock
        set_demo_shock(False)
        return {"status": "demo shock cleared, reverting to normal demo prices"}
    return {"status": "not in demo mode"}


@router.post("/market-shock/clear")
async def clear_shock():
    """Clear active market shock, return to normal conditions."""
    set_market_shock(active=False, description="", effects={})
    _active_shock_meta["activated_at"] = None
    _active_shock_meta["scenario_id"] = None
    _active_shock_meta["scenario_name"] = None
    logging.info("[MarketShock] Shock cleared")
    return {"status": "shock_cleared"}

@router.get("/market-shock/status")
async def shock_status():
    """Get current market shock status."""
    status = get_scheduler_status()
    return {
        "active": status["market_shock_active"],
        "description": status["market_shock_description"],
        "activated_at": _active_shock_meta["activated_at"] if status["market_shock_active"] else None,
        "scenario_id": _active_shock_meta["scenario_id"] if status["market_shock_active"] else None,
        "scenario_name": _active_shock_meta["scenario_name"] if status["market_shock_active"] else None,
    }

@router.post("/circuit-breaker/activate")
async def activate_circuit_breaker():
    """Manually activate the circuit breaker."""
    portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if portfolio:
        portfolio["circuit_breaker_active"] = True
        portfolio["risk_mode"] = "HALTED"
        await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, portfolio)
    from services.cycle_scheduler import stop_scheduler
    stop_scheduler()
    await broadcast_event("circuit_breaker_activated", {
        "cycle_id": "manual",
        "reason": "Manual circuit breaker activation from dashboard",
        "cooldown_minutes": 15
    })
    logging.warning("[CircuitBreaker] Manually activated")
    return {"status": "circuit_breaker_active", "message": "Trading halted"}

@router.post("/circuit-breaker/release")
async def release_circuit_breaker():
    """Release the circuit breaker and resume trading."""
    portfolio = await get_portfolio(settings.FIRESTORE_PORTFOLIO_ID)
    if portfolio:
        portfolio["circuit_breaker_active"] = False
        portfolio["risk_mode"] = "NORMAL"
        await save_portfolio(settings.FIRESTORE_PORTFOLIO_ID, portfolio)
    import asyncio
    from services.cycle_scheduler import start_scheduler
    asyncio.create_task(start_scheduler())
    logging.info("[CircuitBreaker] Released — trading resumed")
    return {"status": "circuit_breaker_released", "message": "Trading resumed"}
