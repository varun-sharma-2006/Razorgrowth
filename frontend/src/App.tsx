import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { MetricsOverview } from './components/MetricsOverview';
import { FailedPaymentsList } from './components/FailedPaymentsList';
import { OpportunityCard } from './components/OpportunityCard';
import { ApprovalModal } from './components/ApprovalModal';
import { AuditTimeline } from './components/AuditTimeline';
import { FailureSimulationPanel } from './components/FailureSimulationPanel';
import { api } from './services/api';
import {
  SystemStatus,
  MerchantMetrics,
  PaymentItem,
  OpportunityItem,
  ActionItem,
  AuditEventItem,
  PolicyCheckResult
} from './types';
import { LayoutDashboard, AlertCircle, History, Sparkles } from 'lucide-react';

const initialFailedPayments: PaymentItem[] = [
  { id: "pay_fail_01", customer_id: "cust_104", customer_name: "Vikram Patel", customer_email: "vikram.p@example.com", amount: 850.0, currency: "INR", status: "failed", failure_reason: "bank_decline", payment_method: "upi", created_at: new Date().toISOString() },
  { id: "pay_fail_02", customer_id: "cust_102", customer_name: "Priya Sharma", customer_email: "priya.s@example.com", amount: 1299.0, currency: "INR", status: "failed", failure_reason: "insufficient_funds", payment_method: "card", created_at: new Date().toISOString() },
  { id: "pay_fail_03", customer_id: "cust_101", customer_name: "Rohan Verma", customer_email: "rohan.v@example.com", amount: 2499.0, currency: "INR", status: "failed", failure_reason: "card_expired", payment_method: "card", created_at: new Date().toISOString() },
  { id: "pay_fail_04", customer_id: "cust_105", customer_name: "Sneha Gupta", customer_email: "sneha.g@example.com", amount: 649.0, currency: "INR", status: "failed", failure_reason: "network_timeout", payment_method: "netbanking", created_at: new Date().toISOString() },
  { id: "pay_fail_05", customer_id: "cust_107", customer_name: "Riya Sen", customer_email: "riya.s@example.com", amount: 499.0, currency: "INR", status: "failed", failure_reason: "bank_decline", payment_method: "upi", created_at: new Date().toISOString() },
  { id: "pay_fail_06", customer_id: "cust_109", customer_name: "Neha Kapoor", customer_email: "neha.k@example.com", amount: 799.0, currency: "INR", status: "failed", failure_reason: "card_expired", payment_method: "card", created_at: new Date().toISOString() },
  { id: "pay_fail_07", customer_id: "cust_103", customer_name: "Ananya Mehta", customer_email: "ananya.m@example.com", amount: 550.0, currency: "INR", status: "failed", failure_reason: "insufficient_funds", payment_method: "upi", created_at: new Date().toISOString() },
  { id: "pay_fail_08", customer_id: "cust_106", customer_name: "Karan Malhotra", customer_email: "karan.m@example.com", amount: 400.0, currency: "INR", status: "failed", failure_reason: "network_timeout", payment_method: "netbanking", created_at: new Date().toISOString() },
  { id: "pay_fail_09", customer_id: "cust_108", customer_name: "Aditya Nair", customer_email: "aditya.n@example.com", amount: 305.0, currency: "INR", status: "failed", failure_reason: "bank_decline", payment_method: "upi", created_at: new Date().toISOString() }
];

const initialAuditEvents: AuditEventItem[] = [
  { id: "evt_init_01", merchant_id: "merch_razorgrowth_01", step: "DATA_ANALYSIS", status: "SUCCESS", component: "SystemInit", message: "RazorGrowth system initialized with 10 customer accounts and 9 failed payment records (Total lost: ₹7,850.00).", sanitized_payload: { initial_failed_count: 9, initial_failed_amount: 7850.0 }, timestamp: new Date().toISOString() }
];

export function App() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<MerchantMetrics | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>(initialFailedPayments);
  const [opportunity, setOpportunity] = useState<OpportunityItem | null>(null);
  const [action, setAction] = useState<ActionItem | null>(null);
  const [policyCheck, setPolicyCheck] = useState<PolicyCheckResult | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>(initialAuditEvents);
  
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telemetry' | 'audit'>('dashboard');

  const loadData = async () => {
    setLoading(true);
    try {
      const [sysStatus, mMetrics, pList, opps, actList, audits] = await Promise.all([
        api.getSystemStatus(),
        api.getMerchantMetrics(),
        api.getPayments(),
        api.getOpportunities(),
        api.getActions(),
        api.getAuditEvents()
      ]);

      setStatus(sysStatus);
      setMetrics(mMetrics);
      if (pList && pList.length > 0) setPayments(pList);
      if (audits && audits.length > 0) setAuditEvents(audits);

      if (opps && opps.length > 0) {
        setOpportunity(opps[0]);
      }
      if (actList && actList.length > 0) {
        setAction(actList[0]);
      }
    } catch (err) {
      console.error("Failed to load backend data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScanOpportunities = async () => {
    setScanning(true);
    try {
      const result = await api.scanForOpportunities();
      setOpportunity(result.opportunity);
      setAction(result.action);
      setPolicyCheck(result.policy_check);
      await loadData();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleActionDecision = async (decision: 'APPROVE' | 'REJECT', reason?: string) => {
    if (!action) return;
    try {
      await api.decideAction(action.id, decision, reason);
      await loadData();
    } catch (err: any) {
      alert(`Action error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  const failedCount = payments.filter(p => p.status === 'failed').length || 9;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      
      {/* Navbar */}
      <Navbar status={status} onRefresh={loadData} loading={loading} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs transition ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard & Recovery Plan</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs transition ${
              activeTab === 'telemetry'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Payment Failure Telemetry ({failedCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs transition ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Trail ({auditEvents.length})</span>
          </button>
        </div>

        {/* Tab 1: Main Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top Metrics Overview */}
            <MetricsOverview
              metrics={metrics}
              onScanClick={handleScanOpportunities}
              scanning={scanning}
            />

            {/* AI Generated Recommendation */}
            <OpportunityCard
              opportunity={opportunity}
              action={action}
              policyCheck={policyCheck}
              onReviewClick={() => setIsApprovalOpen(true)}
            />

            {/* Failure & Safety Simulation Control Room */}
            <FailureSimulationPanel onSimulationComplete={loadData} />

            {/* Visual Audit Trail Timeline */}
            <AuditTimeline events={auditEvents} onRefresh={loadData} />
          </div>
        )}

        {/* Tab 2: Failed Payments Telemetry */}
        {activeTab === 'telemetry' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <FailedPaymentsList payments={payments} />
          </div>
        )}

        {/* Tab 3: Visual Audit Timeline */}
        {activeTab === 'audit' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <AuditTimeline events={auditEvents} onRefresh={loadData} />
          </div>
        )}

      </main>

      {/* Human Approval Modal */}
      <ApprovalModal
        action={action}
        policyCheck={policyCheck}
        isOpen={isApprovalOpen}
        onClose={() => setIsApprovalOpen(false)}
        onDecide={handleActionDecision}
      />

      {/* Footer */}
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
