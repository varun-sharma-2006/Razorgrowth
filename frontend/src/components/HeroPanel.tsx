import React from 'react';
import { LogoMark } from './LogoMark';

/** Decorative chart: recovered revenue with the agent (gold) pulling away from doing nothing (blue). */
const HeroChart: React.FC = () => {
  const withAgent = [4, 6, 9, 13, 16, 22, 27, 31, 38, 44, 49, 57, 63, 70];
  const baseline = [4, 5, 7, 9, 11, 13, 15, 16, 18, 20, 21, 23, 25, 26];
  const W = 560, H = 170, max = 76;
  const pt = (v: number, i: number) => `${(i / (withAgent.length - 1)) * W},${H - (v / max) * H}`;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${pt(v, i)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full max-w-[560px] h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(212,175,106,0.30)" />
          <stop offset="100%" stopColor="rgba(212,175,106,0)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="rgba(238,232,220,0.05)" />
      ))}
      <path d={`${line(withAgent)} L${W},${H} L0,${H} Z`} fill="url(#hero-fill)" />
      <path d={line(baseline)} fill="none" stroke="#5b8fe6" strokeWidth={2} strokeDasharray="5 5" strokeLinecap="round" />
      <path d={line(withAgent)} fill="none" stroke="#e3c27f" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={H - (withAgent[withAgent.length - 1] / max) * H} r={4.5} fill="#f6dfa8" stroke="#0b0d14" strokeWidth={2} />
    </svg>
  );
};

/** The brand story shown beside the sign-in and new-run cards. */
export const HeroPanel: React.FC<{ scenarioCount: number }> = ({ scenarioCount }) => (
  <div className="space-y-7">
    <div className="flex items-center gap-3">
      <LogoMark size={42} />
      <span className="font-display text-xl font-semibold text-slate-100">RazorGrowth Simulator</span>
    </div>

    <div className="space-y-5">
      <span className="eyebrow">Permissioned AI revenue lab</span>
      <h1 className="font-display font-semibold text-slate-100 leading-[1.04] text-[clamp(2.5rem,5.4vw,4.3rem)]">
        Win back lost revenue <em className="italic font-medium text-gold-400">before</em> customers walk away.
      </h1>
      <p className="text-base sm:text-lg text-slate-400 max-w-[52ch] leading-relaxed">
        Run a store for a simulated week. Payments fail; your AI agent proposes Razorpay recovery campaigns,
        but it can't spend a rupee without your approval, and a policy engine blocks anything unsafe.
      </p>
    </div>

    <HeroChart />

    <div className="grid grid-cols-3 gap-3 max-w-[560px]">
      {[
        ['₹20K', 'Incentive wallet'],
        ['7 days', 'Simulated week'],
        [String(scenarioCount || 5), 'Scenarios']
      ].map(([value, label]) => (
        <div key={label} className="glass-card rounded-2xl px-4 py-4">
          <div className="gold-value text-2xl sm:text-[1.7rem]">{value}</div>
          <div className="stat-label mt-2">{label}</div>
        </div>
      ))}
    </div>
  </div>
);
