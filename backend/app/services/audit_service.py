import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditEvent

class AuditService:
    @staticmethod
    async def log_event(
        db: AsyncSession,
        merchant_id: str,
        step: str,
        status: str,
        component: str,
        message: str,
        action_id: Optional[str] = None,
        sanitized_payload: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        event = AuditEvent(
            id=f"evt_{uuid.uuid4().hex[:10]}",
            action_id=action_id,
            merchant_id=merchant_id,
            step=step,
            status=status,
            component=component,
            message=message,
            sanitized_payload=sanitized_payload or {},
            timestamp=datetime.utcnow()
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event
