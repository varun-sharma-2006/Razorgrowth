"""Creates and cleans up per-visitor simulator sandboxes."""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import (
    Action, AuditEvent, Customer, Merchant, Opportunity, Payment, PolicyRule, RecoveryLink, TickStat, User,
)
from app.money import to_paise, utc_now
from app.services.audit_service import AuditService
from app.sim.behavior import rng_for
from app.sim.scenarios import RUN_TICKS, Scenario

STARTING_WALLET_RUPEES = 20000
CUSTOMER_POOL_SIZE = 150

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
    "Ananya", "Diya", "Aadhya", "Saanvi", "Pari", "Anika", "Navya", "Myra", "Riya", "Kavya",
    "Rohan", "Priya", "Karan", "Neha", "Vikram", "Sneha", "Amit", "Pooja", "Rahul", "Meera",
]
LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Mehta", "Patel", "Nair", "Iyer", "Reddy", "Kapoor", "Malhotra",
    "Sen", "Das", "Roy", "Joshi", "Kulkarni", "Chopra", "Bose", "Menon", "Pillai", "Rao",
]
PRODUCTS = [
    ("Leather Backpack", 2499), ("Wireless Earbuds Pro", 1299), ("Smart Fitness Watch", 3499),
    ("Premium Coffee Beans 1kg", 850), ("Ergonomic Desk Mat", 649), ("Mechanical Keyboard", 4199),
    ("Ceramic Mug Set", 499), ("USB-C Fast Charger 65W", 1199), ("Blue Light Glasses", 799),
    ("Laptop Sleeve", 999), ("Yoga Mat", 899), ("Steel Water Bottle", 549),
]


def current_season(now: Optional[datetime] = None) -> str:
    year, week, _ = (now or utc_now()).isocalendar()
    return f"{year}-W{week:02d}"


def season_start(season: str) -> datetime:
    year, week = season.split("-W")
    return datetime.fromisocalendar(int(year), int(week), 1).replace(tzinfo=timezone.utc)


def scenario_seed(scenario_key: str, season: str) -> str:
    """Same scenario + season ⇒ same payment stream for every player."""
    return hashlib.sha256(f"razorgrowth:{scenario_key}:{season}".encode()).hexdigest()[:16]


def customer_pool(seed: str, merchant_id: str) -> List[Customer]:
    customers = []
    for n in range(CUSTOMER_POOL_SIZE):
        rng = rng_for(seed, "customer", n)
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        successful = min(int(rng.expovariate(1 / 5)), 30)
        product, price = rng.choice(PRODUCTS)
        customers.append(Customer(
            id=f"{merchant_id}-c{n:03d}",
            merchant_id=merchant_id,
            name=f"{first} {last}",
            email=f"{first.lower()}.{last[0].lower()}{n}@example.com",
            total_orders=successful + rng.randint(0, 2),
            successful_payments=successful,
            failed_payments=0,
            last_product_info=f"{product} (₹{price:,})",
        ))
    return customers


def _classic_seed(merchant_id: str, sim_start: datetime) -> Tuple[List[Customer], List[Payment]]:
    customers_data = [
        ("c101", "Rohan Verma", "rohan.v@example.com", 12, 11, 1, "Leather Backpack (₹2,499)"),
        ("c102", "Priya Sharma", "priya.s@example.com", 8, 7, 1, "Wireless Earbuds Pro (₹1,299)"),
        ("c103", "Ananya Mehta", "ananya.m@example.com", 5, 4, 1, "Smart Fitness Watch (₹3,499)"),
        ("c104", "Vikram Patel", "vikram.p@example.com", 15, 14, 1, "Premium Coffee Beans 1kg (₹850)"),
        ("c105", "Sneha Gupta", "sneha.g@example.com", 3, 2, 1, "Ergonomic Desk Mat (₹649)"),
        ("c106", "Karan Malhotra", "karan.m@example.com", 6, 5, 1, "Mechanical Keyboard (₹4,199)"),
        ("c107", "Riya Sen", "riya.s@example.com", 4, 3, 1, "Ceramic Mug Set (₹499)"),
        ("c108", "Aditya Nair", "aditya.n@example.com", 9, 8, 1, "USB-C Fast Charger 65W (₹1,199)"),
        ("c109", "Neha Kapoor", "neha.k@example.com", 7, 6, 1, "Blue Light Glasses (₹799)"),
        ("c110", "Amit Roy", "amit.r@example.com", 20, 20, 0, "Laptop Sleeve (₹999)"),
    ]
    customers = [
        Customer(id=f"{merchant_id}-{cid}", merchant_id=merchant_id, name=name, email=email, total_orders=tot,
                 successful_payments=succ, failed_payments=fail, last_product_info=prod)
        for cid, name, email, tot, succ, fail, prod in customers_data
    ]
    by_key = {c.id.rsplit("-", 1)[1]: c for c in customers}

    payments = [Payment(
        id=f"{merchant_id}-pay_cap_01", merchant_id=merchant_id, customer_id=by_key["c110"].id,
        customer_name="Amit Roy", customer_email="amit.r@example.com", amount_paise=to_paise(245000),
        status="captured", payment_method="upi", created_at=sim_start - timedelta(hours=48),
    )]
    # 9 failed payments totalling exactly ₹7,850: 850+1299+2499+649+499+799+550+400+305
    failed_data = [
        ("pay_fail_01", "c104", 850, "bank_decline", "upi"),
        ("pay_fail_02", "c102", 1299, "insufficient_funds", "card"),
        ("pay_fail_03", "c101", 2499, "card_expired", "card"),
        ("pay_fail_04", "c105", 649, "network_timeout", "netbanking"),
        ("pay_fail_05", "c107", 499, "bank_decline", "upi"),
        ("pay_fail_06", "c109", 799, "card_expired", "card"),
        ("pay_fail_07", "c103", 550, "insufficient_funds", "upi"),
        ("pay_fail_08", "c106", 400, "network_timeout", "netbanking"),
        ("pay_fail_09", "c108", 305, "bank_decline", "upi"),
    ]
    for pid, ckey, amt, reason, method in failed_data:
        c = by_key[ckey]
        payments.append(Payment(
            id=f"{merchant_id}-{pid}", merchant_id=merchant_id, customer_id=c.id, customer_name=c.name,
            customer_email=c.email, amount_paise=to_paise(amt), status="failed", failure_reason=reason,
            payment_method=method, created_at=sim_start - timedelta(hours=12), failed_tick=-12,
        ))
    return customers, payments


async def create_sandbox(db: AsyncSession, user: User, scenario: Scenario, nickname: Optional[str]) -> Merchant:
    """Starts a new run for `user`, replacing their previous one (leaderboard entries are kept)."""
    previous = (await db.execute(select(Merchant.id).where(Merchant.user_id == user.id))).scalars().all()
    for old_id in previous:
        await delete_sandbox(db, old_id)

    merchant_id = f"sbx_{uuid.uuid4().hex[:12]}"
    season = current_season()
    seed = scenario_seed(scenario.key, season)
    sim_start = season_start(season)

    merchant = Merchant(
        id=merchant_id,
        name="Aura Store",
        email="admin@aurastore.in",
        user_id=user.id,
        nickname=nickname,
        scenario=scenario.key,
        season=season,
        seed=seed,
        sim_start=sim_start,
        current_tick=0,
        run_ticks=RUN_TICKS,
        status="RUNNING",
        auto_propose=False,
        wallet_start_paise=to_paise(STARTING_WALLET_RUPEES),
    )
    db.add(merchant)
    await db.flush()
    db.add(PolicyRule(
        id=f"pol_{merchant_id}",
        merchant_id=merchant_id,
        max_single_action_budget_paise=to_paise(scenario.default_cap_rupees),
        allowed_action_types="failed_payment_recovery,checkout_recovery",
        requires_human_approval=True,
    ))

    if scenario.streaming:
        db.add_all(customer_pool(seed, merchant_id))
        await db.flush()
    else:
        customers, payments = _classic_seed(merchant_id, sim_start)
        db.add_all(customers)
        await db.flush()
        db.add_all(payments)

    AuditService.log_event(
        db=db,
        merchant_id=merchant_id,
        step="DATA_ANALYSIS",
        status="SUCCESS",
        component="SystemInit",
        message=f"Sandbox started: {scenario.name} ({season}). Incentive wallet ₹{STARTING_WALLET_RUPEES:,}.",
        sanitized_payload={"scenario": scenario.key, "season": season, "wallet": STARTING_WALLET_RUPEES},
    )
    await db.commit()
    return merchant


async def delete_sandbox(db: AsyncSession, merchant_id: str) -> None:
    action_ids = select(Action.id).where(Action.merchant_id == merchant_id)
    await db.execute(delete(AuditEvent).where(AuditEvent.merchant_id == merchant_id))
    await db.execute(delete(RecoveryLink).where(RecoveryLink.action_id.in_(action_ids)))
    await db.execute(delete(Action).where(Action.merchant_id == merchant_id))
    await db.execute(delete(Opportunity).where(Opportunity.merchant_id == merchant_id))
    await db.execute(delete(TickStat).where(TickStat.merchant_id == merchant_id))
    await db.execute(delete(Payment).where(Payment.merchant_id == merchant_id))
    await db.execute(delete(Customer).where(Customer.merchant_id == merchant_id))
    await db.execute(delete(PolicyRule).where(PolicyRule.merchant_id == merchant_id))
    await db.execute(delete(Merchant).where(Merchant.id == merchant_id))


async def cleanup_stale_sandboxes(db: AsyncSession, max_idle: timedelta = timedelta(days=30), limit: int = 20) -> int:
    """Removes runs nobody has touched in a month (their leaderboard entries are kept)."""
    cutoff = utc_now() - max_idle
    stale = (await db.execute(
        select(Merchant.id).where(Merchant.user_id.is_not(None), Merchant.last_active_at < cutoff).limit(limit)
    )).scalars().all()
    for merchant_id in stale:
        await delete_sandbox(db, merchant_id)
    if stale:
        await db.commit()
    return len(stale)
