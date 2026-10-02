import React from 'react';
import { Zap, Play, Pause, Bot, LogOut, Clock } from 'lucide-react';
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

export const SimTopBar: React.FC<Props> = ({ state, playing, speed, onTogglePlay, onSpeed, onToggleAutoPilot, onExit }) => {
  const progress = Math.min(100, (state.current_tick / state.run_ticks) * 100);
  const finished = state.status === 'FINISHED';

  return (
    <header className="sm:sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2.5 mr-auto">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-[2px]">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">RazorGrowth Simulator</div>
            <div className="text-[11px] text-slate-400">{state.scenario.name} · {state.season}{state.nickname ? ` · ${state.nickname}` : ''}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-[220px] flex-1 sm:flex-none" aria-live="off">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-white">{state.clock}</span>
              <span className="text-slate-500">{finished ? 'Week complete' : `${state.run_ticks - state.current_tick}h left`}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Week progress">
              <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" data-tour="controls">
          <button
            onClick={onTogglePlay}
            disabled={finished}
            aria-label={playing ? 'Pause' : 'Play'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition disabled:opacity-40 ${
              playing ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
            }`}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          </button>
          <div className="flex rounded-xl border border-slate-700 overflow-hidden" role="group" aria-label="Speed">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => onSpeed(s)}
                aria-pressed={speed === s}
                className={`px-2.5 py-2 text-xs font-bold transition ${speed === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
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
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
            state.auto_propose
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
              : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          Auto-pilot {state.auto_propose ? 'on' : 'off'}
        </button>

        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="w-4 h-4" /> Menu
        </button>
      </div>
    </header>
  );
};
