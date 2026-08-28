import uuid
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models import Opportunity, Action
from app.schemas import OpportunitySchema, ActionSchema
from app.services.ai_service import AIService
from app.services.policy_engine import PolicyEngine
from app.services.audit_service import AuditService

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])

@router.get("", response_model=List[OpportunitySchema])
async def list_opportunities(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    result = await db.execute(
        select(Opportunity).where(Opportunity.merchant_id == merchant_id).order_by(Opportunity.created_at.desc())
    )
    opps = result.scalars().all()
    return [
        OpportunitySchema(
            id=o.id,
            merchant_id=o.merchant_id,
            title=o.title,
            type=o.type,
            total_failed_count=o.total_failed_count,
            total_failed_amount=o.total_failed_amount,
            impact_estimate=o.impact_estimate,
            status=o.status,
            created_at=o.created_at
        )
        for o in opps
    ]

@router.post("/scan")
async def scan_opportunities(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID

    # Run AI Service Analysis
    ai_result = await AIService.analyze_merchant_payments(db, merchant_id)

    # Check if active opportunity exists
    result = await db.execute(
        select(Opportunity).where(Opportunity.merchant_id == merchant_id, Opportunity.status == "OPEN")
    )
    opp = result.scalars().first()

    if not opp:
        opp = Opportunity(
            id=f"opp_{uuid.uuid4().hex[:8]}",
            merchant_id=merchant_id,
            title=ai_result["title"],
            type="failed_payment_recovery",
            total_failed_count=ai_result["total_failed_count"],
            total_failed_amount=ai_result["total_failed_amount"],
            impact_estimate=ai_result["impact_estimate"],
            status="OPEN"
        )
        db.add(opp)
        await db.commit()
        await db.refresh(opp)

    # Generate Proposed Action with Idempotency Key
    action_id = f"RG-ACT-{uuid.uuid4().hex[:6].upper()}"
    idempotency_key = action_id

    action = Action(
        id=action_id,
        idempotency_key=idempotency_key,
        opportunity_id=opp.id,
        merchant_id=merchant_id,
        title=f"Launch Razorpay Payment Link Recovery Campaign",
        evidence=ai_result["evidence"],
        decision_factors=ai_result["decision_factors"],
        recommendation_reason=ai_result["recommendation_reason"],
        confidence_score=ai_result["confidence_score"],
        proposed_budget=ai_result["proposed_budget"],
        risk_score=ai_result["risk_score"],
        status="PROPOSED"
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    # Run initial Policy Engine Check
    policy_check = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=merchant_id,
        action_type="failed_payment_recovery",
        proposed_budget=action.proposed_budget,
        action_id=action.id
    )

    if policy_check.passed:
        action.status = "PENDING_APPROVAL"
        await db.commit()
        await db.refresh(action)
    else:
        action.status = "POLICY_BLOCKED"
        await db.commit()
        await db.refresh(action)

    return {
        "opportunity": OpportunitySchema(
            id=opp.id,
            merchant_id=opp.merchant_id,
            title=opp.title,
            type=opp.type,
            total_failed_count=opp.total_failed_count,
            total_failed_amount=opp.total_failed_amount,
            impact_estimate=opp.impact_estimate,
            status=opp.status,
            created_at=opp.created_at
        ),
        "action": ActionSchema(
            id=action.id,
            idempotency_key=action.idempotency_key,
            opportunity_id=action.opportunity_id,
            merchant_id=action.merchant_id,
            title=action.title,
            evidence=action.evidence,
            decision_factors=action.decision_factors,
            recommendation_reason=action.recommendation_reason,
            confidence_score=action.confidence_score,
            proposed_budget=action.proposed_budget,
            risk_score=action.risk_score,
            status=action.status,
            razorpay_order_id=action.razorpay_order_id,
            razorpay_payment_link=action.razorpay_payment_link,
            failure_reason=action.failure_reason,
            retry_count=action.retry_count,
            created_at=action.created_at,
            updated_at=action.updated_at
        ),
        "policy_check": policy_check
    }
