import React from 'react';
import { SimState } from '../types';
import { formatINRCompact, formatINRWhole } from '../utils/format';

interface Props {
  state: SimState;
}

const Tile: React.FC<{ label: string; value: string; hint?: string; children?: React.ReactNode }> = ({ label, value, hint, children }) => (
  <div className="glass-card rounded-2xl px-5 py-[1.15rem] flex flex-col gap-2 transition hover:-translate-y-0.5 hover:border-gold-500/25">
    <div className="stat-label">{label}</div>
    <div className="gold-value text-[1.75rem]">{value}</div>
    {children}
    {hint && <div className="text-xs text-slate-500">{hint}</div>}
  </div>
);

export const KpiStrip: React.FC<Props> = ({ state }) => {
  const { score } = state;
  const walletShare = state.wallet_start ? state.wallet_available / state.wallet_start : 0;
  const walletFill = walletShare > 0.4
    ? 'linear-gradient(90deg, #a9803f, #d4af6a, #f6dfa8)'
    : walletShare > 0.15 ? '#fbbf24' : '#f07a7a';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-[1.1rem]" data-tour="score">
      <div className="col-span-2 glass-card rounded-2xl px-6 py-5 flex flex-col gap-2">
        <div className="stat-label !text-gold-500">Score · revenue won back beyond doing nothing</div>
        <div className={score.lift >= 0 ? 'gold-value text-5xl' : 'font-display font-semibold text-5xl text-rose-300'}>
          {formatINRWhole(score.lift)}
        </div>
        <div className="text-xs text-slate-400">
          {formatINRCompact(score.link_recovered + score.organic_recovered)} recovered − {formatINRCompact(score.baseline_recovered)} customers would have paid anyway
        </div>
      </div>

      <Tile label="Incentive wallet" value={formatINRWhole(state.wallet_available)} hint={`of ${formatINRWhole(state.wallet_start)} · ${formatINRWhole(score.incentive_spent)} spent`}>
        <div
          className="h-1 rounded-full bg-white/[0.06] overflow-hidden"
          role="meter"
          aria-valuenow={Math.round(walletShare * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Incentive wallet remaining"
        >
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, walletShare * 100)}%`, background: walletFill }} />
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
