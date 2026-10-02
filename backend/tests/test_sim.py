"""The simulator: deterministic streams, customer behaviour, wallet, scoring and the leaderboard."""
from tests.conftest import start_sandbox
from tests.helpers import approve


def advance(sb, ticks=24):
    res = sb.post("/api/v1/sim/advance", json={"ticks": ticks})
    assert res.status_code == 200, res.text
    return res.json()


def run_to_end(sb, approve_pending=True):
    while True:
        data = advance(sb, 24)
        pending = data["state"]["pending_action_id"]
        if approve_pending and pending:
            approve(sb, pending)
        if data["state"]["status"] == "FINISHED":
            return data


def test_new_sandbox_state(app_client):
    sb = start_sandbox(app_client, "steady", nickname="Asha")
    state = sb.state_on_create
    assert state["scenario"]["key"] == "steady"
    assert state["current_tick"] == 0 and state["clock"] == "Day 1 · 00:00"
    assert state["wallet_start"] == 20000.0 and state["wallet_available"] == 20000.0
    assert state["policy_cap"] == 3000.0
    assert state["status"] == "RUNNING"
    assert state["nickname"] == "Asha"


def test_advance_generates_traffic_and_failures(app_client):
    sb = start_sandbox(app_client, "steady")
    data = advance(sb, 24)
    assert data["state"]["current_tick"] == 24
    assert data["state"]["clock"] == "Day 2 · 00:00"
    assert [s["tick"] for s in data["stats"]] == list(range(24))
    assert sum(s["orders"] for s in data["stats"]) > 100
    assert sum(s["failed_count"] for s in data["stats"]) > 0
    assert data["state"]["score"]["captured"] > 0

    failed = [p for p in sb.get("/api/v1/payments").json() if p["status"] == "failed"]
    assert failed and all(p["failed_tick"] is not None for p in failed)
    # Future customer behaviour must never reach the browser.
    assert all("organic_tick" not in p for p in failed)
    assert len(sb.get("/api/v1/sim/series").json()) == 24


def test_same_scenario_same_stream(app_client):
    a = start_sandbox(app_client, "festive")
    b = start_sandbox(app_client, "festive")
    stats_a = advance(a, 24)["stats"]
    stats_b = advance(b, 24)["stats"]
    strip = lambda stats: [(s["orders"], s["captured"], s["failed_count"], s["failed"]) for s in stats]
    assert strip(stats_a) == strip(stats_b)
    c = start_sandbox(app_client, "upi_outage")
    assert strip(advance(c, 24)["stats"]) != strip(stats_a)


def test_tick_request_bounds(app_client):
    sb = start_sandbox(app_client, "steady")
    assert sb.post("/api/v1/sim/advance", json={"ticks": 0}).status_code == 422
    assert sb.post("/api/v1/sim/advance", json={"ticks": 25}).status_code == 422


def test_scenario_events_arrive_on_time(app_client):
    sb = start_sandbox(app_client, "upi_outage")
    seen = []
    for _ in range(3):
        seen += [e["tick"] for e in advance(sb, 24)["events"]]
    assert 58 in seen and 66 in seen
    # UPI failures spike during the outage window.
    series = sb.get("/api/v1/sim/series").json()
    outage = sum(s["failed_by_method"].get("upi", 0) for s in series if 58 <= s["tick"] < 66)
    before = sum(s["failed_by_method"].get("upi", 0) for s in series if 34 <= s["tick"] < 42)  # same hours, Day 2
    assert outage > 3 * max(before, 1)
    # Only events that already happened are listed.
    assert all(e["tick"] <= 72 for e in sb.get("/api/v1/sim/events").json())


def test_approved_links_reserve_wallet_and_customers_respond(app_client):
    sb = start_sandbox(app_client, "steady")
    advance(sb, 24)
    proposal = sb.post("/api/v1/opportunities/scan").json()
    assert proposal["action"]["status"] == "PENDING_APPROVAL"
    action = approve(sb, proposal["action"]["id"]).json()["action"]
    links = action["recovery_links"]
    assert links and all(l["created_tick"] == 24 and l["expires_tick"] == 72 for l in links)
    assert all("converts_at_tick" not in l for l in links)

    reserved = sum(l["discount"] for l in links)
    state = sb.get("/api/v1/sim/state").json()
    assert state["wallet_available"] == round(20000 - reserved, 2)
    assert state["links_in_flight"] == len(links)

    advance(sb, 24)
    advance(sb, 24)
    advance(sb, 1)  # tick 72 processed: past the 48h link lifetime, every link is paid or expired
    settled = sb.get(f"/api/v1/actions/{action['id']}").json()["recovery_links"]
    assert all(l["status"] in ("PAID", "EXPIRED") for l in settled)
    paid = [l for l in settled if l["status"] == "PAID"]
    assert paid, "some simulated customers should pay"
    state = sb.get("/api/v1/sim/state").json()
    assert state["score"]["link_recovered"] >= round(sum(l["amount"] for l in paid), 2)
    assert state["score"]["incentive_spent"] >= round(sum(l["discount"] for l in paid), 2)


def test_approve_with_changes(app_client):
    sb = start_sandbox(app_client, "card_expiry")
    advance(sb, 24)
    proposal = sb.post("/api/v1/opportunities/scan").json()["action"]
    res = sb.post(f"/api/v1/actions/{proposal['id']}/decision", json={
        "decision": "APPROVE", "budget_override": 500, "exclude_reasons": ["card_expired"],
    })
    assert res.status_code == 200, res.text
    action = res.json()["action"]
    assert action["proposed_budget"] == 500.0
    payments = {p["id"]: p for p in sb.get("/api/v1/payments").json()}
    assert all(payments[l["payment_id"]]["failure_reason"] != "card_expired" for l in action["recovery_links"])
    assert round(sum(l["discount"] for l in action["recovery_links"]), 2) <= 500.0
    events = sb.get("/api/v1/audit", params={"action_id": proposal["id"]}).json()
    assert any("modified the AI proposal" in e["message"] for e in events)


def test_wallet_limit_is_enforced(app_client):
    sb = start_sandbox(app_client, "steady")
    advance(sb, 24)
    sb.put("/api/v1/merchant/policy", json={"max_single_action_budget": 100000})
    proposal = sb.post("/api/v1/opportunities/scan").json()["action"]
    res = sb.post(f"/api/v1/actions/{proposal['id']}/decision",
                  json={"decision": "APPROVE", "budget_override": 25000})
    assert res.status_code == 403
    assert "incentive wallet" in res.json()["detail"]


def test_auto_pilot_proposes_but_never_executes(app_client):
    sb = start_sandbox(app_client, "steady")
    assert sb.put("/api/v1/sim/settings", json={"auto_propose": True}).json()["auto_propose"] is True
    data = advance(sb, 13)  # auto-pilot runs at tick 12
    assert data["new_proposal_id"]
    action = sb.get(f"/api/v1/actions/{data['new_proposal_id']}").json()
    assert action["auto_proposed"] is True
    assert action["status"] == "PENDING_APPROVAL"  # waits for the human
    assert action["recovery_links"] == []
    # While one proposal is pending, the agent doesn't pile up more.
    advance(sb, 24)
    pending = [a for a in sb.get("/api/v1/actions").json() if a["status"] == "PENDING_APPROVAL"]
    assert len(pending) == 1


def test_full_run_score_and_leaderboard(app_client):
    sb = start_sandbox(app_client, "steady")
    early = sb.post("/api/v1/sim/leaderboard", json={"nickname": "Early Bird"})
    assert early.status_code == 409  # not finished yet

    sb.put("/api/v1/sim/settings", json={"auto_propose": True})
    final = run_to_end(sb)
    state = final["state"]
    assert state["status"] == "FINISHED" and state["current_tick"] == 168
    score = state["score"]
    assert score["lift"] == round(score["link_recovered"] + score["organic_recovered"] - score["baseline_recovered"], 2)
    assert state["approvals"] >= 1

    # Advancing a finished run is a no-op.
    again = advance(sb, 24)
    assert again["state"]["current_tick"] == 168 and again["stats"] == []

    entry = sb.post("/api/v1/sim/leaderboard", json={"nickname": "Asha"}).json()
    assert entry["score"] == score["lift"]
    assert sb.post("/api/v1/sim/leaderboard", json={"nickname": "Asha"}).status_code == 409
    assert sb.get("/api/v1/sim/state").json()["leaderboard_entry_id"] == entry["id"]

    # A passive player (never approves anything) on the same stream.
    lazy = start_sandbox(app_client, "steady")
    lazy_state = run_to_end(lazy, approve_pending=False)["state"]
    assert lazy_state["score"]["lift"] == 0  # doing nothing scores exactly the baseline
    lazy.post("/api/v1/sim/leaderboard", json={"nickname": "Lazy"})

    board = app_client.get("/api/v1/leaderboard", params={"scenario": "steady", "entry_id": entry["id"]}).json()
    assert [e["rank"] for e in board["entries"]] == list(range(1, len(board["entries"]) + 1))
    scores = [e["score"] for e in board["entries"]]
    assert scores == sorted(scores, reverse=True)
    assert board["you"]["id"] == entry["id"] and board["you"]["rank"] >= 1


def test_classic_demo_is_not_ranked(client):
    for _ in range(7):
        client.post("/api/v1/sim/advance", json={"ticks": 24})
    assert client.get("/api/v1/sim/state").json()["status"] == "FINISHED"
    assert client.post("/api/v1/sim/leaderboard", json={"nickname": "Asha"}).status_code == 409


def test_bad_nicknames_rejected(app_client):
    sb = start_sandbox(app_client, "steady")
    for bad in ["", "x", "<script>", "a" * 30]:
        assert sb.post("/api/v1/sim/leaderboard", json={"nickname": bad}).status_code == 422, bad
