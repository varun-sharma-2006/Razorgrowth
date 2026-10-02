import os
import tempfile
from pathlib import Path

# Must be set before `app` is imported: settings and the engine are created at import time.
# Environment variables take precedence over any developer .env file.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="razorgrowth-tests-"))
DB_PATH = _TMP_DIR / "test.db"
ADMIN_KEY = "test-admin-key"
WEBHOOK_SECRET = "test_webhook_secret"

os.environ.update({
    "DATABASE_URL": f"sqlite+aiosqlite:///{DB_PATH.as_posix()}",
    "AUTO_MIGRATE": "true",
    "ADMIN_API_KEY": ADMIN_KEY,
    "RAZORPAY_WEBHOOK_SECRET": WEBHOOK_SECRET,
    "RAZORPAY_KEY_ID": "",
    "RAZORPAY_KEY_SECRET": "",
    "GEMINI_API_KEY": "",
    "OPENAI_API_KEY": "",
    "RAZORPAY_RETRY_BACKOFF_SECONDS": "0",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import sandbox_creation_limiter  # noqa: E402
from app.services.razorpay_service import DemoPaymentLinkClient  # noqa: E402


def start_sandbox(client: TestClient, scenario: str = "classic", nickname: str = None) -> TestClient:
    """Creates a sandbox and returns a client that sends its token on every request."""
    res = client.post("/api/v1/sandboxes", json={"scenario": scenario, "nickname": nickname})
    assert res.status_code == 201, res.text
    sandbox = TestClient(app, headers={"X-Sandbox-Token": res.json()["token"]})
    sandbox.state_on_create = res.json()["state"]
    return sandbox


@pytest.fixture
def app_client():
    """A fresh, migrated database for every test; no sandbox token attached."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    DemoPaymentLinkClient._links.clear()
    sandbox_creation_limiter._events.clear()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client(app_client):
    """A client bound to a new Classic-demo sandbox (the original 9 failed payments)."""
    return start_sandbox(app_client, "classic")
