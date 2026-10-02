import logging
from pathlib import Path
from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent.parent


def run_migrations() -> None:
    """Runs `alembic upgrade head`. Call from a worker thread (env.py starts its own event loop)."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.attributes["configure_logger"] = False
    command.upgrade(cfg, "head")
    logger.info("[Migrations] Database schema is up to date.")
