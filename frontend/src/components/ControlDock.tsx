import React from 'react';
import { Play, Pause, Bot } from 'lucide-react';
import { SimState } from '../types';

export const SPEEDS = [1, 2, 5, 10] as const;
export type Speed = typeof SPEEDS[number];

interface Props {
  state: SimState;
  playing: boolean;
  speed: Speed;
  onTogglePlay: () => void;
  onSpeed: (s: Speed) => void;
  onToggleAutoPilot: () => void;
}

/** Media-player style transport, floating at the bottom of every page. */
export const ControlDock: React.FC<Props> = ({ state, playing, speed, onTogglePlay, onSpeed, onToggleAutoPilot }) => {
  const progress = Math.min(100, (state.current_tick / state.run_ticks) * 100);
  const finished = state.status === 'FINISHED';
  const [day, time] = state.clock.split(' · ');

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:pb-5 pointer-events-none" data-tour="controls">
      <div className="pointer-events-auto mx-auto max-w-[760px] glass-card rounded-[22px] px-3 sm:px-4 py-2.5 flex items-center gap-3 sm:gap-4 shadow-[0_20px_60px_-15px_rgba(124,92,255,0.45)]">
        <button
          onClick={onTogglePlay}
          disabled={finished}
          aria-label={playing ? 'Pause' : 'Play'}
          className={`relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white transition disabled:opacity-40 ${
            playing ? 'bg-white/10 border border-white/15 hover:bg-white/15' : 'btn-primary !rounded-full'
          }`}
        >
          {!playing && !finished && <span className="absolute inset-0 rounded-full bg-brand-500/40 animate-ping-soft" aria-hidden />}
          {playing ? <Pause className="relative w-5 h-5" /> : <Play className="relative w-5 h-5 fill-current translate-x-[1px]" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="font-mono text-lg font-semibold text-white tabular-nums">{time}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                <span className="sm:hidden">{day.replace('Day ', 'D')}</span>
                <span className="hidden sm:inline">{day}</span>
              </span>
            </div>
            <span className="text-[0.7rem] font-mono text-slate-500 shrink-0">
              {finished ? 'week complete' : `${state.run_ticks - state.current_tick}h left`}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Week progress"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #7c5cff, #22d3ee)', boxShadow: '0 0 12px rgba(124,92,255,0.8)' }}
            />
          </div>
        </div>

        <div className="hidden sm:flex shrink-0 rounded-xl bg-black/25 border border-slate-800 p-1" role="group" aria-label="Speed">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => onSpeed(s)} aria-pressed={speed === s} className="chip !px-2.5 font-mono">
              {s}×
            </button>
          ))}
        </div>
        <select
          aria-label="Speed"
          value={speed}
          onChange={e => onSpeed(Number(e.target.value) as Speed)}
          className="sm:hidden shrink-0 rounded-lg bg-black/30 border border-slate-800 px-2 py-1.5 text-sm font-mono text-slate-100"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s}×</option>)}
        </select>

        <button
          onClick={onToggleAutoPilot}
          aria-pressed={state.auto_propose}
          data-tour="autopilot"
          title="When on, the agent proposes a campaign every 12 simulated hours. You still approve each one."
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-2.5 sm:px-3 py-2 text-xs font-medium transition ${
            state.auto_propose
              ? 'border-aqua-400/50 bg-aqua-400/10 text-aqua-200 shadow-[0_0_20px_-6px_rgba(34,211,238,0.8)]'
              : 'border-slate-800 text-slate-400 hover:text-slate-100'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">Auto-pilot</span>
          <span className="font-mono">{state.auto_propose ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
