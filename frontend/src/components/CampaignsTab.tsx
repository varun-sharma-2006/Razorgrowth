import React, { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { ActionItem } from '../types';
import { formatINRWhole, simLabel } from '../utils/format';
import { OpportunityCard } from './OpportunityCard';

interface Props {
  actions: ActionItem[];
  onReview: (action: ActionItem) => void;
}

const STATUS_DOT: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-400',
  COMPLETED: 'bg-emerald-400',
  POLICY_BLOCKED: 'bg-rose-400',
  REJECTED: 'bg-slate-500',
  HALTED: 'bg-amber-600',
  EXECUTING: 'bg-indigo-400',
  APPROVED: 'bg-emerald-400',
  PROPOSED: 'bg-slate-400'
};

export const CampaignsTab: React.FC<Props> = ({ actions, onReview }) => {
  const [selectedId, setSelectedId] = useState<string | null>(actions[0]?.id ?? null);
  useEffect(() => {
    if (!selectedId || !actions.some(a => a.id === selectedId)) setSelectedId(actions[0]?.id ?? null);
  }, [actions, selectedId]);
  const selected = actions.find(a => a.id === selectedId) ?? null;

  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
        No campaigns yet. Press <span className="text-white font-semibold">Scan now</span> in the agent panel once failures appear.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-4 gap-4">
      <ul className="lg:col-span-1 space-y-1.5 max-h-[560px] overflow-y-auto pr-1" aria-label="Campaigns">
        {actions.map(a => {
          const paid = a.recovery_links.filter(l => l.status === 'PAID').length;
          return (
            <li key={a.id}>
              <button
                onClick={() => setSelectedId(a.id)}
                aria-current={a.id === selectedId}
                className={`w-full text-left rounded-xl border px-3 py-2.5 text-xs transition ${
                  a.id === selectedId ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[a.status] ?? 'bg-slate-400'}`} />
                    {a.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  {a.auto_proposed && <Bot className="w-3.5 h-3.5 text-cyan-300" aria-label="Auto-pilot" />}
                </div>
                <div className="mt-1 text-slate-400">
                  {a.created_tick != null ? simLabel(a.created_tick) : ''} · {formatINRWhole(a.proposed_budget)}
                </div>
                {a.recovery_links.length > 0 && (
                  <div className="mt-0.5 text-slate-500">{paid}/{a.recovery_links.length} links paid</div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="lg:col-span-3">
        {selected && <OpportunityCard opportunity={null} action={selected} onReviewClick={() => onReview(selected)} />}
      </div>
    </div>
  );
};
