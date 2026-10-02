import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.migrations_runner import run_migrations
from app.routers import merchant, payments, opportunities, actions, webhooks, audit, simulation
from app.security import require_admin
from app.seed import seed_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("razorgrowth")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_MIGRATE:
        # Alembic's env.py runs its own event loop, so it must run off this one.
        await asyncio.to_thread(run_migrations)
    await seed_db()
    if not settings.auth_required:
        logger.warning("ADMIN_API_KEY is not set: merchant-admin endpoints are UNAUTHENTICATED (demo only).")
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.warning("RAZORPAY_WEBHOOK_SECRET is not set: all webhooks will be rejected.")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Auth is header-based (X-Admin-Key), not cookies, so credentials are not needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "X-Admin-Key"],
)

admin = [Depends(require_admin)]

# Public: status (so the UI can tell whether a key is needed) and webhooks (HMAC-authenticated).
app.include_router(merchant.status_router, prefix=settings.API_V1_STR)
app.include_router(webhooks.router, prefix=settings.API_V1_STR)

# Merchant-admin endpoints.
app.include_router(merchant.router, prefix=settings.API_V1_STR, dependencies=admin)
app.include_router(payments.router, prefix=settings.API_V1_STR, dependencies=admin)
app.include_router(opportunities.router, prefix=settings.API_V1_STR, dependencies=admin)
app.include_router(actions.router, prefix=settings.API_V1_STR, dependencies=admin)
app.include_router(audit.router, prefix=settings.API_V1_STR, dependencies=admin)
app.include_router(simulation.router, prefix=settings.API_V1_STR, dependencies=admin)


@app.get("/")
async def root():
    return {
        "project": "RazorGrowth Permissioned AI Agent",
        "buildathon": "Razorpay AI Buildathon 2026",
        "docs": "/docs",
        "razorpay_mode": settings.razorpay_mode,
        "ai_provider": settings.ai_provider_mode,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
