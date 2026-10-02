import hashlib
import hmac
import json
from tests.conftest import WEBHOOK_SECRET


def scan(client):
    res = client.post("/api/v1/opportunities/scan")
    assert res.status_code == 200, res.text
    return res.json()


def approve(client, action_id):
    return client.post(f"/api/v1/actions/{action_id}/decision", json={"decision": "APPROVE"})


def signed_webhook(client, body: dict, event_id: str = None, secret: str = WEBHOOK_SECRET):
    raw = json.dumps(body).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(),
    }
    if event_id:
        headers["X-Razorpay-Event-Id"] = event_id
    return client.post("/api/v1/webhooks/razorpay", content=raw, headers=headers)
