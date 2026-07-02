import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Sparkles, XCircle } from 'lucide-react';

interface StatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  siteUrl?: string;
  magicLink?: string | null;
}

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 2000;

export function CheckoutResult() {
  const params = new URLSearchParams(window.location.search);
  const tranId = params.get('tran_id');
  const redirectStatus = params.get('status'); // success | fail | cancel — from SSLCommerz's own redirect

  const [data, setData] = useState<StatusResponse | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Direct fetch against the function URL, since it needs a query string (GET) —
  // supabase-js's functions.invoke() always POSTs.
  useEffect(() => {
    if (!tranId || redirectStatus !== 'success') return;
    let cancelled = false;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    async function check() {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/checkout-status?tran_id=${encodeURIComponent(tranId!)}`, {
          headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        });
        const body = await res.json() as StatusResponse & { error?: string };
        if (cancelled) return;
        if (body.error) { setError(body.error); return; }
        setData(body);
        if (body.status === 'pending' && attempts < MAX_POLLS) {
          setTimeout(() => setAttempts((a) => a + 1), POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setError('Could not check payment status. Please refresh this page.');
      }
    }
    void check();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tranId, redirectStatus, attempts]);

  function copyLink() {
    if (!data?.magicLink) return;
    void navigator.clipboard.writeText(data.magicLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!tranId) {
    return (
      <Wrap>
        <Icon><XCircle size={26} className="text-red-500" /></Icon>
        <h1 className="font-display text-2xl font-bold text-forest">Missing order reference</h1>
        <p className="mt-2 text-sm text-forest/60">This page needs a valid checkout link.</p>
      </Wrap>
    );
  }

  if (redirectStatus === 'fail' || redirectStatus === 'cancel') {
    return (
      <Wrap>
        <Icon><XCircle size={26} className="text-red-500" /></Icon>
        <h1 className="font-display text-2xl font-bold text-forest">
          {redirectStatus === 'cancel' ? 'Payment cancelled' : 'Payment failed'}
        </h1>
        <p className="mt-2 text-sm text-forest/60">No charge was made. You can try again anytime.</p>
        <a
          href="/pricing"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 py-3 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          Back to pricing
        </a>
      </Wrap>
    );
  }

  if (error) {
    return (
      <Wrap>
        <Icon><XCircle size={26} className="text-red-500" /></Icon>
        <h1 className="font-display text-2xl font-bold text-forest">Something went wrong</h1>
        <p className="mt-2 text-sm text-forest/60">{error}</p>
      </Wrap>
    );
  }

  if (!data || data.status === 'pending') {
    const stillWaiting = attempts >= MAX_POLLS;
    return (
      <Wrap>
        <Icon><Loader2 size={26} className="animate-spin text-primary" /></Icon>
        <h1 className="font-display text-2xl font-bold text-forest">Confirming your payment…</h1>
        <p className="mt-2 text-sm text-forest/60">
          {stillWaiting
            ? "This is taking longer than expected. If you were charged, contact us on WhatsApp with your transaction ID and we'll sort it out."
            : "Hang tight — we're confirming with the payment gateway."}
        </p>
        {stillWaiting && (
          <p className="mt-3 font-mono text-xs text-forest/40">tran_id: {tranId}</p>
        )}
      </Wrap>
    );
  }

  if (data.status === 'failed' || data.status === 'cancelled') {
    return (
      <Wrap>
        <Icon><XCircle size={26} className="text-red-500" /></Icon>
        <h1 className="font-display text-2xl font-bold text-forest">Payment not completed</h1>
        <p className="mt-2 text-sm text-forest/60">No account was created. No charge should have been made.</p>
        <a
          href="/pricing"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 py-3 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          Back to pricing
        </a>
      </Wrap>
    );
  }

  // status === 'paid'
  return (
    <Wrap>
      <Icon><Check size={26} className="text-panel" /></Icon>
      <h1 className="font-display text-3xl font-bold text-forest">Payment confirmed!</h1>
      <p className="mt-2 text-sm text-forest/60">Your portfolio is ready. Open your edit link to fill it in.</p>

      {data.magicLink && (
        <div className="mt-7 rounded-2xl border border-primary/40 bg-primary/8 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Your edit link</p>
          <div className="flex items-center gap-2">
            <span className="flex-1 break-all font-mono text-xs text-forest">{data.magicLink}</span>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-forest/65 transition hover:border-primary/70 hover:text-forest"
            >
              {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-forest/45">Expires in 24 hours — save it or bookmark it now.</p>
        </div>
      )}

      {data.siteUrl && (
        <div className="mt-3 rounded-2xl border border-line bg-ink/50 p-4 text-left">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-forest/50">Your portfolio address</p>
          <p className="font-mono text-sm font-semibold text-forest">{data.siteUrl}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {data.magicLink && (
          <a
            href={data.magicLink}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 py-3.5 text-sm font-semibold text-panel transition hover:brightness-110"
          >
            <Sparkles size={16} />
            Start editing now
          </a>
        )}
        {data.siteUrl && (
          <a
            href={data.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest"
          >
            <ExternalLink size={16} />
            View site
          </a>
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
      <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
        <ArrowLeft size={16} />
        Back to homepage
      </a>
      <div className="rounded-[20px] border border-line bg-panel p-6 text-center shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
        {children}
      </div>
    </section>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-forest to-primary shadow-glow">
      {children}
    </div>
  );
}
