import { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { FailedPaymentsList } from './components/FailedPaymentsList';
import { OpportunityCard } from './components/OpportunityCard';
import { ApprovalModal } from './components/ApprovalModal';
import { AuditTimeline } from './components/AuditTimeline';
import { FailureSimulationPanel } from './components/FailureSimulationPanel';
import { AdminKeyPrompt } from './components/AdminKeyPrompt';
import { adminKey, api, errorMessage, isUnauthorized } from './services/api';
import {
  SystemStatus,
  MerchantMetrics,
  PaymentItem,
  OpportunityItem,
  ActionItem,
  AuditEventItem
} from './types';
import { LayoutDashboard, AlertCircle, History, XCircle, Info } from 'lucide-react';

const AUDIT_POLL_MS = 1500;

export function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<MerchantMetrics | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [opportunity, setOpportunity] = useState<OpportunityItem | null>(null);
  const [action, setAction] = useState<ActionItem | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false); // a long-running backend operation is in flight
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telemetry' | 'audit'>('dashboard');

  const handleError = useCallback((err: unknown) => {
    if (isUnauthorized(err)) {
      adminKey.clear();
      setNeedsKey(true);
      return;
    }
    setError(errorMessage(err));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sysStatus = await api.getSystemStatus();
      setStatus(sysStatus);
      if (sysStatus.auth_required && !adminKey.get()) {
        setNeedsKey(true);
        return;
      }

      const [mMetrics, pList, opps, actList, audits] = await Promise.all([
        api.getMerchantMetrics(),
        api.getPayments(),
        api.getOpportunities(),
        api.getActions(),
        api.getAuditEvents()
      ]);
      setMetrics(mMetrics);
      setPayments(pList);
      setAuditEvents(audits);
      setOpportunity(opps[0] ?? null);
      setAction(actList[0] ?? null);
      setError(null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stream audit events while the backend is working, so retries show up as they happen.
  useEffect(() => {
    if (!busy && !scanning) return;
    const timer = window.setInterval(async () => {
      try {
        setAuditEvents(await api.getAuditEvents());
      } catch {
        /* the next full refresh will report errors */
      }
    }, AUDIT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, scanning]);

  const handleScanOpportunities = async () => {
    setScanning(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.scanForOpportunities();
      setOpportunity(result.opportunity);
      setAction(result.action);
      if (result.reused_existing) {
        setNotice('A recovery proposal for these failed payments is already awaiting your approval.');
      }
      await loadData();
      window.setTimeout(() => {
        document.getElementById('opportunity-card-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err) {
      handleError(err);
    } finally {
      setScanning(false);
    }
  };

  /** Throws on failure so the approval modal can show the backend's reason. */
  const handleActionDecision = async (decision: 'APPROVE' | 'REJECT', reason?: string) => {
    if (!action) return;
    setBusy(true);
    try {
      const res = await api.decideAction(action.id, decision, reason);
      setAction(res.action);
    } catch (err) {
      if (isUnauthorized(err)) handleError(err);
      throw err;
    } finally {
      setBusy(false);
      await loadData();
    }
  };

  const handleKeySubmit = (key: string) => {
    adminKey.set(key);
    setNeedsKey(false);
    loadData();
  };

  const failedCount = payments.filter(p => p.status === 'failed').length;

  const tabClass = (tab: typeof activeTab) =>
    `inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs transition ${
      activeTab === tab
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
        : 'text-slate-400 hover:text-white hover:bg-slate-800'
    }`;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">

      {/* Navbar */}
      <Navbar status={status} onRefresh={loadData} loading={loading} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {status && !status.auth_required && (
          <div className="flex items-start space-x-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Demo mode: the backend has no <span className="font-mono">ADMIN_API_KEY</span>, so anyone who can reach it
              can approve actions. Set one before sharing this deployment.
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            <div className="flex items-start space-x-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-300 hover:text-white font-semibold">Dismiss</button>
          </div>
        )}

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-indigo-300 hover:text-white font-semibold">Dismiss</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button onClick={() => setActiveTab('dashboard')} className={tabClass('dashboard')}>
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard & Recovery Plan</span>
          </button>
          <button onClick={() => setActiveTab('telemetry')} className={tabClass('telemetry')}>
            <AlertCircle className="w-4 h-4" />
            <span>Payment Failure Telemetry ({failedCount})</span>
          </button>
          <button onClick={() => setActiveTab('audit')} className={tabClass('audit')}>
            <History className="w-4 h-4" />
            <span>Audit Trail ({auditEvents.length})</span>
          </button>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <MetricsOverview metrics={metrics} onScanClick={handleScanOpportunities} scanning={scanning} />

            <OpportunityCard
              opportunity={opportunity}
              action={action}
              onReviewClick={() => setIsApprovalOpen(true)}
            />

            <FailureSimulationPanel
              onRunningChange={setBusy}
              onSimulationComplete={loadData}
              onError={handleError}
            />

            <AuditTimeline events={auditEvents} onRefresh={loadData} live={busy || scanning} />
          </div>
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <FailedPaymentsList payments={payments} />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <AuditTimeline events={auditEvents} onRefresh={loadData} live={busy || scanning} />
          </div>
        )}

      </main>

      <ApprovalModal
        action={action}
        isOpen={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        onDecide={handleActionDecision}
      />

      {needsKey && <AdminKeyPrompt onSubmit={handleKeySubmit} />}

      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-300">RazorGrowth</span> — Permissioned AI Merchant Growth Agent
          </div>
          <div>
            Built by <span className="text-indigo-400 font-semibold">Varun Sharma</span> & <span className="text-indigo-400 font-semibold">Yashika Garg</span> for <span className="text-indigo-400 font-semibold">Razorpay AI Buildathon 2026</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
