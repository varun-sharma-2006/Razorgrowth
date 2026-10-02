"""Applies a recovery link's final outcome. Used by real Razorpay webhooks and by the simulator."""
from datetime import datetime
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Action, Opportunity, Payment, RecoveryLink


async def settle_link(
    db: AsyncSession,
    link: RecoveryLink,
    new_status: str,
    when: datetime,
    tick: Optional[int] = None,
) -> Optional[Payment]:
    """Marks a link PAID / EXPIRED / CANCELLED and updates the original payment.

    Returns the payment when it was recovered by this link, else None.
    """
    if link.status not in ("CREATED", "PENDING"):
        return None  # already settled; webhooks can arrive more than once
    link.status = new_status
    if new_status != "PAID":
        return None

    link.paid_at = when
    payment = await db.get(Payment, link.payment_id)
    if payment is not None and payment.status == "failed":
        payment.status = "recovered"
        payment.resolved_tick = tick
    await _resolve_opportunity_if_complete(db, link.action_id)
    return payment


async def _resolve_opportunity_if_complete(db: AsyncSession, action_id: str) -> None:
    action = await db.get(Action, action_id)
    if action is None or action.is_simulation:
        return
    await db.flush()
    open_links = (await db.execute(
        select(func.count(RecoveryLink.id)).where(
            RecoveryLink.action_id == action_id, RecoveryLink.status.in_(["PENDING", "CREATED"])
        )
    )).scalar_one()
    paid = (await db.execute(
        select(func.count(RecoveryLink.id)).where(RecoveryLink.action_id == action_id, RecoveryLink.status == "PAID")
    )).scalar_one()
    if open_links == 0 and paid > 0:
        opp = await db.get(Opportunity, action.opportunity_id)
        if opp is not None:
            opp.status = "RESOLVED"
