from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    policy_rules = relationship("PolicyRule", back_populates="merchant", uselist=False)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    total_orders = Column(Integer, default=0)
    successful_payments = Column(Integer, default=0)
    failed_payments = Column(Integer, default=0)
    last_product_info = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    customer_name = Column(String, nullable=False)
    customer_email = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    status = Column(String, nullable=False) # captured, failed
    failure_reason = Column(String, nullable=True) # bank_decline, insufficient_funds, card_expired, network_timeout
    payment_method = Column(String, default="upi")
    created_at = Column(DateTime, default=datetime.utcnow)

class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, default="failed_payment_recovery")
    total_failed_count = Column(Integer, default=0)
    total_failed_amount = Column(Float, default=0.0)
    impact_estimate = Column(Float, default=0.0)
    status = Column(String, default="OPEN") # OPEN, IN_PROGRESS, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)

    actions = relationship("Action", back_populates="opportunity")

class Action(Base):
    __tablename__ = "actions"

    id = Column(String, primary_key=True, index=True) # e.g. RG-ACT-10291
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    title = Column(String, nullable=False)
    evidence = Column(JSON, nullable=False) # metrics list
    decision_factors = Column(JSON, nullable=False) # list of rationale points
    recommendation_reason = Column(Text, nullable=False)
    confidence_score = Column(Float, default=85.0)
    proposed_budget = Column(Float, nullable=False)
    risk_score = Column(String, default="LOW") # LOW, MEDIUM, HIGH
    status = Column(String, default="PROPOSED") # PROPOSED, POLICY_BLOCKED, PENDING_APPROVAL, APPROVED, REJECTED, EXECUTING, COMPLETED, FAILED, HALTED
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_link = Column(String, nullable=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    opportunity = relationship("Opportunity", back_populates="actions")
    audit_events = relationship("AuditEvent", back_populates="action")

class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(String, primary_key=True, index=True)
    merchant_id = Column(String, ForeignKey("merchants.id"), nullable=False)
    max_single_action_budget = Column(Float, default=1000.0)
    allowed_action_types = Column(String, default="failed_payment_recovery,checkout_recovery")
    requires_human_approval = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    merchant = relationship("Merchant", back_populates="policy_rules")

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, index=True)
    action_id = Column(String, ForeignKey("actions.id"), nullable=True)
    merchant_id = Column(String, nullable=False)
    step = Column(String, nullable=False) # DATA_ANALYSIS, PATTERN_DETECTION, POLICY_EVALUATION, MERCHANT_APPROVAL, RAZORPAY_API_CALL, RETRY_ATTEMPT, SAFE_HALT, WEBHOOK_RECEIVED
    status = Column(String, nullable=False) # SUCCESS, BLOCKED, FAILED, PENDING
    component = Column(String, nullable=False) # AIService, PolicyEngine, MerchantAdmin, RazorpayService, WebhookHandler
    message = Column(Text, nullable=False)
    sanitized_payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    action = relationship("Action", back_populates="audit_events")
