"""Retry, idempotency and incentive allocation in the recovery executor."""
import asyncio
import pytest
from app.services.razorpay_service import (
    DemoPaymentLinkClient,
    FaultInjectingClient,
    PermanentGatewayError,
)
from app.services.recovery_service import MIN_LINK_PAISE, allocate_incentive, reference_id_for
from tests.helpers import scan


def test_policy_block_simulation_uses_current_cap(client):
    client.put("/api/v1/merchant/policy", json={"max_single_action_budget": 5000})
    data = client.post("/api/v1/simulation/policy-block").json()
    assert data["status"] == "POLICY_BLOCKED"
    assert data["policy_result"]["proposed_budget"] == 15000.0  # 3× the cap, whatever the cap is
    assert data["policy_result"]["max_allowed_budget"] == 5000.0
    assert data["action"]["recovery_links"] == []


def test_api_timeout_runs_real_retries_then_halts(client):
    data = client.post("/api/v1/simulation/api-timeout").json()
    assert data["status"] == "HALTED"
    assert data["attempts"] == 3
    assert data["links_at_gateway"] == 0
    action = data["action"]
    assert action["retry_count"] == 2
    assert [l["status"] for l in action["recovery_links"]] == ["FAILED"]

    events = client.get("/api/v1/audit", params={"action_id": action["id"]}).json()
    steps = [e["step"] for e in events]
    assert steps.count("RETRY_ATTEMPT") == 4  # 2 retries × (PENDING + FAILED)
    assert "SAFE_HALT" in steps
    refs = {e["sanitized_payload"].get("reference_id") for e in events if e["step"] in ("RAZORPAY_API_CALL", "RETRY_ATTEMPT")}
    assert refs == {action["recovery_links"][0]["reference_id"]}  # same reference_id every attempt

    # The failed simulation must not consume a real failed payment.
    assert len(scan(client)["action"]["target_payment_ids"]) == 9


def test_lost_response_is_deduplicated_by_reference_id(client):
    data = client.post("/api/v1/simulation/lost-response").json()
    assert data["status"] == "COMPLETED"
    assert data["attempts"] == 2
    assert data["links_at_gateway"] == 1
    link = data["action"]["recovery_links"][0]
    assert link["status"] == "CREATED" and link["razorpay_link_id"]

    events = client.get("/api/v1/audit", params={"action_id": data["action"]["id"]}).json()
    assert any(e["sanitized_payload"].get("deduplicated") is True for e in events)


def test_permanent_errors_are_not_retried(client):
    class RejectingClient(DemoPaymentLinkClient):
        calls = 0

        async def create_payment_link(self, payload):
            RejectingClient.calls += 1
            raise PermanentGatewayError("HTTP 400: invalid customer email")

    from app.routers import actions as actions_router
    original = actions_router.get_payment_link_client
    actions_router.get_payment_link_client = lambda: RejectingClient()
    try:
        action_id = scan(client)["action"]["id"]
        res = client.post(f"/api/v1/actions/{action_id}/decision", json={"decision": "APPROVE"})
    finally:
        actions_router.get_payment_link_client = original

    assert res.status_code == 200
    action = res.json()["action"]
    assert action["status"] == "HALTED"
    assert RejectingClient.calls == 1
    assert "invalid customer email" in action["failure_reason"]


def test_fault_injector_lost_response_creates_exactly_one_link():
    DemoPaymentLinkClient._links.clear()
    client = FaultInjectingClient(DemoPaymentLinkClient(), fail_attempts=1, lose_response=True)
    payload = {"reference_id": "rg_test", "amount": 1000}
    with pytest.raises(Exception):
        asyncio.run(client.create_payment_link(payload))
    assert DemoPaymentLinkClient.count_for_reference("rg_test") == 1


def test_reference_ids_are_deterministic_and_short():
    a = reference_id_for("RG-ACT-ABC123", "pay_fail_01")
    assert a == reference_id_for("RG-ACT-ABC123", "pay_fail_01")
    assert a != reference_id_for("RG-ACT-ABC123", "pay_fail_02")
    assert len(a) <= 40


@pytest.mark.parametrize("amounts,budget", [
    ([85000, 129900, 249900, 64900, 49900, 79900, 55000, 40000, 30500], 85000),
    ([10000], 5000),
    ([150, 100, 20000], 20000),   # tiny payments must keep ₹1 payable
    ([500, 500], 10**9),          # budget larger than what can be given away
    ([33333, 33333, 33334], 100),  # rounding remainders
])
def test_incentive_allocation(amounts, budget):
    shares = allocate_incentive(amounts, budget)
    assert len(shares) == len(amounts)
    max_givable = sum(max(a - MIN_LINK_PAISE, 0) for a in amounts)
    assert sum(shares) == min(budget, max_givable)
    for a, s in zip(amounts, shares):
        assert s >= 0
        assert a - s >= min(a, MIN_LINK_PAISE)
