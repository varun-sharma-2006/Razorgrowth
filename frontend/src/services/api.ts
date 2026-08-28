import axios from 'axios';
import {
  SystemStatus,
  MerchantMetrics,
  PaymentItem,
  OpportunityItem,
  ActionItem,
  AuditEventItem,
  PolicyCheckResult
} from '../types';

const API_BASE = '/api/v1';

export const api = {
  getSystemStatus: async (): Promise<SystemStatus> => {
    const res = await axios.get(`${API_BASE}/merchant/status`);
    return res.data;
  },

  getMerchantMetrics: async (): Promise<MerchantMetrics> => {
    const res = await axios.get(`${API_BASE}/merchant/metrics`);
    return res.data;
  },

  updatePolicyBudget: async (maxBudget: number): Promise<void> => {
    await axios.put(`${API_BASE}/merchant/policy`, { max_single_action_budget: maxBudget });
  },

  getPayments: async (): Promise<PaymentItem[]> => {
    const res = await axios.get(`${API_BASE}/payments`);
    return res.data;
  },

  getOpportunities: async (): Promise<OpportunityItem[]> => {
    const res = await axios.get(`${API_BASE}/opportunities`);
    return res.data;
  },

  scanForOpportunities: async (): Promise<{
    opportunity: OpportunityItem;
    action: ActionItem;
    policy_check: PolicyCheckResult;
  }> => {
    const res = await axios.post(`${API_BASE}/opportunities/scan`);
    return res.data;
  },

  getActions: async (): Promise<ActionItem[]> => {
    const res = await axios.get(`${API_BASE}/actions`);
    return res.data;
  },

  getActionDetail: async (id: string): Promise<ActionItem> => {
    const res = await axios.get(`${API_BASE}/actions/${id}`);
    return res.data;
  },

  decideAction: async (id: string, decision: 'APPROVE' | 'REJECT', reason?: string) => {
    const res = await axios.post(`${API_BASE}/actions/${id}/decision`, { decision, rejection_reason: reason });
    return res.data;
  },

  getAuditEvents: async (actionId?: string): Promise<AuditEventItem[]> => {
    const params = actionId ? { action_id: actionId } : {};
    const res = await axios.get(`${API_BASE}/audit`, { params });
    return res.data;
  },

  simulatePolicyBlock: async () => {
    const res = await axios.post(`${API_BASE}/simulation/policy-block`);
    return res.data;
  },

  simulateApiTimeout: async () => {
    const res = await axios.post(`${API_BASE}/simulation/api-timeout`);
    return res.data;
  }
};
