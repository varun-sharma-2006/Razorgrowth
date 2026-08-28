from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.seed import seed_db
from app.routers import merchant, payments, opportunities, actions, webhooks, audit, simulation

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto initialize DB and seed data on startup
    await seed_db()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev/demo simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers under /api/v1
app.include_router(merchant.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(opportunities.router, prefix=settings.API_V1_STR)
app.include_router(actions.router, prefix=settings.API_V1_STR)
app.include_router(webhooks.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(simulation.router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {
        "project": "RazorGrowth Permissioned AI Agent",
        "buildathon": "Razorpay AI Buildathon 2026",
        "docs": "/docs",
        "razorpay_mode": "RAZORPAY TEST MODE" if settings.is_razorpay_live_test_mode else "LOCAL DEMO MODE",
        "ai_provider": settings.ai_provider_mode
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
