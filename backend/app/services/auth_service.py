"""Sign in with Google and cookie sessions."""
import hashlib
import secrets
import uuid
from datetime import timedelta
from typing import Any, Dict, Optional
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import User, UserSession
from app.money import as_utc, utc_now

SESSION_COOKIE = "rg_session"


def verify_google_credential(credential: str) -> Dict[str, Any]:
    """Claims of a genuine Google ID token issued to this app for a verified email; raises ValueError otherwise.

    verify_oauth2_token checks Google's signature, the expiry, the issuer and that the token was issued
    for our client ID, so a token minted for another site can't be replayed here.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured on the server")
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    claims = id_token.verify_oauth2_token(
        credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID, clock_skew_in_seconds=10
    )
    if not claims.get("email") or not claims.get("email_verified"):
        raise ValueError("This Google account's email address is not verified")
    return claims


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def upsert_user(db: AsyncSession, sub: str, email: str, name: str, picture: Optional[str]) -> User:
    user = (await db.execute(select(User).where(User.google_sub == sub))).scalars().first()
    if user is None:
        user = User(id=f"usr_{uuid.uuid4().hex[:12]}", google_sub=sub, email=email, name=name, picture=picture)
        db.add(user)
    else:
        # Keep profile details current with the Google account.
        user.email, user.name, user.picture = email, name, picture
    user.last_login_at = utc_now()
    await db.flush()
    return user


async def create_session(db: AsyncSession, user: User) -> str:
    """Returns the raw session token for the cookie; only its hash is stored."""
    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        id=_hash(token),
        user_id=user.id,
        expires_at=utc_now() + timedelta(days=settings.SESSION_TTL_DAYS),
    ))
    # Opportunistically drop this user's expired sessions.
    await db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at < utc_now()))
    return token


async def user_for_session(db: AsyncSession, token: str) -> Optional[User]:
    session = await db.get(UserSession, _hash(token))
    if session is None or as_utc(session.expires_at) < utc_now():
        return None
    return await db.get(User, session.user_id)


async def end_session(db: AsyncSession, token: str) -> None:
    await db.execute(delete(UserSession).where(UserSession.id == _hash(token)))
