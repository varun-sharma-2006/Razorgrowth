import React, { useState } from 'react';
import { DollarSign, AlertTriangle, ShieldCheck, TrendingUp, Lock, HelpCircle, Info } from 'lucide-react';
import { MerchantMetrics } from '../types';

interface MetricsOverviewProps {
  metrics: MerchantMetrics | null;
  onScanClick: () => void;
  scanning: boolean;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ metrics, onScanClick, scanning }) => {
  const [showMethodology, setShowMethodology] = useState(false);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Action */}
      <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Permissioned Merchant Revenue Recovery Agent</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Recover Lost Revenue from Failed Payments
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              RazorGrowth gives AI the ability to identify and prepare merchant-growth actions, but never unrestricted financial authority. Every action is verified by a deterministic Policy Engine and requires explicit merchant approval.
            </p>
          </div>

          <button
            onClick={onScanClick}
            disabled={scanning}
            className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>{scanning ? 'AI Analyzing Telemetry...' : 'Scan for Opportunities'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Captured Revenue */}
        <div className="glass-card rounded-xl p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Captured Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white">
              {formatINR(metrics?.total_revenue || 245000)}
            </span>
            <p className="text-xs text-slate-500 mt-1">Successfully processed orders</p>
          </div>
        </div>

        {/* Failed Payment Revenue Loss */}
        <div className="glass-card rounded-xl p-5 border border-rose-500/20 bg-rose-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Failed Payment Loss</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-rose-300">
                {formatINR(metrics?.failed_payment_loss || 7850)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-medium">
                {metrics?.failed_payment_count || 9} failures
              </span>
            </div>
            <p className="text-xs text-rose-400/80 mt-1">Unmonitored payment drop-offs</p>
          </div>
        </div>

        {/* Estimated Recoverable Amount & Methodology */}
        <div className="glass-card rounded-xl p-5 border border-indigo-500/20 bg-indigo-950/10 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Estimated Recoverable</span>
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="text-indigo-400/70 hover:text-indigo-300 transition"
                title="View Calculation Methodology"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-indigo-300">
              {formatINR(metrics?.recoverable_amount || 5495)}
            </span>
            <p className="text-xs text-indigo-400/80 mt-1">70% high-intent recovery estimate</p>
          </div>

          {/* Methodology Explainer Tooltip */}
          {showMethodology && (
            <div className="mt-3 pt-2 border-t border-indigo-500/20 text-[11px] text-slate-300 bg-slate-950/80 p-2.5 rounded-lg">
              <div className="font-bold text-indigo-400 flex items-center space-x-1 mb-1">
                <Info className="w-3 h-3" />
                <span>Calculation Methodology</span>
              </div>
              <div>Failed Loss: ₹7,850.00 × 70% Historical Recovery Rate = <span className="font-bold text-white">₹5,495.00</span></div>
              <div className="text-slate-400 mt-0.5">Based on high checkout intent window within 24h of drop-off.</div>
            </div>
          )}
        </div>

        {/* Safety Engine Budget Cap */}
        <div className="glass-card rounded-xl p-5 border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Safety Policy Limit</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-white">
                {formatINR(metrics?.max_budget_limit || 1000)}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-medium">
                Max Cap
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Deterministic budget ceiling</p>
          </div>
        </div>

      </div>
    </div>
  );
};
