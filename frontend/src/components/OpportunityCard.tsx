import React from 'react';
import { Sparkles, CheckCircle2, ShieldAlert, ShieldCheck, ArrowRight, DollarSign, Target, Eye } from 'lucide-react';
import { OpportunityItem, ActionItem, PolicyCheckResult } from '../types';

interface OpportunityCardProps {
  opportunity: OpportunityItem | null;
  action: ActionItem | null;
  policyCheck: PolicyCheckResult | null;
  onReviewClick: () => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  action,
  policyCheck,
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

  const isBlocked = action.status === 'POLICY_BLOCKED';
  const isCompleted = action.status === 'COMPLETED';
  const isPending = action.status === 'PENDING_APPROVAL' || action.status === 'PROPOSED';

  return (
    <div id="opportunity-card-section" className={`glass-card rounded-2xl p-6 border transition-all ${
      isBlocked
        ? 'border-rose-500/40 bg-rose-950/10'
        : isCompleted
        ? 'border-emerald-500/40 bg-emerald-950/10'
        : 'border-indigo-500/30 bg-slate-900/80 shadow-xl shadow-indigo-500/10'
    }`}>
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">AI Generated Recommendation</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                Confidence: {action.confidence_score}%
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-0.5">{action.title}</h2>
          </div>
        </div>

        {/* Status Pill */}
        <div>
          {isBlocked && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              <ShieldAlert className="w-4 h-4" />
              <span>POLICY BLOCKED</span>
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4" />
              <span>EXECUTION COMPLETED</span>
            </span>
          )}
          {isPending && (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <ShieldCheck className="w-4 h-4" />
              <span>AWAITING MERCHANT APPROVAL</span>
            </span>
          )}
        </div>
      </div>

      {/* Rationale & Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-5">
        
        {/* Evidence Metrics */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Target className="w-4 h-4 text-indigo-400" />
            <span>Verified Evidence</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {action.evidence?.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decision Factors */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Decision Factors</span>
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {action.decision_factors?.map((item, idx) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Budget & Impact Summary Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-950/80 rounded-xl p-4 border border-slate-800 gap-4">
        <div className="flex items-center space-x-6 text-xs">
          <div>
            <span className="text-slate-400 block">Proposed Action Budget</span>
            <span className="text-lg font-bold text-white">₹{action.proposed_budget.toLocaleString('en-IN')}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-400 block">Safety Cap Limit</span>
            <span className="text-lg font-bold text-cyan-400">₹{policyCheck?.max_allowed_budget || 1000}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div>
            <span className="text-slate-400 block">Risk Score</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {action.risk_score} RISK
            </span>
          </div>
        </div>

        {/* Primary Review & Action CTA Buttons */}
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
