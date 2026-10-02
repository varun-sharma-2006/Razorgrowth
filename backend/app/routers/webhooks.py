import hashlib
import json
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Action, RecoveryLink, WebhookEvent
from app.money import format_inr, utc_now
from app.services.audit_service import AuditService
from app.services.link_outcomes import settle_link
from app.services.razorpay_service import RazorpayService

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

SYSTEM_MERCHANT = "_system"  # audit owner for deliveries that can't be tied to a merchant

LINK_STATUS_BY_EVENT = {
    "payment_link.paid": "PAID",
    "payment_link.expired": "EXPIRED",
    "payment_link.cancelled": "CANCELLED",
}


async def _reject(db: AsyncSession, message: str, payload: dict) -> HTTPException:
    AuditService.log_event(
        db=db,
        merchant_id=SYSTEM_MERCHANT,
        step="WEBHOOK_RECEIVED",
        status="BLOCKED",
        component="WebhookHandler",
        message=f"Razorpay Webhook Rejected: {message}",
        sanitized_payload=payload,
    )
    await db.commit()
    return HTTPException(status_code=400, detail=message)


@router.post("/razorpay")
async def handle_razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    x_razorpay_event_id: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret is not configured on the server")

    raw_body = await request.body()
    if not x_razorpay_signature:
        raise await _reject(db, "Missing X-Razorpay-Signature header", {})
    if not RazorpayService.verify_webhook_signature(raw_body, x_razorpay_signature):
        raise await _reject(db, "Invalid HMAC SHA256 signature", {"provided_signature": x_razorpay_signature[:10] + "..."})

    try:
        body = json.loads(raw_body)
        if not isinstance(body, dict):
            raise ValueError("body is not a JSON object")
    except ValueError:
        raise HTTPException(status_code=400, detail="Webhook body is not valid JSON")

    event_name = str(body.get("event", "unknown"))
    event_id = x_razorpay_event_id or "sha256_" + hashlib.sha256(raw_body).hexdigest()[:40]

    # Razorpay retries deliveries; process each event once.
    if await db.get(WebhookEvent, event_id) is not None:
        return {"status": "duplicate", "event": event_name, "event_id": event_id}
    db.add(WebhookEvent(id=event_id, event=event_name))

    payload = body.get("payload") or {}
    link_entity = (payload.get("payment_link") or {}).get("entity") or {}
    payment_entity = (payload.get("payment") or {}).get("entity") or {}
    log = {"event": event_name, "event_id": event_id, "signature_verified": True}
    message = f"Received signature-verified webhook event '{event_name}'"
    merchant_id = SYSTEM_MERCHANT
    action_id = None

    new_link_status = LINK_STATUS_BY_EVENT.get(event_name)
    if new_link_status and (link_entity.get("id") or link_entity.get("reference_id")):
        conditions = []
        if link_entity.get("id"):
            conditions.append(RecoveryLink.razorpay_link_id == link_entity["id"])
        if link_entity.get("reference_id"):
            conditions.append(RecoveryLink.reference_id == link_entity["reference_id"])
        link = (await db.execute(select(RecoveryLink).where(or_(*conditions)))).scalars().first()
        log.update(razorpay_link_id=link_entity.get("id"), reference_id=link_entity.get("reference_id"))

        if link is None:
            message += " for an unknown payment link (ignored)"
        else:
            action = await db.get(Action, link.action_id)
            merchant_id, action_id = action.merchant_id, action.id
            log.update(recovery_link_id=link.id, original_payment_id=link.payment_id)
            await settle_link(db, link, new_link_status, utc_now())
            if new_link_status == "PAID":
                message = (
                    f"Recovery payment received: {format_inr(link.amount_paise)} for original payment "
                    f"{link.payment_id} via link {link.razorpay_link_id}"
                )
            else:
                message = f"Recovery link for {link.payment_id} is now {link.status}"
    elif payment_entity:
        log.update(payment_id=payment_entity.get("id"), order_id=payment_entity.get("order_id"),
                   amount=(payment_entity.get("amount") or 0) / 100, status=payment_entity.get("status"))
        message += f" for payment {payment_entity.get('id')}"

    AuditService.log_event(
        db=db,
        merchant_id=merchant_id,
        action_id=action_id,
        step="WEBHOOK_RECEIVED",
        status="SUCCESS",
        component="WebhookHandler",
        message=message,
        sanitized_payload=log,
    )
    await db.commit()
    return {"status": "processed", "event": event_name, "event_id": event_id, "signature_verified": True}
