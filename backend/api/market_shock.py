from fastapi import APIRouter
from pydantic import BaseModel
from services.cycle_scheduler import set_market_shock, get_scheduler_status
from db.firestore_client import save_portfolio, get_portfolio
from config import settings
import logging

router = APIRouter()

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
    logging.info(f"[MarketShock] Custom shock triggered: {request.description}")
    return {"status": "shock_activated", "description": request.description}

@router.post("/market-shock/clear")
async def clear_shock():
    """Clear active market shock, return to normal conditions."""
    set_market_shock(active=False, description="", effects={})
    logging.info("[MarketShock] Shock cleared")
    return {"status": "shock_cleared"}

@router.get("/market-shock/status")
async def shock_status():
    """Get current market shock status."""
    status = get_scheduler_status()
    return {
        "active": status["market_shock_active"],
        "description": status["market_shock_description"],
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
