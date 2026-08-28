export interface SystemStatus {
  razorpay_mode: string;
  ai_provider_mode: string;
  database_type: string;
  merchant_id: string;
}

export interface MerchantMetrics {
  total_revenue: number;
  failed_payment_loss: number;
  failed_payment_count: number;
  historical_recovery_rate: number;
  recoverable_amount: number;
  methodology_explanation: string;
  approved_actions_count: number;
  policy_blocked_count: number;
  max_budget_limit: number;
}

export interface PaymentItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  status: string;
  failure_reason?: string;
  payment_method: string;
  created_at: string;
}

export interface OpportunityItem {
  id: string;
  merchant_id: string;
  title: string;
  type: string;
  total_failed_count: number;
  total_failed_amount: number;
  impact_estimate: number;
  status: string;
  created_at: string;
}

export interface PolicyRuleItem {
  rule: string;
  passed: boolean;
}

export interface PolicyCheckResult {
  passed: boolean;
  policy_blocked: boolean;
  reason: string;
  max_allowed_budget: number;
  proposed_budget: number;
  action_type_allowed: boolean;
  checklist?: PolicyRuleItem[];
}

export interface ActionItem {
  id: string;
  idempotency_key: string;
  opportunity_id: string;
  merchant_id: string;
  title: string;
  evidence: string[];
  decision_factors: string[];
  recommendation_reason: string;
  confidence_score: number;
  proposed_budget: number;
  risk_score: string;
  status: string;
  razorpay_order_id?: string;
  razorpay_payment_link?: string;
  failure_reason?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuditEventItem {
  id: string;
  action_id?: string;
  merchant_id: string;
  step: string;
  status: string;
  component: string;
  message: string;
  sanitized_payload?: Record<string, any>;
  timestamp: string;
}
