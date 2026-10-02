export interface SystemStatus {
  razorpay_mode: string;
  ai_provider_mode: string;
  database_type: string;
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
  failed_tick?: number | null;
  resolved_tick?: number | null;
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
  created_tick?: number | null;
  expires_tick?: number | null;
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
  created_tick?: number | null;
  auto_proposed: boolean;
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
  sim_tick?: number | null;
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

// ---------------------------------------------------------------- simulator

export interface Scenario {
  key: string;
  name: string;
  difficulty: string;
  description: string;
  ranked: boolean;
  default_cap: number;
}

export interface Score {
  lift: number;
  link_recovered: number;
  organic_recovered: number;
  baseline_recovered: number;
  lost: number;
  captured: number;
  failed: number;
  incentive_spent: number;
  roi: number | null;
}

export interface SimState {
  merchant_id: string;
  nickname?: string | null;
  scenario: Scenario;
  season: string;
  current_tick: number;
  run_ticks: number;
  clock: string;
  status: 'RUNNING' | 'FINISHED';
  auto_propose: boolean;
  wallet_start: number;
  wallet_available: number;
  policy_cap: number;
  score: Score;
  approvals: number;
  rejections: number;
  blocked: number;
  open_failed_count: number;
  open_failed_amount: number;
  links_in_flight: number;
  pending_action_id?: string | null;
  leaderboard_entry_id?: string | null;
}

export interface TickStat {
  tick: number;
  orders: number;
  captured: number;
  failed_count: number;
  failed: number;
  failed_by_method: Record<string, number>;
  link_recovered: number;
  organic_recovered: number;
  baseline_recovered: number;
  lost: number;
  incentive_spent: number;
  wallet_available: number;
}

export interface ScenarioEvent {
  tick: number;
  level: 'info' | 'warning' | 'success';
  message: string;
}

export interface AdvanceResponse {
  state: SimState;
  stats: TickStat[];
  events: ScenarioEvent[];
  new_proposal_id?: string | null;
}

export interface LeaderboardEntry {
  id: string;
  rank?: number | null;
  nickname: string;
  scenario: string;
  season: string;
  score: number;
  recovered: number;
  incentive_spent: number;
  roi: number;
  approvals: number;
  rejections: number;
  blocked: number;
  created_at: string;
}

export interface Leaderboard {
  scenario: string;
  season: string;
  entries: LeaderboardEntry[];
  you?: LeaderboardEntry | null;
}

export type FailureReason = 'bank_decline' | 'insufficient_funds' | 'card_expired' | 'network_timeout';

export interface DecisionOptions {
  rejection_reason?: string;
  budget_override?: number;
  exclude_reasons?: FailureReason[];
}
