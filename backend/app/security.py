from typing import Optional
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import User
from app.services.auth_service import SESSION_COOKIE, user_for_session


async def current_user(
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> User:
    """The signed-in user, from the httpOnly session cookie set after Google sign-in."""
    if not session_token:
        raise HTTPException(status_code=401, detail="Please sign in with Google.")
    user = await user_for_session(db, session_token)
    if user is None:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    return user


async def require_admin(user: User = Depends(current_user)) -> User:
    """Operator endpoints: only Google accounts listed in ADMIN_EMAILS."""
    allowed = user.email.lower() in settings.admin_emails
    if not allowed or (user.is_dev_account and not settings.ENABLE_DEV_LOGIN):
        raise HTTPException(status_code=403, detail="This account is not an administrator.")
    return user
