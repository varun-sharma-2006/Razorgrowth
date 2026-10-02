import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api, errorMessage } from '../services/api';
import { Leaderboard, Scenario } from '../types';
import { formatINRWhole } from '../utils/format';

interface Props {
  scenarios: Scenario[];
  initialScenario?: string;
  highlightEntryId?: string | null;
  compact?: boolean;
}

export const LeaderboardTable: React.FC<Props> = ({ scenarios, initialScenario, highlightEntryId, compact }) => {
  const ranked = scenarios.filter(s => s.ranked);
  const [scenario, setScenario] = useState(initialScenario && ranked.some(s => s.key === initialScenario) ? initialScenario : ranked[0]?.key);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    api.getLeaderboard(scenario, highlightEntryId)
      .then(b => { if (!cancelled) { setBoard(b); setError(null); } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [scenario, highlightEntryId]);

  const rows = board?.entries ?? [];
  const youOutsideTop = board?.you && !rows.some(r => r.id === board.you!.id);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Trophy className="w-4 h-4 text-amber-400" />
          Weekly leaderboard {board && <span className="font-normal text-slate-500">· {board.season}</span>}
        </h3>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Scenario">
          {ranked.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={s.key === scenario}
              onClick={() => setScenario(s.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                s.key === scenario ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead className="text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-2 pr-3 font-semibold w-10">#</th>
              <th className="py-2 pr-3 font-semibold">Player</th>
              <th className="py-2 pr-3 font-semibold text-right">Score (lift)</th>
              {!compact && <th className="py-2 pr-3 font-semibold text-right">Incentive spent</th>}
              {!compact && <th className="py-2 pr-3 font-semibold text-right">ROI</th>}
              {!compact && <th className="py-2 font-semibold text-right">Approved / Rejected</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-slate-200">
            {rows.length === 0 && !error && (
              <tr><td colSpan={6} className="py-4 text-slate-500">No scores yet this week. Be the first.</td></tr>
            )}
            {[...rows, ...(youOutsideTop ? [board!.you!] : [])].map(e => (
              <tr key={e.id} className={e.id === highlightEntryId ? 'bg-indigo-500/10' : ''}>
                <td className="py-2 pr-3 text-slate-400">{e.rank}</td>
                <td className="py-2 pr-3 font-semibold text-white">
                  {e.nickname}{e.id === highlightEntryId && <span className="ml-1.5 text-[10px] text-indigo-300">(you)</span>}
                </td>
                <td className="py-2 pr-3 text-right font-semibold">{formatINRWhole(e.score)}</td>
                {!compact && <td className="py-2 pr-3 text-right text-slate-400">{formatINRWhole(e.incentive_spent)}</td>}
                {!compact && <td className="py-2 pr-3 text-right text-slate-400">{e.incentive_spent ? `${e.roi.toFixed(1)}×` : '—'}</td>}
                {!compact && <td className="py-2 text-right text-slate-400">{e.approvals} / {e.rejections}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
