import asyncio
import hashlib
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import Action, Customer, Merchant, Opportunity, Payment, RecoveryLink
from app.money import format_inr, to_rupees
from app.services.audit_service import AuditService
from app.sim.behavior import LINK_LIFETIME_TICKS, link_payment_tick, loyalty
from app.services.razorpay_service import (
    PaymentLinkClient,
    PermanentGatewayError,
    ReferenceIdConflict,
    TransientGatewayError,
)

MIN_LINK_PAISE = 100  # Razorpay's minimum payment link amount is ₹1


def reference_id_for(idempotency_key: str, payment_id: str) -> str:
    """Deterministic, ≤40-char Razorpay reference_id for one (action, payment) pair."""
    return "rg_" + hashlib.sha256(f"{idempotency_key}:{payment_id}".encode("utf-8")).hexdigest()[:32]


def allocate_incentive(amounts_paise: List[int], budget_paise: int) -> List[int]:
    """Splits the incentive pool across payments in proportion to their amounts.

    Every link keeps at least ₹1 payable, and the shares always sum to the budget
    (or to the most that can be given away, if the budget is larger than that).
    """
    if not amounts_paise:
        return []
    room = [max(a - MIN_LINK_PAISE, 0) for a in amounts_paise]
    budget = max(0, min(budget_paise, sum(room)))
    total = sum(amounts_paise)
    shares = [min(budget * a // total, r) for a, r in zip(amounts_paise, room)]
    remainder = budget - sum(shares)
    for i in sorted(range(len(shares)), key=lambda i: room[i] - shares[i], reverse=True):
        if remainder == 0:
            break
        give = min(remainder, room[i] - shares[i])
        shares[i] += give
        remainder -= give
    return shares


@dataclass
class ExecutionOutcome:
    status: str  # COMPLETED or HALTED
    attempts: int
    links_created: int
    error: Optional[str] = None


def _link_payload(action: Action, link: RecoveryLink) -> Dict[str, Any]:
    description = "Complete your order"
    if link.discount_paise:
        description += f" ({format_inr(link.discount_paise)} recovery discount applied)"
    return {
        "amount": link.amount_paise,
        "currency": "INR",
        "accept_partial": False,
        "reference_id": link.reference_id,
        "description": description,
        "customer": {"name": link.customer_name, "email": link.customer_email},
        "notify": {"sms": False, "email": True},
        "reminder_enable": True,
        "notes": {
            "action_id": action.id,
            "original_payment_id": link.payment_id,
            "source": "RazorGrowth AI",
        },
    }


async def _create_link_with_retry(
    db: AsyncSession,
    action: Action,
    link: RecoveryLink,
    client: PaymentLinkClient,
    max_attempts: int,
    backoff_seconds: float,
) -> bool:
    payload = _link_payload(action, link)
    base_log = {
        "payment_id": link.payment_id,
        "reference_id": link.reference_id,
        "idempotency_key": action.idempotency_key,
        "amount": to_rupees(link.amount_paise),
        "customer_email": link.customer_email,
        "mode": client.mode,
    }

    for attempt in range(1, max_attempts + 1):
        link.attempts += 1
        if attempt > 1:
            action.retry_count += 1
        AuditService.log_event(
            db=db,
            merchant_id=action.merchant_id,
            action_id=action.id,
            step="RAZORPAY_API_CALL" if attempt == 1 else "RETRY_ATTEMPT",
            status="PENDING",
            component="RazorpayService",
            message=(
                f"{'Creating' if attempt == 1 else f'Retry {attempt}/{max_attempts}: re-sending'} payment link for "
                f"{link.payment_id} ({format_inr(link.amount_paise)}) with reference_id {link.reference_id}"
            ),
            sanitized_payload={**base_log, "attempt": attempt},
        )
        await db.commit()

        try:
            try:
                data = await client.create_payment_link(payload)
                deduplicated = False
            except ReferenceIdConflict:
                # An earlier attempt reached Razorpay; adopt that link instead of creating another.
                data = await client.fetch_by_reference_id(link.reference_id)
                deduplicated = True
                if data is None:
                    raise PermanentGatewayError("reference_id conflict reported but no existing link was found")
        except TransientGatewayError as e:
            link.error = str(e)
            AuditService.log_event(
                db=db,
                merchant_id=action.merchant_id,
                action_id=action.id,
                step="RAZORPAY_API_CALL" if attempt == 1 else "RETRY_ATTEMPT",
                status="FAILED",
                component="RazorpayService",
                message=(
                    f"Attempt {attempt}/{max_attempts} failed: {e}"
                    + (" Retrying with the same reference_id." if attempt < max_attempts else "")
                ),
                sanitized_payload={**base_log, "attempt": attempt, "error": str(e), "retryable": True},
            )
            await db.commit()
            if attempt < max_attempts:
                await asyncio.sleep(backoff_seconds * (2 ** (attempt - 1)))
            continue
        except PermanentGatewayError as e:
            link.status = "FAILED"
            link.error = str(e)
            AuditService.log_event(
                db=db,
                merchant_id=action.merchant_id,
                action_id=action.id,
                step="RAZORPAY_API_CALL",
                status="FAILED",
                component="RazorpayService",
                message=f"Attempt {attempt} failed with a non-retryable error: {e}",
                sanitized_payload={**base_log, "attempt": attempt, "error": str(e), "retryable": False},
            )
            await db.commit()
            return False

        link.status = "CREATED"
        link.razorpay_link_id = data.get("id")
        link.short_url = data.get("short_url")
        link.error = None
        AuditService.log_event(
            db=db,
            merchant_id=action.merchant_id,
            action_id=action.id,
            step="RAZORPAY_API_CALL",
            status="SUCCESS",
            component="RazorpayService",
            message=(
                f"Found the link created by an earlier attempt via reference_id {link.reference_id}; "
                f"no duplicate created. Payment Link: {link.short_url}"
                if deduplicated else f"Payment link created for {link.payment_id}: {link.short_url}"
            ),
            sanitized_payload={**base_log, "attempt": attempt, "razorpay_link_id": link.razorpay_link_id,
                               "short_url": link.short_url, "deduplicated": deduplicated},
        )
        await db.commit()
        return True

    link.status = "FAILED"
    await db.commit()
    return False


async def execute_recovery_action(
    db: AsyncSession,
    action: Action,
    client: PaymentLinkClient,
    max_attempts: Optional[int] = None,
    backoff_seconds: Optional[float] = None,
) -> ExecutionOutcome:
    """Creates one payment link per target payment. Safe to re-run: links already created are skipped,
    and reference_ids are deterministic, so Razorpay refuses duplicates."""
    max_attempts = max_attempts or settings.RAZORPAY_MAX_ATTEMPTS
    backoff_seconds = settings.RAZORPAY_RETRY_BACKOFF_SECONDS if backoff_seconds is None else backoff_seconds

    merchant = await db.get(Merchant, action.merchant_id)
    by_id = {
        p.id: p
        for p in (await db.execute(select(Payment).where(Payment.id.in_(action.target_payment_ids)))).scalars()
    }
    # Payments can resolve (or be lost) while a proposal waits for approval; only chase open ones.
    payments = [by_id[pid] for pid in action.target_payment_ids if pid in by_id and by_id[pid].status == "failed"]
    simulate_customers = merchant is not None and merchant.sim_start is not None and not action.is_simulation
    if simulate_customers:
        customers = {
            c.id: c for c in (await db.execute(
                select(Customer).where(Customer.id.in_({p.customer_id for p in payments}))
            )).scalars()
        }
    shares = allocate_incentive([p.amount_paise for p in payments], action.proposed_budget_paise)
    await db.refresh(action, ["recovery_links"])  # never lazy-load in async code
    existing = {l.payment_id: l for l in action.recovery_links}

    attempts = 0
    created = 0
    for payment, discount in zip(payments, shares):
        link = existing.get(payment.id)
        if link is not None and link.status in ("CREATED", "PAID"):
            created += 1
            continue
        if link is None:
            link = RecoveryLink(
                id=f"rl_{uuid.uuid4().hex[:12]}",
                action_id=action.id,
                payment_id=payment.id,
                customer_name=payment.customer_name,
                customer_email=payment.customer_email,
                original_amount_paise=payment.amount_paise,
                discount_paise=discount,
                amount_paise=payment.amount_paise - discount,
                reference_id=reference_id_for(action.idempotency_key, payment.id),
                status="PENDING",
            )
            db.add(link)
            await db.commit()  # record intent + reference_id before touching the gateway

        before = link.attempts
        ok = await _create_link_with_retry(db, action, link, client, max_attempts, backoff_seconds)
        attempts += link.attempts - before
        if ok and merchant is not None and merchant.sim_start is not None:
            link.created_tick = merchant.current_tick
            if simulate_customers:
                link.expires_tick = merchant.current_tick + LINK_LIFETIME_TICKS
                customer = customers.get(payment.customer_id)
                link.converts_at_tick = link_payment_tick(
                    seed=merchant.seed,
                    payment_key=payment.id.rsplit("-", 1)[-1],
                    reason=payment.failure_reason or "unknown",
                    failed_tick=payment.failed_tick if payment.failed_tick is not None else merchant.current_tick,
                    created_tick=merchant.current_tick,
                    discount_share=link.discount_paise / link.original_amount_paise if link.original_amount_paise else 0,
                    loyalty_score=loyalty(customer.successful_payments if customer else 0),
                    organic_tick=payment.organic_tick,
                )
            await db.commit()
        if not ok:
            action.status = "HALTED"
            action.failure_reason = (
                f"Payment link for {payment.id} failed after {link.attempts} attempt(s): {link.error}. "
                f"{created} of {len(payments)} links were created; execution halted safely."
            )
            AuditService.log_event(
                db=db,
                merchant_id=action.merchant_id,
                action_id=action.id,
                step="SAFE_HALT",
                status="HALTED",
                component="RazorpayService",
                message=(
                    f"[SAFE HALT ENGAGED] {action.failure_reason} Re-running this action reuses the same "
                    f"reference_ids, so no duplicate links can be created."
                ),
                sanitized_payload={
                    "idempotency_key": action.idempotency_key,
                    "failed_payment_id": payment.id,
                    "attempts": link.attempts,
                    "links_created": created,
                    "final_state": "HALTED",
                },
            )
            await db.commit()
            await db.refresh(action, ["recovery_links"])
            return ExecutionOutcome(status="HALTED", attempts=attempts, links_created=created, error=link.error)
        created += 1

    action.status = "COMPLETED"
    action.failure_reason = None
    if not action.is_simulation:
        opp = await db.get(Opportunity, action.opportunity_id)
        if opp is not None:
            opp.status = "IN_PROGRESS"
    AuditService.log_event(
        db=db,
        merchant_id=action.merchant_id,
        action_id=action.id,
        step="RAZORPAY_API_CALL",
        status="SUCCESS",
        component="RazorpayService",
        message=(
            f"Recovery campaign executed: {created} payment links sent "
            f"({format_inr(sum(shares))} total incentive)."
        ),
        sanitized_payload={"idempotency_key": action.idempotency_key, "links_created": created,
                           "incentive_total": to_rupees(sum(shares)), "attempts": attempts},
    )
    await db.commit()
    await db.refresh(action, ["recovery_links"])
    return ExecutionOutcome(status="COMPLETED", attempts=attempts, links_created=created)
