import React from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, ShieldCheck, ArrowRight, Target, Eye, XCircle, PauseCircle, Loader2, ExternalLink } from 'lucide-react';
import { OpportunityItem, ActionItem, ActionStatus, RecoveryLinkStatus } from '../types';
import { formatINR } from '../utils/format';

interface OpportunityCardProps {
  opportunity: OpportunityItem | null;
  action: ActionItem | null;
  onReviewClick: () => void;
}

const STATUS_PILLS: Record<ActionStatus, { label: string; className: string; icon: React.ReactNode }> = {
  PROPOSED: { label: 'PROPOSED', className: 'bg-slate-500/20 text-slate-300 border-slate-500/40', icon: <Sparkles className="w-4 h-4" /> },
  PENDING_APPROVAL: { label: 'AWAITING MERCHANT APPROVAL', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse', icon: <ShieldCheck className="w-4 h-4" /> },
  POLICY_BLOCKED: { label: 'POLICY BLOCKED', className: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: <ShieldAlert className="w-4 h-4" /> },
  APPROVED: { label: 'APPROVED', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: <CheckCircle2 className="w-4 h-4" /> },
  EXECUTING: { label: 'EXECUTING VIA RAZORPAY', className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  COMPLETED: { label: 'LINKS SENT', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: <CheckCircle2 className="w-4 h-4" /> },
  REJECTED: { label: 'REJECTED BY MERCHANT', className: 'bg-slate-500/20 text-slate-300 border-slate-500/40', icon: <XCircle className="w-4 h-4" /> },
  HALTED: { label: 'SAFE HALT', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: <PauseCircle className="w-4 h-4" /> }
};

const LINK_STATUS_CLASS: Record<RecoveryLinkStatus, string> = {
  PENDING: 'bg-slate-800 text-slate-300 border-slate-700',
  CREATED: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  PAID: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  EXPIRED: 'bg-slate-800 text-slate-400 border-slate-700',
  CANCELLED: 'bg-slate-800 text-slate-400 border-slate-700'
};

const RISK_CLASS: Record<string, string> = {
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
};

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  action,
  onReviewClick
}) => {
  if (!action) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center border border-slate-800 bg-slate-900/40" id="opportunity-card-section">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3 border border-indigo-500/20">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-white">No Active AI Opportunity Scanned</h3>
        <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
          Click "Scan for Opportunities" above to trigger RazorGrowth's AI payment failure analysis and generate an actionable recovery proposal.
        </p>
      </div>
    );
  }

  const pill = STATUS_PILLS[action.status];
  const isPending = action.status === 'PENDING_APPROVAL';
  const isBlocked = action.status === 'POLICY_BLOCKED';
  const isDone = action.status === 'COMPLETED';
  const cap = action.policy_result?.max_allowed_budget;
  const links = action.recovery_links;
  const paidCount = links.filter(l => l.status === 'PAID').length;

  return (
    <div id="opportunity-card-section" className={`glass-card rounded-2xl p-6 border transition-all ${
      isBlocked || action.status === 'HALTED'
        ? 'border-rose-500/40 bg-rose-950/10'
        : isDone
        ? 'border-emerald-500/40 bg-emerald-950/10'
        : 'border-indigo-500/30 bg-slate-900/80 shadow-xl shadow-indigo-500/10'
    }`}>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Generated Recommendation</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                Confidence: {action.confidence_score}%
              </span>
              {action.ai_provider && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {action.ai_provider}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-white mt-0.5">{opportunity?.title ?? action.title}</h2>
          </div>
        </div>

        <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${pill.className}`}>
          {pill.icon}
          <span>{pill.label}</span>
        </span>
      </div>

      {action.failure_reason && (action.status === 'HALTED' || action.status === 'REJECTED') && (
        <p className="mt-4 text-xs rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-slate-300">
          {action.failure_reason}
        </p>
      )}

      {/* Rationale & Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-5">
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Target className="w-4 h-4 text-indigo-400" />
            <span>Verified Evidence</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {action.evidence.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Decision Factors</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {action.decision_factors.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recovery links sent for this action */}
      {links.length > 0 && (
        <div className="mb-5 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider">Recovery Payment Links</span>
            <span className="text-slate-400">{paidCount} of {links.length} paid</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-4 font-semibold">Customer</th>
                  <th className="py-2 px-4 font-semibold text-right">Original</th>
                  <th className="py-2 px-4 font-semibold text-right">Incentive</th>
                  <th className="py-2 px-4 font-semibold text-right">Link Amount</th>
                  <th className="py-2 px-4 font-semibold">Status</th>
                  <th className="py-2 px-4 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {links.map(l => (
                  <tr key={l.id}>
                    <td className="py-2 px-4 text-slate-200">{l.customer_name}</td>
                    <td className="py-2 px-4 text-right text-slate-400">{formatINR(l.original_amount)}</td>
                    <td className="py-2 px-4 text-right text-amber-300">−{formatINR(l.discount)}</td>
                    <td className="py-2 px-4 text-right font-bold text-white">{formatINR(l.amount)}</td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${LINK_STATUS_CLASS[l.status]}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {l.short_url ? (
                        <a href={l.short_url} target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1 text-indigo-300 hover:text-indigo-200 font-mono">
                          <span>{l.short_url.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500" title={l.error ?? undefined}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Budget & Impact Summary Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-950/80 rounded-xl p-4 border border-slate-800 gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400 block">Proposed Incentive Budget</span>
            <span className="text-lg font-bold text-white">{formatINR(action.proposed_budget)}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-400 block">Safety Cap Limit</span>
            <span className="text-lg font-bold text-cyan-400">{cap !== undefined ? formatINR(cap) : '—'}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-400 block">Risk Score</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${RISK_CLASS[action.risk_score] ?? RISK_CLASS.MEDIUM}`}>
              {action.risk_score} RISK
            </span>
          </div>
        </div>

        <div>
          {isPending ? (
            <button
              onClick={onReviewClick}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Review & Approve Action</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onReviewClick}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
            >
              <Eye className="w-4 h-4" />
              <span>Inspect Action Details & Policy</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};
