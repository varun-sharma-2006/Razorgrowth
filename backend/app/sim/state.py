"""Summarises a sandbox: clock, wallet, score and counters."""
from dataclasses import dataclass
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Action, Merchant, Payment, RecoveryLink, TickStat
from app.services.policy_engine import PolicyEngine
from app.services.proposal_service import pending_proposal, wallet_available_paise


@dataclass
class ScoreBreakdown:
    captured_paise: int
    failed_paise: int
    link_recovered_paise: int
    organic_recovered_paise: int
    baseline_recovered_paise: int
    lost_paise: int
    incentive_spent_paise: int

    @property
    def lift_paise(self) -> int:
        """Revenue recovered beyond what customers would have paid anyway with no agent."""
        return self.link_recovered_paise + self.organic_recovered_paise - self.baseline_recovered_paise


async def score_breakdown(db: AsyncSession, merchant: Merchant) -> ScoreBreakdown:
    row = (await db.execute(
        select(
            func.coalesce(func.sum(TickStat.captured_paise), 0),
            func.coalesce(func.sum(TickStat.failed_paise), 0),
            func.coalesce(func.sum(TickStat.link_recovered_paise), 0),
            func.coalesce(func.sum(TickStat.organic_recovered_paise), 0),
            func.coalesce(func.sum(TickStat.baseline_recovered_paise), 0),
            func.coalesce(func.sum(TickStat.lost_paise), 0),
            func.coalesce(func.sum(TickStat.incentive_spent_paise), 0),
        ).where(TickStat.merchant_id == merchant.id)
    )).one()
    return ScoreBreakdown(*(int(v) for v in row))


async def action_counts(db: AsyncSession, merchant: Merchant) -> dict:
    rows = (await db.execute(
        select(Action.status, func.count(Action.id))
        .where(Action.merchant_id == merchant.id, Action.is_simulation.is_(False))
        .group_by(Action.status)
    )).all()
    counts = dict(rows)
    return {
        "approvals": sum(counts.get(s, 0) for s in ("APPROVED", "EXECUTING", "COMPLETED", "HALTED")),
        "rejections": counts.get("REJECTED", 0),
        "blocked": counts.get("POLICY_BLOCKED", 0),
    }


async def open_failures(db: AsyncSession, merchant: Merchant) -> tuple:
    row = (await db.execute(
        select(func.count(Payment.id), func.coalesce(func.sum(Payment.amount_paise), 0))
        .where(Payment.merchant_id == merchant.id, Payment.status == "failed")
    )).one()
    return int(row[0]), int(row[1])


async def links_in_flight(db: AsyncSession, merchant: Merchant) -> int:
    return (await db.execute(
        select(func.count(RecoveryLink.id))
        .join(Action, Action.id == RecoveryLink.action_id)
        .where(Action.merchant_id == merchant.id, Action.is_simulation.is_(False), RecoveryLink.status == "CREATED")
    )).scalar_one()


async def policy_cap_paise(db: AsyncSession, merchant: Merchant) -> int:
    policy = await PolicyEngine.get_policy(db, merchant.id)
    return policy.max_single_action_budget_paise if policy else 0


async def snapshot(db: AsyncSession, merchant: Merchant) -> dict:
    """Everything the simulator header and KPI strip need, in paise."""
    score = await score_breakdown(db, merchant)
    open_count, open_paise = await open_failures(db, merchant)
    pending = await pending_proposal(db, merchant)
    return {
        "score": score,
        "counts": await action_counts(db, merchant),
        "open_failed_count": open_count,
        "open_failed_paise": open_paise,
        "links_in_flight": await links_in_flight(db, merchant),
        "wallet_available_paise": await wallet_available_paise(db, merchant),
        "policy_cap_paise": await policy_cap_paise(db, merchant),
        "pending_action_id": pending.id if pending else None,
    }
