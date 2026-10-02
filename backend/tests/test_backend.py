"""End-to-end API flows: metrics, scanning, approval, rejection, policy updates."""
import asyncio
import httpx
from app.main import app
from tests.conftest import ADMIN_KEY
from tests.helpers import approve, scan


def test_health_status_endpoint(client):
    assert client.get("/").json()["project"] == "RazorGrowth Permissioned AI Agent"
    status = client.get("/api/v1/merchant/status").json()
    assert status["razorpay_mode"] == "LOCAL DEMO MODE"
    assert status["ai_provider_mode"] == "Demo Heuristic Mode"
    assert status["auth_required"] is True
    assert status["webhook_configured"] is True


def test_merchant_metrics_calculation(client):
    data = client.get("/api/v1/merchant/metrics").json()
    assert data["total_revenue"] == 245000.0
    assert data["failed_payment_loss"] == 7850.0
    assert data["failed_payment_count"] == 9
    assert data["recoverable_amount"] == 5495.0
    assert data["max_budget_limit"] == 1000.0
    assert data["recovered_amount"] == 0
    assert "₹7,850.00" in data["methodology_explanation"] and "₹5,495.00" in data["methodology_explanation"]


def test_ai_scan_evidence_matches_real_data(client):
    data = scan(client)
    action = data["action"]
    assert action["status"] == "PENDING_APPROVAL"
    assert action["ai_provider"] == "Demo Heuristic Mode"
    assert action["proposed_budget"] == 850.0
    assert len(action["target_payment_ids"]) == 9
    evidence = " | ".join(action["evidence"])
    # Seed data: 3 bank declines, 2 card expirations, 2 insufficient funds, 2 network timeouts.
    assert "3 bank declines" in evidence
    assert "2 card expirations" in evidence
    assert "2 insufficient-funds failures" in evidence
    assert "2 network timeouts" in evidence
    assert "9 of 9 affected customers" in evidence
    assert data["policy_check"]["passed"] is True
    assert data["opportunity"]["total_failed_amount"] == 7850.0


def test_rescan_reuses_pending_action(client):
    first = scan(client)
    second = scan(client)
    assert second["reused_existing"] is True
    assert second["action"]["id"] == first["action"]["id"]
    actions = client.get("/api/v1/actions").json()
    assert len([a for a in actions if a["status"] == "PENDING_APPROVAL"]) == 1


def test_approval_creates_one_link_per_failed_payment(client):
    action_id = scan(client)["action"]["id"]
    res = approve(client, action_id)
    assert res.status_code == 200, res.text
    action = res.json()["action"]
    assert action["status"] == "COMPLETED"

    links = action["recovery_links"]
    assert len(links) == 9
    assert {l["payment_id"] for l in links} == set(action["target_payment_ids"])
    assert all(l["status"] == "CREATED" and l["short_url"] for l in links)
    assert len({l["reference_id"] for l in links}) == 9
    assert round(sum(l["discount"] for l in links), 2) == 850.0
    assert round(sum(l["amount"] for l in links), 2) == 7000.0  # ₹7,850 owed − ₹850 incentive
    for l in links:
        assert round(l["original_amount"] - l["discount"], 2) == l["amount"]

    opp = client.get("/api/v1/opportunities").json()[0]
    assert opp["status"] == "IN_PROGRESS"
    # Every failed payment now has a live link, so there is nothing left to propose.
    assert client.post("/api/v1/opportunities/scan").status_code == 409


def test_merchant_rejection_flow(client):
    action_id = scan(client)["action"]["id"]
    res = client.post(f"/api/v1/actions/{action_id}/decision",
                      json={"decision": "REJECT", "rejection_reason": "Manual follow up preferred"})
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"
    # A rejected action can never be approved afterwards.
    assert approve(client, action_id).status_code == 409


def test_invalid_decision_values_are_rejected(client):
    action_id = scan(client)["action"]["id"]
    for bad in ["approve", "MAYBE", "", None]:
        res = client.post(f"/api/v1/actions/{action_id}/decision", json={"decision": bad})
        assert res.status_code == 422, bad
    assert client.get(f"/api/v1/actions/{action_id}").json()["status"] == "PENDING_APPROVAL"


def test_double_approval_is_rejected(client):
    action_id = scan(client)["action"]["id"]
    assert approve(client, action_id).status_code == 200
    second = approve(client, action_id)
    assert second.status_code == 409
    action = client.get(f"/api/v1/actions/{action_id}").json()
    assert len(action["recovery_links"]) == 9  # no second campaign


def test_concurrent_approvals_execute_once(client):
    action_id = scan(client)["action"]["id"]

    async def race():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test",
                                     headers={"X-Admin-Key": ADMIN_KEY}) as ac:
            url = f"/api/v1/actions/{action_id}/decision"
            return await asyncio.gather(*(ac.post(url, json={"decision": "APPROVE"}) for _ in range(3)))

    codes = sorted(r.status_code for r in asyncio.run(race()))
    assert codes == [200, 409, 409]
    assert len(client.get(f"/api/v1/actions/{action_id}").json()["recovery_links"]) == 9


def test_policy_update_is_bounded(client):
    for bad in [-5, 0, 10**9]:
        res = client.put("/api/v1/merchant/policy", json={"max_single_action_budget": bad})
        assert res.status_code == 422, bad
    assert client.get("/api/v1/merchant/policy").json()["max_single_action_budget"] == 1000.0


def test_policy_update_is_audited_and_enforced_on_approval(client):
    action_id = scan(client)["action"]["id"]  # proposes ₹850 under a ₹1,000 cap

    res = client.put("/api/v1/merchant/policy", json={"max_single_action_budget": 500})
    assert res.status_code == 200
    assert res.json()["max_single_action_budget"] == 500.0
    events = client.get("/api/v1/audit").json()
    update = next(e for e in events if e["step"] == "POLICY_UPDATE")
    assert update["sanitized_payload"]["old_max_single_action_budget"] == 1000.0
    assert update["sanitized_payload"]["new_max_single_action_budget"] == 500.0

    # The secondary check at approval time catches the lowered cap.
    res = approve(client, action_id)
    assert res.status_code == 403
    action = client.get(f"/api/v1/actions/{action_id}").json()
    assert action["status"] == "POLICY_BLOCKED"
    assert action["recovery_links"] == []


def test_simulation_actions_are_hidden_from_main_flow(client):
    scan(client)
    client.post("/api/v1/simulation/policy-block")
    actions = client.get("/api/v1/actions").json()
    assert all(not a["is_simulation"] for a in actions)
    all_actions = client.get("/api/v1/actions", params={"include_simulations": True}).json()
    assert any(a["is_simulation"] for a in all_actions)
    sim_id = next(a["id"] for a in all_actions if a["is_simulation"])
    assert approve(client, sim_id).status_code == 409


def test_audit_payloads_are_sanitized(client):
    action_id = scan(client)["action"]["id"]
    approve(client, action_id)
    events = client.get("/api/v1/audit", params={"action_id": action_id}).json()
    assert events
    for e in events:
        blob = str(e["sanitized_payload"]) + e["message"]
        assert "vikram.p@example.com" not in blob
        assert "rohan.v@example.com" not in blob
    assert any("vi***@example.com" in str(e["sanitized_payload"]) for e in events)
