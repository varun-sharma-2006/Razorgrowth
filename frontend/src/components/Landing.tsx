import React, { useState } from 'react';
import { Zap, Play, RotateCcw, ShieldCheck, Wallet, TrendingUp, Gauge } from 'lucide-react';
import { Scenario, SimState } from '../types';
import { formatINRWhole } from '../utils/format';
import { LeaderboardTable } from './LeaderboardTable';

interface Props {
  scenarios: Scenario[];
  resumable: SimState | null;
  starting: boolean;
  onStart: (scenario: string, nickname: string) => void;
  onResume: () => void;
}

const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Hard: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  Guided: 'bg-slate-700/40 text-slate-300 border-slate-600'
};

export const Landing: React.FC<Props> = ({ scenarios, resumable, starting, onStart, onResume }) => {
  const [selected, setSelected] = useState('steady');
  const [nickname, setNickname] = useState('');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-[2px]">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div>
          <div className="text-xl font-bold text-white">RazorGrowth Simulator</div>
          <div className="text-xs text-slate-400">Run a store. Command a permissioned AI agent. Recover lost revenue.</div>
        </div>
      </header>

      <section className="grid lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              One week. ₹20,000 in incentives.<br />How much lost revenue can you win back?
            </h1>
            <p className="mt-3 text-sm text-slate-400 max-w-2xl">
              Payments stream into your store and some fail. Your AI agent proposes Razorpay recovery campaigns,
              but it can't spend a rupee without your approval, and a deterministic policy engine blocks anything unsafe.
              Your score is the revenue you recover <span className="text-slate-200">beyond what customers would have paid back anyway</span>.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            {[
              { icon: <Gauge className="w-4 h-4 text-indigo-400" />, title: 'Play at your speed', text: 'Pause, 1×, 2×, 5×, 10×. A week takes about 3 minutes at 1×.' },
              { icon: <Wallet className="w-4 h-4 text-amber-400" />, title: 'Spend wisely', text: 'Discounts only cost you when a customer pays, but bigger ones get wasted on people who would have paid anyway.' },
              { icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />, title: 'You stay in charge', text: 'Approve, reject, or approve with changes. Every decision lands in the audit trail.' }
            ].map(card => (
              <div key={card.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                <div className="flex items-center gap-2 font-semibold text-white mb-1">{card.icon}{card.title}</div>
                <p className="text-slate-400 leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>

          {resumable && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="text-sm text-indigo-100">
                You have a run in progress: <span className="font-semibold">{resumable.scenario.name}</span>, {resumable.clock},
                score {formatINRWhole(resumable.score.lift)}.
              </div>
              <button
                onClick={onResume}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
              >
                <RotateCcw className="w-4 h-4" /> Resume
              </button>
            </div>
          )}

          <div>
            <h2 className="text-sm font-bold text-white mb-3">Choose a scenario</h2>
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Scenario">
              {scenarios.map(s => (
                <button
                  key={s.key}
                  role="radio"
                  aria-checked={selected === s.key}
                  onClick={() => setSelected(s.key)}
                  className={`text-left rounded-xl border p-4 transition ${
                    selected === s.key
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{s.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${DIFFICULTY_CLASS[s.difficulty] ?? DIFFICULTY_CLASS.Guided}`}>
                      {s.ranked ? s.difficulty : 'Practice'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={e => { e.preventDefault(); onStart(selected, nickname.trim()); }}
          >
            <label className="flex-1">
              <span className="sr-only">Nickname (optional)</span>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={24}
                placeholder="Your nickname (optional, for the leaderboard)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </label>
            <button
              type="submit"
              disabled={starting || !scenarios.length}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/25 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-white" />
              {starting ? 'Opening your store…' : resumable ? 'Start a new run' : 'Start simulation'}
            </button>
          </form>
        </div>

        <aside className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          {scenarios.length > 0 && <LeaderboardTable scenarios={scenarios} compact />}
          <p className="mt-4 flex items-start gap-2 text-[11px] text-slate-500">
            <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Everyone playing a scenario this week gets the same customers and failures, so scores are directly comparable.
          </p>
        </aside>
      </section>
    </div>
  );
};
