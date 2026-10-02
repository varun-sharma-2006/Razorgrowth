import React, { useState } from 'react';
import { Trophy, RotateCcw, X, Send } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { Scenario, SimState } from '../types';
import { formatINRWhole } from '../utils/format';
import { LeaderboardTable } from './LeaderboardTable';

interface Props {
  state: SimState;
  scenarios: Scenario[];
  onClose: () => void;
  onPlayAgain: () => void;
  onSubmitted: () => void;
}

export const EndOfRunModal: React.FC<Props> = ({ state, scenarios, onClose, onPlayAgain, onSubmitted }) => {
  const [nickname, setNickname] = useState(state.nickname ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { score } = state;
  const ranked = state.scenario.ranked;
  const submitted = !!state.leaderboard_entry_id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.submitScore(nickname.trim());
      onSubmitted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const rows: [string, number, string?][] = [
    ['Paid through RazorGrowth links', score.link_recovered],
    ['Customers who retried on their own', score.organic_recovered],
    ['Would have come back with no agent', -score.baseline_recovered, 'subtracted: you get no credit for these'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="results-title" className="glass-card w-full max-w-3xl rounded-[24px] !border-brand-500/25 !bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-800">
          <div>
            <div className="eyebrow w-fit">
              <Trophy className="w-4 h-4" /> Week complete · {state.scenario.name}
            </div>
            <h2 id="results-title" className="mt-3 font-display text-2xl font-semibold text-slate-100">Revenue won back beyond doing nothing</h2>
            <div className={`mt-3 text-6xl ${score.lift >= 0 ? 'metric-value' : 'font-display font-semibold text-rose-300'}`}>{formatINRWhole(score.lift)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tbody className="divide-y divide-slate-800">
                {rows.map(([label, value, note]) => (
                  <tr key={label}>
                    <td className="py-2 pr-3 text-slate-300">
                      {label}
                      {note && <span className="block text-[11px] text-slate-500">{note}</span>}
                    </td>
                    <td className="py-2 text-right font-semibold text-white">{formatINRWhole(value)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-3 font-bold text-white">Score</td>
                  <td className="py-2 text-right font-extrabold text-white">{formatINRWhole(score.lift)}</td>
                </tr>
              </tbody>
            </table>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-black/20 border border-slate-800 p-2.5">
                <div className="stat-label !text-[0.62rem]">Incentive spent</div>
                <div className="mt-1 font-display text-lg font-semibold text-brand-200">{formatINRWhole(score.incentive_spent)}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-slate-800 p-2.5">
                <div className="stat-label !text-[0.62rem]">Return</div>
                <div className="mt-1 font-display text-lg font-semibold text-brand-200">{score.roi === null ? '—' : `${score.roi.toFixed(1)}×`}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-slate-800 p-2.5">
                <div className="stat-label !text-[0.62rem]">Lost for good</div>
                <div className="mt-1 font-display text-lg font-semibold text-brand-200">{formatINRWhole(score.lost)}</div>
              </div>
            </div>

            {ranked ? (
              submitted ? (
                <p className="text-xs text-emerald-300">Your score is on this week's leaderboard.</p>
              ) : (
                <form onSubmit={submit} className="space-y-2">
                  <label className="block text-xs text-slate-400" htmlFor="nick">Nickname for the leaderboard</label>
                  <div className="flex gap-2">
                    <input
                      id="nick"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      minLength={2}
                      maxLength={24}
                      required
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={submitting || nickname.trim().length < 2}
                      className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" /> Submit
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">Letters, numbers, spaces, dots, dashes and underscores.</p>
                  {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                </form>
              )
            ) : (
              <p className="text-xs text-slate-400">The Classic demo is practice and isn't ranked. Try a live scenario to compete.</p>
            )}

            <button
              onClick={onPlayAgain}
              className="btn-primary w-full px-4 py-2.5 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Play again
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <LeaderboardTable
              key={state.leaderboard_entry_id ?? 'none'}
              scenarios={scenarios}
              initialScenario={state.scenario.key}
              highlightEntryId={state.leaderboard_entry_id}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
};
