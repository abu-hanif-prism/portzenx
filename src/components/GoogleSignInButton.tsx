import { useEffect, useRef } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: GoogleCredentialResponse) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface Props {
  onCredential: (idToken: string) => void;
}

export function GoogleSignInButton({ onCredential }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    function render() {
      if (cancelled || !window.google || !ref.current) return;
      window.google!.accounts.id.initialize({
        client_id: clientId!,
        callback: (resp) => onCredential(resp.credential),
      });
      // Measure the nearest containing block, not ref.current itself — on
      // first render (esp. mobile, before webfonts/layout settle) offsetWidth
      // can briefly read wider than the actual viewport, which then renders
      // an oversized Google button (esp. the "Continue as <account>" variant
      // shown when already signed in) that pushes the whole page wider.
      const available = ref.current.parentElement?.clientWidth || ref.current.offsetWidth || 320;
      window.google!.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: Math.max(200, Math.min(available, 400)),
        text: 'continue_with',
      });
    }

    if (window.google) {
      render();
    } else {
      pollTimer = setInterval(() => {
        if (window.google) { clearInterval(pollTimer); render(); }
      }, 200);
    }

    return () => { cancelled = true; if (pollTimer) clearInterval(pollTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div
      ref={ref}
      className="w-full min-w-0 max-w-full overflow-hidden [&>div]:!max-w-full [&_iframe]:!max-w-full"
    />
  );
}
