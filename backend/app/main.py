import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.migrations_runner import run_migrations
from app.routers import actions, admin, audit, auth, merchant, opportunities, payments, sim, simulation, webhooks
from app.security import require_admin

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("razorgrowth")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_MIGRATE:
        # Alembic's env.py runs its own event loop, so it must run off this one.
        await asyncio.to_thread(run_migrations)
    if not settings.GOOGLE_CLIENT_ID and not settings.ENABLE_DEV_LOGIN:
        logger.warning("GOOGLE_CLIENT_ID is not set: nobody can sign in.")
    if settings.ENABLE_DEV_LOGIN:
        logger.warning("ENABLE_DEV_LOGIN is on: anyone can sign in without Google (development only).")
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        logger.warning("RAZORPAY_WEBHOOK_SECRET is not set: all webhooks will be rejected.")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# The browser reaches the API same-origin (Vite proxy / Vercel rewrite), so cross-origin requests
# never need cookies; CORS stays credential-free.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

api = settings.API_V1_STR

# Public: status, sign-in, scenarios, the leaderboard, and HMAC-verified webhooks.
app.include_router(merchant.status_router, prefix=api)
app.include_router(auth.router, prefix=api)
app.include_router(sim.public_router, prefix=api)
app.include_router(webhooks.router, prefix=api)

# Per-user simulation endpoints (each resolves the signed-in user's current run).
for module in (sim, merchant, payments, opportunities, actions, audit, simulation):
    app.include_router(module.router, prefix=api)

# Operator-only: Google accounts listed in ADMIN_EMAILS.
app.include_router(admin.router, prefix=api, dependencies=[Depends(require_admin)])


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
