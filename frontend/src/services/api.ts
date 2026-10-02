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
  DecisionOptions,
  AuthConfig,
  User
} from '../types';

// The API is served same-origin (Vite proxy locally, Vercel rewrite in production), so the
// httpOnly session cookie set after Google sign-in is sent automatically. No tokens in JS.
const client = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1'
});

export const isUnauthorized = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 401;

export const isNotFound = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 404;

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
  // Auth
  getAuthConfig: async (): Promise<AuthConfig> => (await client.get('/auth/config')).data,
  me: async (): Promise<User> => (await client.get('/auth/me')).data,
  googleLogin: async (credential: string): Promise<User> => (await client.post('/auth/google', { credential })).data,
  devLogin: async (): Promise<User> => (await client.post('/auth/dev-login', {})).data,
  logout: async (): Promise<void> => {
    await client.post('/auth/logout');
  },

  // Public
  getSystemStatus: async (): Promise<SystemStatus> => (await client.get('/merchant/status')).data,
  getScenarios: async (): Promise<Scenario[]> => (await client.get('/scenarios')).data,
  getLeaderboard: async (scenario: string, entryId?: string | null): Promise<Leaderboard> =>
    (await client.get('/leaderboard', { params: { scenario, ...(entryId ? { entry_id: entryId } : {}) } })).data,
  startSandbox: async (scenario: string, nickname?: string): Promise<SimState> =>
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
