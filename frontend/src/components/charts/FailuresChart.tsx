import React, { useMemo, useState } from 'react';
import { ScenarioEvent, TickStat } from '../../types';
import { simLabel } from '../../utils/format';
import { CHART, niceTicks, useElementWidth } from './chartUtils';

interface Props {
  series: TickStat[];
  runTicks: number;
  events: ScenarioEvent[];
}

const BUCKET = 6; // hours per column
const METHODS = [
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'netbanking', label: 'Netbanking' }
];
const PLOT_H = 150;
const AXIS_H = 24;
const M = { top: 18, right: 12, left: 36 };
const GAP = 2;

/** Path for a column segment with 4px rounded data-end (top) and a square base. */
function roundedTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export const FailuresChart: React.FC<Props> = ({ series, runTicks, events }) => {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [eventHover, setEventHover] = useState<ScenarioEvent | null>(null);

  const buckets = useMemo(() => {
    const out = Array.from({ length: Math.ceil(runTicks / BUCKET) }, (_, i) => ({
      start: i * BUCKET,
      counts: { upi: 0, card: 0, netbanking: 0 } as Record<string, number>,
      total: 0,
      filled: false
    }));
    for (const s of series) {
      const b = out[Math.floor(s.tick / BUCKET)];
      if (!b) continue;
      b.filled = true;
      for (const m of METHODS) {
        const n = s.failed_by_method?.[m.key] ?? 0;
        b.counts[m.key] += n;
        b.total += n;
      }
    }
    return out;
  }, [series, runTicks]);

  const plotW = Math.max(width - M.left - M.right, 120);
  const slot = plotW / buckets.length;
  const barW = Math.min(24, Math.max(slot - GAP, 2));
  const maxY = Math.max(5, ...buckets.map(b => b.total));
  const ticks = niceTicks(maxY, 3);
  const yMax = ticks[ticks.length - 1];
  const h = (v: number) => (v / yMax) * PLOT_H;
  const baseY = M.top + PLOT_H;
  const visibleEvents = events.filter(e => e.tick > 0);
  const hovered = hover !== null ? buckets[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-2 text-xs text-slate-300" aria-label="Legend">
        {METHODS.map((m, i) => (
          <span key={m.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: CHART.series[i] }} />
            {m.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-slate-400">
          <span className="inline-block w-0 h-0 border-x-4 border-x-transparent border-t-[6px]" style={{ borderTopColor: CHART.muted }} />
          Scenario event
        </span>
      </div>

      <div ref={wrapRef} className="relative w-full min-w-0">
        <svg
          width={width}
          height={M.top + PLOT_H + AXIS_H}
          role="img"
          aria-label={`Failed payments per ${BUCKET} hours by method. ${buckets.reduce((a, b) => a + b.total, 0)} failures so far.`}
          className="block"
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={baseY - h(t)} y2={baseY - h(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
              <text x={M.left - 8} y={baseY - h(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t}
              </text>
            </g>
          ))}
          {Array.from({ length: Math.floor(runTicks / 24) }, (_, d) => (
            <text key={d} x={M.left + (d * 24 + 12) / runTicks * plotW} y={baseY + 16} textAnchor="middle" fontSize={10} fill={CHART.muted}>
              {plotW / (runTicks / 24) < 52 ? `D${d + 1}` : `Day ${d + 1}`}
            </text>
          ))}

          {buckets.map((b, i) => {
            const bx = M.left + i * slot + (slot - barW) / 2;
            let top = baseY;
            const segs = METHODS.map((m, mi) => ({ m, mi, v: b.counts[m.key] })).filter(s => s.v > 0);
            return (
              <g
                key={b.start}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={b.filled ? 0 : -1}
                aria-label={`${simLabel(b.start)}: ${b.total} failures`}
                style={{ outline: 'none' }}
              >
                {/* Hit target: the full slot, not just the painted bar. */}
                <rect x={M.left + i * slot} y={M.top} width={slot} height={PLOT_H} fill="transparent" />
                {segs.map((s, si) => {
                  const segH = h(s.v);
                  const y0 = top - segH;
                  const isTop = si === segs.length - 1;
                  // 2px surface gap between stacked segments.
                  const drawnH = Math.max(segH - (si > 0 ? GAP : 0), 1);
                  top = y0;
                  const fill = CHART.series[s.mi];
                  const opacity = hover === null || hover === i ? 1 : 0.55;
                  return isTop ? (
                    <path key={s.m.key} d={roundedTop(bx, y0, barW, drawnH)} fill={fill} opacity={opacity} />
                  ) : (
                    <rect key={s.m.key} x={bx} y={y0} width={barW} height={drawnH} fill={fill} opacity={opacity} />
                  );
                })}
              </g>
            );
          })}

          {visibleEvents.map(e => {
            const ex = M.left + (e.tick / runTicks) * plotW;
            return (
              <g key={e.tick} onPointerEnter={() => setEventHover(e)} onPointerLeave={() => setEventHover(null)}>
                <line x1={ex} x2={ex} y1={M.top - 2} y2={baseY} stroke={CHART.muted} strokeWidth={1} opacity={0.5} />
                <path d={`M${ex - 5},${M.top - 12} L${ex + 5},${M.top - 12} L${ex},${M.top - 4} Z`} fill={CHART.muted} />
                <rect x={ex - 12} y={M.top - 16} width={24} height={20} fill="transparent" />
              </g>
            );
          })}
        </svg>

        {hovered && hovered.filled && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl"
            style={{ left: Math.min(M.left + hover! * slot + slot + 6, width - 170) }}
          >
            <div className="text-slate-400 mb-1">
              {simLabel(hovered.start)} – {String((hovered.start + BUCKET) % 24).padStart(2, '0')}:00
            </div>
            {METHODS.map((m, i) => (
              <div key={m.key} className="flex items-center gap-2 py-0.5">
                <span className="inline-block w-3 h-0.5 rounded" style={{ background: CHART.series[i] }} />
                <span className="font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{hovered.counts[m.key]}</span>
                <span className="text-slate-400">{m.label}</span>
              </div>
            ))}
            <div className="mt-1 pt-1 border-t border-slate-800 text-slate-300">
              Total <span className="font-semibold text-white">{hovered.total}</span>
            </div>
          </div>
        )}
        {eventHover && (
          <div
            className="pointer-events-none absolute -top-2 z-10 max-w-[240px] rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-xl"
            style={{ left: Math.min(M.left + (eventHover.tick / runTicks) * plotW + 10, width - 250) }}
          >
            <div className="text-slate-400">{simLabel(eventHover.tick)}</div>
            {eventHover.message}
          </div>
        )}
      </div>
    </div>
  );
};
