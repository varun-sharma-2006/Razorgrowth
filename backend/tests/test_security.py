"""Sandbox authentication, isolation between visitors, the admin API and webhook verification."""
from app.config import settings
from tests.conftest import ADMIN_KEY, start_sandbox
from tests.helpers import approve, scan, signed_webhook


def test_sandbox_endpoints_require_token(app_client):
    assert app_client.get("/api/v1/merchant/status").status_code == 200  # public
    assert app_client.get("/api/v1/scenarios").status_code == 200  # public
    for method, url in [
        ("get", "/api/v1/sim/state"),
        ("post", "/api/v1/sim/advance"),
        ("get", "/api/v1/merchant/metrics"),
        ("get", "/api/v1/payments"),
        ("get", "/api/v1/actions"),
        ("get", "/api/v1/audit"),
        ("post", "/api/v1/opportunities/scan"),
        ("put", "/api/v1/merchant/policy"),
        ("post", "/api/v1/simulation/policy-block"),
    ]:
        assert getattr(app_client, method)(url).status_code == 401, url
    bad = app_client.get("/api/v1/sim/state", headers={"X-Sandbox-Token": "not-a-real-token"})
    assert bad.status_code == 401


def test_sandboxes_are_isolated(app_client):
    alice = start_sandbox(app_client, "classic")
    bob = start_sandbox(app_client, "classic")
    action_id = scan(alice)["action"]["id"]

    # Bob can neither see nor decide Alice's action.
    assert bob.get(f"/api/v1/actions/{action_id}").status_code == 404
    assert approve(bob, action_id).status_code == 404
    assert bob.get("/api/v1/actions").json() == []
    assert all(e["merchant_id"] == bob.state_on_create["merchant_id"] for e in bob.get("/api/v1/audit").json())
    assert alice.get(f"/api/v1/actions/{action_id}").json()["status"] == "PENDING_APPROVAL"


def test_sandbox_creation_is_rate_limited(app_client):
    for _ in range(30):
        assert app_client.post("/api/v1/sandboxes", json={"scenario": "classic"}).status_code == 201
    assert app_client.post("/api/v1/sandboxes", json={"scenario": "classic"}).status_code == 429


def test_unknown_scenario_is_rejected(app_client):
    assert app_client.post("/api/v1/sandboxes", json={"scenario": "moon_landing"}).status_code == 422


def test_admin_api_requires_key(app_client, monkeypatch):
    assert app_client.get("/api/v1/admin/stats").status_code == 401
    assert app_client.get("/api/v1/admin/stats", headers={"X-Admin-Key": "wrong"}).status_code == 401
    ok = app_client.get("/api/v1/admin/stats", headers={"X-Admin-Key": ADMIN_KEY})
    assert ok.status_code == 200
    monkeypatch.setattr(settings, "ADMIN_API_KEY", "")
    assert app_client.get("/api/v1/admin/stats", headers={"X-Admin-Key": ADMIN_KEY}).status_code == 503


def test_webhook_without_signature_is_rejected(client):
    res = client.post("/api/v1/webhooks/razorpay", json={"event": "payment_link.paid"})
    assert res.status_code == 400


def test_webhook_with_bad_signature_is_rejected(client):
    res = signed_webhook(client, {"event": "payment.captured"}, secret="attacker_guess")
    assert res.status_code == 400


def test_webhook_rejected_when_secret_not_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    res = signed_webhook(client, {"event": "payment.captured"})
    assert res.status_code == 503


def test_valid_webhook_is_processed(client):
    body = {"event": "payment.captured", "payload": {"payment": {"entity": {"id": "pay_test_99", "amount": 85000}}}}
    res = signed_webhook(client, body, event_id="evt_generic_1")
    assert res.status_code == 200
    assert res.json()["status"] == "processed"
    assert res.json()["signature_verified"] is True


def test_payment_link_paid_webhook_marks_recovery(client):
    action = approve(client, scan(client)["action"]["id"]).json()["action"]
    link = action["recovery_links"][0]
    body = {
        "event": "payment_link.paid",
        "payload": {"payment_link": {"entity": {"id": link["razorpay_link_id"], "reference_id": link["reference_id"],
                                                "status": "paid"}}},
    }
    res = signed_webhook(client, body, event_id="evt_paid_1")
    assert res.status_code == 200

    updated = client.get(f"/api/v1/actions/{action['id']}").json()
    paid = next(l for l in updated["recovery_links"] if l["id"] == link["id"])
    assert paid["status"] == "PAID" and paid["paid_at"]

    payments = {p["id"]: p for p in client.get("/api/v1/payments").json()}
    assert payments[link["payment_id"]]["status"] == "recovered"

    metrics = client.get("/api/v1/merchant/metrics").json()
    assert metrics["recovered_amount"] == link["amount"]
    assert metrics["failed_payment_count"] == 8

    # The webhook is attributed to the owning sandbox's audit trail.
    assert any(e["step"] == "WEBHOOK_RECEIVED" and e["status"] == "SUCCESS" for e in client.get("/api/v1/audit").json())

    # Razorpay redelivers webhooks; the same event id must not be applied twice.
    dup = signed_webhook(client, body, event_id="evt_paid_1")
    assert dup.json()["status"] == "duplicate"


def test_opportunity_resolves_when_all_links_paid(client):
    action = approve(client, scan(client)["action"]["id"]).json()["action"]
    for i, link in enumerate(action["recovery_links"]):
        body = {"event": "payment_link.paid",
                "payload": {"payment_link": {"entity": {"id": link["razorpay_link_id"]}}}}
        assert signed_webhook(client, body, event_id=f"evt_{i}").status_code == 200
    opp = client.get("/api/v1/opportunities").json()[0]
    assert opp["status"] == "RESOLVED"
    assert client.get("/api/v1/merchant/metrics").json()["recovered_amount"] == 7050.0
