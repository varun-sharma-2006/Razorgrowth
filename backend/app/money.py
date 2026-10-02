from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def to_paise(rupees: float) -> int:
    """Converts a rupee amount to integer paise without float rounding drift."""
    return int((Decimal(str(rupees)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_rupees(paise: int) -> float:
    return paise / 100


def format_inr(paise: int) -> str:
    return f"₹{paise / 100:,.2f}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo on read; every stored timestamp is UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
