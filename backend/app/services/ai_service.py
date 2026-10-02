import json
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Literal, Tuple
import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import Action, Customer, Payment, RecoveryLink
from app.money import as_utc, format_inr, to_paise, to_rupees, utc_now
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)

HEURISTIC_PROVIDER = "Demo Heuristic Mode"

REASON_LABELS = {
    "bank_decline": ("bank decline", "bank declines"),
    "insufficient_funds": ("insufficient-funds failure", "insufficient-funds failures"),
    "card_expired": ("card expiration", "card expirations"),
    "network_timeout": ("network timeout", "network timeouts"),
}
# Failures caused by transient infrastructure problems rather than the customer's instrument.
TRANSIENT_REASONS = {"bank_decline", "network_timeout"}


class AIRecommendation(BaseModel):
    """Schema every LLM response must satisfy before it can become a proposed action.

    There is deliberately no upper bound on proposed_budget: enforcing the merchant's
    cap is the Policy Engine's job, and it must be able to block an over-budget proposal.
    """
    title: str = Field(min_length=1, max_length=200)
    evidence: List[str] = Field(min_length=1, max_length=10)
    decision_factors: List[str] = Field(min_length=1, max_length=10)
    recommendation_reason: str = Field(min_length=1, max_length=2000)
    confidence_score: float = Field(ge=0, le=100)
    proposed_budget: float = Field(gt=0)
    risk_score: Literal["LOW", "MEDIUM", "HIGH"]


@dataclass
class Recommendation:
    provider: str
    data: AIRecommendation


@dataclass
class PaymentTelemetry:
    total_transactions: int
    eligible: List[Payment]
    reasons: Dict[str, int] = field(default_factory=dict)
    affected_customers: int = 0
    customers_with_prior_success: int = 0
    newest_failure_hours: float = 0.0
    oldest_failure_hours: float = 0.0

    @property
    def failed_count(self) -> int:
        return len(self.eligible)

    @property
    def failed_amount_paise(self) -> int:
        return sum(p.amount_paise for p in self.eligible)

    @property
    def transient_share(self) -> float:
        if not self.eligible:
            return 0.0
        return sum(n for r, n in self.reasons.items() if r in TRANSIENT_REASONS) / len(self.eligible)

    @property
    def prior_success_share(self) -> float:
        return self.customers_with_prior_success / self.affected_customers if self.affected_customers else 0.0


def describe_reasons(reasons: Dict[str, int]) -> str:
    parts = []
    for reason, count in sorted(reasons.items(), key=lambda kv: (-kv[1], kv[0])):
        singular, plural = REASON_LABELS.get(reason, (reason.replace("_", " "), reason.replace("_", " ")))
        parts.append(f"{count} {singular if count == 1 else plural}")
    return ", ".join(parts)


class AIService:
    @staticmethod
    def get_provider_mode() -> str:
        return settings.ai_provider_mode

    @staticmethod
    async def collect_telemetry(db: AsyncSession, merchant_id: str) -> PaymentTelemetry:
        """Gathers the failed payments that are not already covered by a live recovery link."""
        total = len((await db.execute(select(Payment.id).where(Payment.merchant_id == merchant_id))).all())

        covered = (
            select(RecoveryLink.payment_id)
            .join(Action, Action.id == RecoveryLink.action_id)
            .where(Action.is_simulation.is_(False), RecoveryLink.status.in_(["CREATED", "PAID"]))
        )
        result = await db.execute(
            select(Payment)
            .where(Payment.merchant_id == merchant_id, Payment.status == "failed", Payment.id.not_in(covered))
            .order_by(Payment.created_at.desc(), Payment.id)
        )
        eligible = list(result.scalars().all())

        reasons: Dict[str, int] = {}
        for p in eligible:
            r = p.failure_reason or "unknown"
            reasons[r] = reasons.get(r, 0) + 1

        customer_ids = {p.customer_id for p in eligible}
        prior_success = 0
        if customer_ids:
            customers = (await db.execute(select(Customer).where(Customer.id.in_(customer_ids)))).scalars().all()
            prior_success = sum(1 for c in customers if (c.successful_payments or 0) > 0)

        now = utc_now()
        ages = [(now - as_utc(p.created_at)).total_seconds() / 3600 for p in eligible]

        return PaymentTelemetry(
            total_transactions=total,
            eligible=eligible,
            reasons=reasons,
            affected_customers=len(customer_ids),
            customers_with_prior_success=prior_success,
            newest_failure_hours=min(ages) if ages else 0.0,
            oldest_failure_hours=max(ages) if ages else 0.0,
        )

    @staticmethod
    def build_prompt(t: PaymentTelemetry) -> str:
        return f"""You are RazorGrowth AI, a permissioned merchant-growth agent for Razorpay.
You can only PROPOSE a failed-payment recovery campaign. A deterministic policy engine and a
human merchant decide whether it runs.

The campaign sends each affected customer a Razorpay Payment Link for their original amount,
minus a share of an incentive pool (the "budget") that the merchant gives up to win them back.

Failed payment telemetry (facts; do not invent other numbers):
- Transactions analysed: {t.total_transactions}
- Unrecovered failed payments: {t.failed_count}
- Lost revenue: {format_inr(t.failed_amount_paise)}
- Failure reasons: {json.dumps(t.reasons)}
- Affected customers with prior successful purchases: {t.customers_with_prior_success} of {t.affected_customers}
- Failure age: newest {t.newest_failure_hours:.1f}h, oldest {t.oldest_failure_hours:.1f}h

Respond with ONLY a JSON object with exactly these keys:
- "title": short string
- "evidence": array of 2-6 strings restating the facts above
- "decision_factors": array of 2-6 strings explaining why recovery is worthwhile
- "recommendation_reason": string
- "confidence_score": number between 0 and 100
- "proposed_budget": incentive pool in INR (number greater than 0)
- "risk_score": one of "LOW", "MEDIUM", "HIGH"
"""

    @staticmethod
    async def _call_llm(prompt: str) -> Tuple[str, str]:
        """Returns (provider label, raw JSON text) from the configured LLM provider."""
        if settings.GEMINI_API_KEY:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = await client.aio.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            return "Gemini 2.5 Flash", response.text or ""

        if settings.OPENAI_API_KEY:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": settings.OPENAI_MODEL,
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                res.raise_for_status()
                return "OpenAI GPT-4o-mini", res.json()["choices"][0]["message"]["content"]

        raise RuntimeError("No LLM provider configured")

    @staticmethod
    def parse_llm_output(raw: str) -> AIRecommendation:
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else ""
            text = text.rsplit("```", 1)[0]
        return AIRecommendation.model_validate_json(text)

    @staticmethod
    def heuristic_recommendation(t: PaymentTelemetry) -> AIRecommendation:
        lost = t.failed_amount_paise
        budget_paise = min(
            to_paise(settings.HEURISTIC_PROPOSED_BUDGET),
            to_paise(round(to_rupees(lost) * settings.HEURISTIC_MAX_BUDGET_SHARE)),
        )
        budget_paise = max(budget_paise, 100)  # never propose less than ₹1
        expected = round(lost * settings.RECOVERY_CONVERSION_RATE)
        discount_pct = budget_paise / lost * 100 if lost else 0.0

        if t.oldest_failure_hours <= 24:
            recency = "All failures occurred within the last 24 hours, so purchase intent is still high"
        else:
            recency = f"Failures span the last {t.oldest_failure_hours:.0f} hours; the oldest are least likely to convert"

        confidence = min(95.0, round(60 + 30 * t.prior_success_share + 5 * (t.oldest_failure_hours <= 24), 1))

        return AIRecommendation(
            title=f"Recover {format_inr(lost)} lost in {t.failed_count} failed payments",
            evidence=[
                f"{t.failed_count} unrecovered failed payments across {t.total_transactions} transactions",
                f"Total revenue lost: {format_inr(lost)}",
                f"Failure reasons: {describe_reasons(t.reasons)}",
                f"{t.customers_with_prior_success} of {t.affected_customers} affected customers have prior successful purchases",
            ],
            decision_factors=[
                recency,
                f"{t.transient_share:.0%} of failures were transient (bank declines / network timeouts) and are likely to succeed on retry",
                f"Each customer gets a Razorpay Payment Link for their original amount minus ~{discount_pct:.1f}% recovery incentive",
                f"The {format_inr(budget_paise)} incentive pool is the only money the merchant gives up",
            ],
            recommendation_reason=(
                f"Send {t.failed_count} targeted Razorpay recovery payment links. At a "
                f"{settings.RECOVERY_CONVERSION_RATE:.0%} conversion rate the expected recovery is {format_inr(expected)} "
                f"for a {format_inr(budget_paise)} incentive."
            ),
            confidence_score=confidence,
            proposed_budget=to_rupees(budget_paise),
            risk_score="LOW",
        )

    @staticmethod
    async def recommend(db: AsyncSession, merchant_id: str, t: PaymentTelemetry) -> Recommendation:
        """Produces a validated recommendation. Adds audit events; the caller commits."""
        AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            step="DATA_ANALYSIS",
            status="SUCCESS",
            component="AIService",
            message=(
                f"Analyzed {t.total_transactions} transaction logs. Identified {t.failed_count} unrecovered "
                f"failed payments worth {format_inr(t.failed_amount_paise)}."
            ),
            sanitized_payload={
                "total_transactions_analyzed": t.total_transactions,
                "failed_payment_count": t.failed_count,
                "total_failed_amount": to_rupees(t.failed_amount_paise),
                "failure_reasons": t.reasons,
                "ai_provider": settings.ai_provider_mode,
            },
        )

        llm_configured = bool(settings.GEMINI_API_KEY or settings.OPENAI_API_KEY)
        if llm_configured:
            try:
                provider, raw = await AIService._call_llm(AIService.build_prompt(t))
                data = AIService.parse_llm_output(raw)
                AuditService.log_event(
                    db=db,
                    merchant_id=merchant_id,
                    step="PATTERN_DETECTION",
                    status="SUCCESS",
                    component="AIService",
                    message=f"{provider} produced a schema-valid recommendation with {data.confidence_score}% confidence.",
                    sanitized_payload={"provider": provider, "confidence": data.confidence_score,
                                       "proposed_budget": data.proposed_budget},
                )
                return Recommendation(provider=provider, data=data)
            except (ValidationError, ValueError) as e:
                failure = f"LLM output failed schema validation: {e}"
            except Exception as e:  # network / provider errors
                failure = f"LLM call failed: {type(e).__name__}: {e}"
            logger.warning("[AIService] %s; falling back to heuristic", failure)
            AuditService.log_event(
                db=db,
                merchant_id=merchant_id,
                step="PATTERN_DETECTION",
                status="FAILED",
                component="AIService",
                message=f"{settings.ai_provider_mode} output rejected; falling back to Demo Heuristic Mode.",
                sanitized_payload={"provider": settings.ai_provider_mode, "error": failure},
            )

        data = AIService.heuristic_recommendation(t)
        label = f"{HEURISTIC_PROVIDER} (fallback from {settings.ai_provider_mode})" if llm_configured else HEURISTIC_PROVIDER
        AuditService.log_event(
            db=db,
            merchant_id=merchant_id,
            step="PATTERN_DETECTION",
            status="SUCCESS",
            component="AIService",
            message=(
                f"[AI Provider: {label}] Opportunity detected: {format_inr(t.failed_amount_paise)} recoverable "
                f"with {data.confidence_score}% confidence."
            ),
            sanitized_payload={"provider": label, "confidence_score": data.confidence_score,
                               "proposed_budget": data.proposed_budget},
        )
        return Recommendation(provider=label, data=data)
