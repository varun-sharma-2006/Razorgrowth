"""Authentication and webhook verification."""
from app.config import settings
from tests.helpers import approve, scan, signed_webhook


def test_admin_endpoints_require_key(client, anon_client):
    assert anon_client.get("/api/v1/merchant/status").status_code == 200  # public
    for method, url in [
        ("get", "/api/v1/merchant/metrics"),
        ("get", "/api/v1/payments"),
        ("get", "/api/v1/actions"),
        ("get", "/api/v1/audit"),
        ("post", "/api/v1/opportunities/scan"),
        ("put", "/api/v1/merchant/policy"),
        ("post", "/api/v1/simulation/policy-block"),
    ]:
        assert getattr(anon_client, method)(url).status_code == 401, url


def test_wrong_admin_key_cannot_approve(client, anon_client):
    action_id = scan(client)["action"]["id"]
    res = anon_client.post(f"/api/v1/actions/{action_id}/decision", json={"decision": "APPROVE"},
                           headers={"X-Admin-Key": "wrong"})
    assert res.status_code == 401
    assert client.get(f"/api/v1/actions/{action_id}").json()["status"] == "PENDING_APPROVAL"


def test_webhook_without_signature_is_rejected(client):
    res = client.post("/api/v1/webhooks/razorpay", json={"event": "payment_link.paid"})
    assert res.status_code == 400
    blocked = [e for e in client.get("/api/v1/audit").json() if e["step"] == "WEBHOOK_RECEIVED"]
    assert blocked and blocked[0]["status"] == "BLOCKED"


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
    assert client.get("/api/v1/merchant/metrics").json()["recovered_amount"] == 7000.0
