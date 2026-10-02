import React from 'react';

/** Headline block shared by the sign-in and new-run screens. */
export const HeroPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="space-y-6">
    <span className="eyebrow">Built for the Razorpay AI Buildathon 2026</span>
    <h1 className="font-display font-bold text-slate-50 leading-[0.98] tracking-[-0.035em] text-[clamp(2.6rem,6vw,4.8rem)]">
      Turn failed payments into <span className="text-gradient">recovered revenue.</span>
    </h1>
    <p className="text-base sm:text-lg text-slate-400 max-w-[50ch] leading-relaxed">
      Run a store for a simulated week. Your AI agent spots failed payments and proposes Razorpay recovery
      campaigns, but it can't spend a rupee without your approval, and a policy engine blocks anything unsafe.
    </p>
    {children}
  </div>
);
