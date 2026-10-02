import { useEffect, useRef, useState } from 'react';

/** Chart tokens on the shared ink surface. Series validated with the dataviz palette checker
 * against #11131c (lightness band, chroma, CVD separation, contrast). Gold and blue mirror the
 * Algo Trade Simulator's strategy vs buy-and-hold lines. */
export const CHART = {
  surface: '#11131c',
  grid: '#1f2028',
  axis: '#33322f',
  muted: '#7a756c',
  text: '#eee8dc',
  series: ['#b8883c', '#5b8fe6', '#d95f72'] // categorical slots 1–3, fixed order
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
