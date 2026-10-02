from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import LeaderboardEntry, Merchant
from app.services.sandbox_service import cleanup_stale_sandboxes

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    sandboxes = (await db.execute(select(func.count(Merchant.id)).where(Merchant.token_hash.is_not(None)))).scalar_one()
    entries = (await db.execute(select(func.count(LeaderboardEntry.id)))).scalar_one()
    return {"sandboxes": sandboxes, "leaderboard_entries": entries}


@router.delete("/leaderboard/{entry_id}", status_code=204)
async def remove_leaderboard_entry(entry_id: str, db: AsyncSession = Depends(get_db)):
    entry = await db.get(LeaderboardEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()


@router.post("/cleanup")
async def cleanup(db: AsyncSession = Depends(get_db)):
    return {"deleted_sandboxes": await cleanup_stale_sandboxes(db, limit=500)}
