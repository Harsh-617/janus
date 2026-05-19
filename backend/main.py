import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from observability.tracing import setup_tracing
from db.firestore_client import initialize_portfolio

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    setup_tracing()
    await initialize_portfolio()
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

try:
    from api.portfolio import router as portfolio_router
    app.include_router(portfolio_router, prefix="/api", tags=["portfolio"])
except ImportError:
    logger.warning("api.portfolio router not found — skipping")

try:
    from api.trades import router as trades_router
    app.include_router(trades_router, prefix="/api", tags=["trades"])
except ImportError:
    logger.warning("api.trades router not found — skipping")

try:
    from api.cycles import router as cycles_router
    app.include_router(cycles_router, prefix="/api", tags=["cycles"])
except ImportError:
    logger.warning("api.cycles router not found — skipping")

try:
    from api.stream import router as stream_router
    app.include_router(stream_router, prefix="/api", tags=["stream"])
except ImportError:
    logger.warning("api.stream router not found — skipping")

try:
    from api.market_shock import router as market_shock_router
    app.include_router(market_shock_router, prefix="/api", tags=["market_shock"])
except ImportError:
    logger.warning("api.market_shock router not found — skipping")

try:
    from api.janus_loop import router as janus_loop_router
    app.include_router(janus_loop_router, prefix="/api", tags=["janus_loop"])
except ImportError:
    logger.warning("api.janus_loop router not found — skipping")


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
