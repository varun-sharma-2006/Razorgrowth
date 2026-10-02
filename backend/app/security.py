import hmac
from typing import Optional
from fastapi import Header, HTTPException
from app.config import settings


async def require_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    """Guards operator-only endpoints (leaderboard moderation, stats) with X-Admin-Key.

    Visitors never need this: each one gets their own sandbox token instead.
    When ADMIN_API_KEY is unset the admin API is disabled entirely.
    """
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API is disabled (ADMIN_API_KEY is not set)")
    if not x_admin_key or not hmac.compare_digest(
        x_admin_key.encode("utf-8"), settings.ADMIN_API_KEY.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Missing or invalid X-Admin-Key header")
