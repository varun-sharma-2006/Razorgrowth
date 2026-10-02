from typing import Optional
from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Merchant
from app.services.sandbox_service import hash_token
from app.simclock import current_sim_tick


async def current_merchant(
    x_sandbox_token: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    """Resolves the visitor's sandbox from the X-Sandbox-Token header.

    The token is a bearer secret held only by the visitor's browser; the server stores its hash.
    """
    if not x_sandbox_token:
        raise HTTPException(status_code=401, detail="Missing X-Sandbox-Token header. Start a simulation first.")
    merchant = (await db.execute(
        select(Merchant).where(Merchant.token_hash == hash_token(x_sandbox_token))
    )).scalars().first()
    if merchant is None:
        raise HTTPException(status_code=401, detail="This simulation no longer exists. Start a new one.")
    current_sim_tick.set(merchant.current_tick)
    return merchant
