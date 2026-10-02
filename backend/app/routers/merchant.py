from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db, is_sqlite
from app.models import Action, Payment, PolicyRule, RecoveryLink
from app.money import format_inr, to_paise, to_rupees
from app.schemas import MerchantMetricsSchema, PolicySchema, PolicyUpdateSchema, SystemStatusSchema
from app.security import actor_label
from app.services.audit_service import AuditService
from app.services.policy_engine import PolicyEngine

# Public: lets the UI show integration modes and whether it needs an admin key.
status_router = APIRouter(prefix="/merchant", tags=["Merchant"])
router = APIRouter(prefix="/merchant", tags=["Merchant"])


@status_router.get("/status", response_model=SystemStatusSchema)
async def get_system_status():
    return SystemStatusSchema(
        razorpay_mode=settings.razorpay_mode,
        ai_provider_mode=settings.ai_provider_mode,
        database_type="SQLite (Local Dev)" if is_sqlite else "PostgreSQL",
        merchant_id=settings.MERCHANT_ID,
        auth_required=settings.auth_required,
        webhook_configured=bool(settings.RAZORPAY_WEBHOOK_SECRET),
    )


async def _sum_payments(db: AsyncSession, merchant_id: str, status: str) -> int:
    res = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_paise), 0)).where(
            Payment.merchant_id == merchant_id, Payment.status == status
        )
    )
    return int(res.scalar_one())


@router.get("/metrics", response_model=MerchantMetricsSchema)
async def get_merchant_metrics(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    rate = settings.RECOVERY_CONVERSION_RATE

    total_revenue = await _sum_payments(db, merchant_id, "captured")
    failed_loss = await _sum_payments(db, merchant_id, "failed")
    failed_count = (await db.execute(
        select(func.count(Payment.id)).where(Payment.merchant_id == merchant_id, Payment.status == "failed")
    )).scalar_one()
    recoverable = round(failed_loss * rate)

    real_actions = (Action.merchant_id == merchant_id, Action.is_simulation.is_(False))
    approved_count = (await db.execute(
        select(func.count(Action.id)).where(*real_actions, Action.status.in_(["APPROVED", "EXECUTING", "COMPLETED"]))
    )).scalar_one()
    blocked_count = (await db.execute(
        select(func.count(Action.id)).where(Action.merchant_id == merchant_id, Action.status == "POLICY_BLOCKED")
    )).scalar_one()

    link_stats = (await db.execute(
        select(
            func.count(RecoveryLink.id).filter(RecoveryLink.status.in_(["CREATED", "PAID"])),
            func.coalesce(func.sum(RecoveryLink.amount_paise).filter(RecoveryLink.status == "PAID"), 0),
        ).join(Action, Action.id == RecoveryLink.action_id).where(*real_actions)
    )).one()

    policy = await PolicyEngine.get_policy(db, merchant_id)
    max_budget = policy.max_single_action_budget_paise if policy else to_paise(settings.DEFAULT_MAX_BUDGET)

    return MerchantMetricsSchema(
        total_revenue=to_rupees(total_revenue),
        failed_payment_loss=to_rupees(failed_loss),
        failed_payment_count=failed_count,
        historical_recovery_rate=rate,
        recoverable_amount=to_rupees(recoverable),
        methodology_explanation=(
            f"{format_inr(failed_loss)} failed payments × {rate:.0%} estimated conversion rate "
            f"(prior purchase intent) = {format_inr(recoverable)}"
        ),
        approved_actions_count=approved_count,
        policy_blocked_count=blocked_count,
        max_budget_limit=to_rupees(max_budget),
        recovery_links_sent=link_stats[0],
        recovered_amount=to_rupees(int(link_stats[1])),
    )


@router.get("/policy", response_model=PolicySchema)
async def get_merchant_policy(db: AsyncSession = Depends(get_db)):
    policy = await PolicyEngine.get_policy(db, settings.MERCHANT_ID)
    return PolicySchema(
        max_single_action_budget=policy.max_single_action_budget if policy else settings.DEFAULT_MAX_BUDGET,
        allowed_action_types=[
            t.strip() for t in (policy.allowed_action_types if policy else settings.ALLOWED_ACTION_TYPES).split(",")
        ],
        requires_human_approval=policy.requires_human_approval if policy else True,
    )


@router.put("/policy", response_model=PolicySchema)
async def update_merchant_policy(body: PolicyUpdateSchema, db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    new_cap = to_paise(body.max_single_action_budget)
    policy = await PolicyEngine.get_policy(db, merchant_id)
    old_cap = policy.max_single_action_budget_paise if policy else to_paise(settings.DEFAULT_MAX_BUDGET)
    if not policy:
        policy = PolicyRule(
            id=f"pol_{merchant_id}",
            merchant_id=merchant_id,
            max_single_action_budget_paise=new_cap,
            allowed_action_types=settings.ALLOWED_ACTION_TYPES,
        )
        db.add(policy)
    else:
        policy.max_single_action_budget_paise = new_cap

    AuditService.log_event(
        db=db,
        merchant_id=merchant_id,
        step="POLICY_UPDATE",
        status="SUCCESS",
        component="MerchantAdmin",
        message=f"Merchant safety cap changed from {format_inr(old_cap)} to {format_inr(new_cap)}.",
        sanitized_payload={
            "old_max_single_action_budget": to_rupees(old_cap),
            "new_max_single_action_budget": to_rupees(new_cap),
            "actor": actor_label(),
        },
    )
    await db.commit()
    return await get_merchant_policy(db)
