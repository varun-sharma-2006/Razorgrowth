import React, { useEffect, useMemo, useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, Key, Target, Sparkles, Check, Link2, SlidersHorizontal } from 'lucide-react';
import { ActionItem, DecisionOptions, FailureReason, PaymentItem } from '../types';
import { errorMessage } from '../services/api';
import { formatINR, formatINRWhole, REASON_LABELS } from '../utils/format';

interface ApprovalModalProps {
  action: ActionItem | null;
  payments: PaymentItem[];
  isOpen: boolean;
  onClose: () => void;
  onDecide: (decision: 'APPROVE' | 'REJECT', options?: DecisionOptions) => Promise<void>;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  action,
  payments,
  isOpen,
  onClose,
  onDecide
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [excluded, setExcluded] = useState<FailureReason[]>([]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setShowRejectInput(false);
      setRejectReason('');
      setBudget(action ? String(action.proposed_budget) : '');
      setExcluded([]);
    }
  }, [isOpen, action?.id, action?.proposed_budget]);

  // Targeted payments grouped by failure reason, for "approve with changes".
  const reasonGroups = useMemo(() => {
    if (!action) return [];
    const byId = new Map(payments.map(p => [p.id, p]));
    const groups = new Map<string, { count: number; amount: number }>();
    for (const id of action.target_payment_ids) {
      const p = byId.get(id);
      if (!p || !p.failure_reason) continue;
      const g = groups.get(p.failure_reason) ?? { count: 0, amount: 0 };
      g.count += 1;
      g.amount += p.amount;
      groups.set(p.failure_reason, g);
    }
    return [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [action, payments]);

  if (!isOpen || !action) return null;

  const policyCheck = action.policy_result ?? null;
  const isPending = action.status === 'PENDING_APPROVAL';
  const isPolicyBlocked = action.status === 'POLICY_BLOCKED' || !!policyCheck?.policy_blocked;
  const budgetValue = Number(budget);
  const budgetValid = Number.isFinite(budgetValue) && budgetValue > 0;
  const budgetChanged = budgetValid && Math.abs(budgetValue - action.proposed_budget) > 0.001;
  const excludedCount = reasonGroups
    .filter(([r]) => excluded.includes(r as FailureReason))
    .reduce((a, [, g]) => a + g.count, 0);
  const linkCount = action.target_payment_ids.length - excludedCount;
  const modified = budgetChanged || excluded.length > 0;

  const approve = () => decide('APPROVE', {
    ...(budgetChanged ? { budget_override: budgetValue } : {}),
    ...(excluded.length ? { exclude_reasons: excluded } : {})
  });
  const toggleReason = (r: FailureReason) =>
    setExcluded(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));

  const decide = async (decision: 'APPROVE' | 'REJECT', options?: DecisionOptions) => {
    setSubmitting(true);
    setError(null);
    try {
      await onDecide(decision, options);
      onClose();
    } catch (err) {
      // Never assume success: show exactly why the backend refused or failed.
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    decide('REJECT', { rejection_reason: rejectReason.trim() || 'Merchant Admin rejected proposal' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card rounded-[24px] max-w-2xl w-full !border-gold-500/25 !bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-100">Permissioned Action Approval</h3>
              <p className="text-xs text-slate-400">Explicit merchant authorization required before Razorpay REST execution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center space-x-1">
                <Key className="w-3 h-3 text-cyan-400" />
                <span>Idempotency Key: {action.idempotency_key}</span>
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {action.status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{action.title}</h2>
          </div>

          {/* What approval will do */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex items-center space-x-1.5 font-bold text-cyan-400 uppercase tracking-wider">
              <Link2 className="w-4 h-4" />
              <span>What Approval Executes</span>
            </div>
            <p>
              Sends <span className="font-bold text-white">{linkCount} Razorpay Payment Links</span>, one per failed payment,
              each for the customer's original amount minus their share of a{' '}
              <span className="font-bold text-white">{formatINR(budgetValid ? budgetValue : action.proposed_budget)}</span> recovery incentive.
              Incentives are only spent when a customer actually pays.
              Every link carries a unique <span className="font-mono">reference_id</span>, so retries cannot create duplicates.
            </p>
          </div>

          {/* Rationale Summary Box */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-1.5 font-bold text-indigo-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>AI Recommendation Summary</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                {action.ai_provider ?? 'AI'} · Confidence {action.confidence_score}%
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-slate-800/80 pb-2">
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

            {policyCheck ? (
              <div className="space-y-2 text-xs">
                {policyCheck.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 px-2.5 rounded bg-slate-950/50 border border-slate-800/60">
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        item.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {item.passed ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className={item.passed ? 'text-slate-200' : 'text-rose-300 font-semibold'}>
                        {item.rule}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold ${item.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {item.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                ))}
                {isPolicyBlocked && <p className="text-rose-300 pt-1">{policyCheck.reason}</p>}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No policy evaluation has been recorded for this action yet.</p>
            )}
          </div>

          {/* Evidence and Decision Factors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/40 rounded-xl p-3.5 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                <span>Verified Metrics</span>
              </h4>
              <ul className="space-y-1 text-xs text-slate-300">
                {action.evidence.map((item, i) => (
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
                {action.decision_factors.map((item, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-purple-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {isPending && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                <span>Approve with changes (optional)</span>
              </div>
              <label className="block text-xs text-slate-400">
                Incentive budget (₹)
                <input
                  type="number"
                  min={1}
                  step={50}
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="mt-1 w-40 block bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </label>
              {reasonGroups.length > 0 && (
                <fieldset>
                  <legend className="text-xs text-slate-400 mb-1.5">Include failures caused by</legend>
                  <div className="flex flex-wrap gap-2">
                    {reasonGroups.map(([reason, g]) => {
                      const on = !excluded.includes(reason as FailureReason);
                      return (
                        <button
                          key={reason}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggleReason(reason as FailureReason)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition ${
                            on ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-100' : 'border-slate-700 text-slate-500 line-through'
                          }`}
                        >
                          {on ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {REASON_LABELS[reason] ?? reason} · {g.count} ({formatINRWhole(g.amount)})
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <p className="text-[11px] text-slate-500">
                The policy engine re-checks your changes against the safety cap and wallet before anything runs.
              </p>
            </div>
          )}

          {showRejectInput && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label htmlFor="reject-reason" className="text-xs font-semibold text-rose-300">Reason for Rejection (Optional)</label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                maxLength={500}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Prefer manually contacting key customers..."
                className="w-full bg-slate-950 border border-rose-500/30 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                rows={2}
              />
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start space-x-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          {isPending ? (
            <button
              onClick={handleReject}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 font-semibold text-xs border border-slate-700 hover:border-rose-500/30 transition disabled:opacity-50"
            >
              {showRejectInput ? 'Confirm Rejection' : 'Reject Proposal'}
            </button>
          ) : (
            <span className="text-xs text-slate-500">This action is {action.status.replace(/_/g, ' ').toLowerCase()} and can no longer be decided.</span>
          )}

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-semibold text-xs"
            >
              {isPending ? 'Cancel' : 'Close'}
            </button>
            {isPending && (
              <button
                onClick={approve}
                disabled={submitting || isPolicyBlocked || !budgetValid || linkCount === 0}
                className="btn-gold px-6 py-2.5 text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Executing via Razorpay...' : modified ? `Approve with changes (${linkCount} links)` : 'Approve & Execute Action'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
