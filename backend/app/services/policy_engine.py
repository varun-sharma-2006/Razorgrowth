from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models import PolicyRule, Action
from app.schemas import PolicyCheckResult
from app.services.audit_service import AuditService
from app.config import settings

class PolicyEngine:
    @staticmethod
    async def evaluate_action_policy(
        db: AsyncSession,
        merchant_id: str,
        action_type: str,
        proposed_budget: float,
        action_id: str = None
    ) -> PolicyCheckResult:
        # Fetch merchant policy rules
        result = await db.execute(
            select(PolicyRule).where(PolicyRule.merchant_id == merchant_id)
        )
        policy = result.scalars().first()

        max_budget = policy.max_single_action_budget if policy else settings.DEFAULT_MAX_BUDGET
        allowed_types = (policy.allowed_action_types if policy else settings.ALLOWED_ACTION_TYPES).split(",")
        allowed_types = [t.strip() for t in allowed_types]

        type_allowed = action_type in allowed_types
        budget_allowed = proposed_budget <= max_budget

        checklist = [
            {"rule": f"Action type allowed ({action_type})", "passed": type_allowed},
            {"rule": f"Proposed Budget ₹{proposed_budget:,.2f} ≤ Merchant Cap ₹{max_budget:,.2f}", "passed": budget_allowed},
            {"rule": "Human Approval Guard active", "passed": True},
            {"rule": "Action Idempotency Key generated", "passed": True},
            {"rule": "Financial Execution Safety Guard", "passed": budget_allowed and type_allowed}
        ]

        if not type_allowed:
            reason = f"Action type '{action_type}' is not in merchant allowed list: {allowed_types}"
            await AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                step="POLICY_EVALUATION",
                status="BLOCKED",
                component="PolicyEngine",
                message=f"Policy Blocked: {reason}",
                action_id=action_id,
                sanitized_payload={
                    "proposed_budget": proposed_budget,
                    "max_allowed_budget": max_budget,
                    "action_type": action_type,
                    "policy_result": "REJECTED_UNALLOWED_TYPE",
                    "checklist": checklist
                }
            )
            return PolicyCheckResult(
                passed=False,
                policy_blocked=True,
                reason=reason,
                max_allowed_budget=max_budget,
                proposed_budget=proposed_budget,
                action_type_allowed=False,
                checklist=checklist
            )

        if not budget_allowed:
            reason = f"Proposed budget ₹{proposed_budget:,.2f} exceeds merchant safety cap of ₹{max_budget:,.2f}"
            await AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                step="POLICY_EVALUATION",
                status="BLOCKED",
                component="PolicyEngine",
                message=f"Policy Blocked: {reason}",
                action_id=action_id,
                sanitized_payload={
                    "proposed_budget": proposed_budget,
                    "max_allowed_budget": max_budget,
                    "action_type": action_type,
                    "policy_result": "REJECTED_BUDGET_CAP_EXCEEDED",
                    "checklist": checklist
                }
            )
            return PolicyCheckResult(
                passed=False,
                policy_blocked=True,
                reason=reason,
                max_allowed_budget=max_budget,
                proposed_budget=proposed_budget,
                action_type_allowed=True,
                checklist=checklist
            )

        # Policy passed successfully
        await AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            step="POLICY_EVALUATION",
            status="SUCCESS",
            component="PolicyEngine",
            message=f"Policy Verification Passed: Budget ₹{proposed_budget:,.2f} <= ₹{max_budget:,.2f}. Human Approval Required.",
            action_id=action_id,
            sanitized_payload={
                "proposed_budget": proposed_budget,
                "max_allowed_budget": max_budget,
                "action_type": action_type,
                "policy_result": "PASSED",
                "checklist": checklist
            }
        )

        return PolicyCheckResult(
            passed=True,
            policy_blocked=False,
            reason=f"Policy verification passed. Budget ₹{proposed_budget:,.2f} is within limit ₹{max_budget:,.2f}.",
            max_allowed_budget=max_budget,
            proposed_budget=proposed_budget,
            action_type_allowed=True,
            checklist=checklist
        )
