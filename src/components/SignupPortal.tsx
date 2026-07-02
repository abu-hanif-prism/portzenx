import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Copy, ExternalLink,
  Loader2, Sparkles, User, Globe, Mail, ShieldCheck,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { functionErrorMessage, supabase } from '../lib/supabase';

interface SignupForm {
  name: string;
  email: string;
  subdomain: string;
}

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
  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('template') ?? 'photographer-red';
  const planParam = params.get('plan');
  const plan: Plan = planParam === 'six_months' || planParam === 'one_year' ? planParam : 'trial';

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<SignupForm>({ name: '', email: '', subdomain: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Email OTP verification (step 2)
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Google sign-in — an alternate way to satisfy the same "verified email"
  // gate the manual OTP flow uses, without spending an OTP send.
  const [googleVerified, setGoogleVerified] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Debounced subdomain availability check
  const [subStatus, setSubStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(field: keyof SignupForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  function setSubdomain(raw: string) {
    const value = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    set('subdomain', value);

    setSubStatus('idle');
    if (checkTimer.current) clearTimeout(checkTimer.current);

    const formatErr = subdomainError(value);
    if (formatErr || !value) return;

    setSubStatus('checking');
    checkTimer.current = setTimeout(async () => {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('subdomain', value);
      setSubStatus(count && count > 0 ? 'taken' : 'available');
    }, 500);
  }

  useEffect(() => () => { if (checkTimer.current) clearTimeout(checkTimer.current); }, []);

  function step1Errors(): string[] {
    const errs: string[] = [];
    if (form.name.trim().length <= 1) errs.push('Enter your full name');
    if (!form.email.includes('@')) errs.push('Enter a valid email address');
    if (subdomainError(form.subdomain)) errs.push(subdomainError(form.subdomain)!);
    if (subStatus === 'checking') errs.push('Wait for subdomain check to finish');
    if (subStatus === 'taken') errs.push('That subdomain is already taken');
    if (subStatus === 'idle' && !subdomainError(form.subdomain) && form.subdomain.length >= 3) errs.push('Wait for subdomain check');
    return errs;
  }

  function step1Valid() {
    return step1Errors().length === 0;
  }

  async function handleGoogleCredential(idToken: string) {
    setError('');
    setGoogleLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-google-token', {
        body: { idToken },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error as string);
      setForm((prev) => ({ ...prev, email: data.email as string, name: prev.name || (data.name as string) || '' }));
      setGoogleVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function primaryAction() {
    if (googleVerified) await submit();
    else await goToVerify();
  }

  async function goToVerify() {
    if (!step1Valid()) return;
    setOtpError('');
    setOtpSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-otp', {
        body: { email: form.email.trim() },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error as string);
      setStep(2);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setOtpSending(false);
    }
  }

  async function resendOtp() {
    setOtpError('');
    setOtpSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-otp', {
        body: { email: form.email.trim() },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error as string);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return;
    setOtpError('');
    setOtpVerifying(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('verify-otp', {
        body: { email: form.email.trim(), code: otp },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error as string);
      await submit();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
      setOtpVerifying(false);
    }
  }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      if (plan === 'trial') {
        const { data, error: fnErr } = await supabase.functions.invoke('signup', {
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            subdomain: form.subdomain,
            templateId,
          },
        });

        if (fnErr) throw new Error(await functionErrorMessage(fnErr));
        if (data?.error) throw new Error(data.error as string);
        if (!data?.magicLink) throw new Error('Something went wrong. Please try again.');

        setResult(data as SignupResult);
      } else {
        const { data, error: fnErr } = await supabase.functions.invoke('create-checkout', {
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            subdomain: form.subdomain,
            templateId,
            plan,
          },
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
      setOtpVerifying(false);
    }
  }

  function copyLink() {
    if (!result) return;
    void navigator.clipboard.writeText(result.magicLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            Your portfolio is ready. Open your edit link to fill it in.
          </p>

          {/* Edit link */}
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
            <p className="mt-2 text-xs text-forest/45">Expires in 24 hours — save it or bookmark it now. This is the only way to edit your portfolio, so don't lose it.</p>
          </div>

          {/* Site URL */}
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
              href={result.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest"
            >
              <ExternalLink size={16} />
              View site
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
        {/* Plan badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
          {PLAN_INFO[plan].label} plan — {PLAN_INFO[plan].price}
        </div>

        {/* Step indicator */}
        <div className="mb-7 flex items-center gap-3">
          <StepDot n={1} active={step === 1} done={step > 1} />
          <div className="h-px flex-1 bg-line" />
          <StepDot n={2} active={step === 2} done={false} />
        </div>

        {step === 1 && (
          <>
            <h1 className="font-display text-3xl font-bold text-forest">Create your portfolio</h1>
            <p className="mt-2 text-sm text-forest/60">Choose your address and tell us who you are.</p>

            <div className="mt-7 grid gap-3">
              <GoogleSignInButton onCredential={(idToken) => void handleGoogleCredential(idToken)} />
              {googleLoading && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-forest/50">
                  <Loader2 size={12} className="animate-spin" />
                  Verifying with Google…
                </p>
              )}

              <div className="my-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-forest/35">
                <div className="h-px flex-1 bg-line" />
                or continue manually
                <div className="h-px flex-1 bg-line" />
              </div>

              {/* Name */}
              <InputField
                icon={<User size={15} />}
                type="text"
                placeholder="Your full name"
                value={form.name}
                onChange={(v) => set('name', v)}
                autoComplete="name"
              />

              {/* Email */}
              {googleVerified ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-forest">
                  <Check size={15} className="shrink-0 text-emerald-500" />
                  <span className="truncate">{form.email}</span>
                  <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-600">Verified via Google</span>
                </div>
              ) : (
                <InputField
                  icon={<Mail size={15} />}
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  autoComplete="email"
                />
              )}

              {/* Subdomain */}
              <div>
                <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
                  <span className="flex items-center gap-2 border-r border-line bg-ink/80 px-3 text-sm text-forest/40">
                    <Globe size={15} />
                  </span>
                  <input
                    type="text"
                    value={form.subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="yourname"
                    autoComplete="off"
                    className="min-h-12 flex-1 bg-transparent px-3 text-sm text-forest outline-none placeholder:text-forest/35"
                  />
                  <span className="flex items-center px-3 text-sm font-medium text-forest/35">.md-hanif.xyz</span>
                </div>

                {/* Subdomain status */}
                {form.subdomain.length > 0 && (
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
                      {subStatus === 'available' && `${form.subdomain}.md-hanif.xyz is available!`}
                      {subStatus === 'taken' && 'That subdomain is already taken.'}
                      {subStatus === 'idle' && subdomainError(form.subdomain)}
                    </span>
                  </div>
                )}
              </div>

              {(error || otpError) && <ErrorBanner message={error || otpError} />}

              {!step1Valid() && (form.name || form.email || form.subdomain) && (
                <ul className="space-y-1">
                  {step1Errors().map((e) => (
                    <li key={e} className="flex items-center gap-1.5 text-xs text-amber-600">
                      <span>›</span>{e}
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => void primaryAction()}
                disabled={!step1Valid() || otpSending || loading}
                className={[
                  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-panel transition',
                  step1Valid() && !otpSending && !loading
                    ? 'bg-gradient-to-br from-forest to-primary hover:brightness-110 cursor-pointer'
                    : 'bg-forest/30 cursor-not-allowed',
                ].join(' ')}
              >
                {otpSending || loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading
                  ? plan === 'trial' ? 'Creating your portfolio…' : 'Starting checkout…'
                  : otpSending ? 'Sending code…'
                    : googleVerified ? (plan === 'trial' ? 'Create My Portfolio' : 'Continue to Payment')
                      : 'Next'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <button
              type="button"
              onClick={() => { setStep(1); setOtpError(''); }}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest/55 transition hover:text-forest"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <h1 className="font-display text-3xl font-bold text-forest">Verify your email</h1>
            <p className="mt-2 text-sm text-forest/60">
              Enter the 6-digit code sent to <span className="font-semibold text-primary">{form.email}</span>.{' '}
              {plan === 'trial'
                ? "We'll create your portfolio as soon as it's verified."
                : "We'll take you to payment as soon as it's verified."}
            </p>

            <div className="mt-7 grid gap-3">
              <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
                <span className="flex items-center border-r border-line bg-ink/80 px-3 text-forest/40">
                  <ShieldCheck size={15} />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="min-h-12 flex-1 bg-transparent px-3 text-center text-lg font-semibold tracking-[0.3em] text-forest outline-none placeholder:text-forest/25"
                />
              </div>

              {otpError && <ErrorBanner message={otpError} />}

              <button
                type="button"
                onClick={() => void verifyOtp()}
                disabled={otp.length !== 6 || otpVerifying || loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otpVerifying || loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                {loading
                  ? plan === 'trial' ? 'Creating your portfolio…' : 'Starting checkout…'
                  : otpVerifying ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <button
                type="button"
                onClick={() => void resendOtp()}
                disabled={otpSending}
                className="text-xs font-semibold text-forest/50 transition hover:text-forest"
              >
                {otpSending ? 'Sending…' : "Didn't get it? Resend code"}
              </button>
            </div>

            <p className="mt-5 text-xs text-forest/40">
              By creating a portfolio you agree to our terms.{' '}
              {plan === 'trial'
                ? 'Trial portfolios are active for 7 days.'
                : "You'll be redirected to our payment partner (SSLCommerz sandbox) to complete payment."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={[
      'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition',
      active ? 'bg-primary text-panel shadow-glow'
        : done ? 'bg-primary/20 text-primary'
          : 'bg-line/50 text-forest/40',
    ].join(' ')}>
      {done ? <Check size={13} /> : n}
    </div>
  );
}

function InputField({
  icon, type, placeholder, value, onChange, autoComplete,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
      <span className="flex items-center border-r border-line bg-ink/80 px-3 text-forest/40">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-12 flex-1 bg-transparent px-3 text-sm text-forest outline-none placeholder:text-forest/35"
      />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      {message}
    </div>
  );
}
