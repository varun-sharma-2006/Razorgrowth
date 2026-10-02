import React from 'react';
import { SimState } from '../types';
import { formatINRCompact, formatINRWhole } from '../utils/format';

interface Props {
  state: SimState;
}

const Tile: React.FC<{ label: string; value: string; hint?: string; children?: React.ReactNode }> = ({ label, value, hint, children }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
    <div className="text-[11px] font-semibold text-slate-400">{label}</div>
    <div className="mt-1 text-xl font-bold text-white">{value}</div>
    {children}
    {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
  </div>
);

export const KpiStrip: React.FC<Props> = ({ state }) => {
  const { score } = state;
  const walletShare = state.wallet_start ? state.wallet_available / state.wallet_start : 0;
  const walletTone = walletShare > 0.4 ? 'bg-indigo-500' : walletShare > 0.15 ? 'bg-amber-400' : 'bg-rose-500';
  const liftPositive = score.lift >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3" data-tour="score">
      <div className="col-span-2 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900/60 p-4">
        <div className="text-[11px] font-semibold text-indigo-300">Your score: revenue won back beyond doing nothing</div>
        <div className={`mt-1 text-5xl font-extrabold tracking-tight ${liftPositive ? 'text-white' : 'text-rose-300'}`}>
          {formatINRWhole(score.lift)}
        </div>
        <div className="mt-1.5 text-[11px] text-slate-400">
          {formatINRCompact(score.link_recovered + score.organic_recovered)} recovered − {formatINRCompact(score.baseline_recovered)} customers would have paid anyway
        </div>
      </div>

      <Tile label="Incentive wallet" value={formatINRWhole(state.wallet_available)} hint={`of ${formatINRWhole(state.wallet_start)} · ${formatINRWhole(score.incentive_spent)} spent`}>
        <div
          className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden"
          role="meter"
          aria-valuenow={Math.round(walletShare * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Incentive wallet remaining"
        >
          <div className={`h-full rounded-full ${walletTone} transition-[width] duration-500`} style={{ width: `${Math.max(0, walletShare * 100)}%` }} />
        </div>
      </Tile>
      <Tile label="Recovered via links" value={formatINRWhole(score.link_recovered)} hint={`${state.links_in_flight} link${state.links_in_flight === 1 ? '' : 's'} awaiting payment`} />
      <Tile label="Open failures" value={formatINRWhole(state.open_failed_amount)} hint={`${state.open_failed_count} payment${state.open_failed_count === 1 ? '' : 's'} · ${formatINRCompact(score.lost)} lost for good`} />
      <Tile
        label="Return on incentive"
        value={score.roi === null ? '—' : `${score.roi.toFixed(1)}×`}
        hint={`${state.approvals} approved · ${state.rejections} rejected · ${state.blocked} blocked`}
      />
    </div>
  );
};
