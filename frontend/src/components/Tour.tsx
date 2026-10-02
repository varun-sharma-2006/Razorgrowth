import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';

const TOUR_KEY = 'razorgrowth.tourDone';

const STEPS = [
  {
    title: 'Your store is live',
    text: 'Press Play to start the week. Payments stream in hour by hour and some fail: bank declines, UPI timeouts, expired cards.'
  },
  {
    title: 'Your AI agent proposes; you decide',
    text: 'Press Scan now (or turn on Auto-pilot) and the agent proposes a recovery campaign. Nothing is sent until you approve it. You can resize the incentive or skip failure types.'
  },
  {
    title: 'Spend the wallet wisely',
    text: 'You have ₹20,000 in incentives. Discounts are only spent when a customer pays, but customers who would have retried anyway still take the discount. Fresher failures convert better.'
  },
  {
    title: 'Beat doing nothing',
    text: 'Your score is the revenue you win back beyond what customers would have paid on their own. Finish the week and submit it to the leaderboard.'
  }
];

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return true;
  }
}

export const Tour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* ignore */
    }
    onDone();
  };
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="w-full max-w-md rounded-2xl border border-indigo-500/40 bg-slate-900 p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] font-semibold text-indigo-300">How to play · {step + 1} of {STEPS.length}</div>
          <button onClick={finish} aria-label="Skip tour" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <h2 id="tour-title" className="mt-1 text-lg font-bold text-white">{s.title}</h2>
        <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{s.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-indigo-400' : 'w-1.5 bg-slate-700'}`} />
            ))}
          </div>
          <button
            onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
            className="btn-primary px-4 py-2 text-sm"
          >
            {step === STEPS.length - 1 ? "Let's go" : 'Next'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
