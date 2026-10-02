from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.money import utc_now, to_rupees

# Money is stored as integer paise; the rupee properties below are what the API exposes.


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Simulator sandbox state. Every visitor gets their own merchant.
    token_hash = Column(String(64), unique=True, index=True, nullable=True)  # sha256 of the sandbox token
    nickname = Column(String(40), nullable=True)
    scenario = Column(String, nullable=False, server_default="classic", default="classic")
    season = Column(String, nullable=False, server_default="", default="")  # e.g. 2026-W40
    seed = Column(String, nullable=False, server_default="", default="")
    sim_start = Column(DateTime(timezone=True), nullable=True)  # simulated time of tick 0
    current_tick = Column(Integer, nullable=False, server_default="0", default=0)  # ticks completed
    run_ticks = Column(Integer, nullable=False, server_default="168", default=168)
    status = Column(String, nullable=False, server_default="RUNNING", default="RUNNING")  # RUNNING, FINISHED
    auto_propose = Column(Boolean, nullable=False, server_default="0", default=False)
    wallet_start_paise = Column(Integer, nullable=False, server_default="2000000", default=2_000_000)
    leaderboard_entry_id = Column(String, nullable=True)
    last_active_at = Column(DateTime(timezone=True), default=utc_now)

    policy_rules = relationship("PolicyRule", back_populates="merchant", uselist=False)

    @property
    def wallet_start(self) -> float:
        return to_rupees(self.wallet_start_paise)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    total_orders = Column(Integer, default=0)
    successful_payments = Column(Integer, default=0)
    failed_payments = Column(Integer, default=0)
    last_product_info = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    amount_paise = Column(Integer, nullable=False)
    currency = Column(String, default="INR")
    # captured, failed, recovered (paid via a recovery link), self_recovered (customer retried alone), lost
    status = Column(String, nullable=False)
    failure_reason = Column(String, nullable=True)  # bank_decline, insufficient_funds, card_expired, network_timeout
    payment_method = Column(String, default="upi")
    created_at = Column(DateTime(timezone=True), default=utc_now)  # simulated time for sandbox payments
    failed_tick = Column(Integer, nullable=True, index=True)
    # Pre-rolled at failure: the tick at which this customer would retry on their own (None = never).
    organic_tick = Column(Integer, nullable=True, index=True)
    resolved_tick = Column(Integer, nullable=True)

    @property
    def amount(self) -> float:
        return to_rupees(self.amount_paise)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    type = Column(String, default="failed_payment_recovery")
    total_failed_count = Column(Integer, default=0)
    total_failed_amount_paise = Column(Integer, default=0)
    impact_estimate_paise = Column(Integer, default=0)
    status = Column(String, default="OPEN")  # OPEN, IN_PROGRESS, RESOLVED, SIMULATION
    created_at = Column(DateTime(timezone=True), default=utc_now)

    actions = relationship("Action", back_populates="opportunity")

    @property
    def total_failed_amount(self) -> float:
        return to_rupees(self.total_failed_amount_paise)

    @property
    def impact_estimate(self) -> float:
        return to_rupees(self.impact_estimate_paise)


class Action(Base):
    __tablename__ = "actions"

    id = Column(String, primary_key=True, index=True)  # e.g. RG-ACT-10291
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, index=True)
    action_type = Column(String, nullable=False, default="failed_payment_recovery")
    is_simulation = Column(Boolean, nullable=False, default=False)
    title = Column(String, nullable=False)
    ai_provider = Column(String, nullable=True)
    evidence = Column(JSON, nullable=False)  # list of metric statements
    decision_factors = Column(JSON, nullable=False)  # list of rationale points
    recommendation_reason = Column(Text, nullable=False)
    confidence_score = Column(Float, default=0.0)
    proposed_budget_paise = Column(Integer, nullable=False)  # recovery incentive pool
    risk_score = Column(String, default="LOW")  # LOW, MEDIUM, HIGH
    target_payment_ids = Column(JSON, nullable=False, default=list)
    policy_result = Column(JSON, nullable=True)  # last PolicyCheckResult
    # PROPOSED, POLICY_BLOCKED, PENDING_APPROVAL, APPROVED, REJECTED, EXECUTING, COMPLETED, HALTED
    status = Column(String, default="PROPOSED", index=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    created_tick = Column(Integer, nullable=True)
    auto_proposed = Column(Boolean, nullable=False, server_default="0", default=False)

    opportunity = relationship("Opportunity", back_populates="actions")
    audit_events = relationship("AuditEvent", back_populates="action")
    recovery_links = relationship(
        "RecoveryLink", back_populates="action", lazy="selectin", order_by="RecoveryLink.created_at"
    )

    @property
    def proposed_budget(self) -> float:
        return to_rupees(self.proposed_budget_paise)


class RecoveryLink(Base):
    """One Razorpay Payment Link sent to one customer for one failed payment."""
    __tablename__ = "recovery_links"
    __table_args__ = (UniqueConstraint("action_id", "payment_id", name="uq_recovery_link_action_payment"),)

    id = Column(String, primary_key=True, index=True)
    action_id = Column(String, ForeignKey("actions.id"), nullable=False, index=True)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False, index=True)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    original_amount_paise = Column(Integer, nullable=False)
    discount_paise = Column(Integer, nullable=False, default=0)
    amount_paise = Column(Integer, nullable=False)
    # Sent to Razorpay as `reference_id`; Razorpay rejects a second link with the same value,
    # which is what makes retries safe.
    reference_id = Column(String(40), unique=True, nullable=False)
    razorpay_link_id = Column(String, nullable=True, index=True)
    short_url = Column(String, nullable=True)
    status = Column(String, nullable=False, default="PENDING")  # PENDING, CREATED, PAID, FAILED, EXPIRED, CANCELLED
    attempts = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_tick = Column(Integer, nullable=True)
    expires_tick = Column(Integer, nullable=True, index=True)
    # Pre-rolled when the link is sent: the tick at which the simulated customer pays (None = never).
    converts_at_tick = Column(Integer, nullable=True, index=True)

    action = relationship("Action", back_populates="recovery_links")

    @property
    def amount(self) -> float:
        return to_rupees(self.amount_paise)

    @property
    def original_amount(self) -> float:
        return to_rupees(self.original_amount_paise)

    @property
    def discount(self) -> float:
        return to_rupees(self.discount_paise)


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, unique=True)
    max_single_action_budget_paise = Column(Integer, nullable=False)
    allowed_action_types = Column(String, default="failed_payment_recovery,checkout_recovery")
    requires_human_approval = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    merchant = relationship("Merchant", back_populates="policy_rules")

    @property
    def max_single_action_budget(self) -> float:
        return to_rupees(self.max_single_action_budget_paise)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    action_id = Column(String, ForeignKey("actions.id"), nullable=True, index=True)
    merchant_id = Column(String, nullable=False, index=True)
    # DATA_ANALYSIS, PATTERN_DETECTION, POLICY_EVALUATION, POLICY_UPDATE, MERCHANT_APPROVAL,
    # RAZORPAY_API_CALL, RETRY_ATTEMPT, SAFE_HALT, WEBHOOK_RECEIVED
    step = Column(String, nullable=False)
    status = Column(String, nullable=False)  # SUCCESS, BLOCKED, FAILED, PENDING, HALTED
    component = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    sanitized_payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now)
    sim_tick = Column(Integer, nullable=True)

    action = relationship("Action", back_populates="audit_events")


class WebhookEvent(Base):
    """Processed Razorpay webhook deliveries, so redeliveries are ignored."""
    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True)  # x-razorpay-event-id (or body hash)
    event = Column(String, nullable=False)
    received_at = Column(DateTime(timezone=True), default=utc_now)


class TickStat(Base):
    """Per-hour aggregates for one sandbox; drives the live charts and the score."""
    __tablename__ = "tick_stats"
    __table_args__ = (UniqueConstraint("merchant_id", "tick", name="uq_tick_stat_merchant_tick"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False, index=True)
    tick = Column(Integer, nullable=False)
    orders = Column(Integer, nullable=False, default=0)
    captured_paise = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    failed_paise = Column(Integer, nullable=False, default=0)
    failed_by_method = Column(JSON, nullable=False, default=dict)
    link_recovered_paise = Column(Integer, nullable=False, default=0)
    organic_recovered_paise = Column(Integer, nullable=False, default=0)
    baseline_recovered_paise = Column(Integer, nullable=False, default=0)  # counterfactual: no agent at all
    lost_paise = Column(Integer, nullable=False, default=0)
    incentive_spent_paise = Column(Integer, nullable=False, default=0)
    wallet_available_paise = Column(Integer, nullable=False, default=0)

    @property
    def captured(self) -> float:
        return to_rupees(self.captured_paise)

    @property
    def failed(self) -> float:
        return to_rupees(self.failed_paise)

    @property
    def link_recovered(self) -> float:
        return to_rupees(self.link_recovered_paise)

    @property
    def organic_recovered(self) -> float:
        return to_rupees(self.organic_recovered_paise)

    @property
    def baseline_recovered(self) -> float:
        return to_rupees(self.baseline_recovered_paise)

    @property
    def lost(self) -> float:
        return to_rupees(self.lost_paise)

    @property
    def incentive_spent(self) -> float:
        return to_rupees(self.incentive_spent_paise)

    @property
    def wallet_available(self) -> float:
        return to_rupees(self.wallet_available_paise)


class LeaderboardEntry(Base):
    """Kept after a sandbox is cleaned up, so no foreign key to merchants."""
    __tablename__ = "leaderboard_entries"

    id = Column(String, primary_key=True)
    merchant_id = Column(String, nullable=True, index=True)
    nickname = Column(String(40), nullable=False)
    scenario = Column(String, nullable=False, index=True)
    season = Column(String, nullable=False, index=True)
    score_paise = Column(Integer, nullable=False)  # incremental recovered revenue vs doing nothing
    recovered_paise = Column(Integer, nullable=False)
    incentive_paise = Column(Integer, nullable=False)
    approvals = Column(Integer, nullable=False, default=0)
    rejections = Column(Integer, nullable=False, default=0)
    blocked = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    @property
    def score(self) -> float:
        return to_rupees(self.score_paise)

    @property
    def recovered(self) -> float:
        return to_rupees(self.recovered_paise)

    @property
    def incentive_spent(self) -> float:
        return to_rupees(self.incentive_paise)

    @property
    def roi(self) -> float:
        return round(self.score_paise / self.incentive_paise, 2) if self.incentive_paise else 0.0
