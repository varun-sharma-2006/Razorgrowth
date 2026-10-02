from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.config import settings


def normalize_database_url(url: str) -> str:
    """Maps sync-style URLs (as given by Render/Heroku etc.) to their async drivers."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return url.replace(prefix, "postgresql+asyncpg://", 1)
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


database_url = normalize_database_url(settings.DATABASE_URL)
is_sqlite = database_url.startswith("sqlite")

engine_kwargs = {"echo": False}
if is_sqlite:
    # NullPool: SQLite connections are cheap, and pooled aiosqlite connections
    # must not be shared across event loops (tests, migrations).
    engine_kwargs.update(poolclass=NullPool, connect_args={"check_same_thread": False})

engine = create_async_engine(database_url, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _record):
        # SQLite ignores foreign keys unless asked; enforce them so local dev
        # behaves like PostgreSQL.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    # Uncommitted work is rolled back when the session closes.
    async with AsyncSessionLocal() as session:
        yield session
