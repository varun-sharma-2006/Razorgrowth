from typing import Iterable, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Action
from app.money import format_inr, to_rupees, utc_now
from app.schemas import ActionDecisionSchema, ActionSchema, DecisionResponse
from app.security import actor_label
from app.services.audit_service import AuditService
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_service import get_payment_link_client
from app.services.recovery_service import execute_recovery_action

router = APIRouter(prefix="/actions", tags=["Actions"])


async def get_action_or_404(db: AsyncSession, action_id: str) -> Action:
    action = await db.get(Action, action_id)
    if action is None or action.merchant_id != settings.MERCHANT_ID:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


async def claim_transition(db: AsyncSession, action: Action, from_states: Iterable[str], to_state: str, **values) -> bool:
    """Atomically moves an action between states.

    The status check and the write happen in one UPDATE, so two concurrent decisions on the
    same action cannot both succeed. Returns False if the action was no longer in `from_states`.
    """
    result = await db.execute(
        update(Action)
        .where(Action.id == action.id, Action.status.in_(list(from_states)))
        .values(status=to_state, updated_at=utc_now(), **values)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        await db.rollback()
        await db.refresh(action)
        return False
    await db.refresh(action)
    return True


@router.get("", response_model=List[ActionSchema])
async def list_actions(include_simulations: bool = False, db: AsyncSession = Depends(get_db)):
    query = select(Action).where(Action.merchant_id == settings.MERCHANT_ID)
    if not include_simulations:
        query = query.where(Action.is_simulation.is_(False))
    return (await db.execute(query.order_by(Action.created_at.desc()))).scalars().all()


@router.get("/{action_id}", response_model=ActionSchema)
async def get_action_detail(action_id: str, db: AsyncSession = Depends(get_db)):
    return await get_action_or_404(db, action_id)


@router.post("/{action_id}/decision", response_model=DecisionResponse)
async def handle_merchant_decision(
    action_id: str,
    payload: ActionDecisionSchema,
    db: AsyncSession = Depends(get_db)
):
    action = await get_action_or_404(db, action_id)
    if action.is_simulation:
        raise HTTPException(status_code=409, detail="Simulation actions cannot be approved or rejected")

    def not_pending() -> HTTPException:
        return HTTPException(
            status_code=409,
            detail=f"Action is no longer awaiting approval (current state: {action.status})",
        )

    if payload.decision == "REJECT":
        reason = payload.rejection_reason or "Explicitly rejected by Merchant Admin"
        if not await claim_transition(db, action, ["PENDING_APPROVAL"], "REJECTED", failure_reason=reason):
            raise not_pending()
        AuditService.log_event(
            db=db,
            merchant_id=action.merchant_id,
            action_id=action.id,
            step="MERCHANT_APPROVAL",
            status="BLOCKED",
            component="MerchantAdmin",
            message=f"Action REJECTED by Merchant Admin: {reason}",
            sanitized_payload={"decision": "REJECT", "reason": reason, "actor": actor_label()},
        )
        await db.commit()
        return DecisionResponse(status=action.status, action=ActionSchema.model_validate(action))

    # APPROVE: claim the action first so a concurrent approval gets a 409 instead of a second execution.
    if not await claim_transition(db, action, ["PENDING_APPROVAL"], "APPROVED"):
        raise not_pending()
    await db.commit()

    # Secondary policy check: the merchant's cap may have changed since the proposal was made.
    policy_check = await PolicyEngine.evaluate_action_policy(
        db=db,
        merchant_id=action.merchant_id,
        action_type=action.action_type,
        proposed_budget_paise=action.proposed_budget_paise,
        idempotency_key=action.idempotency_key,
        action_id=action.id,
    )
    action.policy_result = policy_check.model_dump()
    if not policy_check.passed:
        action.status = "POLICY_BLOCKED"
        await db.commit()
        raise HTTPException(status_code=403, detail=f"Action blocked by secondary policy check: {policy_check.reason}")

    AuditService.log_event(
        db=db,
        merchant_id=action.merchant_id,
        action_id=action.id,
        step="MERCHANT_APPROVAL",
        status="SUCCESS",
        component="MerchantAdmin",
        message=(
            f"Explicit Merchant Approval granted for {len(action.target_payment_ids)} recovery links with a "
            f"{format_inr(action.proposed_budget_paise)} incentive budget."
        ),
        sanitized_payload={"decision": "APPROVE", "approved_budget": to_rupees(action.proposed_budget_paise),
                           "actor": actor_label()},
    )
    action.status = "EXECUTING"
    await db.commit()

    await execute_recovery_action(db, action, get_payment_link_client())
    return DecisionResponse(status=action.status, action=ActionSchema.model_validate(action))
