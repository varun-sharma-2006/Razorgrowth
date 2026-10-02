import React, { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, ListChecks, CreditCard, History, FlaskConical, Trophy, LogOut, RotateCcw, ChevronDown } from 'lucide-react';
import { SimState, User } from '../types';
import { LogoMark } from './LogoMark';
import { UserAvatar } from './UserAvatar';

export type Page = 'overview' | 'campaigns' | 'payments' | 'audit' | 'lab' | 'leaderboard';

interface Props {
  user: User;
  state: SimState;
  page: Page;
  playing: boolean;
  campaignCount: number;
  onNavigate: (page: Page) => void;
  onNewRun: () => void;
  onLogout: () => void;
}

const NAV: { key: Page; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'campaigns', label: 'Campaigns', icon: <ListChecks className="w-4 h-4" /> },
  { key: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { key: 'audit', label: 'Audit', icon: <History className="w-4 h-4" /> },
  { key: 'lab', label: 'Safety lab', icon: <FlaskConical className="w-4 h-4" /> },
  { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-4 h-4" /> }
];

export const TopNav: React.FC<Props> = ({ user, state, page, playing, campaignCount, onNavigate, onNewRun, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-5 pt-3">
      <div className="glass-card rounded-2xl max-w-[1400px] mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5 shrink-0">
          <LogoMark size={34} />
          <span className="font-display text-lg font-bold tracking-tight text-slate-50">RazorGrowth</span>
        </div>

        <nav aria-label="Pages" className="order-3 lg:order-none w-full lg:w-auto flex gap-1 overflow-x-auto rounded-xl bg-black/25 border border-slate-800 p-1 lg:mx-auto">
          {NAV.map(item => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`relative shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? 'text-white bg-gradient-to-b from-brand-500/35 to-brand-500/15 shadow-[0_0_24px_-8px_rgba(124,92,255,0.9)] border border-brand-500/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className={active ? 'text-brand-200' : 'opacity-70'}>{item.icon}</span>
                {item.label}
                {item.key === 'campaigns' && campaignCount > 0 && (
                  <span className="ml-0.5 rounded-md bg-white/10 px-1.5 text-[0.68rem] font-mono text-slate-200">{campaignCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto lg:ml-0 flex items-center gap-3 shrink-0">
          <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-slate-800 bg-black/20 px-3 py-1 text-xs text-slate-300">
            <span className="relative flex w-2 h-2">
              {playing && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />}
              <span className={`relative inline-flex w-2 h-2 rounded-full ${playing ? 'bg-emerald-400' : state.status === 'FINISHED' ? 'bg-slate-500' : 'bg-amber-400'}`} />
            </span>
            {state.scenario.name}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 hover:bg-white/[0.05] transition"
            >
              <UserAvatar user={user} size={30} />
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 glass-card rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 px-2.5 py-2">
                  <UserAvatar user={user} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{user.name}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </div>
                </div>
                <div className="my-1 h-px bg-slate-800" />
                <button role="menuitem" onClick={() => { setMenuOpen(false); onNewRun(); }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-slate-200 hover:bg-white/[0.05]">
                  <RotateCcw className="w-4 h-4 text-brand-300" /> New run
                </button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-slate-200 hover:bg-white/[0.05]">
                  <LogOut className="w-4 h-4 text-slate-400" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
