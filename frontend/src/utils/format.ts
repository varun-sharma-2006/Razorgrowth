const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

export const formatINR = (value: number): string => inr.format(value);

export const formatINRWhole = (value: number): string => inrWhole.format(value);

/** ₹1.2L / ₹3.4K style for axes and tiles (Indian lakh/crore units). */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Tick 0 is Day 1 00:00. */
export function simLabel(tick: number): string {
  return `Day ${Math.floor(tick / 24) + 1} · ${String(tick % 24).padStart(2, '0')}:00`;
}

export const REASON_LABELS: Record<string, string> = {
  bank_decline: 'Bank decline',
  insufficient_funds: 'Insufficient funds',
  card_expired: 'Card expired',
  network_timeout: 'Network timeout'
};
