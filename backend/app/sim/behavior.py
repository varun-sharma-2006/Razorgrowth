"""How simulated customers react. Everything is deterministic for a given seed and decision,
so two players on the same scenario and season face exactly the same customers."""
import hashlib
import math
import random
from typing import Optional

LINK_LIFETIME_TICKS = 48  # a recovery link expires after 2 simulated days
PAYMENT_GIVE_UP_TICKS = 72  # unrecovered failures are lost after 3 days

# Chance a customer retries on their own, with no help (by failure reason).
ORGANIC_RETRY = {"network_timeout": 0.35, "bank_decline": 0.25, "insufficient_funds": 0.15, "card_expired": 0.10}
ORGANIC_MEAN_DELAY = 10.0  # hours

# Base chance a customer pays a recovery link (by failure reason).
LINK_BASE_CONVERSION = {"network_timeout": 0.55, "bank_decline": 0.45, "card_expired": 0.35, "insufficient_funds": 0.20}
LINK_MEAN_DELAY = 6.0  # hours
LINK_STALENESS_HOURS = 36.0  # conversion decays as the failure ages
DISCOUNT_WEIGHT = 1.0  # +1.0·√(discount share); tuned so incentive size is a real decision
LOYALTY_WEIGHT = 0.10


def rng_for(*parts) -> random.Random:
    digest = hashlib.sha256(":".join(str(p) for p in parts).encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def loyalty(successful_payments: int) -> float:
    return min(max(successful_payments, 0), 10) / 10


def organic_retry_tick(seed: str, payment_key: str, reason: str, failed_tick: int, loyalty_score: float) -> Optional[int]:
    """When (if ever) this customer would retry the payment by themselves."""
    rng = rng_for(seed, payment_key, "organic")
    p = ORGANIC_RETRY.get(reason, 0.15) * (1 + 0.3 * loyalty_score)
    if rng.random() >= p:
        return None
    delay = max(1, round(rng.expovariate(1 / ORGANIC_MEAN_DELAY)))
    return failed_tick + delay if delay < PAYMENT_GIVE_UP_TICKS else None


def link_conversion_probability(reason: str, discount_share: float, loyalty_score: float, age_ticks: int) -> float:
    p = LINK_BASE_CONVERSION.get(reason, 0.3) + LOYALTY_WEIGHT * loyalty_score
    p += DISCOUNT_WEIGHT * math.sqrt(max(discount_share, 0.0))
    p *= math.exp(-max(age_ticks, 0) / LINK_STALENESS_HOURS)
    return max(0.0, min(p, 0.95))


def link_payment_tick(
    seed: str,
    payment_key: str,
    reason: str,
    failed_tick: int,
    created_tick: int,
    discount_share: float,
    loyalty_score: float,
    organic_tick: Optional[int],
) -> Optional[int]:
    """When (if ever) the customer pays the recovery link sent at `created_tick`.

    A customer who was going to retry anyway uses the cheaper link instead: the discount is
    wasted on them. That cannibalisation is what makes over-generous campaigns score badly.
    """
    rng = rng_for(seed, payment_key, "link", created_tick, round(discount_share, 3))
    p = link_conversion_probability(reason, discount_share, loyalty_score, created_tick - failed_tick)
    candidates = []
    if rng.random() < p:
        candidates.append(created_tick + max(1, round(rng.expovariate(1 / LINK_MEAN_DELAY))))
    if organic_tick is not None and organic_tick > created_tick:
        candidates.append(organic_tick)
    expires = created_tick + LINK_LIFETIME_TICKS
    candidates = [t for t in candidates if t < expires]
    return min(candidates) if candidates else None
