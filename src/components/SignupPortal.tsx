import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Globe, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { functionErrorMessage, supabase } from '../lib/supabase';

interface SignupResult {
  magicLink: string;
  siteUrl: string;
  subdomain: string;
  expiresAt: string;
}

type Plan = 'trial' | 'six_months' | 'one_year';

const PLAN_INFO: Record<Plan, { label: string; price: string }> = {
  trial: { label: 'Trial', price: 'Free for 7 days' },
  six_months: { label: 'Six Months', price: '৳300' },
  one_year: { label: 'One Year', price: '৳500' },
};

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function subdomainError(s: string): string | null {
  if (!s) return null;
  if (s.length < 3) return 'At least 3 characters';
  if (s.length > 30) return 'Max 30 characters';
  if (!SUBDOMAIN_RE.test(s)) return 'Letters, numbers, hyphens only — no leading/trailing hyphen';
  return null;
}

export function SignupPortal() {
  const { session, profile, loading: authLoading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('template') ?? 'photographer-red';
  const planParam = params.get('plan');
  const plan: Plan = planParam === 'six_months' || planParam === 'one_year' ? planParam : 'trial';

  const [subdomain, setSubdomainRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [subStatus, setSubStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session || !profile) {
      const redirect = `/start${window.location.search}`;
      window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
    }
  }, [authLoading, session, profile]);

  function setSubdomain(raw: string) {
    const value = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomainRaw(value);
    setError('');

    setSubStatus('idle');
    if (checkTimer.current) clearTimeout(checkTimer.current);

    const formatErr = subdomainError(value);
    if (formatErr || !value) return;

    setSubStatus('checking');
    checkTimer.current = setTimeout(async () => {
      const { data, error: fnErr } = await supabase.functions.invoke('check-subdomain', {
        body: { subdomain: value },
      });
      if (fnErr || !data) { setSubStatus('idle'); return; }
      setSubStatus(data.available ? 'available' : 'taken');
    }, 500);
  }

  useEffect(() => () => { if (checkTimer.current) clearTimeout(checkTimer.current); }, []);

  function formErrors(): string[] {
    const errs: string[] = [];
    const fmtErr = subdomainError(subdomain);
    if (fmtErr) errs.push(fmtErr);
    if (subStatus === 'checking') errs.push('Wait for subdomain check to finish');
    if (subStatus === 'taken') errs.push('That subdomain is already taken');
    return errs;
  }

  function formValid() {
    return subdomain.length > 0 && formErrors().length === 0 && subStatus === 'available';
  }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      if (plan === 'trial') {
        const { data, error: fnErr } = await supabase.functions.invoke('signup', {
          body: { subdomain, templateId },
        });

        if (fnErr) throw new Error(await functionErrorMessage(fnErr));
        if (data?.error) throw new Error(data.error as string);
        if (!data?.magicLink) throw new Error('Something went wrong. Please try again.');

        setResult(data as SignupResult);
      } else {
        const { data, error: fnErr } = await supabase.functions.invoke('create-checkout', {
          body: { subdomain, templateId, plan },
        });

        if (fnErr) throw new Error(await functionErrorMessage(fnErr));
        if (data?.error) throw new Error(data.error as string);
        if (!data?.gatewayUrl) throw new Error('Could not start checkout. Please try again.');

        window.location.href = data.gatewayUrl as string;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!result) return;
    void navigator.clipboard.writeText(result.magicLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (authLoading || !session || !profile) {
    return (
      <section className="mx-auto flex max-w-2xl justify-center px-4 pb-24 pt-24 sm:px-7">
        <Loader2 size={22} className="animate-spin text-forest/40" />
      </section>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
        <div className="rounded-[20px] border border-line bg-panel p-6 text-center shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-forest to-primary shadow-glow">
            <Check size={26} className="text-panel" />
          </div>
          <h1 className="font-display text-3xl font-bold text-forest">You're all set!</h1>
          <p className="mt-2 text-sm text-forest/60">
            Your portfolio is ready. Open your edit link to fill it in, or find it anytime in your dashboard.
          </p>

          <div className="mt-7 rounded-2xl border border-primary/40 bg-primary/8 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Your edit link</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 break-all font-mono text-xs text-forest">{result.magicLink}</span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-forest/65 transition hover:border-primary/70 hover:text-forest"
              >
                {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-forest/45">Expires in 24 hours — you can always get a fresh one from your dashboard.</p>
          </div>

          <div className="mt-3 rounded-2xl border border-line bg-ink/50 p-4 text-left">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-forest/50">Your portfolio address</p>
            <p className="font-mono text-sm font-semibold text-forest">{result.siteUrl}</p>
            <p className="mt-1 text-xs text-forest/40">Goes live after the admin activates your subdomain.</p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a
              href={result.magicLink}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 py-3.5 text-sm font-semibold text-panel transition hover:brightness-110"
            >
              <Sparkles size={16} />
              Start editing now
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest"
            >
              <ExternalLink size={16} />
              Go to dashboard
            </a>
          </div>
        </div>
      </section>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────────
  return (
    <section className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
      <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
        <ArrowLeft size={16} />
        Back to homepage
      </a>

      <div className="rounded-[20px] border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          {PLAN_INFO[plan].label} plan — {PLAN_INFO[plan].price}
        </div>

        <h1 className="font-display text-3xl font-bold text-forest">Choose your address</h1>
        <p className="mt-2 text-sm text-forest/60">Signed in as {profile.name} ({profile.phone}). Pick a subdomain for your portfolio.</p>

        <div className="mt-7 grid gap-3 [&>*]:min-w-0">
          <div>
            <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
              <span className="flex items-center gap-2 border-r border-line bg-ink/80 px-3 text-sm text-forest/40">
                <Globe size={15} />
              </span>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="yourname"
                autoComplete="off"
                className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-forest outline-none placeholder:text-forest/35"
              />
              <span className="flex items-center px-3 text-sm font-medium text-forest/35">.portzenx.com</span>
            </div>

            {subdomain.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {subStatus === 'checking' && <Loader2 size={12} className="animate-spin text-forest/50" />}
                {subStatus === 'available' && <Check size={12} className="text-emerald-500" />}
                {subStatus === 'taken' && <span className="text-red-500">✕</span>}
                <span className={
                  subStatus === 'available' ? 'text-emerald-600'
                    : subStatus === 'taken' ? 'text-red-500'
                      : 'text-forest/45'
                }>
                  {subStatus === 'checking' && 'Checking availability…'}
                  {subStatus === 'available' && `${subdomain}.portzenx.com is available!`}
                  {subStatus === 'taken' && 'That subdomain is already taken.'}
                  {subStatus === 'idle' && subdomainError(subdomain)}
                </span>
              </div>
            )}
          </div>

          {error && <ErrorBanner message={error} />}

          {!formValid() && subdomain && (
            <ul className="space-y-1">
              {formErrors().map((e) => (
                <li key={e} className="flex items-center gap-1.5 text-xs text-amber-600">
                  <span>›</span>{e}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!formValid() || loading}
            className={[
              'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-panel transition',
              formValid() && !loading
                ? 'bg-gradient-to-br from-forest to-primary hover:brightness-110 cursor-pointer'
                : 'bg-forest/30 cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading
              ? plan === 'trial' ? 'Creating your portfolio…' : 'Starting checkout…'
              : plan === 'trial' ? 'Create My Portfolio' : 'Continue to Payment'}
          </button>
        </div>

        <p className="mt-5 text-xs text-forest/40">
          By creating a portfolio you agree to our terms.{' '}
          {plan === 'trial'
            ? 'Trial portfolios are active for 7 days.'
            : "You'll be redirected to our payment partner (SSLCommerz sandbox) to complete payment."}
        </p>
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      {message}
    </div>
  );
}
