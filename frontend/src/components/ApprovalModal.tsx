import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Key, DollarSign, Target, Sparkles, Check, HelpCircle } from 'lucide-react';
import { ActionItem, PolicyCheckResult } from '../types';

interface ApprovalModalProps {
  action: ActionItem | null;
  policyCheck: PolicyCheckResult | null;
  isOpen: boolean;
  onClose: () => void;
  onDecide: (decision: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  action,
  policyCheck,
  isOpen,
  onClose,
  onDecide
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!isOpen || !action) return null;

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await onDecide('APPROVE');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setSubmitting(true);
    try {
      await onDecide('REJECT', rejectReason || 'Merchant Admin rejected proposal');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const isPolicyBlocked = policyCheck?.policy_blocked || action.status === 'POLICY_BLOCKED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card rounded-2xl max-w-2xl w-full border border-indigo-500/30 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Permissioned Action Approval Screen</h3>
              <p className="text-xs text-slate-400">Explicit merchant authorization required before Razorpay REST execution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Action Title & Idempotency Key */}
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center space-x-1">
                <Key className="w-3 h-3 text-cyan-400" />
                <span>Idempotency Key: {action.idempotency_key}</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{action.title}</h2>
          </div>

          {/* Rationale Summary Box */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-indigo-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>AI Recommendation Summary</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                AI Confidence: {action.confidence_score}%
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {action.recommendation_reason}
            </p>
          </div>

          {/* "Why Was This Action Allowed?" Policy Evaluation Checklist */}
          <div className={`rounded-xl p-4 border transition-all ${
            isPolicyBlocked
              ? 'bg-rose-950/20 border-rose-500/30'
              : 'bg-emerald-950/20 border-emerald-500/30'
          }`}>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 text-white">
                <ShieldCheck className={`w-4 h-4 ${isPolicyBlocked ? 'text-rose-400' : 'text-emerald-400'}`} />
                <span>Why Was This Action {isPolicyBlocked ? 'Blocked' : 'Allowed'}? (Deterministic Policy Engine)</span>
              </h4>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded border uppercase ${
                isPolicyBlocked
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}>
                {isPolicyBlocked ? 'STATUS: BLOCKED' : 'STATUS: SAFE TO APPROVE'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {policyCheck?.checklist?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 px-2.5 rounded bg-slate-950/50 border border-slate-800/60">
                  <div className="flex items-center space-x-2">
                    {item.passed ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                        <X className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                    <span className={item.passed ? "text-slate-200" : "text-rose-300 font-semibold"}>
                      {item.rule}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${item.passed ? "text-emerald-400" : "text-rose-400"}`}>
                    {item.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
              )) || (
                <div className="space-y-1 text-slate-300">
                  <div className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Action type allowed (failed_payment_recovery)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Budget ₹{action.proposed_budget.toLocaleString('en-IN')} ≤ Merchant Cap ₹{policyCheck?.max_allowed_budget || 1000}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Human Approval Guard active</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evidence and Decision Factors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>Verified Metrics</span>
              </h4>
              <ul className="space-y-1 text-xs text-slate-300">
                {action.evidence?.map((item, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-indigo-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Decision Factors</span>
              </h4>
              <ul className="space-y-1 text-xs text-slate-300">
                {action.decision_factors?.map((item, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Optional Rejection Reason Input */}
          {showRejectInput && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-xs font-semibold text-rose-300">Reason for Rejection (Optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Prefer manually contacting key customers..."
                className="w-full bg-slate-950 border border-rose-500/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                rows={2}
              />
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            onClick={handleReject}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-semibold text-xs border border-slate-700 hover:border-rose-500/30 transition"
          >
            {showRejectInput ? 'Confirm Rejection' : 'Reject Proposal'}
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting || isPolicyBlocked}
              className={`inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0 ${
                isPolicyBlocked
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Executing via Razorpay...' : 'Approve & Execute Action'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
