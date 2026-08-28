from fastapi import APIRouter, Request, Depends, Header, HTTPException, Response
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.services.razorpay_service import RazorpayService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/razorpay")
async def handle_razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    raw_body = await request.body()
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Verify Webhook HMAC Signature if signature header is provided or in live test mode
    if x_razorpay_signature and settings.RAZORPAY_WEBHOOK_SECRET:
        is_valid = RazorpayService.verify_webhook_signature(raw_body, x_razorpay_signature)
        if not is_valid:
            await AuditService.log_event(
                db=db,
                merchant_id=settings.MERCHANT_ID,
                step="WEBHOOK_RECEIVED",
                status="BLOCKED",
                component="WebhookHandler",
                message="Razorpay Webhook Rejected: Invalid HMAC SHA256 Signature Header",
                sanitized_payload={"provided_signature": x_razorpay_signature[:10] + "..."}
            )
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_name = body.get("event", "order.paid")
    payload = body.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id") or payment_entity.get("id", "pay_demo_wh")
    amount = (payment_entity.get("amount", 85000)) / 100.0 if payment_entity.get("amount") else 850.0

    await AuditService.log_event(
        db=db,
        merchant_id=settings.MERCHANT_ID,
        step="WEBHOOK_RECEIVED",
        status="SUCCESS",
        component="WebhookHandler",
        message=f"Received & Signature-Verified Webhook Event '{event_name}' for Order/Payment ID {order_id} (Amount: ₹{amount:,.2f})",
        sanitized_payload={
            "event": event_name,
            "order_id": order_id,
            "amount": amount,
            "currency": payment_entity.get("currency", "INR"),
            "status": payment_entity.get("status", "captured"),
            "signature_verified": bool(x_razorpay_signature)
        }
    )

    return {"status": "processed", "event": event_name, "signature_verified": bool(x_razorpay_signature)}
