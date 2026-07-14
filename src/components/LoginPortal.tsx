import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowLeft, Check, Loader2, Mail, Phone, ShieldCheck, TriangleAlert, User, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const PHONE_RE = /^01[3-9]\d{8}$/;

// Email OTP delivery is currently unreliable (slow/delayed sends while the
// sending domain builds reputation) — disable it and steer everyone to
// Google sign-in until that's resolved. Flip back to true once fixed.
const EMAIL_LOGIN_ENABLED = false;

// supabase-js discards the real response body for any 5xx and just
// stringifies the raw Response object (which serializes to "{}"), so a
// generic 500 shows up with an unhelpful message — fall back to something
// readable in that case instead of surfacing "{}" to the user.
function authErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (!err.message || err.message === '{}') return 'The server had a problem sending that — please try again in a moment.';
  return err.message;
}

export function LoginPortal() {
  const { session, profile, loading, refreshProfile } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const redirectTo = params.get('redirect') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  async function sendCode() {
    if (!EMAIL_LOGIN_ENABLED) { setShowMaintenanceModal(true); return; }
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    setError('');
    setSending(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (otpErr) throw otpErr;
      setStep('code');
    } catch (err) {
      setError(authErrorMessage(err, 'Could not send verification code'));
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    if (code.length !== 6) return;
    setError('');
    setVerifying(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      });
      if (verifyErr) throw verifyErr;
    } catch (err) {
      setError(authErrorMessage(err, 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo)}` },
    });
  }

  async function saveProfile() {
    if (!session) return;
    if (name.trim().length < 2) { setProfileError('Enter your full name'); return; }
    if (!PHONE_RE.test(phone.trim())) { setProfileError('Enter a valid Bangladeshi phone number (e.g. 01712345678)'); return; }
    setProfileError('');
    setSavingProfile(true);
    try {
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: session.user.id,
        name: name.trim(),
        phone: phone.trim(),
      });
      if (insertErr) throw insertErr;
      await refreshProfile();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto flex max-w-2xl justify-center px-4 pb-24 pt-24 sm:px-7">
        <Loader2 size={22} className="animate-spin text-forest/40" />
      </section>
    );
  }

  // Logged in but no profile yet — mandatory phone/name completion step.
  if (session && !profile) {
    return (
      <section className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
        <div className="rounded-[20px] border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
          <h1 className="font-display text-3xl font-bold text-forest">Complete your profile</h1>
          <p className="mt-2 text-sm text-forest/60">We need your name and phone number before you can continue.</p>

          <div className="mt-7 grid gap-3 [&>*]:min-w-0">
            <FieldInput icon={<User size={15} />} type="text" placeholder="Your full name" value={name} onChange={setName} autoComplete="name" />
            <FieldInput icon={<Phone size={15} />} type="tel" placeholder="01712345678" value={phone} onChange={setPhone} autoComplete="tel" />

            {profileError && <ErrorBanner message={profileError} />}

            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={savingProfile}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {savingProfile ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Already logged in with a complete profile.
  if (session && profile) {
    window.location.href = redirectTo;
    return null;
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
      <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
        <ArrowLeft size={16} />
        Back to homepage
      </a>

      <div className="rounded-[20px] border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
        {step === 'email' ? (
          <>
            <h1 className="font-display text-3xl font-bold text-forest">Log in</h1>
            <p className="mt-2 text-sm text-forest/60">Access your dashboard — no password needed.</p>

            <div className="mt-7 grid gap-3 [&>*]:min-w-0">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-5 text-sm font-semibold text-forest transition hover:border-primary/70"
              >
                Continue with Google
              </button>

              <div className="my-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-forest/35">
                <div className="h-px flex-1 bg-line" />
                or continue with email
                <div className="h-px flex-1 bg-line" />
              </div>

              <FieldInput icon={<Mail size={15} />} type="email" placeholder="Email address" value={email} onChange={setEmail} autoComplete="email" />

              {error && <ErrorBanner message={error} />}

              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={sending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {sending ? 'Sending code…' : 'Send code'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setStep('email'); setError(''); }}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest/55 transition hover:text-forest"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <h1 className="font-display text-3xl font-bold text-forest">Enter your code</h1>
            <p className="mt-2 text-sm text-forest/60">
              We sent a 6-digit code to <span className="font-semibold text-primary">{email}</span>.
            </p>

            <div className="mt-7 grid gap-3 [&>*]:min-w-0">
              <div className="flex overflow-hidden rounded-xl border border-line bg-ink transition focus-within:border-primary">
                <span className="flex items-center border-r border-line bg-ink/80 px-3 text-forest/40">
                  <ShieldCheck size={15} />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-center text-lg font-semibold tracking-[0.3em] text-forest outline-none placeholder:text-forest/25"
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <button
                type="button"
                onClick={() => void verifyCode()}
                disabled={code.length !== 6 || verifying}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
                {verifying ? 'Verifying…' : 'Verify & continue'}
              </button>
            </div>
          </>
        )}
      </div>

      {showMaintenanceModal && (
        <MaintenanceModal
          onClose={() => setShowMaintenanceModal(false)}
          onUseGoogle={() => { setShowMaintenanceModal(false); void signInWithGoogle(); }}
        />
      )}
    </section>
  );
}

function FieldInput({
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
      <span className="flex items-center border-r border-line bg-ink/80 px-3 text-forest/40">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-forest outline-none placeholder:text-forest/35"
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

function MaintenanceModal({ onClose, onUseGoogle }: { onClose: () => void; onUseGoogle: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-forest/20 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-[0_32px_80px_rgba(29,53,48,0.18)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/40 bg-amber-500/10 text-amber-600">
            <TriangleAlert size={19} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-forest/50 transition hover:bg-primary/10 hover:text-forest"
          >
            <X size={16} />
          </button>
        </div>

        <h2 className="font-display text-lg font-bold text-forest">Email sign-in unavailable</h2>
        <div className="mt-2 space-y-2 text-sm leading-6 text-forest/70">
          <p>Email sign-in is temporarily under maintenance. Please use Google Sign-In instead.</p>
          <p lang="bn">রক্ষণাবেক্ষণের কারণে ইমেইল দিয়ে সাইন-ইন সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে Google দিয়ে সাইন-ইন করুন।</p>
        </div>

        <button
          type="button"
          onClick={onUseGoogle}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          Continue with Google
        </button>
      </div>
    </div>,
    document.body,
  );
}
