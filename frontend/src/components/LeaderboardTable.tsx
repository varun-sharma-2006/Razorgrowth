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
        <div>
          <span className="eyebrow">This week{board ? ` · ${board.season}` : ''}</span>
          <h3 className="flex items-center gap-2 font-display text-[1.3rem] font-semibold text-slate-100 mt-1">
            <Trophy className="w-5 h-5 text-gold-400" />
            Leaderboard
          </h3>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Scenario">
          {ranked.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={s.key === scenario}
              onClick={() => setScenario(s.key)}
              className="chip !text-xs"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead className="text-slate-500 uppercase tracking-[0.14em] text-[0.68rem] border-b border-gold-500/25">
            <tr>
              <th className="py-2 pr-3 font-semibold w-10">#</th>
              <th className="py-2 pr-3 font-semibold">Player</th>
              <th className="py-2 pr-3 font-semibold text-right">Score (lift)</th>
              {!compact && <th className="py-2 pr-3 font-semibold text-right">Incentive spent</th>}
              {!compact && <th className="py-2 pr-3 font-semibold text-right">ROI</th>}
              {!compact && <th className="py-2 font-semibold text-right">Approved / Rejected</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {rows.length === 0 && !error && (
              <tr><td colSpan={6} className="py-4 text-slate-500">No scores yet this week. Be the first.</td></tr>
            )}
            {[...rows, ...(youOutsideTop ? [board!.you!] : [])].map(e => (
              <tr key={e.id} className={`transition hover:bg-gold-500/[0.06] ${e.id === highlightEntryId ? 'bg-gold-500/10' : ''}`}>
                <td className="py-2 pr-3 text-slate-400">{e.rank}</td>
                <td className="py-2 pr-3 font-semibold text-white">
                  {e.nickname}{e.id === highlightEntryId && <span className="ml-1.5 text-[10px] text-gold-300">(you)</span>}
                </td>
                <td className="py-2 pr-3 text-right font-semibold text-gold-200">{formatINRWhole(e.score)}</td>
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
