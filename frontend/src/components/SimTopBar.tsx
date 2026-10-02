import React from 'react';
import { Play, Pause, Bot, LogOut } from 'lucide-react';
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
  onExit: () => void;
}

/** The simulation's transport controls, pinned above every page. */
export const SimTopBar: React.FC<Props> = ({ state, playing, speed, onTogglePlay, onSpeed, onToggleAutoPilot, onExit }) => {
  const progress = Math.min(100, (state.current_tick / state.run_ticks) * 100);
  const finished = state.status === 'FINISHED';

  return (
    <div className="lg:sticky lg:top-4 z-30 glass-card rounded-2xl px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-3" data-tour="controls">
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl font-semibold text-slate-100">{state.clock}</span>
          <span className="text-xs text-slate-500">{finished ? 'Week complete' : `${state.run_ticks - state.current_tick}h left`}</span>
        </div>
        <div
          className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Week progress"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #a9803f, #d4af6a, #f6dfa8)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          disabled={finished}
          aria-label={playing ? 'Pause' : 'Play'}
          className={playing ? 'btn-ghost w-11 h-11' : 'btn-gold w-11 h-11'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>
        <div className="flex gap-1" role="group" aria-label="Speed">
          {SPEEDS.map(s => (
            <button key={s} onClick={() => onSpeed(s)} aria-pressed={speed === s} className="chip">
              {s}×
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onToggleAutoPilot}
        aria-pressed={state.auto_propose}
        data-tour="autopilot"
        title="When on, the agent proposes a campaign every 12 simulated hours. You still approve each one."
        className="chip inline-flex items-center gap-1.5 !py-2"
      >
        <Bot className="w-4 h-4" />
        Auto-pilot {state.auto_propose ? 'on' : 'off'}
      </button>

      <button onClick={onExit} className="lg:hidden chip inline-flex items-center gap-1.5 !py-2">
        <LogOut className="w-4 h-4" /> Menu
      </button>
    </div>
  );
};
