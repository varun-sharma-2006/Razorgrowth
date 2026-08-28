from fastapi import APIRouter, Depends
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models import AuditEvent
from app.schemas import AuditEventSchema

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("", response_model=List[AuditEventSchema])
async def list_audit_events(
    action_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    merchant_id = settings.MERCHANT_ID
    query = select(AuditEvent).where(AuditEvent.merchant_id == merchant_id)
    if action_id:
        query = query.where(AuditEvent.action_id == action_id)
    query = query.order_by(AuditEvent.timestamp.desc())

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        AuditEventSchema(
            id=e.id,
            action_id=e.action_id,
            merchant_id=e.merchant_id,
            step=e.step,
            status=e.status,
            component=e.component,
            message=e.message,
            sanitized_payload=e.sanitized_payload or {},
            timestamp=e.timestamp
        )
        for e in events
    ]
