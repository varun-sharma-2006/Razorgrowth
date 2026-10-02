"""Simulated market conditions. Each scenario describes how orders and failures behave per hour."""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

RUN_TICKS = 168  # one simulated week, one tick per hour

# Relative order volume by hour of day (late-evening peak, quiet nights). Mean ≈ 1.
HOURLY_CURVE = [
    0.30, 0.18, 0.12, 0.10, 0.12, 0.25, 0.45, 0.70, 0.95, 1.10, 1.20, 1.25,
    1.30, 1.20, 1.10, 1.10, 1.20, 1.40, 1.65, 1.85, 1.80, 1.50, 1.05, 0.62,
]

METHOD_MIX = {"upi": 0.55, "card": 0.30, "netbanking": 0.15}
BASE_FAILURE_RATE = {"upi": 0.07, "card": 0.09, "netbanking": 0.11}
BASE_REASONS = {
    "upi": {"bank_decline": 0.45, "network_timeout": 0.35, "insufficient_funds": 0.20},
    "card": {"card_expired": 0.30, "bank_decline": 0.30, "insufficient_funds": 0.25, "network_timeout": 0.15},
    "netbanking": {"network_timeout": 0.50, "bank_decline": 0.30, "insufficient_funds": 0.20},
}


@dataclass
class Conditions:
    volume: float = 1.0  # multiplier on orders per hour
    avg_order_rupees: float = 950.0
    failure_multiplier: Dict[str, float] = field(default_factory=dict)  # by method
    reasons: Dict[str, Dict[str, float]] = field(default_factory=dict)  # overrides by method


@dataclass
class ScenarioEvent:
    tick: int
    level: str  # info, warning, success
    message: str


@dataclass
class Scenario:
    key: str
    name: str
    difficulty: str
    description: str
    orders_per_hour: float
    default_cap_rupees: float
    conditions: Callable[[int], Conditions]
    events: List[ScenarioEvent] = field(default_factory=list)
    ranked: bool = True  # appears on the leaderboard
    streaming: bool = True  # generates new payments every tick

    def events_between(self, start: int, end: int) -> List[ScenarioEvent]:
        return [e for e in self.events if start <= e.tick < end]


def _steady(_tick: int) -> Conditions:
    return Conditions()


def _festive(tick: int) -> Conditions:
    if 48 <= tick < 120:  # days 3–5
        return Conditions(volume=2.6, avg_order_rupees=1400, failure_multiplier={"upi": 1.3, "card": 1.3, "netbanking": 1.4})
    return Conditions()


def _upi_outage(tick: int) -> Conditions:
    if 58 <= tick < 66:  # Day 3, 10:00–18:00
        return Conditions(
            failure_multiplier={"upi": 7.0},
            reasons={"upi": {"network_timeout": 0.70, "bank_decline": 0.30}},
        )
    return Conditions()


def _card_expiry(_tick: int) -> Conditions:
    return Conditions(
        failure_multiplier={"card": 2.2},
        reasons={"card": {"card_expired": 0.70, "bank_decline": 0.15, "insufficient_funds": 0.15}},
    )


SCENARIOS: Dict[str, Scenario] = {
    "steady": Scenario(
        key="steady",
        name="Steady Week",
        difficulty="Easy",
        description="A normal week for Aura Store. Learn how failures pile up and when recovery pays off.",
        orders_per_hour=12,
        default_cap_rupees=3000,
        conditions=_steady,
        events=[ScenarioEvent(0, "info", "Store open. A normal week is ahead.")],
    ),
    "festive": Scenario(
        key="festive",
        name="Festive Sale",
        difficulty="Medium",
        description="Traffic and basket sizes jump during a 3-day sale while banks struggle with load.",
        orders_per_hour=12,
        default_cap_rupees=3000,
        conditions=_festive,
        events=[
            ScenarioEvent(0, "info", "Festive sale starts on Day 3. Plan your incentive wallet."),
            ScenarioEvent(46, "warning", "Sale starts in 2 hours: expect heavy traffic."),
            ScenarioEvent(48, "warning", "Festive sale is live: traffic ×2.6, banks under load."),
            ScenarioEvent(120, "success", "Festive sale has ended. Traffic is back to normal."),
        ],
    ),
    "upi_outage": Scenario(
        key="upi_outage",
        name="UPI Outage",
        difficulty="Hard",
        description="A UPI degradation on Day 3 causes a burst of transient failures. React fast.",
        orders_per_hour=12,
        default_cap_rupees=3000,
        conditions=_upi_outage,
        events=[
            ScenarioEvent(0, "info", "Store open. Watch the UPI failure rate."),
            ScenarioEvent(58, "warning", "NPCI reports UPI degradation: UPI payments failing widely."),
            ScenarioEvent(66, "success", "UPI services restored."),
        ],
    ),
    "card_expiry": Scenario(
        key="card_expiry",
        name="Card Expiry Wave",
        difficulty="Hard",
        description="A major issuer reissued cards. Many failures are expired cards, which rarely convert.",
        orders_per_hour=12,
        default_cap_rupees=3000,
        conditions=_card_expiry,
        events=[ScenarioEvent(0, "warning", "A large issuer reissued cards: expect expired-card declines all week.")],
    ),
    "classic": Scenario(
        key="classic",
        name="Classic Demo",
        difficulty="Guided",
        description="The original fixed demo: 9 failed payments worth ₹7,850. No live traffic.",
        orders_per_hour=0,
        default_cap_rupees=1000,
        conditions=_steady,
        events=[ScenarioEvent(0, "info", "Classic demo: 9 failed payments are waiting for recovery.")],
        ranked=False,
        streaming=False,
    ),
}


def get_scenario(key: str) -> Optional[Scenario]:
    return SCENARIOS.get(key)


def reason_mix(method: str, cond: Conditions) -> List[Tuple[str, float]]:
    mix = cond.reasons.get(method) or BASE_REASONS[method]
    return list(mix.items())
