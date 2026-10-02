import React from 'react';
import { ShieldCheck, KeyRound, Lock, Code2, XCircle } from 'lucide-react';
import { AuthConfig } from '../types';
import { GoogleSignIn } from './GoogleSignIn';
import { HeroPanel } from './HeroPanel';
import { LogoMark } from './LogoMark';

interface Props {
  config: AuthConfig | null;
  scenarioCount: number;
  busy: boolean;
  error: string | null;
  onCredential: (credential: string) => void;
  onDevLogin: () => void;
}

const TRUST = [
  { icon: ShieldCheck, text: 'Identity verified by Google' },
  { icon: KeyRound, text: 'No passwords or keys to create or leak' },
  { icon: Lock, text: 'Your runs stay private to your account' }
];

export const LoginPage: React.FC<Props> = ({ config, scenarioCount, busy, error, onCredential, onDevLogin }) => (
  <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-10 lg:py-14">
    <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
      <HeroPanel scenarioCount={scenarioCount} />

      <div className="space-y-4">
        <div className="glass-card rounded-[24px] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span style={{ filter: 'drop-shadow(0 8px 24px rgba(212,175,106,0.35))' }}><LogoMark size={52} /></span>
            <span className="eyebrow mt-4">Welcome</span>
            <h2 className="font-display text-[1.85rem] font-semibold text-slate-100 mt-2">Sign in to your workspace</h2>
            <p className="text-sm text-slate-400 mt-1.5">One click with your Google account. Your runs follow you to any device.</p>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            {config?.google_client_id ? (
              <GoogleSignIn clientId={config.google_client_id} onCredential={onCredential} disabled={busy} />
            ) : (
              <p className="text-sm text-amber-200 text-center">
                Google sign-in isn't configured on this server yet.
              </p>
            )}
            {config?.dev_login_enabled && (
              <button onClick={onDevLogin} disabled={busy} className="btn-ghost px-5 py-2 text-sm">
                <Code2 className="w-4 h-4" /> Continue as developer
              </button>
            )}
            {busy && <p className="text-xs text-slate-400">Signing you in…</p>}
            {error && (
              <p role="alert" className="flex items-start gap-2 text-xs text-rose-300 max-w-[320px]">
                <XCircle className="w-4 h-4 shrink-0" />{error}
              </p>
            )}
          </div>

          <div className="mt-7 flex items-center gap-3 text-[0.68rem] tracking-[0.16em] uppercase text-slate-500">
            <span className="flex-1 h-px bg-slate-800" />Why Google sign-in<span className="flex-1 h-px bg-slate-800" />
          </div>
          <ul className="mt-4 space-y-3">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-8 h-8 rounded-lg border border-slate-800 bg-white/[0.03] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-gold-400" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-500 leading-relaxed">
            Sign-in is verified by Google. When you sign in, your name, email address and profile photo are shared
            with this app so it can save your runs and show your name on the leaderboard. Nothing else in your
            Google account is accessed. <a href="/privacy.html" className="text-gold-300 underline underline-offset-2 hover:text-white">Privacy policy</a>
          </p>
        </div>
        <p className="text-center text-[0.68rem] tracking-[0.16em] uppercase text-slate-500">
          Simulated customers · demo payment gateway
        </p>
      </div>
    </section>
  </div>
);
