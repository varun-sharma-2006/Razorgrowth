import hmac
from typing import Optional
from fastapi import Header, HTTPException
from app.config import settings


async def require_admin(x_admin_key: Optional[str] = Header(default=None)) -> None:
    """Guards merchant-admin endpoints with a shared API key (X-Admin-Key header).

    Disabled only when ADMIN_API_KEY is unset, which the app logs loudly at startup
    and reports via /merchant/status so the UI can show it.
    """
    if not settings.ADMIN_API_KEY:
        return
    if not x_admin_key or not hmac.compare_digest(
        x_admin_key.encode("utf-8"), settings.ADMIN_API_KEY.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Missing or invalid X-Admin-Key header")


def actor_label() -> str:
    return "admin-api-key" if settings.auth_required else "unauthenticated-demo"
