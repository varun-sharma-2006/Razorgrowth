import React, { useState } from 'react';
import { Play, RotateCcw, ShieldCheck, Wallet, Gauge, TrendingUp } from 'lucide-react';
import { Scenario, SimState } from '../types';
import { formatINRWhole } from '../utils/format';
import { LeaderboardTable } from './LeaderboardTable';
import { LogoMark } from './LogoMark';

interface Props {
  scenarios: Scenario[];
  resumable: SimState | null;
  starting: boolean;
  onStart: (scenario: string, nickname: string) => void;
  onResume: () => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  Medium: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  Hard: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
  Guided: 'text-slate-300 border-slate-600 bg-white/[0.03]'
};

/** Decorative hero chart: recovered revenue with the agent (gold) pulling away from doing nothing (blue). */
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

export const Landing: React.FC<Props> = ({ scenarios, resumable, starting, onStart, onResume }) => {
  const [selected, setSelected] = useState('steady');
  const [nickname, setNickname] = useState('');

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-10 lg:py-14 space-y-14">
      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
        {/* Left: story */}
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
              [String(scenarios.length || 5), 'Scenarios']
            ].map(([value, label]) => (
              <div key={label} className="glass-card rounded-2xl px-4 py-4">
                <div className="gold-value text-2xl sm:text-[1.7rem]">{value}</div>
                <div className="stat-label mt-2">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: start card */}
        <div className="space-y-4">
          <div className="glass-card rounded-[24px] p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span style={{ filter: 'drop-shadow(0 8px 24px rgba(212,175,106,0.35))' }}><LogoMark size={52} /></span>
              <span className="eyebrow mt-4">New simulation</span>
              <h2 className="font-display text-[1.85rem] font-semibold text-slate-100 mt-2">Open your store</h2>
              <p className="text-sm text-slate-400 mt-1.5">No sign-up. Your run is private to this browser.</p>
            </div>

            {resumable && (
              <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-gold-500/30 bg-gold-500/[0.07] p-3.5">
                <div className="text-sm text-slate-200">
                  <div className="font-semibold text-gold-200">{resumable.scenario.name}</div>
                  <div className="text-xs text-slate-400">{resumable.clock} · score {formatINRWhole(resumable.score.lift)}</div>
                </div>
                <button onClick={onResume} className="btn-ghost px-4 py-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> Resume
                </button>
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={e => { e.preventDefault(); onStart(selected, nickname.trim()); }}>
              <fieldset>
                <legend className="stat-label mb-2">Scenario</legend>
                <div className="space-y-2" role="radiogroup" aria-label="Scenario">
                  {scenarios.map(s => {
                    const on = selected === s.key;
                    return (
                      <button
                        type="button"
                        key={s.key}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSelected(s.key)}
                        className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition ${
                          on ? 'border-gold-500/50 bg-gold-500/[0.08]' : 'border-slate-800 hover:border-gold-500/25 bg-black/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${on ? 'text-gold-200' : 'text-slate-100'}`}>{s.name}</span>
                          <span className={`text-[0.65rem] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full border ${DIFFICULTY_CLASS[s.difficulty] ?? DIFFICULTY_CLASS.Guided}`}>
                            {s.ranked ? s.difficulty : 'Practice'}
                          </span>
                        </div>
                        {on && <p className="mt-1 text-xs text-slate-400 leading-relaxed">{s.description}</p>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="stat-label block mb-2">Nickname (optional)</span>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={24}
                  placeholder="Shown on the leaderboard"
                  className="w-full rounded-[10px] border border-slate-800 bg-black/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition hover:border-gold-500/25 focus:outline-none focus:border-gold-500/50 focus:ring-[3px] focus:ring-gold-500/15"
                />
              </label>

              <button type="submit" disabled={starting || !scenarios.length} className="btn-gold w-full py-3 text-[0.95rem]">
                <Play className="w-4 h-4 fill-current" />
                {starting ? 'Opening your store…' : resumable ? 'Start a new run' : 'Start simulation'}
              </button>
            </form>
          </div>
          <p className="text-center text-[0.68rem] tracking-[0.16em] uppercase text-slate-500">
            Simulated customers · demo payment gateway
          </p>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { icon: <Gauge className="w-4 h-4" />, title: 'Play at your speed', text: 'Pause, 1×, 2×, 5×, 10×. A full week takes about three minutes at 1×.' },
          { icon: <Wallet className="w-4 h-4" />, title: 'Spend wisely', text: 'Discounts only cost you when a customer pays, but they are wasted on customers who would have paid anyway.' },
          { icon: <ShieldCheck className="w-4 h-4" />, title: 'You stay in charge', text: 'Approve, reject, or approve with changes. Every decision lands in the audit trail.' }
        ].map(card => (
          <div key={card.title} className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gold-400">{card.icon}<span className="eyebrow !tracking-[0.16em]">{card.title}</span></div>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">{card.text}</p>
          </div>
        ))}
      </section>

      <section className="glass-card rounded-[24px] p-6 sm:p-7">
        {scenarios.length > 0 && <LeaderboardTable scenarios={scenarios} />}
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Everyone playing a scenario this week gets the same customers and failures, so scores are directly comparable.
        </p>
      </section>
    </div>
  );
};
