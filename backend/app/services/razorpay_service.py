import httpx
import uuid
import asyncio
import hmac
import hashlib
from typing import Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.services.audit_service import AuditService

class RazorpayService:
    @staticmethod
    def get_mode() -> str:
        return "RAZORPAY TEST MODE" if settings.is_razorpay_live_test_mode else "LOCAL DEMO MODE"

    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
        """
        Verifies Razorpay Webhook HMAC SHA256 signature against RAZORPAY_WEBHOOK_SECRET.
        """
        if not signature:
            return False
        secret = settings.RAZORPAY_WEBHOOK_SECRET.encode('utf-8')
        expected_signature = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_signature, signature)

    @staticmethod
    async def create_payment_link(
        amount_inr: float,
        description: str,
        customer_name: str,
        customer_email: str,
        idempotency_key: str,
        db: AsyncSession,
        merchant_id: str,
        action_id: str
    ) -> Tuple[bool, Dict[str, Any]]:
        amount_paise = int(amount_inr * 100)
        mode = RazorpayService.get_mode()

        await AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            action_id=action_id,
            step="RAZORPAY_API_CALL",
            status="PENDING",
            component="RazorpayService",
            message=f"Initiating Razorpay API Payment Link creation ({mode}) for amount ₹{amount_inr:,.2f} with Idempotency Key: {idempotency_key}",
            sanitized_payload={
                "amount": amount_inr,
                "currency": "INR",
                "mode": mode,
                "idempotency_key": idempotency_key,
                "customer_email": customer_email
            }
        )

        if settings.is_razorpay_live_test_mode:
            # Real Razorpay Test Mode REST API call using httpx
            auth = (settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            payload = {
                "amount": amount_paise,
                "currency": "INR",
                "accept_partial": False,
                "description": description,
                "customer": {
                    "name": customer_name,
                    "email": customer_email
                },
                "notify": {"sms": False, "email": True},
                "reminder_enable": True,
                "notes": {
                    "idempotency_key": idempotency_key,
                    "source": "RazorGrowth AI"
                }
            }
            headers = {
                "X-Razorpay-Idempotency-Key": idempotency_key
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        "https://api.razorpay.com/v1/payment_links",
                        json=payload,
                        auth=auth,
                        headers=headers
                    )
                    if res.status_code in [200, 201]:
                        data = res.json()
                        payment_link = data.get("short_url", f"https://rzp.io/i/{data.get('id')}")
                        order_id = data.get("id")
                        
                        await AuditService.log_event(
                            db=db,
                            merchant_id=merchant_id,
                            action_id=action_id,
                            step="RAZORPAY_API_CALL",
                            status="SUCCESS",
                            component="RazorpayService",
                            message=f"Razorpay Test API returned success. Payment Link: {payment_link}",
                            sanitized_payload={
                                "order_id": order_id,
                                "payment_link": payment_link,
                                "status": "created",
                                "idempotency_key": idempotency_key
                            }
                        )
                        return True, {"order_id": order_id, "payment_link": payment_link}
                    else:
                        error_msg = f"Razorpay API HTTP {res.status_code}: {res.text}"
                        await AuditService.log_event(
                            db=db,
                            merchant_id=merchant_id,
                            action_id=action_id,
                            step="RAZORPAY_API_CALL",
                            status="FAILED",
                            component="RazorpayService",
                            message=error_msg,
                            sanitized_payload={"status_code": res.status_code, "error": res.text}
                        )
                        return False, {"error": error_msg}
            except Exception as e:
                error_msg = f"Razorpay network exception: {str(e)}"
                await AuditService.log_event(
                    db=db,
                    merchant_id=merchant_id,
                    action_id=action_id,
                    step="RAZORPAY_API_CALL",
                    status="FAILED",
                    component="RazorpayService",
                    message=error_msg,
                    sanitized_payload={"exception": str(e)}
                )
                return False, {"error": error_msg}
        else:
            # Local Demo Adapter execution for zero-credential test mode
            mock_id = f"plink_demo_{uuid.uuid4().hex[:8]}"
            mock_link = f"https://rzp.io/i/demo_{uuid.uuid4().hex[:6]}"

            await asyncio.sleep(0.5) # Simulate API latency

            await AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                action_id=action_id,
                step="RAZORPAY_API_CALL",
                status="SUCCESS",
                component="RazorpayService",
                message=f"[LOCAL DEMO ADAPTER] Created mock Razorpay Recovery Payment Link {mock_link} with Idempotency Key: {idempotency_key}",
                sanitized_payload={
                    "order_id": mock_id,
                    "payment_link": mock_link,
                    "status": "created",
                    "idempotency_key": idempotency_key,
                    "adapter_mode": "LOCAL DEMO MODE"
                }
            )
            return True, {"order_id": mock_id, "payment_link": mock_link}

    @staticmethod
    async def simulate_api_timeout_workflow(
        db: AsyncSession,
        merchant_id: str,
        action_id: str,
        idempotency_key: str,
        max_retries: int = 2
    ) -> Dict[str, Any]:
        """
        Executes Demo Scenario 2:
        Simulates network timeout on Razorpay API, retries using exact SAME idempotency key,
        stops safely without creating duplicate orders, and records safe halt in audit timeline.
        """
        await AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            action_id=action_id,
            step="RAZORPAY_API_CALL",
            status="PENDING",
            component="RazorpayService",
            message=f"Executing Razorpay API Request with Idempotency Key '{idempotency_key}'...",
            sanitized_payload={"attempt": 1, "idempotency_key": idempotency_key}
        )

        await asyncio.sleep(0.3)

        # Attempt 1: Timeout
        await AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            action_id=action_id,
            step="RAZORPAY_API_CALL",
            status="FAILED",
            component="RazorpayService",
            message="Attempt 1 Failed: HTTP Gateway Timeout (504) after 10,000ms. Triggering Controlled Retry Policy.",
            sanitized_payload={"attempt": 1, "error": "Gateway Timeout (504)", "idempotency_key": idempotency_key}
        )

        for attempt in range(2, max_retries + 2):
            await asyncio.sleep(0.3)
            await AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                action_id=action_id,
                step="RETRY_ATTEMPT",
                status="PENDING",
                component="RazorpayService",
                message=f"Controlled Retry Attempt {attempt}/{max_retries + 1} reusing Idempotency Key '{idempotency_key}' (Guarantees No Duplicate Transaction).",
                sanitized_payload={"attempt": attempt, "idempotency_key": idempotency_key}
            )

            await asyncio.sleep(0.3)
            await AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                action_id=action_id,
                step="RETRY_ATTEMPT",
                status="FAILED",
                component="RazorpayService",
                message=f"Retry Attempt {attempt} Failed: Connection Timeout persisted.",
                sanitized_payload={"attempt": attempt, "status": "timeout_persisted", "idempotency_key": idempotency_key}
            )

        # Final Safe Halt
        await AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            action_id=action_id,
            step="SAFE_HALT",
            status="HALTED",
            component="RazorpayService",
            message="[SAFE HALT ENGAGED] All retry attempts exhausted. Operation safely halted. Zero duplicate financial transactions created.",
            sanitized_payload={
                "idempotency_key": idempotency_key,
                "total_attempts": max_retries + 1,
                "final_state": "HALTED",
                "duplicate_prevention_guaranteed": True
            }
        )

        return {
            "status": "HALTED",
            "idempotency_key": idempotency_key,
            "total_attempts": max_retries + 1,
            "message": "API timeout persisted. Execution safely halted without duplicate financial operations."
        }
