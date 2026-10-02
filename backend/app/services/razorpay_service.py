import hashlib
import hmac
import uuid
from typing import Any, Dict, Optional
import httpx
from app.config import settings


class GatewayError(Exception):
    """Base class for payment-gateway failures."""


class TransientGatewayError(GatewayError):
    """Timeouts, connection errors, 429 and 5xx: safe to retry with the same reference_id."""


class PermanentGatewayError(GatewayError):
    """4xx validation/auth errors: retrying will not help."""


class ReferenceIdConflict(GatewayError):
    """Razorpay already holds a payment link with this reference_id (an earlier attempt succeeded)."""


class PaymentLinkClient:
    mode = "UNKNOWN"

    async def create_payment_link(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    async def fetch_by_reference_id(self, reference_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError


class RazorpayPaymentLinkClient(PaymentLinkClient):
    """Razorpay Payment Links REST API (Test Mode keys)."""
    mode = "RAZORPAY TEST MODE"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=settings.RAZORPAY_API_BASE,
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
            timeout=settings.RAZORPAY_TIMEOUT_SECONDS,
        )

    async def create_payment_link(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            async with self._client() as client:
                res = await client.post("/payment_links", json=payload)
        except httpx.TimeoutException as e:
            raise TransientGatewayError(f"Razorpay request timed out: {e}") from e
        except httpx.TransportError as e:
            raise TransientGatewayError(f"Razorpay connection error: {e}") from e

        if res.status_code in (200, 201):
            return res.json()
        body = res.text
        if res.status_code == 429 or res.status_code >= 500:
            raise TransientGatewayError(f"Razorpay HTTP {res.status_code}: {body}")
        if res.status_code == 400 and "reference_id" in body.lower():
            raise ReferenceIdConflict(body)
        raise PermanentGatewayError(f"Razorpay HTTP {res.status_code}: {body}")

    async def fetch_by_reference_id(self, reference_id: str) -> Optional[Dict[str, Any]]:
        try:
            async with self._client() as client:
                res = await client.get("/payment_links", params={"reference_id": reference_id})
        except httpx.HTTPError as e:
            raise TransientGatewayError(f"Razorpay lookup failed: {e}") from e
        if res.status_code != 200:
            raise TransientGatewayError(f"Razorpay lookup HTTP {res.status_code}: {res.text}")
        data = res.json()
        links = data.get("payment_links") or data.get("items") or []
        return next((l for l in links if l.get("reference_id") == reference_id), None)


class DemoPaymentLinkClient(PaymentLinkClient):
    """Zero-credential stand-in that mimics Razorpay's reference_id uniqueness rule."""
    mode = "LOCAL DEMO MODE"
    _links: Dict[str, Dict[str, Any]] = {}  # shared across instances, like a remote gateway

    async def create_payment_link(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ref = payload["reference_id"]
        if ref in self._links:
            raise ReferenceIdConflict(f"Payment link with reference_id {ref} already exists")
        link_id = f"plink_demo_{uuid.uuid4().hex[:10]}"
        link = {
            "id": link_id,
            "reference_id": ref,
            "amount": payload["amount"],
            "currency": payload.get("currency", "INR"),
            "status": "created",
            "short_url": f"https://rzp.io/i/demo_{link_id[-8:]}",
        }
        self._links[ref] = link
        return dict(link)

    async def fetch_by_reference_id(self, reference_id: str) -> Optional[Dict[str, Any]]:
        link = self._links.get(reference_id)
        return dict(link) if link else None

    @classmethod
    def count_for_reference(cls, reference_id: str) -> int:
        return 1 if reference_id in cls._links else 0


class FaultInjectingClient(PaymentLinkClient):
    """Wraps a client and makes the first `fail_attempts` create calls time out.

    With `lose_response=True` the request still reaches the gateway (the link is created)
    but the response is lost, which is exactly the case reference_id dedup must handle.
    """

    def __init__(self, inner: PaymentLinkClient, fail_attempts: int, lose_response: bool = False):
        self.inner = inner
        self.fail_attempts = fail_attempts
        self.lose_response = lose_response
        self.calls = 0
        self.mode = f"{inner.mode} + FAULT INJECTION"

    async def create_payment_link(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        self.calls += 1
        if self.calls <= self.fail_attempts:
            if self.lose_response:
                await self.inner.create_payment_link(payload)
                raise TransientGatewayError("Response lost: read timeout after request was sent (simulated)")
            raise TransientGatewayError("HTTP 504 Gateway Timeout after 10,000ms (simulated)")
        return await self.inner.create_payment_link(payload)

    async def fetch_by_reference_id(self, reference_id: str) -> Optional[Dict[str, Any]]:
        return await self.inner.fetch_by_reference_id(reference_id)


def get_payment_link_client() -> PaymentLinkClient:
    return RazorpayPaymentLinkClient() if settings.is_razorpay_live_test_mode else DemoPaymentLinkClient()


class RazorpayService:
    @staticmethod
    def get_mode() -> str:
        return settings.razorpay_mode

    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
        """Verifies the X-Razorpay-Signature HMAC SHA256 header against RAZORPAY_WEBHOOK_SECRET."""
        if not signature or not settings.RAZORPAY_WEBHOOK_SECRET:
            return False
        secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
        expected_signature = hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
