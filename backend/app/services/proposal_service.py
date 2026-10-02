"""Turns telemetry into a policy-checked recovery proposal awaiting merchant approval."""
import uuid
from dataclasses import dataclass
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import Action, Merchant, Opportunity, RecoveryLink
from app.money import to_paise
from app.schemas import PolicyCheckResult
from app.services.ai_service import AIService
from app.services.policy_engine import PolicyEngine
from app.simclock import sim_time

ACTION_TYPE = "failed_payment_recovery"


class NothingToRecover(Exception):
    pass


@dataclass
class ProposalResult:
    opportunity: Opportunity
    action: Action
    policy_check: PolicyCheckResult
    reused_existing: bool = False


def merchant_now(merchant: Merchant):
    return sim_time(merchant.sim_start, merchant.current_tick) if merchant.sim_start else None


async def wallet_available_paise(db: AsyncSession, merchant: Merchant) -> int:
    """Starting wallet minus discounts reserved on open links and spent on paid ones."""
    committed = (await db.execute(
        select(func.coalesce(func.sum(RecoveryLink.discount_paise), 0))
        .join(Action, Action.id == RecoveryLink.action_id)
        .where(Action.merchant_id == merchant.id, Action.is_simulation.is_(False),
               RecoveryLink.status.in_(["PENDING", "CREATED", "PAID"]))
    )).scalar_one()
    return merchant.wallet_start_paise - int(committed)


async def pending_proposal(db: AsyncSession, merchant: Merchant):
    return (await db.execute(
        select(Action)
        .where(Action.merchant_id == merchant.id, Action.status == "PENDING_APPROVAL",
               Action.is_simulation.is_(False))
        .order_by(Action.created_at.desc())
    )).scalars().first()


async def propose_recovery(db: AsyncSession, merchant: Merchant, auto: bool = False) -> ProposalResult:
    """Returns the pending proposal if one exists, otherwise asks the AI for a new one.

    Adds audit events; the caller commits.
    """
    opp = (await db.execute(
        select(Opportunity)
        .where(Opportunity.merchant_id == merchant.id, Opportunity.status == "OPEN")
        .order_by(Opportunity.created_at.desc())
    )).scalars().first()

    # One pending proposal at a time: re-scanning returns it instead of creating a second
    # approvable action for the same failed payments.
    pending = await pending_proposal(db, merchant)
    if pending is not None and pending.policy_result:
        pending_opp = await db.get(Opportunity, pending.opportunity_id)
        return ProposalResult(pending_opp, pending, PolicyCheckResult.model_validate(pending.policy_result), True)

    telemetry = await AIService.collect_telemetry(db, merchant.id, merchant_now(merchant))
    if telemetry.failed_count == 0:
        raise NothingToRecover("No unrecovered failed payments to act on.")

    wallet = await wallet_available_paise(db, merchant)
    policy = await PolicyEngine.get_policy(db, merchant.id)
    limit = min(wallet, policy.max_single_action_budget_paise) if policy else wallet
    rec = await AIService.recommend(db, merchant.id, telemetry, budget_limit_paise=limit)
    impact = round(telemetry.failed_amount_paise * settings.RECOVERY_CONVERSION_RATE)

    if opp is None:
        opp = Opportunity(id=f"opp_{uuid.uuid4().hex[:8]}", merchant_id=merchant.id, type=ACTION_TYPE, status="OPEN")
        db.add(opp)
    opp.title = rec.data.title
    opp.total_failed_count = telemetry.failed_count
    opp.total_failed_amount_paise = telemetry.failed_amount_paise
    opp.impact_estimate_paise = impact

    action_id = f"RG-ACT-{uuid.uuid4().hex[:8].upper()}"
    action = Action(
        id=action_id,
        idempotency_key=action_id,
        opportunity_id=opp.id,
        merchant_id=merchant.id,
        action_type=ACTION_TYPE,
        title="Launch Razorpay Payment Link Recovery Campaign",
        ai_provider=rec.provider,
        evidence=rec.data.evidence,
        decision_factors=rec.data.decision_factors,
        recommendation_reason=rec.data.recommendation_reason,
        confidence_score=rec.data.confidence_score,
        proposed_budget_paise=to_paise(rec.data.proposed_budget),
        risk_score=rec.data.risk_score,
        target_payment_ids=[p.id for p in telemetry.eligible],
        status="PROPOSED",
        created_tick=merchant.current_tick,
        auto_proposed=auto,
    )
    db.add(action)
    await db.flush()

    policy_check = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=merchant.id,
        action_type=action.action_type,
        proposed_budget_paise=action.proposed_budget_paise,
        idempotency_key=action.idempotency_key,
        action_id=action.id,
        wallet_available_paise=await wallet_available_paise(db, merchant),
    )
    action.status = "PENDING_APPROVAL" if policy_check.passed else "POLICY_BLOCKED"
    action.policy_result = policy_check.model_dump()
    await db.flush()
    await db.refresh(action, ["recovery_links"])
    return ProposalResult(opp, action, policy_check)
