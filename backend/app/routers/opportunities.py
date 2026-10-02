import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Action, Opportunity
from app.money import to_paise
from app.schemas import ActionSchema, OpportunitySchema, PolicyCheckResult, ScanResponse
from app.services.ai_service import AIService
from app.services.policy_engine import PolicyEngine

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])

ACTION_TYPE = "failed_payment_recovery"


@router.get("", response_model=List[OpportunitySchema])
async def list_opportunities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Opportunity)
        .where(Opportunity.merchant_id == settings.MERCHANT_ID, Opportunity.status != "SIMULATION")
        .order_by(Opportunity.created_at.desc())
    )
    return result.scalars().all()


@router.post("/scan", response_model=ScanResponse)
async def scan_opportunities(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID

    opp = (await db.execute(
        select(Opportunity)
        .where(Opportunity.merchant_id == merchant_id, Opportunity.status == "OPEN")
        .order_by(Opportunity.created_at.desc())
    )).scalars().first()

    # One pending proposal per opportunity: re-scanning returns it instead of creating a second
    # approvable action for the same failed payments.
    if opp is not None:
        pending = (await db.execute(
            select(Action)
            .where(Action.opportunity_id == opp.id, Action.status == "PENDING_APPROVAL",
                   Action.is_simulation.is_(False))
            .order_by(Action.created_at.desc())
        )).scalars().first()
        if pending is not None and pending.policy_result:
            return ScanResponse(
                opportunity=OpportunitySchema.model_validate(opp),
                action=ActionSchema.model_validate(pending),
                policy_check=PolicyCheckResult.model_validate(pending.policy_result),
                reused_existing=True,
            )

    telemetry = await AIService.collect_telemetry(db, merchant_id)
    if telemetry.failed_count == 0:
        raise HTTPException(status_code=409, detail="No unrecovered failed payments to act on.")

    rec = await AIService.recommend(db, merchant_id, telemetry)
    impact = round(telemetry.failed_amount_paise * settings.RECOVERY_CONVERSION_RATE)

    if opp is None:
        opp = Opportunity(
            id=f"opp_{uuid.uuid4().hex[:8]}",
            merchant_id=merchant_id,
            type=ACTION_TYPE,
            status="OPEN",
        )
        db.add(opp)
    opp.title = rec.data.title
    opp.total_failed_count = telemetry.failed_count
    opp.total_failed_amount_paise = telemetry.failed_amount_paise
    opp.impact_estimate_paise = impact

    action_id = f"RG-ACT-{uuid.uuid4().hex[:6].upper()}"
    action = Action(
        id=action_id,
        idempotency_key=action_id,
        opportunity_id=opp.id,
        merchant_id=merchant_id,
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
    )
    db.add(action)
    await db.flush()

    policy_check = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=merchant_id,
        action_type=action.action_type,
        proposed_budget_paise=action.proposed_budget_paise,
        idempotency_key=action.idempotency_key,
        action_id=action.id,
    )
    action.status = "PENDING_APPROVAL" if policy_check.passed else "POLICY_BLOCKED"
    action.policy_result = policy_check.model_dump()
    await db.commit()
    await db.refresh(action, ["recovery_links"])

    return ScanResponse(
        opportunity=OpportunitySchema.model_validate(opp),
        action=ActionSchema.model_validate(action),
        policy_check=policy_check,
    )
