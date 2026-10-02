import React, { useState } from 'react';
import {
  Play, RotateCcw, LogOut, Activity, PartyPopper, WifiOff, CreditCard, GraduationCap, Check, ScanSearch, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Scenario, SimState, User } from '../types';
import { formatINRWhole } from '../utils/format';
import { LeaderboardTable } from './LeaderboardTable';
import { LogoMark } from './LogoMark';
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
  Medium: 'text-amber-200 border-amber-400/30 bg-amber-400/10',
  Hard: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
  Guided: 'text-slate-300 border-slate-700 bg-white/[0.03]'
};

const SCENARIO_ICON: Record<string, React.ReactNode> = {
  steady: <Activity className="w-5 h-5" />,
  festive: <PartyPopper className="w-5 h-5" />,
  upi_outage: <WifiOff className="w-5 h-5" />,
  card_expiry: <CreditCard className="w-5 h-5" />,
  classic: <GraduationCap className="w-5 h-5" />
};

const STEPS = [
  { icon: <ScanSearch className="w-4 h-4" />, title: 'Agent spots failures', text: 'It proposes a recovery campaign with evidence and a budget.' },
  { icon: <ShieldCheck className="w-4 h-4" />, title: 'Policy + you decide', text: 'The policy engine checks limits; you approve, reject or edit.' },
  { icon: <CheckCircle2 className="w-4 h-4" />, title: 'Customers pay links', text: 'Score counts only revenue that would not have come back anyway.' }
];

export const Landing: React.FC<Props> = ({ user, onLogout, scenarios, resumable, starting, onStart, onResume }) => {
  const [selected, setSelected] = useState('steady');
  const [nickname, setNickname] = useState('');
  const firstName = user.name.split(' ')[0];

  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-6 lg:py-8 space-y-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LogoMark size={36} />
          <span className="font-display text-xl font-bold tracking-tight text-slate-50">RazorGrowth</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 rounded-full border border-slate-800 bg-black/20 pl-1 pr-3 py-1">
            <UserAvatar user={user} size={28} />
            <span className="text-sm text-slate-200">{user.name}</span>
          </div>
          <button onClick={onLogout} className="btn-ghost px-3 py-2 text-sm">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </div>

      <section className="grid xl:grid-cols-[1.55fr_1fr] gap-8 items-start">
        <div className="space-y-7">
          <div>
            <span className="eyebrow">Welcome, {firstName}</span>
            <h1 className="mt-4 font-display font-bold text-slate-50 leading-[1] tracking-[-0.035em] text-[clamp(2.4rem,5vw,4rem)]">
              Pick a week to <span className="text-gradient">win back.</span>
            </h1>
            <p className="mt-3 text-slate-400 max-w-[58ch]">
              Every scenario streams the same customers to everyone this week, so your score on the leaderboard is a fair fight.
            </p>
          </div>

          {resumable && (
            <div className="relative overflow-hidden glass-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div aria-hidden className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-aqua-400/15 blur-3xl" />
              <div className="relative">
                <div className="text-xs text-slate-400">Run in progress</div>
                <div className="font-display text-lg font-bold text-slate-50">{resumable.scenario.name}</div>
                <div className="text-sm text-slate-400 font-mono">{resumable.clock} · score {formatINRWhole(resumable.score.lift)}</div>
              </div>
              <button onClick={onResume} className="relative btn-primary px-5 py-2.5 text-sm">
                <RotateCcw className="w-4 h-4" /> Resume run
              </button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Scenario">
            {scenarios.map(s => {
              const on = selected === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSelected(s.key)}
                  className={`group relative text-left rounded-2xl border p-4 transition duration-300 ${
                    on
                      ? 'border-brand-500/70 bg-gradient-to-b from-brand-500/20 to-brand-500/[0.04] shadow-[0_0_40px_-12px_rgba(124,92,255,0.9)]'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-10 h-10 rounded-xl border flex items-center justify-center transition ${
                      on ? 'border-brand-400/60 bg-brand-500/25 text-white' : 'border-slate-800 bg-black/25 text-slate-300 group-hover:text-white'
                    }`}>
                      {SCENARIO_ICON[s.key] ?? <Activity className="w-5 h-5" />}
                    </span>
                    {on ? (
                      <span className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></span>
                    ) : (
                      <span className={`text-[0.68rem] font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_CLASS[s.difficulty] ?? DIFFICULTY_CLASS.Guided}`}>
                        {s.ranked ? s.difficulty : 'Practice'}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 font-display text-base font-bold text-slate-50">{s.name}</div>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{s.description}</p>
                </button>
              );
            })}
          </div>

          <form
            className="glass-card rounded-2xl p-3 flex flex-col sm:flex-row gap-3"
            onSubmit={e => { e.preventDefault(); onStart(selected, nickname.trim()); }}
          >
            <label className="flex-1">
              <span className="sr-only">Nickname for the leaderboard</span>
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={24}
                placeholder={`Leaderboard nickname (default: ${firstName})`}
                className="w-full h-full min-h-[46px] rounded-xl border border-slate-800 bg-black/30 px-4 text-sm text-slate-100 placeholder-slate-500 transition focus:outline-none focus:border-brand-500/60 focus:ring-4 focus:ring-brand-500/15"
              />
            </label>
            <button type="submit" disabled={starting || !scenarios.length} className="btn-primary px-6 py-3 text-[0.95rem]">
              <Play className="w-4 h-4 fill-current" />
              {starting ? 'Opening your store…' : resumable ? 'Start a new run' : 'Start simulation'}
            </button>
          </form>

          <ol className="grid sm:grid-cols-3 gap-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">0{i + 1}</span>
                  <span className="text-aqua-300">{step.icon}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{step.title}</div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="glass-card rounded-3xl p-5 sm:p-6">
          {scenarios.length > 0 && <LeaderboardTable scenarios={scenarios} compact />}
        </aside>
      </section>
    </div>
  );
};
