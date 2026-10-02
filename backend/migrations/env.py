import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.database import Base, database_url
import app.models  # noqa: F401  (registers tables on Base.metadata)

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _guard_legacy_schema(connection) -> None:
    tables = set(inspect(connection).get_table_names())
    if "merchants" in tables and "alembic_version" not in tables:
        raise RuntimeError(
            "This database was created by an older RazorGrowth version without migrations. "
            "Delete the local SQLite file (e.g. backend/razorgrowth.db) and restart; demo data is re-seeded."
        )


def run_migrations_offline() -> None:
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    _guard_legacy_schema(connection)
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(database_url, poolclass=NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
