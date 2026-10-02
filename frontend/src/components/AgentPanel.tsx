import React, { useEffect, useState } from 'react';
import { Sparkles, ScanSearch, ShieldCheck, ShieldAlert, ArrowRight, Bot, Megaphone, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ActionItem, ScenarioEvent, SimState } from '../types';
import { formatINRWhole, simLabel } from '../utils/format';

interface Props {
  state: SimState;
  latestAction: ActionItem | null;
  events: ScenarioEvent[];
  scanning: boolean;
  onScan: () => void;
  onReview: () => void;
  onCapChange: (cap: number) => void;
}

const CAP_MIN = 500;
const CAP_MAX = 20000;
const CAP_STEP = 500;

const EVENT_ICON = {
  info: <Megaphone className="w-3.5 h-3.5 text-slate-400" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
};

export const AgentPanel: React.FC<Props> = ({ state, latestAction, events, scanning, onScan, onReview, onCapChange }) => {
  const [cap, setCap] = useState(state.policy_cap);
  useEffect(() => setCap(state.policy_cap), [state.policy_cap]);

  const pending = latestAction && latestAction.status === 'PENDING_APPROVAL' ? latestAction : null;
  const blocked = latestAction && latestAction.status === 'POLICY_BLOCKED' && !latestAction.is_simulation ? latestAction : null;
  const finished = state.status === 'FINISHED';
  const commitCap = () => { if (cap !== state.policy_cap) onCapChange(cap); };

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-[24px] !border-brand-500/25 p-4" data-tour="agent">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
            <Sparkles className="w-4 h-4 text-indigo-400" /> AI recovery agent
          </h2>
          <button
            onClick={onScan}
            disabled={scanning || finished || !!pending}
            title={pending ? 'Decide on the pending proposal first' : 'Ask the agent to analyse failures now'}
            className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            {scanning ? 'Analysing…' : 'Scan now'}
          </button>
        </div>

        {pending ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 font-bold">Awaiting your approval</span>
              {pending.auto_proposed && (
                <span className="inline-flex items-center gap-1 text-cyan-300"><Bot className="w-3 h-3" />auto-pilot</span>
              )}
              {pending.created_tick != null && <span className="text-slate-500">{simLabel(pending.created_tick)}</span>}
            </div>
            <div className="text-sm font-semibold text-white">
              Send {pending.target_payment_ids.length} recovery links with a {formatINRWhole(pending.proposed_budget)} incentive
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{pending.recommendation_reason}</p>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>{pending.ai_provider} · confidence {pending.confidence_score}%</span>
              <button
                onClick={onReview}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                Review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : blocked ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3.5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-300"><ShieldAlert className="w-4 h-4" />Last proposal was blocked by policy</div>
            <p className="text-slate-300">{blocked.policy_result?.reason}</p>
            <button onClick={onReview} className="text-rose-200 underline-offset-2 hover:underline">Inspect checklist</button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 leading-relaxed">
            {finished
              ? 'The week is over. Check your results.'
              : state.auto_propose
                ? 'Auto-pilot is on: the agent proposes a campaign every 12 simulated hours. You still approve each one.'
                : 'No proposal waiting. Press Scan now when failures pile up. Fresher failures convert better.'}
          </p>
        )}
      </section>

      <section className="glass-card rounded-[24px] p-4" data-tour="policy">
        <div className="flex items-center justify-between mb-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
            <ShieldCheck className="w-4 h-4 text-brand-400" /> Safety policy
          </h2>
          <span className="font-display text-lg font-semibold text-brand-200" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatINRWhole(cap)}</span>
        </div>
        <label htmlFor="cap" className="text-[11px] text-slate-400">Maximum incentive per campaign</label>
        <input
          id="cap"
          type="range"
          min={CAP_MIN}
          max={CAP_MAX}
          step={CAP_STEP}
          value={cap}
          disabled={finished}
          onChange={e => setCap(Number(e.target.value))}
          onPointerUp={commitCap}
          onKeyUp={commitCap}
          onBlur={commitCap}
          className="w-full mt-2 accent-cyan-500"
        />
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>{formatINRWhole(CAP_MIN)}</span><span>{formatINRWhole(CAP_MAX)}</span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Enforced by the deterministic policy engine on every proposal and again at approval. Changes are audited.
        </p>
      </section>

      <section className="glass-card rounded-[24px] p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100 mb-2">
          <Megaphone className="w-4 h-4 text-slate-400" /> Store news
        </h2>
        <ul className="space-y-2 max-h-44 overflow-y-auto pr-1" aria-live="polite">
          {events.length === 0 && <li className="text-xs text-slate-500">Nothing yet.</li>}
          {[...events].reverse().map(e => (
            <li key={`${e.tick}-${e.message}`} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5">{EVENT_ICON[e.level] ?? EVENT_ICON.info}</span>
              <span>
                <span className="text-slate-500">{simLabel(e.tick)}</span>
                <span className="block text-slate-200">{e.message}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
