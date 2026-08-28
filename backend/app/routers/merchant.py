from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.config import settings
from app.models import Merchant, Payment, Opportunity, Action, PolicyRule, AuditEvent
from app.schemas import SystemStatusSchema, MerchantMetricsSchema, PolicyUpdateSchema

router = APIRouter(prefix="/merchant", tags=["Merchant"])

@router.get("/status", response_model=SystemStatusSchema)
async def get_system_status():
    return SystemStatusSchema(
        razorpay_mode="RAZORPAY TEST MODE" if settings.is_razorpay_live_test_mode else "LOCAL DEMO MODE",
        ai_provider_mode=settings.ai_provider_mode,
        database_type="PostgreSQL" if "postgresql" in settings.DATABASE_URL else "SQLite (Local Dev)",
        merchant_id=settings.MERCHANT_ID
    )

@router.get("/metrics", response_model=MerchantMetricsSchema)
async def get_merchant_metrics(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID

    # Total captured revenue
    cap_res = await db.execute(
        select(func.sum(Payment.amount)).where(Payment.merchant_id == merchant_id, Payment.status == "captured")
    )
    total_revenue = cap_res.scalar() or 245000.0

    # Failed payment loss
    fail_res = await db.execute(
        select(func.sum(Payment.amount)).where(Payment.merchant_id == merchant_id, Payment.status == "failed")
    )
    failed_payment_loss = fail_res.scalar() or 0.0

    fail_count_res = await db.execute(
        select(func.count(Payment.id)).where(Payment.merchant_id == merchant_id, Payment.status == "failed")
    )
    failed_payment_count = fail_count_res.scalar() or 0

    # Recoverable estimate (70% of failed payments)
    recoverable_amount = round(failed_payment_loss * 0.70, 2)

    # Approved actions
    approved_res = await db.execute(
        select(func.count(Action.id)).where(Action.merchant_id == merchant_id, Action.status.in_(["APPROVED", "COMPLETED"]))
    )
    approved_actions_count = approved_res.scalar() or 0

    # Policy blocked count
    blocked_res = await db.execute(
        select(func.count(Action.id)).where(Action.merchant_id == merchant_id, Action.status == "POLICY_BLOCKED")
    )
    policy_blocked_count = blocked_res.scalar() or 0

    # Policy max budget limit
    policy_res = await db.execute(
        select(PolicyRule).where(PolicyRule.merchant_id == merchant_id)
    )
    policy = policy_res.scalars().first()
    max_budget_limit = policy.max_single_action_budget if policy else settings.DEFAULT_MAX_BUDGET

    return MerchantMetricsSchema(
        total_revenue=total_revenue,
        failed_payment_loss=failed_payment_loss,
        failed_payment_count=failed_payment_count,
        recoverable_amount=recoverable_amount,
        approved_actions_count=approved_actions_count,
        policy_blocked_count=policy_blocked_count,
        max_budget_limit=max_budget_limit
    )

@router.put("/policy")
async def update_merchant_policy(body: PolicyUpdateSchema, db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    result = await db.execute(
        select(PolicyRule).where(PolicyRule.merchant_id == merchant_id)
    )
    policy = result.scalars().first()
    if not policy:
        policy = PolicyRule(
            id="pol_default",
            merchant_id=merchant_id,
            max_single_action_budget=body.max_single_action_budget
        )
        db.add(policy)
    else:
        policy.max_single_action_budget = body.max_single_action_budget
    await db.commit()
    return {"status": "updated", "max_single_action_budget": policy.max_single_action_budget}
