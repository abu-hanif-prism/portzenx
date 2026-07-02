import { useState } from 'react';
import { ArrowLeft, Check, Copy, Loader2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { functionErrorMessage, supabase } from '../lib/supabase';
import { usePortZenStore } from '../store/usePortZenStore';
import type { GenerateTokenResponse } from '../types';

export function EditPortal() {
  const magicLink = usePortZenStore((state) => state.magicLink);
  const setMagicLink = usePortZenStore((state) => state.setMagicLink);

  const [step, setStep] = useState<1 | 2>(1);
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Google sign-in — an alternate way to satisfy the same "verified email"
  // gate the manual OTP flow uses, without spending an OTP send.
  const [googleVerified, setGoogleVerified] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function step1Valid() {
    return customerId.trim().length > 0 && email.includes('@');
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
      setEmail(data.email as string);
      setGoogleVerified(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function getLink() {
    setError('');
    setVerifying(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<GenerateTokenResponse & { error?: string }>('generate-token', {
        body: { customerId: customerId.trim(), email: email.trim() },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error);
      if (!data?.magicLink) throw new Error('No magic link returned.');
      setMagicLink(data.magicLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  async function primaryAction() {
    if (googleVerified) { await getLink(); return; }
    if (!step1Valid()) return;
    setError('');
    setSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('send-otp', {
        body: { email: email.trim() },
      });
      if (fnErr) throw new Error(await functionErrorMessage(fnErr));
      if (data?.error) throw new Error(data.error as string);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      setSending(false);
    }
  }

  async function verifyAndGetLink() {
    if (otp.length !== 6) return;
    setError('');
    setVerifying(true);
    try {
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-otp', {
        body: { email: email.trim(), code: otp },
      });
      if (verifyErr) throw new Error(await functionErrorMessage(verifyErr));
      if (verifyData?.error) throw new Error(verifyData.error as string);
      await getLink();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setVerifying(false);
    }
  }

  const copyLink = async () => {
    if (magicLink) await navigator.clipboard.writeText(magicLink);
  };

  return (
    <section id="portal" className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-7">
      <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
        <ArrowLeft size={16} />
        Back to homepage
      </a>
      <div className="rounded-[20px] border border-line bg-panel p-6 text-center shadow-[0_24px_60px_rgba(101,146,135,0.18)] sm:p-9">
        <div className="mx-auto mb-7 grid max-w-md grid-cols-2 rounded-xl border border-line bg-ink p-1 text-sm font-semibold">
          <a
            href="/templates"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-forest/55 transition hover:text-forest"
          >
            <Plus size={16} />
            New portfolio
          </a>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-panel shadow-[0_8px_22px_rgba(101,146,135,0.28)]"
          >
            <ShieldCheck size={16} />
            Edit existing account
          </button>
        </div>

        {magicLink ? (
          <div className="mt-7 rounded-2xl border border-primary/50 bg-primary/10 p-4">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-primary">
              <ShieldCheck size={18} />
              Your edit link is ready
            </div>
            <div className="break-all rounded-xl bg-ink px-4 py-3 text-left text-sm text-forest">{magicLink}</div>
            <button
              type="button"
              onClick={copyLink}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              <Copy size={16} />
              Copy Link
            </button>
          </div>
        ) : step === 1 ? (
          <div className="mt-7 grid grid-cols-1 gap-3">
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Your subdomain (e.g. yourname)"
              autoComplete="username"
              className="min-h-12 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
            />

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

            {googleVerified ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-forest">
                <Check size={15} className="shrink-0 text-emerald-500" />
                <span className="truncate">{email}</span>
                <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-600">Verified via Google</span>
              </div>
            ) : (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email you signed up with"
                autoComplete="email"
                className="min-h-12 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void primaryAction()}
              disabled={!step1Valid() || sending || verifying}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending || verifying ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
              {verifying ? 'Getting your link…' : sending ? 'Sending code…' : googleVerified ? 'Get Edit Link' : 'Send verification code'}
            </button>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-3">
            <p className="text-sm text-forest/60">
              Enter the 6-digit code sent to <span className="font-semibold text-primary">{email}</span>.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
              className="min-h-12 rounded-xl border border-line bg-ink px-4 text-center text-lg font-semibold tracking-[0.3em] text-forest outline-none transition placeholder:text-forest/25 focus:border-primary"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={() => void verifyAndGetLink()}
              disabled={otp.length !== 6 || verifying}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {verifying ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
              {verifying ? 'Verifying…' : 'Verify & Get Edit Link'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="text-xs font-semibold text-forest/50 transition hover:text-forest"
            >
              Back
            </button>
          </div>
        )}

        <p className="mt-5 text-xs text-forest/50">Magic links expire after 24 hours.</p>
      </div>
    </section>
  );
}
