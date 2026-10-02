import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';

interface AdminKeyPromptProps {
  onSubmit: (key: string) => void;
}

export const AdminKeyPrompt: React.FC<AdminKeyPromptProps> = ({ onSubmit }) => {
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-slate-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base">Merchant Admin Sign-in</h2>
            <p className="text-xs text-slate-400">This backend requires its admin API key.</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-300">Admin API key</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            placeholder="ADMIN_API_KEY from the backend .env"
          />
        </label>
        <p className="text-[11px] text-slate-500">Kept only in this browser tab's session storage.</p>
        <button
          type="submit"
          disabled={!value.trim()}
          className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
};
