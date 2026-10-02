from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import PolicyRule
from app.schemas import PolicyCheckResult, PolicyChecklistItem
from app.services.audit_service import AuditService
from app.config import settings
from app.money import to_paise, to_rupees, format_inr


class PolicyEngine:
    @staticmethod
    async def get_policy(db: AsyncSession, merchant_id: str) -> Optional[PolicyRule]:
        result = await db.execute(select(PolicyRule).where(PolicyRule.merchant_id == merchant_id))
        return result.scalars().first()

    @staticmethod
    async def evaluate_action_policy(
        db: AsyncSession,
        merchant_id: str,
        action_type: str,
        proposed_budget_paise: int,
        idempotency_key: Optional[str],
        action_id: Optional[str] = None,
        wallet_available_paise: Optional[int] = None,
    ) -> PolicyCheckResult:
        """Deterministic policy check. Adds a POLICY_EVALUATION audit event; the caller commits."""
        policy = await PolicyEngine.get_policy(db, merchant_id)

        max_budget_paise = (
            policy.max_single_action_budget_paise if policy else to_paise(settings.DEFAULT_MAX_BUDGET)
        )
        allowed_types = [
            t.strip()
            for t in (policy.allowed_action_types if policy else settings.ALLOWED_ACTION_TYPES).split(",")
            if t.strip()
        ]
        requires_approval = policy.requires_human_approval if policy else True

        type_allowed = action_type in allowed_types
        budget_positive = proposed_budget_paise > 0
        budget_within_cap = proposed_budget_paise <= max_budget_paise
        has_idempotency_key = bool(idempotency_key)
        within_wallet = wallet_available_paise is None or proposed_budget_paise <= wallet_available_paise
        all_passed = (type_allowed and budget_positive and budget_within_cap and within_wallet
                      and has_idempotency_key and requires_approval)

        checklist = [
            PolicyChecklistItem(rule=f"Action type allowed ({action_type})", passed=type_allowed),
            PolicyChecklistItem(rule=f"Proposed budget {format_inr(proposed_budget_paise)} is positive", passed=budget_positive),
            PolicyChecklistItem(
                rule=f"Proposed Budget {format_inr(proposed_budget_paise)} ≤ Merchant Cap {format_inr(max_budget_paise)}",
                passed=budget_within_cap,
            ),
            *([PolicyChecklistItem(
                rule=f"Budget {format_inr(proposed_budget_paise)} ≤ incentive wallet {format_inr(wallet_available_paise)}",
                passed=within_wallet,
            )] if wallet_available_paise is not None else []),
            PolicyChecklistItem(rule="Human Approval Guard active", passed=requires_approval),
            PolicyChecklistItem(rule="Action Idempotency Key generated", passed=has_idempotency_key),
            PolicyChecklistItem(rule="Financial Execution Safety Guard", passed=all_passed),
        ]

        if not type_allowed:
            reason, code = f"Action type '{action_type}' is not in merchant allowed list: {allowed_types}", "REJECTED_UNALLOWED_TYPE"
        elif not budget_positive:
            reason, code = "Proposed budget must be greater than zero", "REJECTED_NON_POSITIVE_BUDGET"
        elif not budget_within_cap:
            reason = (
                f"Proposed budget {format_inr(proposed_budget_paise)} exceeds merchant safety cap of "
                f"{format_inr(max_budget_paise)}"
            )
            code = "REJECTED_BUDGET_CAP_EXCEEDED"
        elif not within_wallet:
            reason = (
                f"Proposed budget {format_inr(proposed_budget_paise)} exceeds the remaining incentive wallet "
                f"{format_inr(wallet_available_paise)}"
            )
            code = "REJECTED_WALLET_EXHAUSTED"
        elif not has_idempotency_key:
            reason, code = "Action has no idempotency key", "REJECTED_NO_IDEMPOTENCY_KEY"
        elif not requires_approval:
            # This agent is only allowed to run with a human in the loop.
            reason, code = "Merchant policy disables human approval; autonomous execution is not permitted", "REJECTED_NO_HUMAN_APPROVAL"
        else:
            reason = (
                f"Policy verification passed. Budget {format_inr(proposed_budget_paise)} is within limit "
                f"{format_inr(max_budget_paise)}."
            )
            code = "PASSED"

        AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            step="POLICY_EVALUATION",
            status="SUCCESS" if all_passed else "BLOCKED",
            component="PolicyEngine",
            message=(
                f"Policy Verification Passed: Budget {format_inr(proposed_budget_paise)} <= "
                f"{format_inr(max_budget_paise)}. Human Approval Required."
                if all_passed else f"Policy Blocked: {reason}"
            ),
            action_id=action_id,
            sanitized_payload={
                "proposed_budget": to_rupees(proposed_budget_paise),
                "max_allowed_budget": to_rupees(max_budget_paise),
                "action_type": action_type,
                "wallet_available": to_rupees(wallet_available_paise) if wallet_available_paise is not None else None,
                "policy_result": code,
                "checklist": [item.model_dump() for item in checklist],
            },
        )

        return PolicyCheckResult(
            passed=all_passed,
            policy_blocked=not all_passed,
            reason=reason,
            max_allowed_budget=to_rupees(max_budget_paise),
            proposed_budget=to_rupees(proposed_budget_paise),
            action_type_allowed=type_allowed,
            checklist=checklist,
        )
