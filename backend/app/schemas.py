from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, PlainSerializer
from app.config import settings
from app.money import as_utc

# Always serialize timestamps as explicit UTC ("...Z") so browsers don't read them as local time.
UTCDateTime = Annotated[
    datetime,
    PlainSerializer(lambda dt: as_utc(dt).isoformat().replace("+00:00", "Z"), return_type=str),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SystemStatusSchema(BaseModel):
    razorpay_mode: str  # "RAZORPAY TEST MODE" or "LOCAL DEMO MODE"
    ai_provider_mode: str  # "Gemini 2.5 Flash", "OpenAI GPT-4o-mini", "Demo Heuristic Mode"
    database_type: str
    merchant_id: str
    auth_required: bool
    webhook_configured: bool


class MerchantMetricsSchema(BaseModel):
    total_revenue: float
    failed_payment_loss: float
    failed_payment_count: int
    historical_recovery_rate: float
    recoverable_amount: float
    methodology_explanation: str
    approved_actions_count: int
    policy_blocked_count: int
    max_budget_limit: float
    recovery_links_sent: int
    recovered_amount: float


class CustomerSchema(ORMModel):
    id: str
    name: str
    email: str
    total_orders: int
    successful_payments: int
    failed_payments: int
    last_product_info: Optional[str] = None


class PaymentSchema(ORMModel):
    id: str
    customer_id: str
    customer_name: str
    customer_email: str
    amount: float
    currency: str
    status: str
    failure_reason: Optional[str] = None
    payment_method: str
    created_at: UTCDateTime


class OpportunitySchema(ORMModel):
    id: str
    merchant_id: str
    title: str
    type: str
    total_failed_count: int
    total_failed_amount: float
    impact_estimate: float
    status: str
    created_at: UTCDateTime


class PolicyChecklistItem(BaseModel):
    rule: str
    passed: bool


class PolicyCheckResult(BaseModel):
    passed: bool
    policy_blocked: bool
    reason: str
    max_allowed_budget: float
    proposed_budget: float
    action_type_allowed: bool
    checklist: List[PolicyChecklistItem] = Field(default_factory=list)


class RecoveryLinkSchema(ORMModel):
    id: str
    payment_id: str
    customer_name: str
    customer_email: str
    original_amount: float
    discount: float
    amount: float
    reference_id: str
    razorpay_link_id: Optional[str] = None
    short_url: Optional[str] = None
    status: str
    attempts: int
    error: Optional[str] = None
    paid_at: Optional[UTCDateTime] = None


class ActionSchema(ORMModel):
    id: str
    idempotency_key: str
    opportunity_id: str
    merchant_id: str
    action_type: str
    is_simulation: bool
    title: str
    ai_provider: Optional[str] = None
    evidence: List[str]
    decision_factors: List[str]
    recommendation_reason: str
    confidence_score: float
    proposed_budget: float
    risk_score: str
    target_payment_ids: List[str]
    policy_result: Optional[PolicyCheckResult] = None
    status: str
    failure_reason: Optional[str] = None
    retry_count: int
    recovery_links: List[RecoveryLinkSchema] = Field(default_factory=list)
    created_at: UTCDateTime
    updated_at: UTCDateTime


class AuditEventSchema(ORMModel):
    id: str
    action_id: Optional[str] = None
    merchant_id: str
    step: str
    status: str
    component: str
    message: str
    sanitized_payload: Optional[Dict[str, Any]] = None
    timestamp: UTCDateTime


class ScanResponse(BaseModel):
    opportunity: OpportunitySchema
    action: ActionSchema
    policy_check: PolicyCheckResult
    reused_existing: bool = False


class PolicyUpdateSchema(BaseModel):
    max_single_action_budget: float = Field(gt=0, le=settings.MAX_POLICY_BUDGET_CEILING)


class PolicySchema(BaseModel):
    max_single_action_budget: float
    allowed_action_types: List[str]
    requires_human_approval: bool


class ActionDecisionSchema(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    rejection_reason: Optional[str] = Field(default=None, max_length=500)


class DecisionResponse(BaseModel):
    status: str
    action: ActionSchema


class SimulationResponse(BaseModel):
    demo: str
    status: str
    message: str
    action: ActionSchema
    policy_result: Optional[PolicyCheckResult] = None
    attempts: int = 0
    links_at_gateway: int = 0
