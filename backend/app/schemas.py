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
    failed_tick: Optional[int] = None
    resolved_tick: Optional[int] = None
    # organic_tick is deliberately not exposed: it would reveal future customer behaviour.


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
    created_tick: Optional[int] = None
    expires_tick: Optional[int] = None
    # converts_at_tick is deliberately not exposed (future customer behaviour).


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
    created_tick: Optional[int] = None
    auto_proposed: bool = False


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
    sim_tick: Optional[int] = None


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


FailureReason = Literal["bank_decline", "insufficient_funds", "card_expired", "network_timeout"]


class ActionDecisionSchema(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    rejection_reason: Optional[str] = Field(default=None, max_length=500)
    # "Approve with changes": the merchant may resize the incentive or skip failure types.
    # Both are re-checked by the policy engine before execution.
    budget_override: Optional[float] = Field(default=None, gt=0, le=settings.MAX_POLICY_BUDGET_CEILING)
    exclude_reasons: List[FailureReason] = Field(default_factory=list, max_length=4)


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


# ---------------------------------------------------------------- simulator

class ScenarioSchema(BaseModel):
    key: str
    name: str
    difficulty: str
    description: str
    ranked: bool
    default_cap: float


class ScenarioEventSchema(BaseModel):
    tick: int
    level: str
    message: str


class TickStatSchema(ORMModel):
    tick: int
    orders: int
    captured: float
    failed_count: int
    failed: float
    failed_by_method: Dict[str, int]
    link_recovered: float
    organic_recovered: float
    baseline_recovered: float
    lost: float
    incentive_spent: float
    wallet_available: float


class ScoreSchema(BaseModel):
    lift: float  # the score: recovered beyond what would have come back with no agent
    link_recovered: float
    organic_recovered: float
    baseline_recovered: float
    lost: float
    captured: float
    failed: float
    incentive_spent: float
    roi: Optional[float] = None  # lift per rupee of incentive spent


class SimStateSchema(BaseModel):
    merchant_id: str
    nickname: Optional[str] = None
    scenario: ScenarioSchema
    season: str
    current_tick: int
    run_ticks: int
    clock: str
    status: str
    auto_propose: bool
    wallet_start: float
    wallet_available: float
    policy_cap: float
    score: ScoreSchema
    approvals: int
    rejections: int
    blocked: int
    open_failed_count: int
    open_failed_amount: float
    links_in_flight: int
    pending_action_id: Optional[str] = None
    leaderboard_entry_id: Optional[str] = None


class SandboxCreateSchema(BaseModel):
    scenario: str = Field(min_length=1, max_length=32)
    nickname: Optional[str] = Field(default=None, max_length=24)


class SandboxCreatedSchema(BaseModel):
    token: str
    state: SimStateSchema


class AdvanceRequestSchema(BaseModel):
    ticks: int = Field(default=1, ge=1, le=24)


class AdvanceResponseSchema(BaseModel):
    state: SimStateSchema
    stats: List[TickStatSchema]
    events: List[ScenarioEventSchema]
    new_proposal_id: Optional[str] = None


class SimSettingsSchema(BaseModel):
    auto_propose: Optional[bool] = None


class LeaderboardSubmitSchema(BaseModel):
    nickname: str = Field(min_length=2, max_length=24, pattern=r"^[A-Za-z0-9 _.\-]+$")


class LeaderboardEntrySchema(ORMModel):
    id: str
    rank: Optional[int] = None
    nickname: str
    scenario: str
    season: str
    score: float
    recovered: float
    incentive_spent: float
    roi: float
    approvals: int
    rejections: int
    blocked: int
    created_at: UTCDateTime


class LeaderboardSchema(BaseModel):
    scenario: str
    season: str
    entries: List[LeaderboardEntrySchema]
    you: Optional[LeaderboardEntrySchema] = None
