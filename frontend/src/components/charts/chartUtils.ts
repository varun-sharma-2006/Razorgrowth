import { useEffect, useRef, useState } from 'react';

/** Chart tokens (dark surface). Validated with the dataviz palette checker against #0f172a. */
export const CHART = {
  surface: '#0f172a',
  grid: '#1e293b',
  axis: '#334155',
  muted: '#94a3b8',
  text: '#e2e8f0',
  series: ['#3987e5', '#d95926', '#199e70'] // categorical slots 1–3, fixed order
};

/** Round axis ticks: 0, 2K, 4K … */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Tracks an element's rendered width so SVG charts stay crisp at any size. */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
