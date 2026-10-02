import React, { useMemo, useState } from 'react';
import { TickStat } from '../../types';
import { formatINRCompact, formatINRWhole, simLabel } from '../../utils/format';
import { CHART, niceTicks, useElementWidth } from './chartUtils';

interface Props {
  series: TickStat[];
  runTicks: number;
}

const PLOT_H = 220;
const AXIS_H = 26;
const M = { top: 12, right: 92, left: 52 };

/** Cumulative recovered revenue: with the agent vs what customers would have paid back anyway. */
export const RecoveryRaceChart: React.FC<Props> = ({ series, runTicks }) => {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const points = useMemo(() => {
    let withAgent = 0;
    let baseline = 0;
    return series.map(s => {
      withAgent += s.link_recovered + s.organic_recovered;
      baseline += s.baseline_recovered;
      return { tick: s.tick + 1, withAgent, baseline };
    });
  }, [series]);

  const plotW = Math.max(width - M.left - M.right, 120);
  const maxY = Math.max(1000, ...points.map(p => Math.max(p.withAgent, p.baseline)));
  const ticks = niceTicks(maxY);
  const yMax = ticks[ticks.length - 1];
  const x = (tick: number) => M.left + (tick / runTicks) * plotW;
  const y = (v: number) => M.top + PLOT_H - (v / yMax) * PLOT_H;

  const path = (key: 'withAgent' | 'baseline') =>
    points.length ? `M${x(0)},${y(0)} ` + points.map(p => `L${x(p.tick)},${y(p[key])}`).join(' ') : '';
  const area = points.length
    ? `${path('withAgent')} L${x(points[points.length - 1].tick)},${y(0)} L${x(0)},${y(0)} Z`
    : '';

  const last = points[points.length - 1];
  const hovered = hover !== null ? points[hover] : null;

  const pick = (clientX: number, rect: DOMRect) => {
    if (!points.length) return;
    const tick = ((clientX - rect.left - M.left) / plotW) * runTicks;
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(tick) - 1));
    setHover(idx);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!points.length) return;
    if (e.key === 'ArrowRight') setHover(h => Math.min(points.length - 1, (h ?? points.length - 1) + 1));
    else if (e.key === 'ArrowLeft') setHover(h => Math.max(0, (h ?? points.length - 1) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  // Direct end labels only when they don't collide; the legend always carries identity.
  const labelsFit = last && Math.abs(y(last.withAgent) - y(last.baseline)) >= 16;
  const narrow = plotW / (runTicks / 24) < 52; // shorten day labels so they never collide
  // On narrow charts the final 'End' tick would collide with the last day label, so drop it.
  const days = Array.from({ length: Math.floor(runTicks / 24) + (narrow ? 0 : 1) }, (_, i) => i * 24);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-4 text-xs text-slate-300" aria-label="Legend">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: CHART.series[0] }} />
            With RazorGrowth
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: CHART.series[1] }} />
            Without an agent (customers retrying alone)
          </span>
        </div>
        <button
          onClick={() => setShowTable(t => !t)}
          className="text-[11px] text-slate-400 hover:text-white underline-offset-2 hover:underline"
        >
          {showTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {last && Math.abs(last.withAgent - last.baseline) < 1 && !showTable && (
        <p className="mb-2 text-[11px] text-slate-500">
          The two lines overlap until your agent wins back revenue that customers wouldn't have paid on their own.
        </p>
      )}

      {showTable ? (
        <DailyTable points={points} />
      ) : (
        <div ref={wrapRef} className="relative w-full min-w-0">
          <svg
            width={width}
            height={M.top + PLOT_H + AXIS_H}
            role="img"
            aria-label={`Cumulative recovered revenue. With RazorGrowth ${formatINRWhole(last?.withAgent ?? 0)}, without an agent ${formatINRWhole(last?.baseline ?? 0)}.`}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerMove={e => pick(e.clientX, (e.currentTarget as SVGSVGElement).getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded"
          >
            {ticks.map(t => (
              <g key={t}>
                <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatINRCompact(t)}
                </text>
              </g>
            ))}
            {days.map(d => (
              <text key={d} x={x(d)} y={M.top + PLOT_H + 17} textAnchor={d === runTicks ? 'end' : 'middle'} fontSize={10} fill={CHART.muted}>
                {d === runTicks ? 'End' : narrow ? `D${d / 24 + 1}` : `Day ${d / 24 + 1}`}
              </text>
            ))}

            {area && <path d={area} fill={CHART.series[0]} opacity={0.1} />}
            <path d={path('baseline')} fill="none" stroke={CHART.series[1]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={path('withAgent')} fill="none" stroke={CHART.series[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {last && (
              <>
                {(['baseline', 'withAgent'] as const).map((k, i) => (
                  <circle key={k} cx={x(last.tick)} cy={y(last[k])} r={4} fill={CHART.series[i === 0 ? 1 : 0]} stroke={CHART.surface} strokeWidth={2} />
                ))}
                {labelsFit && (
                  <>
                    <text x={x(last.tick) + 8} y={y(last.withAgent)} dy="0.32em" fontSize={11} fontWeight={600} fill={CHART.text}>
                      {formatINRCompact(last.withAgent)}
                    </text>
                    <text x={x(last.tick) + 8} y={y(last.baseline)} dy="0.32em" fontSize={11} fill={CHART.muted}>
                      {formatINRCompact(last.baseline)}
                    </text>
                  </>
                )}
              </>
            )}

            {hovered && (
              <line x1={x(hovered.tick)} x2={x(hovered.tick)} y1={M.top} y2={M.top + PLOT_H} stroke={CHART.muted} strokeWidth={1} />
            )}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl"
              style={{ left: Math.min(x(hovered.tick) + 12, width - 190) }}
            >
              <div className="text-slate-400 mb-1">{simLabel(hovered.tick)}</div>
              <TooltipRow color={CHART.series[0]} value={formatINRWhole(hovered.withAgent)} label="With RazorGrowth" />
              <TooltipRow color={CHART.series[1]} value={formatINRWhole(hovered.baseline)} label="Without an agent" />
              <div className="mt-1 pt-1 border-t border-slate-800 text-slate-300">
                Lift <span className="font-semibold text-white">{formatINRWhole(hovered.withAgent - hovered.baseline)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TooltipRow: React.FC<{ color: string; value: string; label: string }> = ({ color, value, label }) => (
  <div className="flex items-center gap-2 py-0.5">
    <span className="inline-block w-3 h-0.5 rounded" style={{ background: color }} />
    <span className="font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    <span className="text-slate-400">{label}</span>
  </div>
);

const DailyTable: React.FC<{ points: { tick: number; withAgent: number; baseline: number }[] }> = ({ points }) => {
  const rows = points.filter(p => p.tick % 24 === 0 || p === points[points.length - 1]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="text-slate-400">
          <tr>
            <th className="py-1.5 pr-4 font-semibold">Time</th>
            <th className="py-1.5 pr-4 font-semibold text-right">With RazorGrowth</th>
            <th className="py-1.5 pr-4 font-semibold text-right">Without an agent</th>
            <th className="py-1.5 font-semibold text-right">Lift</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {rows.length === 0 && (
            <tr><td colSpan={4} className="py-3 text-slate-500">No data yet. Press Play.</td></tr>
          )}
          {rows.map(p => (
            <tr key={p.tick}>
              <td className="py-1.5 pr-4">{simLabel(p.tick)}</td>
              <td className="py-1.5 pr-4 text-right">{formatINRWhole(p.withAgent)}</td>
              <td className="py-1.5 pr-4 text-right">{formatINRWhole(p.baseline)}</td>
              <td className="py-1.5 text-right font-semibold">{formatINRWhole(p.withAgent - p.baseline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
