import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.razorpay_service import RazorpayService
import hmac
import hashlib
import json

def test_health_status_endpoint():
    with TestClient(app) as client:
        res = client.get("/")
        assert res.status_code == 200
        data = res.json()
        assert data["project"] == "RazorGrowth Permissioned AI Agent"

        status_res = client.get("/api/v1/merchant/status")
        assert status_res.status_code == 200
        assert "razorpay_mode" in status_res.json()
        assert "ai_provider_mode" in status_res.json()

def test_merchant_metrics_calculation():
    with TestClient(app) as client:
        res = client.get("/api/v1/merchant/metrics")
        assert res.status_code == 200
        data = res.json()
        assert data["failed_payment_loss"] == 7850.0
        assert data["failed_payment_count"] == 9
        assert data["recoverable_amount"] == 5495.0 # 70% of 7850
        assert data["max_budget_limit"] == 1000.0

def test_ai_opportunity_generation():
    with TestClient(app) as client:
        res = client.post("/api/v1/opportunities/scan")
        assert res.status_code == 200
        data = res.json()
        assert "opportunity" in data
        assert "action" in data
        assert data["action"]["proposed_budget"] == 850.0
        assert data["action"]["confidence_score"] == 87.0
        assert len(data["action"]["evidence"]) > 0

def test_policy_engine_allowed_budget():
    with TestClient(app) as client:
        scan_res = client.post("/api/v1/opportunities/scan")
        data = scan_res.json()
        assert data["policy_check"]["passed"] is True
        assert data["policy_check"]["policy_blocked"] is False
        assert data["action"]["status"] == "PENDING_APPROVAL"

def test_policy_engine_blocked_budget():
    with TestClient(app) as client:
        block_res = client.post("/api/v1/simulation/policy-block")
        assert block_res.status_code == 200
        data = block_res.json()
        assert data["status"] == "POLICY_BLOCKED"
        assert data["proposed_budget"] == 3000.0
        assert data["merchant_max_limit"] == 1000.0
        assert data["policy_result"]["passed"] is False

def test_merchant_approval_flow():
    with TestClient(app) as client:
        scan_res = client.post("/api/v1/opportunities/scan")
        action_id = scan_res.json()["action"]["id"]

        decision_res = client.post(
            f"/api/v1/actions/{action_id}/decision",
            json={"decision": "APPROVE"}
        )
        assert decision_res.status_code == 200
        assert decision_res.json()["status"] == "COMPLETED"
        assert "razorpay_payment_link" in decision_res.json()

def test_merchant_rejection_flow():
    with TestClient(app) as client:
        scan_res = client.post("/api/v1/opportunities/scan")
        action_id = scan_res.json()["action"]["id"]

        decision_res = client.post(
            f"/api/v1/actions/{action_id}/decision",
            json={"decision": "REJECT", "rejection_reason": "Manual follow up preferred"}
        )
        assert decision_res.status_code == 200
        assert decision_res.json()["status"] == "REJECTED"

def test_action_idempotency_key_uniqueness():
    with TestClient(app) as client:
        scan1 = client.post("/api/v1/opportunities/scan").json()
        scan2 = client.post("/api/v1/opportunities/scan").json()
        assert scan1["action"]["idempotency_key"] != scan2["action"]["idempotency_key"]

def test_api_timeout_and_retry_safe_halt():
    with TestClient(app) as client:
        res = client.post("/api/v1/simulation/api-timeout")
        assert res.status_code == 200
        data = res.json()
        assert data["final_status"] == "HALTED"
        assert data["simulation_result"]["status"] == "HALTED"
        assert "idempotency_key" in data

def test_razorpay_webhook_signature_verification():
    secret = "razorgrowth_wh_secret_123"
    payload = json.dumps({"event": "order.paid", "payload": {"payment": {"entity": {"id": "pay_test_99", "amount": 85000}}}}).encode('utf-8')
    sig = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()

    with TestClient(app) as client:
        res = client.post(
            "/api/v1/webhooks/razorpay",
            content=payload,
            headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "processed"
        assert res.json()["signature_verified"] is True

def test_audit_event_sanitized_logging():
    with TestClient(app) as client:
        audit_res = client.get("/api/v1/audit")
        assert audit_res.status_code == 200
        events = audit_res.json()
        assert isinstance(events, list)
        assert len(events) > 0
        first_evt = events[0]
        assert "step" in first_evt
        assert "sanitized_payload" in first_evt
