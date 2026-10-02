/** Gold-framed mark in the same family as the Algo Trade Simulator logo, with RazorGrowth's bolt. */
export function LogoMark({ size = 40, breathe = false }: { size?: number; breathe?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={breathe ? 'logo-breathe' : undefined}>
      <defs>
        <linearGradient id="rg-logo-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dfa8" />
          <stop offset="55%" stopColor="#d4af6a" />
          <stop offset="100%" stopColor="#9c7535" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#0d0f16" stroke="url(#rg-logo-gold)" strokeWidth="1.5" />
      <path d="M27 9 L15 26 H23 L20.5 39 L33 21 H25 Z" fill="none" stroke="url(#rg-logo-gold)" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}
