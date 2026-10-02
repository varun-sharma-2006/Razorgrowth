export interface SystemStatus {
  razorpay_mode: string;
  ai_provider_mode: string;
  database_type: string;
  merchant_id: string;
  auth_required: boolean;
  webhook_configured: boolean;
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
  recovery_links_sent: number;
  recovered_amount: number;
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
  checklist: PolicyRuleItem[];
}

export type RecoveryLinkStatus = 'PENDING' | 'CREATED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export interface RecoveryLink {
  id: string;
  payment_id: string;
  customer_name: string;
  customer_email: string;
  original_amount: number;
  discount: number;
  amount: number;
  reference_id: string;
  razorpay_link_id?: string | null;
  short_url?: string | null;
  status: RecoveryLinkStatus;
  attempts: number;
  error?: string | null;
  paid_at?: string | null;
}

export type ActionStatus =
  | 'PROPOSED'
  | 'POLICY_BLOCKED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'HALTED';

export interface ActionItem {
  id: string;
  idempotency_key: string;
  opportunity_id: string;
  merchant_id: string;
  action_type: string;
  is_simulation: boolean;
  title: string;
  ai_provider?: string | null;
  evidence: string[];
  decision_factors: string[];
  recommendation_reason: string;
  confidence_score: number;
  proposed_budget: number;
  risk_score: string;
  target_payment_ids: string[];
  policy_result?: PolicyCheckResult | null;
  status: ActionStatus;
  failure_reason?: string | null;
  retry_count: number;
  recovery_links: RecoveryLink[];
  created_at: string;
  updated_at: string;
}

export interface AuditEventItem {
  id: string;
  action_id?: string | null;
  merchant_id: string;
  step: string;
  status: string;
  component: string;
  message: string;
  sanitized_payload?: Record<string, unknown> | null;
  timestamp: string;
}

export interface ScanResponse {
  opportunity: OpportunityItem;
  action: ActionItem;
  policy_check: PolicyCheckResult;
  reused_existing: boolean;
}

export interface DecisionResponse {
  status: ActionStatus;
  action: ActionItem;
}

export interface SimulationResult {
  demo: string;
  status: ActionStatus;
  message: string;
  action: ActionItem;
  policy_result?: PolicyCheckResult | null;
  attempts: number;
  links_at_gateway: number;
}
