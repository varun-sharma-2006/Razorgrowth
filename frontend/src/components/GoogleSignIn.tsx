import { useEffect, useRef, useState } from 'react';

// Minimal typing for Google Identity Services (https://developers.google.com/identity/gsi/web).
interface GoogleId {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Google sign-in. Check your connection or ad blocker."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Stops Google from silently signing the same account back in after an explicit logout. */
export function googleSignOut() {
  window.google?.accounts?.id?.disableAutoSelect();
}

interface Props {
  clientId: string;
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export function GoogleSignIn({ clientId, onCredential, disabled }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const google = window.google?.accounts?.id;
        if (cancelled || !google || !container.current) return;
        google.initialize({
          client_id: clientId,
          callback: response => callback.current(response.credential),
          auto_select: false,
          ux_mode: 'popup'
        });
        google.renderButton(container.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: 320
        });
      })
      .catch((error: Error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div aria-busy={disabled} className={`flex flex-col items-center gap-3 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Google's button is an iframe; on a dark page the browser paints it an opaque white box
          unless its host opts into the light scheme the iframe uses. */}
      <div ref={container} className="min-h-[44px]" style={{ colorScheme: 'light' }} />
      {loadError && (
        <p role="alert" className="text-xs text-rose-300 text-center">{loadError}</p>
      )}
    </div>
  );
}
