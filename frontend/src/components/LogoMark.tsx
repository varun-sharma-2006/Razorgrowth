/** RazorGrowth mark: a violet → cyan tile with a white bolt. */
export function LogoMark({ size = 40, breathe = false }: { size?: number; breathe?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={breathe ? 'logo-breathe' : undefined}>
      <defs>
        <linearGradient id="rg-logo-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9b7dff" />
          <stop offset="50%" stopColor="#6a45f5" />
          <stop offset="100%" stopColor="#22b8dc" />
        </linearGradient>
        <linearGradient id="rg-logo-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#rg-logo-fill)" />
      <rect x="2" y="2" width="44" height="22" rx="13" fill="url(#rg-logo-shine)" opacity="0.5" />
      <path d="M27 9.5 L15 26 H23 L20.5 38.5 L33 21.5 H25 Z" fill="#fff" />
    </svg>
  );
}
