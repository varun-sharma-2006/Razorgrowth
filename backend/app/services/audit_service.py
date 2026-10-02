import re
import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditEvent
from app.money import utc_now

_EMAIL_RE = re.compile(r"([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
_SECRET_KEYS = {"key_secret", "secret", "password", "authorization", "api_key", "signature"}
_MAX_STRING = 500


def mask_email(value: str) -> str:
    return _EMAIL_RE.sub(r"\1***@\2", value)


def sanitize(value: Any, key: str = "") -> Any:
    """Masks emails, redacts secrets and truncates long strings before they are persisted."""
    if key.lower() in _SECRET_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {k: sanitize(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize(v) for v in value]
    if isinstance(value, str):
        value = mask_email(value)
        return value if len(value) <= _MAX_STRING else value[:_MAX_STRING] + "…"
    return value


class AuditService:
    @staticmethod
    def log_event(
        db: AsyncSession,
        merchant_id: str,
        step: str,
        status: str,
        component: str,
        message: str,
        action_id: Optional[str] = None,
        sanitized_payload: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Adds an audit event to the caller's transaction. The caller commits."""
        event = AuditEvent(
            id=f"evt_{uuid.uuid4().hex[:12]}",
            action_id=action_id,
            merchant_id=merchant_id,
            step=step,
            status=status,
            component=component,
            message=mask_email(message),
            sanitized_payload=sanitize(sanitized_payload or {}),
            timestamp=utc_now()
        )
        db.add(event)
        return event
