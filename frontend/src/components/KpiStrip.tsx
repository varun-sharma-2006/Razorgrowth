import React, { useMemo } from 'react';
import { Wallet, Link2, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { SimState, TickStat } from '../types';
import { formatINRCompact, formatINRWhole } from '../utils/format';

interface Props {
  state: SimState;
  series: TickStat[];
}

const TONES = {
  violet: 'text-brand-200 bg-brand-500/15 border-brand-500/30',
  aqua: 'text-aqua-200 bg-aqua-400/10 border-aqua-400/30',
  emerald: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
  amber: 'text-amber-200 bg-amber-400/10 border-amber-400/30'
};

const Tile: React.FC<{
  label: string; value: string; hint?: string; icon: React.ReactNode; tone: keyof typeof TONES; children?: React.ReactNode;
}> = ({ label, value, hint, icon, tone, children }) => (
  <div className="glass-card rounded-2xl p-4 flex flex-col gap-2.5 transition duration-300 hover:-translate-y-0.5">
    <div className="flex items-center justify-between gap-2">
      <div className="stat-label">{label}</div>
      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center ${TONES[tone]}`}>{icon}</span>
    </div>
    <div className="metric-value text-2xl">{value}</div>
    {children}
    {hint && <div className="text-xs text-slate-500">{hint}</div>}
  </div>
);

/** Cumulative lift over time; a single series, so no legend (the card title names it). */
const LiftSparkline: React.FC<{ series: TickStat[]; runTicks: number }> = ({ series, runTicks }) => {
  const path = useMemo(() => {
    let lift = 0;
    const pts = series.map(s => {
      lift += s.link_recovered + s.organic_recovered - s.baseline_recovered;
      return { x: s.tick + 1, y: lift };
    });
    if (pts.length < 2) return null;
    const min = Math.min(0, ...pts.map(p => p.y));
    const max = Math.max(1, ...pts.map(p => p.y));
    const W = 240, H = 64;
    const sx = (x: number) => (x / runTicks) * W;
    const sy = (y: number) => H - ((y - min) / (max - min)) * (H - 6) - 3;
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    return { line, area: `${line} L${sx(last.x)},${H} L${sx(pts[0].x)},${H} Z`, end: { x: sx(last.x), y: sy(last.y) }, zero: sy(0), W, H };
  }, [series, runTicks]);

  if (!path) return null;
  return (
    <svg viewBox={`0 0 ${path.W} ${path.H}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="lift-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(124,92,255,0.35)" />
          <stop offset="100%" stopColor="rgba(124,92,255,0)" />
        </linearGradient>
        <linearGradient id="lift-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <line x1={0} x2={path.W} y1={path.zero} y2={path.zero} stroke="rgba(148,163,255,0.15)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={path.area} fill="url(#lift-fill)" />
      <path d={path.line} fill="none" stroke="url(#lift-line)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

export const KpiStrip: React.FC<Props> = ({ state, series }) => {
  const { score } = state;
  const walletShare = state.wallet_start ? state.wallet_available / state.wallet_start : 0;
  const walletFill = walletShare > 0.4
    ? 'linear-gradient(90deg, #7c5cff, #22d3ee)'
    : walletShare > 0.15 ? '#fbbf24' : '#fb7185';

  return (
    <div className="grid grid-cols-2 xl:grid-cols-6 gap-4" data-tour="score">
      <div className="col-span-2 relative overflow-hidden glass-card rounded-2xl p-5 flex flex-col gap-2">
        <div aria-hidden className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-200">
            <Sparkles className="w-4 h-4" /> Your score
          </span>
          <span className="text-xs text-slate-500">revenue won back beyond doing nothing</span>
        </div>
        <div className={`relative metric-value text-5xl sm:text-[3.4rem] ${score.lift < 0 ? '!text-rose-300' : ''}`}>
          {formatINRWhole(score.lift)}
        </div>
        <div className="relative -mx-1">
          <LiftSparkline series={series} runTicks={state.run_ticks} />
        </div>
        <div className="relative text-xs text-slate-400">
          {formatINRCompact(score.link_recovered + score.organic_recovered)} recovered − {formatINRCompact(score.baseline_recovered)} customers would have paid anyway
        </div>
      </div>

      <Tile label="Incentive wallet" tone="violet" icon={<Wallet className="w-3.5 h-3.5" />}
        value={formatINRWhole(state.wallet_available)}
        hint={`of ${formatINRWhole(state.wallet_start)} · ${formatINRWhole(score.incentive_spent)} spent`}>
        <div
          className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"
          role="meter"
          aria-valuenow={Math.round(walletShare * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Incentive wallet remaining"
        >
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, walletShare * 100)}%`, background: walletFill }} />
        </div>
      </Tile>
      <Tile label="Recovered via links" tone="emerald" icon={<Link2 className="w-3.5 h-3.5" />}
        value={formatINRWhole(score.link_recovered)}
        hint={`${state.links_in_flight} link${state.links_in_flight === 1 ? '' : 's'} awaiting payment`} />
      <Tile label="Open failures" tone="amber" icon={<AlertTriangle className="w-3.5 h-3.5" />}
        value={formatINRWhole(state.open_failed_amount)}
        hint={`${state.open_failed_count} payment${state.open_failed_count === 1 ? '' : 's'} · ${formatINRCompact(score.lost)} lost`} />
      <Tile label="Return on incentive" tone="aqua" icon={<TrendingUp className="w-3.5 h-3.5" />}
        value={score.roi === null ? '—' : `${score.roi.toFixed(1)}×`}
        hint={`${state.approvals} approved · ${state.rejections} rejected · ${state.blocked} blocked`} />
    </div>
  );
};
