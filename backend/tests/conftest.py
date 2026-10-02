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
    "DEFAULT_MAX_BUDGET": "1000",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.services.razorpay_service import DemoPaymentLinkClient  # noqa: E402


@pytest.fixture
def client():
    """A fresh, migrated and seeded database for every test."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    DemoPaymentLinkClient._links.clear()
    with TestClient(app, headers={"X-Admin-Key": ADMIN_KEY}) as c:
        yield c


@pytest.fixture
def anon_client(client):
    """Same app and database, but without the admin key header."""
    return TestClient(app)
