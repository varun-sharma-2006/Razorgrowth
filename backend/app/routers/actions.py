from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models import Action, Opportunity
from app.schemas import ActionSchema, ActionDecisionSchema
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_service import RazorpayService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/actions", tags=["Actions"])

@router.get("", response_model=List[ActionSchema])
async def list_actions(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    result = await db.execute(
        select(Action).where(Action.merchant_id == merchant_id).order_by(Action.created_at.desc())
    )
    actions = result.scalars().all()
    return [
        ActionSchema(
            id=a.id,
            idempotency_key=a.idempotency_key,
            opportunity_id=a.opportunity_id,
            merchant_id=a.merchant_id,
            title=a.title,
            evidence=a.evidence or [],
            decision_factors=a.decision_factors or [],
            recommendation_reason=a.recommendation_reason,
            confidence_score=a.confidence_score,
            proposed_budget=a.proposed_budget,
            risk_score=a.risk_score,
            status=a.status,
            razorpay_order_id=a.razorpay_order_id,
            razorpay_payment_link=a.razorpay_payment_link,
            failure_reason=a.failure_reason,
            retry_count=a.retry_count,
            created_at=a.created_at,
            updated_at=a.updated_at
        )
        for a in actions
    ]

@router.get("/{action_id}", response_model=ActionSchema)
async def get_action_detail(action_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Action).where(Action.id == action_id))
    action = result.scalars().first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return ActionSchema(
        id=action.id,
        idempotency_key=action.idempotency_key,
        opportunity_id=action.opportunity_id,
        merchant_id=action.merchant_id,
        title=action.title,
        evidence=action.evidence or [],
        decision_factors=action.decision_factors or [],
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
    )

@router.post("/{action_id}/decision")
async def handle_merchant_decision(
    action_id: str,
    payload: ActionDecisionSchema,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Action).where(Action.id == action_id))
    action = result.scalars().first()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    if action.status not in ["PENDING_APPROVAL", "PROPOSED"]:
        raise HTTPException(status_code=400, detail=f"Action cannot be decided in state '{action.status}'")

    if payload.decision == "REJECT":
        action.status = "REJECTED"
        action.failure_reason = payload.rejection_reason or "Explicitly rejected by Merchant Admin"
        await db.commit()

        await AuditService.log_event(
            db=db,
            merchant_id=action.merchant_id,
            action_id=action.id,
            step="MERCHANT_APPROVAL",
            status="BLOCKED",
            component="MerchantAdmin",
            message=f"Action REJECTED by Merchant Admin: {action.failure_reason}",
            sanitized_payload={"decision": "REJECT", "reason": action.failure_reason}
        )

        return {"status": "REJECTED", "action_id": action.id}

    # Merchant Approved!
    # Secondary Policy Safety Check
    policy_check = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=action.merchant_id,
        action_type="failed_payment_recovery",
        proposed_budget=action.proposed_budget,
        action_id=action.id
    )

    if not policy_check.passed:
        action.status = "POLICY_BLOCKED"
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Action blocked by secondary policy check: {policy_check.reason}")

    # Mark Approved and log audit event
    action.status = "APPROVED"
    await db.commit()

    await AuditService.log_event(
        db=db,
        merchant_id=action.merchant_id,
        action_id=action.id,
        step="MERCHANT_APPROVAL",
        status="SUCCESS",
        component="MerchantAdmin",
        message=f"Explicit Merchant Approval granted for budget ₹{action.proposed_budget:,.2f}.",
        sanitized_payload={"decision": "APPROVE", "approved_budget": action.proposed_budget}
    )

    # Execute Razorpay API Integration using Idempotency Key
    action.status = "EXECUTING"
    await db.commit()

    success, rzp_data = await RazorpayService.create_payment_link(
        amount_inr=action.proposed_budget,
        description="RazorGrowth Recovery Payment Link Campaign",
        customer_name="Target Merchant Customers",
        customer_email="recovery@razorgrowth.demo",
        idempotency_key=action.idempotency_key,
        db=db,
        merchant_id=action.merchant_id,
        action_id=action.id
    )

    if success:
        action.status = "COMPLETED"
        action.razorpay_order_id = rzp_data.get("order_id")
        action.razorpay_payment_link = rzp_data.get("payment_link")
        await db.commit()

        # Update Opportunity status to RESOLVED
        opp_res = await db.execute(select(Opportunity).where(Opportunity.id == action.opportunity_id))
        opp = opp_res.scalars().first()
        if opp:
            opp.status = "RESOLVED"
            await db.commit()

        return {
            "status": "COMPLETED",
            "action_id": action.id,
            "idempotency_key": action.idempotency_key,
            "razorpay_order_id": action.razorpay_order_id,
            "razorpay_payment_link": action.razorpay_payment_link
        }
    else:
        action.status = "FAILED"
        action.failure_reason = rzp_data.get("error", "Razorpay API Execution Failed")
        await db.commit()
        return {
            "status": "FAILED",
            "action_id": action.id,
            "error": action.failure_reason
        }
