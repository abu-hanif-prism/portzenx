import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Copy, ExternalLink,
  Eye, EyeOff, Loader2, Sparkles, User, Globe, Lock, Mail,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SignupForm {
  name: string;
  email: string;
  subdomain: string;
  password: string;
  confirmPassword: string;
}

interface SignupResult {
  magicLink: string;
  siteUrl: string;
  subdomain: string;
  expiresAt: string;
}

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function subdomainError(s: string): string | null {
  if (!s) return null;
  if (s.length < 3) return 'At least 3 characters';
  if (s.length > 30) return 'Max 30 characters';
  if (!SUBDOMAIN_RE.test(s)) return 'Letters, numbers, hyphens only — no leading/trailing hyphen';
  return null;
}

export function SignupPortal() {
  const templateId = new URLSearchParams(window.location.search).get('template') ?? 'photographer-red';

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<SignupForm>({ name: '', email: '', subdomain: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

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

  function step1Valid() {
    return form.name.trim().length > 1
      && form.email.includes('@')
      && !subdomainError(form.subdomain)
      && subStatus === 'available';
  }

  function step2Valid() {
    return form.password.length >= 8 && form.password === form.confirmPassword;
  }

  async function submit() {
    setError('');
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('signup', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          subdomain: form.subdomain,
          password: form.password,
          templateId,
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error as string);
      if (!data?.magicLink) throw new Error('Something went wrong. Please try again.');

      setResult(data as SignupResult);
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
            <p className="mt-2 text-xs text-forest/45">Expires in 24 hours — save it or bookmark it now.</p>
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
        {/* Step indicator */}
        <div className="mb-7 flex items-center gap-3">
          <StepDot n={1} active={step === 1} done={step > 1} />
          <div className="h-px flex-1 bg-line" />
          <StepDot n={2} active={step === 2} done={false} />
        </div>

        {step === 1 ? (
          <>
            <h1 className="font-display text-3xl font-bold text-forest">Create your portfolio</h1>
            <p className="mt-2 text-sm text-forest/60">Choose your address and tell us who you are.</p>

            <div className="mt-7 grid gap-3">
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
              <InputField
                icon={<Mail size={15} />}
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(v) => set('email', v)}
                autoComplete="email"
              />

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

              {error && <ErrorBanner message={error} />}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest/55 transition hover:text-forest"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <h1 className="font-display text-3xl font-bold text-forest">Set your password</h1>
            <p className="mt-2 text-sm text-forest/60">
              You'll use <span className="font-semibold text-primary">{form.subdomain}</span> + this password to get your edit link anytime.
            </p>

            <div className="mt-7 grid gap-3">
              <PasswordField
                placeholder="Password (min 8 characters)"
                value={form.password}
                onChange={(v) => set('password', v)}
                show={showPw}
                onToggleShow={() => setShowPw(!showPw)}
                autoComplete="new-password"
              />
              <PasswordField
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChange={(v) => set('confirmPassword', v)}
                show={showPw}
                onToggleShow={() => setShowPw(!showPw)}
                autoComplete="new-password"
              />

              {form.confirmPassword.length > 0 && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match.</p>
              )}

              {error && <ErrorBanner message={error} />}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={!step2Valid() || loading}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {loading ? 'Creating your portfolio…' : 'Create My Portfolio'}
              </button>
            </div>

            <p className="mt-5 text-xs text-forest/40">
              By creating a portfolio you agree to our terms. Trial portfolios are active for 7 days.
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

function PasswordField({
  placeholder, value, onChange, show, onToggleShow, autoComplete,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
      <span className="flex items-center border-r border-line bg-ink/80 px-3 text-forest/40">
        <Lock size={15} />
      </span>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-12 flex-1 bg-transparent px-3 text-sm text-forest outline-none placeholder:text-forest/35"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="px-3 text-forest/35 transition hover:text-forest/70"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
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
