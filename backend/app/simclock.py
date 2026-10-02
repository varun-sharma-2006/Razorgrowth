from contextvars import ContextVar
from datetime import datetime, timedelta
from typing import Optional
from app.money import as_utc

# The simulated hour being processed; audit events pick it up automatically.
current_sim_tick: ContextVar[Optional[int]] = ContextVar("current_sim_tick", default=None)


def sim_time(sim_start: datetime, tick: int) -> datetime:
    return as_utc(sim_start) + timedelta(hours=tick)


def sim_label(tick: int) -> str:
    """Tick 0 is Day 1 00:00."""
    return f"Day {tick // 24 + 1} · {tick % 24:02d}:00"
