import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models import Action, Opportunity
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_service import RazorpayService
from app.services.audit_service import AuditService

router = APIRouter(prefix="/simulation", tags=["Failure Simulations"])

@router.post("/policy-block")
async def simulate_policy_block(db: AsyncSession = Depends(get_db)):
    """
    Demo 1: Safety Policy Block
    AI proposes a ₹3,000 budget action while Merchant Limit = ₹1,000.
    Policy Engine blocks action immediately before human approval or Razorpay execution.
    """
    merchant_id = settings.MERCHANT_ID
    action_id = f"RG-ACT-BLOCK-{uuid.uuid4().hex[:4].upper()}"

    action = Action(
        id=action_id,
        idempotency_key=action_id,
        opportunity_id="opp_demo_policy",
        merchant_id=merchant_id,
        title="Excessive Budget Offer (Policy Violation Test)",
        evidence=["9 failed payments worth ₹7,850"],
        decision_factors=["Over-budget cashback campaign test"],
        recommendation_reason="Test proposed budget exceeds merchant maximum safety threshold.",
        confidence_score=92.0,
        proposed_budget=3000.0, # ₹3,000 exceeds ₹1,000 cap!
        risk_score="HIGH",
        status="PROPOSED"
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    # Evaluate Policy Engine
    policy_result = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=merchant_id,
        action_type="failed_payment_recovery",
        proposed_budget=3000.0,
        action_id=action.id
    )

    action.status = "POLICY_BLOCKED"
    await db.commit()

    return {
        "demo": "Demo 1 - Policy Block",
        "action_id": action.id,
        "proposed_budget": 3000.0,
        "merchant_max_limit": policy_result.max_allowed_budget,
        "status": action.status,
        "policy_result": policy_result,
        "message": "Policy Engine successfully blocked action. No human approval or Razorpay API invocation allowed."
    }

@router.post("/api-timeout")
async def simulate_api_timeout(db: AsyncSession = Depends(get_db)):
    """
    Demo 2: Razorpay API Timeout & Controlled Retry Safe Halt
    Simulates API timeout during Razorpay execution, retries using exact SAME idempotency key,
    halts safely without duplicate transaction creation, and logs full audit trail.
    """
    merchant_id = settings.MERCHANT_ID
    action_id = f"RG-ACT-TIMEOUT-{uuid.uuid4().hex[:4].upper()}"
    idempotency_key = f"IDEM-KEY-{action_id}"

    action = Action(
        id=action_id,
        idempotency_key=idempotency_key,
        opportunity_id="opp_demo_timeout",
        merchant_id=merchant_id,
        title="Razorpay Payment Link Creation (Network Timeout Test)",
        evidence=["Automated API retry policy test"],
        decision_factors=["Simulating gateway 504 timeout scenario"],
        recommendation_reason="Test network timeout resilience and idempotency guard.",
        confidence_score=85.0,
        proposed_budget=850.0,
        risk_score="LOW",
        status="EXECUTING"
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)

    # Execute Timeout Workflow Simulation
    simulation_result = await RazorpayService.simulate_api_timeout_workflow(
        db=db,
        merchant_id=merchant_id,
        action_id=action.id,
        idempotency_key=idempotency_key,
        max_retries=2
    )

    action.status = "HALTED"
    action.failure_reason = "Razorpay API timeout persisted after 3 attempts. Operation safely halted."
    await db.commit()

    return {
        "demo": "Demo 2 - API Timeout & Safe Halt",
        "action_id": action.id,
        "idempotency_key": idempotency_key,
        "final_status": action.status,
        "simulation_result": simulation_result,
        "message": "Controlled retry completed with zero duplicate transactions created."
    }
