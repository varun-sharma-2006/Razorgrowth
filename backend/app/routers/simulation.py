import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Action, Opportunity, Payment
from app.money import to_paise
from app.schemas import ActionSchema, SimulationResponse
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_service import DemoPaymentLinkClient, FaultInjectingClient
from app.services.recovery_service import execute_recovery_action

router = APIRouter(prefix="/simulation", tags=["Failure Simulations"])

# Simulations never touch real Razorpay and never count towards metrics or eligibility.


async def _create_simulation_action(
    db: AsyncSession, label: str, title: str, budget_paise: int, target_payment_ids: List[str], status: str
) -> Action:
    merchant_id = settings.MERCHANT_ID
    suffix = uuid.uuid4().hex[:6].upper()
    opp = Opportunity(
        id=f"opp_sim_{suffix.lower()}",
        merchant_id=merchant_id,
        title=f"[Simulation] {title}",
        type="failed_payment_recovery",
        status="SIMULATION",
    )
    db.add(opp)
    action_id = f"RG-ACT-{label}-{suffix}"
    action = Action(
        id=action_id,
        idempotency_key=action_id,
        opportunity_id=opp.id,
        merchant_id=merchant_id,
        action_type="failed_payment_recovery",
        is_simulation=True,
        title=title,
        ai_provider="Simulation",
        evidence=["Failure-injection scenario for demonstration"],
        decision_factors=["Exercises the production safety path with injected faults"],
        recommendation_reason=title,
        confidence_score=0.0,
        proposed_budget_paise=budget_paise,
        risk_score="HIGH" if label == "BLOCK" else "LOW",
        target_payment_ids=target_payment_ids,
        status=status,
    )
    db.add(action)
    await db.flush()
    return action


async def _demo_target_payment(db: AsyncSession) -> Payment:
    payment = (await db.execute(
        select(Payment)
        .where(Payment.merchant_id == settings.MERCHANT_ID, Payment.status.in_(["failed", "recovered"]))
        .order_by(Payment.created_at.desc(), Payment.id)
    )).scalars().first()
    if payment is None:
        raise HTTPException(status_code=409, detail="No failed payments available to run the simulation against")
    return payment


@router.post("/policy-block", response_model=SimulationResponse)
async def simulate_policy_block(db: AsyncSession = Depends(get_db)):
    """Demo 1: an AI proposal of 3× the merchant's cap is blocked before approval or execution."""
    policy = await PolicyEngine.get_policy(db, settings.MERCHANT_ID)
    cap = policy.max_single_action_budget_paise if policy else to_paise(settings.DEFAULT_MAX_BUDGET)
    budget = cap * 3

    action = await _create_simulation_action(
        db, "BLOCK", "Excessive Budget Offer (Policy Violation Test)", budget, [], "PROPOSED"
    )
    policy_result = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=settings.MERCHANT_ID,
        action_type=action.action_type,
        proposed_budget_paise=budget,
        idempotency_key=action.idempotency_key,
        action_id=action.id,
    )
    action.status = "PENDING_APPROVAL" if policy_result.passed else "POLICY_BLOCKED"
    action.policy_result = policy_result.model_dump()
    await db.commit()
    await db.refresh(action, ["recovery_links"])

    return SimulationResponse(
        demo="Demo 1 - Policy Block",
        status=action.status,
        message=(
            "Policy Engine blocked the action. No human approval or Razorpay call is possible."
            if not policy_result.passed else "Unexpected: the policy engine allowed an over-cap proposal."
        ),
        action=ActionSchema.model_validate(action),
        policy_result=policy_result,
    )


@router.post("/api-timeout", response_model=SimulationResponse)
async def simulate_api_timeout(db: AsyncSession = Depends(get_db)):
    """Demo 2: every gateway call times out. The real retry loop runs, then halts safely."""
    payment = await _demo_target_payment(db)
    action = await _create_simulation_action(
        db, "TIMEOUT", "Razorpay Payment Link Creation (Network Timeout Test)",
        to_paise(50), [payment.id], "EXECUTING",
    )
    await db.commit()

    client = FaultInjectingClient(DemoPaymentLinkClient(), fail_attempts=10**6)
    outcome = await execute_recovery_action(db, action, client)

    return SimulationResponse(
        demo="Demo 2 - API Timeout & Safe Halt",
        status=action.status,
        message=(
            f"All {outcome.attempts} attempts timed out, each reusing the same reference_id. "
            f"Execution halted with zero links created."
        ),
        action=ActionSchema.model_validate(action),
        attempts=outcome.attempts,
        links_at_gateway=sum(DemoPaymentLinkClient.count_for_reference(l.reference_id) for l in action.recovery_links),
    )


@router.post("/lost-response", response_model=SimulationResponse)
async def simulate_lost_response(db: AsyncSession = Depends(get_db)):
    """Demo 3: the first request reaches the gateway but its response is lost.

    The retry reuses the same reference_id, the gateway reports a conflict, and the existing
    link is adopted — exactly one link exists afterwards.
    """
    payment = await _demo_target_payment(db)
    action = await _create_simulation_action(
        db, "LOST", "Razorpay Payment Link Creation (Lost Response Test)",
        to_paise(50), [payment.id], "EXECUTING",
    )
    await db.commit()

    client = FaultInjectingClient(DemoPaymentLinkClient(), fail_attempts=1, lose_response=True)
    outcome = await execute_recovery_action(db, action, client)
    at_gateway = sum(DemoPaymentLinkClient.count_for_reference(l.reference_id) for l in action.recovery_links)

    return SimulationResponse(
        demo="Demo 3 - Lost Response & Deduplication",
        status=action.status,
        message=(
            f"Attempt 1 created the link but its response was lost. The retry was recognised by reference_id "
            f"and adopted the existing link: {at_gateway} link exists at the gateway after {outcome.attempts} attempts."
        ),
        action=ActionSchema.model_validate(action),
        attempts=outcome.attempts,
        links_at_gateway=at_gateway,
    )
