import React, { useState } from 'react';
import { Play, RotateCcw, ShieldCheck, Wallet, Gauge, TrendingUp, LogOut } from 'lucide-react';
import { Scenario, SimState, User } from '../types';
import { formatINRWhole } from '../utils/format';
import { LeaderboardTable } from './LeaderboardTable';
import { LogoMark } from './LogoMark';
import { HeroPanel } from './HeroPanel';
import { UserAvatar } from './UserAvatar';

interface Props {
  user: User;
  onLogout: () => void;
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

export const Landing: React.FC<Props> = ({ user, onLogout, scenarios, resumable, starting, onStart, onResume }) => {
  const [selected, setSelected] = useState('steady');
  const [nickname, setNickname] = useState('');

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-8 lg:py-10 space-y-12">
      <div className="flex items-center justify-end gap-3">
        <UserAvatar user={user} size={34} />
        <div className="text-right leading-tight hidden sm:block">
          <div className="text-sm text-slate-100">{user.name}</div>
          <div className="text-xs text-slate-500">{user.email}</div>
        </div>
        <button onClick={onLogout} className="chip inline-flex items-center gap-1.5 !py-2">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>

      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
        <HeroPanel scenarioCount={scenarios.length} />

        {/* Right: start card */}
        <div className="space-y-4">
          <div className="glass-card rounded-[24px] p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <span style={{ filter: 'drop-shadow(0 8px 24px rgba(212,175,106,0.35))' }}><LogoMark size={52} /></span>
              <span className="eyebrow mt-4">New simulation</span>
              <h2 className="font-display text-[1.85rem] font-semibold text-slate-100 mt-2">Open your store</h2>
              <p className="text-sm text-slate-400 mt-1.5">Saved to your Google account, so you can continue on any device.</p>
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
                  placeholder={`Shown on the leaderboard (default: ${user.name.split(' ')[0]})`}
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
