import React from 'react';
import { ShieldCheck, KeyRound, Lock, Code2, XCircle } from 'lucide-react';
import { AuthConfig } from '../types';
import { GoogleSignIn } from './GoogleSignIn';
import { HeroPanel } from './HeroPanel';
import { LogoMark } from './LogoMark';
import { RecoveryFeed } from './RecoveryFeed';

interface Props {
  config: AuthConfig | null;
  busy: boolean;
  error: string | null;
  onCredential: (credential: string) => void;
  onDevLogin: () => void;
}

const TRUST = [
  { icon: ShieldCheck, text: 'Verified by Google' },
  { icon: KeyRound, text: 'No passwords or keys' },
  { icon: Lock, text: 'Runs private to you' }
];

export const LoginPage: React.FC<Props> = ({ config, busy, error, onCredential, onDevLogin }) => (
  <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-6 lg:py-8">
    <div className="flex items-center gap-2.5">
      <LogoMark size={36} />
      <span className="font-display text-xl font-bold tracking-tight text-slate-50">RazorGrowth</span>
    </div>

    <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-14 lg:gap-12 items-center py-10 lg:py-16">
      <HeroPanel>
        <div className="glass-card rounded-2xl p-5 max-w-[460px] space-y-4">
          <div>
            <div className="font-display text-lg font-bold text-slate-50">Sign in to start your week</div>
            <div className="text-sm text-slate-400">Your runs are saved to your Google account and follow you to any device.</div>
          </div>
          <div className="flex flex-col items-start gap-3">
            {config?.google_client_id ? (
              <GoogleSignIn clientId={config.google_client_id} onCredential={onCredential} disabled={busy} />
            ) : (
              <p className="text-sm text-amber-200">Google sign-in isn't configured on this server yet.</p>
            )}
            {config?.dev_login_enabled && (
              <button onClick={onDevLogin} disabled={busy} className="btn-ghost px-4 py-2 text-sm">
                <Code2 className="w-4 h-4" /> Continue as developer
              </button>
            )}
            {busy && <p className="text-xs text-slate-400">Signing you in…</p>}
            {error && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-300">
                <XCircle className="w-4 h-4 shrink-0" />{error}
              </p>
            )}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Icon className="w-3.5 h-3.5 text-aqua-300" />{text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500 max-w-[460px] leading-relaxed">
          Google shares your name, email address and profile photo so we can save your runs and show your name on
          the leaderboard. Nothing else in your Google account is accessed.{' '}
          <a href="/privacy.html" className="text-brand-300 underline underline-offset-2 hover:text-white">Privacy policy</a>
        </p>
      </HeroPanel>

      <RecoveryFeed />
    </section>
  </div>
);
