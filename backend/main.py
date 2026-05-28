import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from observability.tracing import setup_tracing
from db.firestore_client import initialize_portfolio
from api.portfolio import router as portfolio_router
from api.trades import router as trades_router
from api.cycles import router as cycles_router
from api.stream import router as stream_router
from api.market_shock import router as market_shock_router
from api.janus_loop import router as janus_loop_router
from api.agents import router as agents_router
from api.routes.constraints import router as constraints_router
from api.routes.market_shock_parse import router as market_shock_parse_router
from api.routes.constraint_validate import router as constraint_validate_router
from api.routes.chat import router as chat_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    setup_tracing()
    await initialize_portfolio()
    from services.phoenix_mcp_client import verify_mcp_connection
    await verify_mcp_connection()
    import asyncio
    from services.cycle_scheduler import start_scheduler
    asyncio.create_task(start_scheduler())
    logging.info("Cycle scheduler started")
    logger.info("Janus system initialized and ready")
    yield
    logger.info("Janus system shutting down")


app = FastAPI(
    title="Janus Financial Intelligence System",
    description="Self-governing autonomous financial AI with Phoenix observability",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio_router, prefix="/api", tags=["portfolio"])
app.include_router(trades_router, prefix="/api", tags=["trades"])
app.include_router(cycles_router, prefix="/api", tags=["cycles"])
app.include_router(stream_router, prefix="/api", tags=["stream"])
app.include_router(market_shock_router, prefix="/api", tags=["market_shock"])
app.include_router(janus_loop_router, prefix="/api", tags=["janus_loop"])
app.include_router(agents_router, prefix="/api", tags=["agents"])
app.include_router(constraints_router, prefix="/api", tags=["constraints"])
app.include_router(market_shock_parse_router, prefix="/api", tags=["market-shock"])
app.include_router(constraint_validate_router, prefix="/api", tags=["constraints"])
app.include_router(chat_router, prefix="/api", tags=["chat"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "janus-backend", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "message": "Janus Financial Intelligence System",
        "docs": "/docs",
        "health": "/health",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
