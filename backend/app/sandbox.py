from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Merchant, User
from app.security import current_user
from app.simclock import current_sim_tick


async def current_merchant(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> Merchant:
    """The signed-in user's current simulation run (their most recently started one)."""
    merchant = (await db.execute(
        select(Merchant).where(Merchant.user_id == user.id).order_by(Merchant.created_at.desc(), Merchant.id.desc())
    )).scalars().first()
    if merchant is None:
        raise HTTPException(status_code=404, detail="You don't have a simulation yet. Start one.")
    current_sim_tick.set(merchant.current_tick)
    return merchant
