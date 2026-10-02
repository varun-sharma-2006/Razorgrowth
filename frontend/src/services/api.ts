import axios, { AxiosError } from 'axios';
import {
  SystemStatus,
  MerchantMetrics,
  PaymentItem,
  OpportunityItem,
  ActionItem,
  AuditEventItem,
  ScanResponse,
  DecisionResponse,
  SimulationResult
} from '../types';

const ADMIN_KEY_STORAGE = 'razorgrowth.adminKey';

const client = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1'
});

// The admin key lives only in this tab's sessionStorage; it is never baked into the bundle.
export const adminKey = {
  get(): string | null {
    try {
      return sessionStorage.getItem(ADMIN_KEY_STORAGE);
    } catch {
      return null;
    }
  },
  set(key: string) {
    try {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    } catch {
      /* storage unavailable: key is lost on reload */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      /* ignore */
    }
  }
};

client.interceptors.request.use((config) => {
  const key = adminKey.get();
  if (key) config.headers.set('X-Admin-Key', key);
  return config;
});

export const isUnauthorized = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 401;

/** Turns an API error into a message a merchant can read. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ detail?: unknown }>;
    if (!e.response) return 'Cannot reach the RazorGrowth backend. Check that it is running.';
    const detail = e.response.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ');
    }
    return `Request failed with HTTP ${e.response.status}`;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

export const api = {
  getSystemStatus: async (): Promise<SystemStatus> => (await client.get('/merchant/status')).data,

  getMerchantMetrics: async (): Promise<MerchantMetrics> => (await client.get('/merchant/metrics')).data,

  updatePolicyBudget: async (maxBudget: number): Promise<void> => {
    await client.put('/merchant/policy', { max_single_action_budget: maxBudget });
  },

  getPayments: async (): Promise<PaymentItem[]> => (await client.get('/payments')).data,

  getOpportunities: async (): Promise<OpportunityItem[]> => (await client.get('/opportunities')).data,

  scanForOpportunities: async (): Promise<ScanResponse> => (await client.post('/opportunities/scan')).data,

  getActions: async (): Promise<ActionItem[]> => (await client.get('/actions')).data,

  getActionDetail: async (id: string): Promise<ActionItem> => (await client.get(`/actions/${id}`)).data,

  decideAction: async (id: string, decision: 'APPROVE' | 'REJECT', reason?: string): Promise<DecisionResponse> =>
    (await client.post(`/actions/${id}/decision`, { decision, rejection_reason: reason })).data,

  getAuditEvents: async (actionId?: string): Promise<AuditEventItem[]> =>
    (await client.get('/audit', { params: actionId ? { action_id: actionId } : {} })).data,

  simulatePolicyBlock: async (): Promise<SimulationResult> => (await client.post('/simulation/policy-block')).data,

  simulateApiTimeout: async (): Promise<SimulationResult> => (await client.post('/simulation/api-timeout')).data,

  simulateLostResponse: async (): Promise<SimulationResult> => (await client.post('/simulation/lost-response')).data
};
