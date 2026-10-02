"""Advances a sandbox through simulated hours.

Each tick (one hour) resolves what customers do — pay a recovery link, retry on their own,
give up — then generates that hour's orders and failures, optionally lets the AI auto-propose,
and records a TickStat row for the live charts.
"""
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Action, Customer, Merchant, Payment, RecoveryLink, TickStat
from app.money import format_inr
from app.services.audit_service import AuditService
from app.services.link_outcomes import settle_link
from app.services.proposal_service import NothingToRecover, pending_proposal, propose_recovery, wallet_available_paise
from app.sim.behavior import PAYMENT_GIVE_UP_TICKS, loyalty, organic_retry_tick, rng_for
from app.sim.scenarios import HOURLY_CURVE, METHOD_MIX, BASE_FAILURE_RATE, Scenario, ScenarioEvent, get_scenario, reason_mix
from app.simclock import current_sim_tick, sim_label, sim_time

MAX_TICKS_PER_REQUEST = 24
AUTO_PROPOSE_EVERY = 12  # hours


class SimulationConflict(Exception):
    """Another request advanced this sandbox at the same time."""


@dataclass
class AdvanceResult:
    from_tick: int
    to_tick: int
    stats: List[TickStat] = field(default_factory=list)
    events: List[ScenarioEvent] = field(default_factory=list)
    new_proposal_id: Optional[str] = None
    finished: bool = False


def _poisson(rng, lam: float) -> int:
    if lam <= 0:
        return 0
    if lam > 50:  # normal approximation keeps this fast for big festive hours
        return max(0, round(rng.gauss(lam, math.sqrt(lam))))
    threshold, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= threshold:
            return k
        k += 1


def _weighted(rng, items) -> str:
    items = list(items)
    total = sum(w for _, w in items)
    r = rng.random() * total
    for key, w in items:
        r -= w
        if r <= 0:
            return key
    return items[-1][0]


def _order_amount_paise(rng, avg_rupees: float) -> int:
    sigma = 0.6
    mu = math.log(avg_rupees) - sigma ** 2 / 2
    rupees = min(max(round(rng.lognormvariate(mu, sigma)), 99), 25000)
    return rupees * 100


async def _generate_orders(
    db: AsyncSession, merchant: Merchant, scenario: Scenario, tick: int, customers: List[Customer], stat: TickStat
) -> None:
    cond = scenario.conditions(tick)
    rng = rng_for(merchant.seed, "orders", tick)
    lam = scenario.orders_per_hour * HOURLY_CURVE[tick % 24] * cond.volume
    when = sim_time(merchant.sim_start, tick)
    failed_by_method: Dict[str, int] = {}

    for i in range(_poisson(rng, lam)):
        method = _weighted(rng, METHOD_MIX.items())
        amount = _order_amount_paise(rng, cond.avg_order_rupees)
        customer = customers[rng.randrange(len(customers))]
        fail_p = BASE_FAILURE_RATE[method] * cond.failure_multiplier.get(method, 1.0)
        stat.orders += 1
        if rng.random() >= min(fail_p, 0.95):
            stat.captured_paise += amount
            continue

        reason = _weighted(rng, reason_mix(method, cond))
        key = f"p{tick:03d}{i:03d}"
        db.add(Payment(
            id=f"{merchant.id}-{key}",
            merchant_id=merchant.id,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_email=customer.email,
            amount_paise=amount,
            status="failed",
            failure_reason=reason,
            payment_method=method,
            created_at=when,
            failed_tick=tick,
            organic_tick=organic_retry_tick(merchant.seed, key, reason, tick, loyalty(customer.successful_payments)),
        ))
        stat.failed_count += 1
        stat.failed_paise += amount
        failed_by_method[method] = failed_by_method.get(method, 0) + 1
    stat.failed_by_method = failed_by_method


def _real_links(merchant_id: str):
    return (
        select(RecoveryLink)
        .join(Action, Action.id == RecoveryLink.action_id)
        .where(Action.merchant_id == merchant_id, Action.is_simulation.is_(False))
    )


async def _resolve_customers(db: AsyncSession, merchant: Merchant, tick: int, stat: TickStat) -> None:
    when = sim_time(merchant.sim_start, tick)

    # 1. Customers pay recovery links (the simulated equivalent of a payment_link.paid webhook).
    paying = (await db.execute(
        _real_links(merchant.id).where(RecoveryLink.status == "CREATED", RecoveryLink.converts_at_tick == tick)
    )).scalars().all()
    for link in paying:
        payment = await settle_link(db, link, "PAID", when, tick)
        if payment is not None:
            stat.link_recovered_paise += link.amount_paise
            stat.incentive_spent_paise += link.discount_paise
    if paying:
        AuditService.log_event(
            db=db,
            merchant_id=merchant.id,
            step="WEBHOOK_RECEIVED",
            status="SUCCESS",
            component="WebhookHandler",
            message=(
                f"{len(paying)} customer(s) paid recovery links: "
                f"{format_inr(sum(l.amount_paise for l in paying))} recovered (simulated payment_link.paid)."
            ),
            sanitized_payload={"links": [l.id for l in paying], "simulated": True},
        )

    # 2. Unpaid links expire, releasing their reserved incentive.
    expiring = (await db.execute(
        _real_links(merchant.id).where(RecoveryLink.status == "CREATED", RecoveryLink.expires_tick == tick)
    )).scalars().all()
    for link in expiring:
        await settle_link(db, link, "EXPIRED", when, tick)
    await db.flush()

    # 3. Customers retry on their own, and 4. give up after PAYMENT_GIVE_UP_TICKS.
    covered = select(RecoveryLink.payment_id).join(Action, Action.id == RecoveryLink.action_id).where(
        Action.merchant_id == merchant.id, Action.is_simulation.is_(False), RecoveryLink.status == "CREATED"
    )
    open_failed = select(Payment).where(
        Payment.merchant_id == merchant.id, Payment.status == "failed", Payment.id.not_in(covered)
    )
    for payment in (await db.execute(open_failed.where(Payment.organic_tick == tick))).scalars():
        payment.status = "self_recovered"
        payment.resolved_tick = tick
        stat.organic_recovered_paise += payment.amount_paise
    for payment in (await db.execute(
        open_failed.where(Payment.failed_tick.is_not(None), Payment.failed_tick <= tick - PAYMENT_GIVE_UP_TICKS)
    )).scalars():
        payment.status = "lost"
        payment.resolved_tick = tick
        stat.lost_paise += payment.amount_paise

    # Counterfactual: what would have come back if the merchant had done nothing at all.
    for payment in (await db.execute(
        select(Payment).where(Payment.merchant_id == merchant.id, Payment.organic_tick == tick)
    )).scalars():
        stat.baseline_recovered_paise += payment.amount_paise


async def advance(db: AsyncSession, merchant: Merchant, ticks: int) -> AdvanceResult:
    """Runs up to `ticks` simulated hours. Commits once at the end."""
    scenario = get_scenario(merchant.scenario)
    start = merchant.current_tick
    end = min(start + max(1, min(ticks, MAX_TICKS_PER_REQUEST)), merchant.run_ticks)
    result = AdvanceResult(from_tick=start, to_tick=start)
    if merchant.status != "RUNNING" or start >= merchant.run_ticks:
        result.finished = True
        return result

    # Claim the tick range atomically so two tabs can't simulate the same hours twice.
    claimed = await db.execute(
        update(Merchant)
        .where(Merchant.id == merchant.id, Merchant.current_tick == start)
        .values(current_tick=end)
        .execution_options(synchronize_session=False)
    )
    if claimed.rowcount != 1:
        await db.rollback()
        raise SimulationConflict()

    customers = []
    if scenario.streaming:
        customers = list((await db.execute(
            select(Customer).where(Customer.merchant_id == merchant.id).order_by(Customer.id)
        )).scalars())

    for tick in range(start, end):
        current_sim_tick.set(tick)
        merchant.current_tick = tick
        stat = TickStat(
            merchant_id=merchant.id, tick=tick, orders=0, captured_paise=0, failed_count=0, failed_paise=0,
            failed_by_method={}, link_recovered_paise=0, organic_recovered_paise=0, baseline_recovered_paise=0,
            lost_paise=0, incentive_spent_paise=0, wallet_available_paise=0,
        )
        await _resolve_customers(db, merchant, tick, stat)
        if scenario.streaming:
            await _generate_orders(db, merchant, scenario, tick, customers, stat)
        await db.flush()

        if merchant.auto_propose and tick > 0 and tick % AUTO_PROPOSE_EVERY == 0:
            if await pending_proposal(db, merchant) is None:
                try:
                    proposal = await propose_recovery(db, merchant, auto=True)
                    if not proposal.reused_existing:
                        result.new_proposal_id = proposal.action.id
                except NothingToRecover:
                    pass

        stat.wallet_available_paise = await wallet_available_paise(db, merchant)
        db.add(stat)
        result.stats.append(stat)

    merchant.current_tick = end
    current_sim_tick.set(end)
    result.to_tick = end
    result.events = scenario.events_between(start, end)
    if end >= merchant.run_ticks:
        merchant.status = "FINISHED"
        result.finished = True
        AuditService.log_event(
            db=db,
            merchant_id=merchant.id,
            step="RUN_FINISHED",
            status="SUCCESS",
            component="Simulator",
            message=f"Simulation complete at {sim_label(end)}.",
            sanitized_payload={"ticks": end},
        )
    await db.commit()
    return result
