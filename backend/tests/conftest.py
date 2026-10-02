import itertools
import os
import tempfile
from pathlib import Path

# Must be set before `app` is imported: settings and the engine are created at import time.
# Environment variables take precedence over any developer .env file.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="razorgrowth-tests-"))
DB_PATH = _TMP_DIR / "test.db"
WEBHOOK_SECRET = "test_webhook_secret"
ADMIN_EMAIL = "admin@example.com"
GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com"

os.environ.update({
    "DATABASE_URL": f"sqlite+aiosqlite:///{DB_PATH.as_posix()}",
    "AUTO_MIGRATE": "true",
    "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
    "ADMIN_EMAILS": ADMIN_EMAIL,
    "ENABLE_DEV_LOGIN": "true",
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

_user_counter = itertools.count(1)


def signed_in_client(email: str = None, name: str = "Test Merchant") -> TestClient:
    """A client with its own cookie jar, signed in through the dev login."""
    c = TestClient(app)
    email = email or f"user{next(_user_counter)}@example.com"
    res = c.post("/api/v1/auth/dev-login", json={"email": email, "name": name})
    assert res.status_code == 200, res.text
    return c


def start_sandbox(_app_client: TestClient = None, scenario: str = "classic", nickname: str = None,
                  user: TestClient = None) -> TestClient:
    """Signs in a fresh user (unless one is given) and starts a run for them."""
    sb = user or signed_in_client()
    res = sb.post("/api/v1/sandboxes", json={"scenario": scenario, "nickname": nickname})
    assert res.status_code == 201, res.text
    sb.state_on_create = res.json()
    return sb


@pytest.fixture
def app_client():
    """A fresh, migrated database for every test; not signed in."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    DemoPaymentLinkClient._links.clear()
    sandbox_creation_limiter._events.clear()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client(app_client):
    """A signed-in user with a Classic-demo run (the original 9 failed payments)."""
    return start_sandbox(app_client, "classic")
