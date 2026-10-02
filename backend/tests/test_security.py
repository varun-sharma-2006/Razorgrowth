"""Google sign-in, sessions, isolation between users, admin access and webhook verification."""
import pytest
from app.config import settings
from app.routers import auth as auth_router
from app.services import auth_service
from tests.conftest import ADMIN_EMAIL, GOOGLE_CLIENT_ID, signed_in_client, start_sandbox
from tests.helpers import approve, scan, signed_webhook


# ------------------------------------------------------------------ sign-in

def test_auth_config_is_public(app_client):
    cfg = app_client.get("/api/v1/auth/config").json()
    assert cfg == {"google_client_id": GOOGLE_CLIENT_ID, "dev_login_enabled": True}


def test_google_login_sets_httponly_session(app_client, monkeypatch):
    seen = {}

    def fake_verify(credential):
        seen["credential"] = credential
        return {"sub": "1234567890", "email": "asha@gmail.com", "email_verified": True,
                "name": "Asha Rao", "picture": "https://example.com/a.png"}

    monkeypatch.setattr(auth_router, "verify_google_credential", fake_verify)
    res = app_client.post("/api/v1/auth/google", json={"credential": "x" * 40})
    assert res.status_code == 200
    assert res.json()["email"] == "asha@gmail.com" and res.json()["name"] == "Asha Rao"
    cookie = res.headers["set-cookie"].lower()
    assert "rg_session=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert app_client.get("/api/v1/auth/me").json()["email"] == "asha@gmail.com"

    # Signing in again with the same Google account reuses the user.
    app_client.post("/api/v1/auth/google", json={"credential": "y" * 40})
    assert app_client.get("/api/v1/admin/stats").status_code == 403  # not an admin


def test_rejected_google_token_is_401(app_client, monkeypatch):
    def bad_verify(credential):
        raise ValueError("Token has wrong audience")

    monkeypatch.setattr(auth_router, "verify_google_credential", bad_verify)
    res = app_client.post("/api/v1/auth/google", json={"credential": "x" * 40})
    assert res.status_code == 401
    assert "wrong audience" in res.json()["detail"]
    assert app_client.get("/api/v1/auth/me").status_code == 401


def test_unverified_google_email_is_rejected(monkeypatch):
    from google.oauth2 import id_token
    monkeypatch.setattr(id_token, "verify_oauth2_token",
                        lambda *a, **k: {"sub": "1", "email": "x@gmail.com", "email_verified": False})
    with pytest.raises(ValueError, match="not verified"):
        auth_service.verify_google_credential("token")


def test_google_login_needs_client_id(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    with pytest.raises(ValueError, match="not configured"):
        auth_service.verify_google_credential("token")


def test_dev_login_is_off_unless_enabled(app_client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", False)
    assert app_client.post("/api/v1/auth/dev-login", json={}).status_code == 404


def test_logout_ends_the_session(app_client):
    user = signed_in_client()
    assert user.get("/api/v1/auth/me").status_code == 200
    assert user.post("/api/v1/auth/logout").status_code == 204
    assert user.get("/api/v1/auth/me").status_code == 401


def test_stolen_cookie_value_is_useless_after_logout(app_client):
    user = signed_in_client()
    token = user.cookies.get("rg_session")
    user.post("/api/v1/auth/logout")
    thief = app_client
    thief.cookies.set("rg_session", token)
    assert thief.get("/api/v1/auth/me").status_code == 401


# ------------------------------------------------------------------ access to runs

def test_simulation_endpoints_require_sign_in(app_client):
    assert app_client.get("/api/v1/merchant/status").status_code == 200  # public
    assert app_client.get("/api/v1/scenarios").status_code == 200  # public
    assert app_client.get("/api/v1/leaderboard").status_code == 200  # public
    for method, url in [
        ("post", "/api/v1/sandboxes"),
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


def test_signed_in_without_a_run_gets_404(app_client):
    user = signed_in_client()
    assert user.get("/api/v1/sim/state").status_code == 404


def test_users_are_isolated(app_client):
    alice = start_sandbox(app_client, "classic")
    bob = start_sandbox(app_client, "classic")
    action_id = scan(alice)["action"]["id"]

    # Bob can neither see nor decide Alice's action.
    assert bob.get(f"/api/v1/actions/{action_id}").status_code == 404
    assert approve(bob, action_id).status_code == 404
    assert bob.get("/api/v1/actions").json() == []
    assert all(e["merchant_id"] == bob.state_on_create["merchant_id"] for e in bob.get("/api/v1/audit").json())
    assert alice.get(f"/api/v1/actions/{action_id}").json()["status"] == "PENDING_APPROVAL"


def test_run_follows_the_account_across_devices(app_client):
    laptop = start_sandbox(app_client, "steady", user=signed_in_client("varun@example.com"))
    laptop.post("/api/v1/sim/advance", json={"ticks": 5})
    phone = signed_in_client("varun@example.com")  # same Google account, different browser
    state = phone.get("/api/v1/sim/state").json()
    assert state["merchant_id"] == laptop.state_on_create["merchant_id"]
    assert state["current_tick"] == 5


def test_new_run_replaces_the_previous_one(app_client):
    user = start_sandbox(app_client, "classic")
    first = user.state_on_create["merchant_id"]
    second = start_sandbox(user=user, scenario="steady").state_on_create["merchant_id"]
    assert second != first
    assert user.get("/api/v1/sim/state").json()["scenario"]["key"] == "steady"


def test_nickname_defaults_to_first_name(app_client):
    user = start_sandbox(app_client, "steady", user=signed_in_client(name="Asha Rao"))
    assert user.state_on_create["nickname"] == "Asha"


def test_run_creation_is_rate_limited_per_user(app_client):
    user = signed_in_client()
    for _ in range(30):
        assert user.post("/api/v1/sandboxes", json={"scenario": "classic"}).status_code == 201
    assert user.post("/api/v1/sandboxes", json={"scenario": "classic"}).status_code == 429
    # Another user is unaffected.
    assert signed_in_client().post("/api/v1/sandboxes", json={"scenario": "classic"}).status_code == 201


def test_unknown_scenario_is_rejected(app_client):
    assert signed_in_client().post("/api/v1/sandboxes", json={"scenario": "moon_landing"}).status_code == 422


# ------------------------------------------------------------------ admin

def test_admin_is_by_google_email(app_client, monkeypatch):
    assert app_client.get("/api/v1/admin/stats").status_code == 401
    assert signed_in_client().get("/api/v1/admin/stats").status_code == 403
    admin = signed_in_client(ADMIN_EMAIL)
    stats = admin.get("/api/v1/admin/stats")
    assert stats.status_code == 200 and stats.json()["users"] >= 2
    assert admin.get("/api/v1/auth/me").json()["is_admin"] is True
    # A dev-login account never keeps admin rights once dev login is switched off.
    monkeypatch.setattr(settings, "ENABLE_DEV_LOGIN", False)
    assert admin.get("/api/v1/admin/stats").status_code == 403


# ------------------------------------------------------------------ webhooks

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
