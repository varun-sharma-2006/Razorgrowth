from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import AuditEvent
from app.schemas import AuditEventSchema

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("", response_model=List[AuditEventSchema])
async def list_audit_events(
    action_id: Optional[str] = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditEvent).where(AuditEvent.merchant_id == settings.MERCHANT_ID)
    if action_id:
        query = query.where(AuditEvent.action_id == action_id)
    query = query.order_by(AuditEvent.timestamp.desc()).limit(limit)
    return (await db.execute(query)).scalars().all()
