from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class SystemStatusSchema(BaseModel):
    razorpay_mode: str # "RAZORPAY TEST MODE" or "LOCAL DEMO MODE"
    ai_provider_mode: str # "Gemini 2.5 Flash", "OpenAI GPT-4o-mini", "Demo Heuristic Mode"
    database_type: str
    merchant_id: str

class MerchantMetricsSchema(BaseModel):
    total_revenue: float
    failed_payment_loss: float
    failed_payment_count: int
    historical_recovery_rate: float = 0.70
    recoverable_amount: float
    methodology_explanation: str = "₹7,850.00 failed payments × 70% estimated conversion rate (prior purchase intent)"
    approved_actions_count: int
    policy_blocked_count: int
    max_budget_limit: float

class CustomerSchema(BaseModel):
    id: str
    name: str
    email: str
    total_orders: int
    successful_payments: int
    failed_payments: int
    last_product_info: Optional[str] = None

class PaymentSchema(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_email: str
    amount: float
    currency: str
    status: str
    failure_reason: Optional[str] = None
    payment_method: str
    created_at: datetime

class OpportunitySchema(BaseModel):
    id: str
    merchant_id: str
    title: str
    type: str
    total_failed_count: int
    total_failed_amount: float
    impact_estimate: float
    status: str
    created_at: datetime

class PolicyCheckResult(BaseModel):
    passed: bool
    policy_blocked: bool
    reason: str
    max_allowed_budget: float
    proposed_budget: float
    action_type_allowed: bool
    checklist: List[Dict[str, Any]] = Field(default_factory=list)

class ActionCreateSchema(BaseModel):
    opportunity_id: str
    proposed_budget: float
    simulate_policy_violation: bool = False

class ActionSchema(BaseModel):
    id: str
    idempotency_key: str
    opportunity_id: str
    merchant_id: str
    title: str
    evidence: List[str]
    decision_factors: List[str]
    recommendation_reason: str
    confidence_score: float
    proposed_budget: float
    risk_score: str
    status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_link: Optional[str] = None
    failure_reason: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime

class AuditEventSchema(BaseModel):
    id: str
    action_id: Optional[str] = None
    merchant_id: str
    step: str
    status: str
    component: str
    message: str
    sanitized_payload: Optional[Dict[str, Any]] = None
    timestamp: datetime

class PolicyUpdateSchema(BaseModel):
    max_single_action_budget: float

class ActionDecisionSchema(BaseModel):
    decision: str # "APPROVE" or "REJECT"
    rejection_reason: Optional[str] = None
