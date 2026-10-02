import React from 'react';
import { LayoutDashboard, ListChecks, CreditCard, History, FlaskConical, Trophy, LogOut, RotateCcw } from 'lucide-react';
import { SimState, User } from '../types';
import { LogoMark } from './LogoMark';
import { UserAvatar } from './UserAvatar';

export type Page = 'overview' | 'campaigns' | 'payments' | 'audit' | 'lab' | 'leaderboard';

interface Props {
  user: User;
  state: SimState;
  page: Page;
  campaignCount: number;
  onNavigate: (page: Page) => void;
  onExit: () => void;
  onLogout: () => void;
}

const NAV: { key: Page; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { key: 'campaigns', label: 'Campaigns', icon: <ListChecks className="w-[18px] h-[18px]" /> },
  { key: 'payments', label: 'Failed payments', icon: <CreditCard className="w-[18px] h-[18px]" /> },
  { key: 'audit', label: 'Audit trail', icon: <History className="w-[18px] h-[18px]" /> },
  { key: 'lab', label: 'Safety lab', icon: <FlaskConical className="w-[18px] h-[18px]" /> },
  { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-[18px] h-[18px]" /> }
];

export const AppSidebar: React.FC<Props> = ({ user, state, page, campaignCount, onNavigate, onExit, onLogout }) => {

  return (
    <aside
      className="lg:sticky lg:top-0 lg:h-screen lg:w-[272px] shrink-0 flex flex-col gap-4 lg:gap-8 px-4 py-4 lg:px-[1.35rem] lg:pt-8 lg:pb-6
                 border-b lg:border-b-0 lg:border-r border-slate-800 backdrop-blur-xl"
      style={{ background: 'linear-gradient(180deg, rgba(12, 14, 21, 0.92), rgba(8, 9, 14, 0.96))' }}
    >
      <div className="flex lg:flex-col items-center lg:items-stretch justify-between gap-4 lg:gap-6">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div className="leading-tight">
            <div className="font-display text-[1.15rem] font-semibold text-slate-100">RazorGrowth</div>
            <div className="text-[0.66rem] font-semibold tracking-[0.2em] uppercase text-gold-500 mt-1">Simulator</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-slate-800 bg-white/[0.025] px-3.5 py-3 min-w-0">
          <UserAvatar user={user} size={36} />
          <div className="min-w-0">
            <div className="text-sm text-slate-100 truncate">{user.name}</div>
            <div className="text-xs text-slate-400 truncate" title={user.email}>{state.scenario.name} · {state.season}</div>
          </div>
        </div>
      </div>

      <nav aria-label="Workspace" className="flex lg:grid gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
        <div className="hidden lg:block px-[0.9rem] pb-2 text-[0.66rem] font-semibold tracking-[0.2em] uppercase text-slate-500">Workspace</div>
        {NAV.map(item => {
          const active = item.key === page;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`relative shrink-0 flex items-center gap-3 rounded-xl px-[0.9rem] py-[0.65rem] text-[0.94rem] transition ${
                active
                  ? 'text-gold-200 bg-gradient-to-r from-gold-500/[0.14] to-gold-500/[0.02]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.035]'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="hidden lg:block absolute -left-[1.35rem] top-[22%] bottom-[22%] w-[3px] rounded-r"
                  style={{ background: 'linear-gradient(135deg, #f6dfa8, #d4af6a, #a9803f)', boxShadow: '0 0 14px rgba(212,175,106,0.7)' }}
                />
              )}
              <span className="opacity-80">{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
              {item.key === 'campaigns' && campaignCount > 0 && (
                <span className="ml-auto text-[0.7rem] text-slate-500">{campaignCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="hidden lg:flex flex-col gap-3 mt-auto">
        <button onClick={onExit} className="btn-ghost w-full py-2.5 text-sm">
          <RotateCcw className="w-4 h-4" /> New run
        </button>
        <button onClick={onLogout} className="chip w-full inline-flex items-center justify-center gap-1.5 !py-2">
          <LogOut className="w-4 h-4" /> Log out
        </button>
        <p className="text-center text-[0.7rem] text-slate-500">Simulated customers · demo payment gateway</p>
      </div>
    </aside>
  );
};
