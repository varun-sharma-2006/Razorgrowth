from typing import Optional
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import User
from app.security import current_user
from app.services.auth_service import (
    SESSION_COOKIE, create_session, end_session, upsert_user, verify_google_credential,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


class AuthConfigSchema(BaseModel):
    google_client_id: str
    dev_login_enabled: bool


class GoogleLoginSchema(BaseModel):
    credential: str = Field(min_length=20, max_length=8192)


class DevLoginSchema(BaseModel):
    email: EmailStr = "dev@razorgrowth.local"
    name: str = Field(default="Dev Merchant", min_length=1, max_length=60)


class UserSchema(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    is_admin: bool


def user_schema(user: User) -> UserSchema:
    return UserSchema(
        id=user.id, email=user.email, name=user.name, picture=user.picture,
        is_admin=user.email.lower() in settings.admin_emails,
    )


def _set_session_cookie(request: Request, response: Response, token: str) -> None:
    # The API is served same-origin (Vite proxy locally, Vercel rewrite in production), so a
    # first-party, httpOnly, SameSite=Lax cookie works and is never readable by page scripts.
    https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").startswith("https")
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=settings.SESSION_TTL_DAYS * 24 * 3600,
        httponly=True, secure=https, samesite="lax", path="/",
    )


@router.get("/config", response_model=AuthConfigSchema)
async def auth_config():
    return AuthConfigSchema(google_client_id=settings.GOOGLE_CLIENT_ID, dev_login_enabled=settings.ENABLE_DEV_LOGIN)


@router.post("/google", response_model=UserSchema)
async def google_login(body: GoogleLoginSchema, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        claims = verify_google_credential(body.credential)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Google sign-in failed: {e}")
    user = await upsert_user(
        db, sub=claims["sub"], email=claims["email"],
        name=claims.get("name") or claims["email"].split("@")[0], picture=claims.get("picture"),
    )
    token = await create_session(db, user)
    await db.commit()
    _set_session_cookie(request, response, token)
    return user_schema(user)


@router.post("/dev-login", response_model=UserSchema)
async def dev_login(body: DevLoginSchema, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Local development and tests only (ENABLE_DEV_LOGIN). Dev accounts never get admin rights in production."""
    if not settings.ENABLE_DEV_LOGIN:
        raise HTTPException(status_code=404, detail="Not found")
    user = await upsert_user(db, sub=f"dev:{body.email.lower()}", email=body.email.lower(), name=body.name, picture=None)
    token = await create_session(db, user)
    await db.commit()
    _set_session_cookie(request, response, token)
    return user_schema(user)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    if session_token:
        await end_session(db, session_token)
        await db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserSchema)
async def me(user: User = Depends(current_user)):
    return user_schema(user)
