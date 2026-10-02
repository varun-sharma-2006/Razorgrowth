import React, { useEffect, useState } from 'react';
import { XCircle, Sparkles, ShieldCheck, UserCheck, CheckCircle2, TrendingUp } from 'lucide-react';

const EVENTS = [
  {
    icon: <XCircle className="w-4 h-4" />, tone: 'text-rose-300 bg-rose-400/10 border-rose-400/30',
    title: 'Payment failed', meta: 'UPI timeout · Rohan V.', amount: '₹2,499', amountTone: 'text-rose-300'
  },
  {
    icon: <Sparkles className="w-4 h-4" />, tone: 'text-brand-200 bg-brand-500/15 border-brand-500/35',
    title: 'Agent proposes a campaign', meta: '9 recovery links · ₹800 incentive', amount: '87%', amountTone: 'text-brand-200'
  },
  {
    icon: <ShieldCheck className="w-4 h-4" />, tone: 'text-aqua-200 bg-aqua-400/10 border-aqua-400/30',
    title: 'Policy check passed', meta: '₹800 ≤ ₹1,000 cap · wallet OK', amount: '6/6', amountTone: 'text-aqua-200'
  },
  {
    icon: <UserCheck className="w-4 h-4" />, tone: 'text-slate-100 bg-white/[0.06] border-white/15',
    title: 'You approved', meta: 'Links sent via Razorpay', amount: 'ref ✓', amountTone: 'text-slate-300'
  },
  {
    icon: <CheckCircle2 className="w-4 h-4" />, tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30',
    title: 'Customer paid', meta: 'Rohan V. · recovery link', amount: '+₹2,244', amountTone: 'text-emerald-300'
  }
];

const STEP_MS = 1400;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Decorative, looping story of one recovery. Purely illustrative (hidden from screen readers). */
export const RecoveryFeed: React.FC = () => {
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(reduced ? EVENTS.length : 1);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => {
      if (shown < EVENTS.length) setShown(shown + 1);
      else {
        setShown(1);
        setCycle(c => c + 1);
      }
    }, shown < EVENTS.length ? STEP_MS : STEP_MS * 3);
    return () => window.clearTimeout(t);
  }, [shown, reduced]);

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[440px]">
      <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-brand-600/30 via-brand-500/10 to-aqua-400/20 blur-3xl" />

      <div className="relative glass-card rounded-3xl p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping-soft" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            Live recovery feed
          </div>
          <span className="font-mono text-xs text-slate-500">Day 2 · 14:00</span>
        </div>

        <ul key={cycle} className="space-y-2.5 min-h-[318px]">
          {EVENTS.slice(0, shown).map(e => (
            <li key={e.title} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-black/25 px-3 py-2.5 animate-feed-in">
              <span className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center ${e.tone}`}>{e.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100 truncate">{e.title}</div>
                <div className="text-xs text-slate-500 truncate">{e.meta}</div>
              </div>
              <span className={`font-mono text-sm font-semibold ${e.amountTone}`}>{e.amount}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative ml-auto -mt-3 mr-2 sm:-mr-6 w-fit glass-card rounded-2xl px-4 py-3 animate-float-y">
        <div className="flex items-center gap-1.5 text-xs text-slate-400"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Score this week</div>
        <div className="metric-value text-2xl mt-0.5">+₹15,193</div>
      </div>
    </div>
  );
};
