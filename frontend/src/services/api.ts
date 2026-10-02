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
  SimulationResult,
  Scenario,
  SimState,
  TickStat,
  ScenarioEvent,
  AdvanceResponse,
  Leaderboard,
  LeaderboardEntry,
  DecisionOptions
} from '../types';

const TOKEN_STORAGE = 'razorgrowth.sandboxToken';

const client = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1'
});

// The sandbox token identifies this visitor's private simulation. It lives only in this
// browser (localStorage), so a run survives reloads on this device.
export const sandboxToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_STORAGE, token);
    } catch {
      /* storage unavailable: the run is lost on reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_STORAGE);
    } catch {
      /* ignore */
    }
  }
};

client.interceptors.request.use((config) => {
  const token = sandboxToken.get();
  if (token) config.headers.set('X-Sandbox-Token', token);
  return config;
});

export const isUnauthorized = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 401;

export const isConflict = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 409;

/** Turns an API error into a message a person can read. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ detail?: unknown }>;
    if (!e.response) return 'Cannot reach the RazorGrowth backend. Check your connection.';
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
  // Public
  getSystemStatus: async (): Promise<SystemStatus> => (await client.get('/merchant/status')).data,
  getScenarios: async (): Promise<Scenario[]> => (await client.get('/scenarios')).data,
  getLeaderboard: async (scenario: string, entryId?: string | null): Promise<Leaderboard> =>
    (await client.get('/leaderboard', { params: { scenario, ...(entryId ? { entry_id: entryId } : {}) } })).data,
  startSandbox: async (scenario: string, nickname?: string): Promise<{ token: string; state: SimState }> =>
    (await client.post('/sandboxes', { scenario, nickname: nickname || null })).data,

  // Simulation
  getState: async (): Promise<SimState> => (await client.get('/sim/state')).data,
  advance: async (ticks: number): Promise<AdvanceResponse> => (await client.post('/sim/advance', { ticks })).data,
  getSeries: async (): Promise<TickStat[]> => (await client.get('/sim/series')).data,
  getEvents: async (): Promise<ScenarioEvent[]> => (await client.get('/sim/events')).data,
  setAutoPropose: async (autoPropose: boolean): Promise<SimState> =>
    (await client.put('/sim/settings', { auto_propose: autoPropose })).data,
  submitScore: async (nickname: string): Promise<LeaderboardEntry> =>
    (await client.post('/sim/leaderboard', { nickname })).data,

  // Store & agent
  getMerchantMetrics: async (): Promise<MerchantMetrics> => (await client.get('/merchant/metrics')).data,
  updatePolicyBudget: async (maxBudget: number): Promise<void> => {
    await client.put('/merchant/policy', { max_single_action_budget: maxBudget });
  },
  getPayments: async (): Promise<PaymentItem[]> => (await client.get('/payments')).data,
  getOpportunities: async (): Promise<OpportunityItem[]> => (await client.get('/opportunities')).data,
  scanForOpportunities: async (): Promise<ScanResponse> => (await client.post('/opportunities/scan')).data,
  getActions: async (): Promise<ActionItem[]> => (await client.get('/actions')).data,
  getActionDetail: async (id: string): Promise<ActionItem> => (await client.get(`/actions/${id}`)).data,
  decideAction: async (id: string, decision: 'APPROVE' | 'REJECT', options: DecisionOptions = {}): Promise<DecisionResponse> =>
    (await client.post(`/actions/${id}/decision`, { decision, ...options })).data,
  getAuditEvents: async (actionId?: string): Promise<AuditEventItem[]> =>
    (await client.get('/audit', { params: actionId ? { action_id: actionId } : {} })).data,

  // Safety lab
  simulatePolicyBlock: async (): Promise<SimulationResult> => (await client.post('/simulation/policy-block')).data,
  simulateApiTimeout: async (): Promise<SimulationResult> => (await client.post('/simulation/api-timeout')).data,
  simulateLostResponse: async (): Promise<SimulationResult> => (await client.post('/simulation/lost-response')).data
};
