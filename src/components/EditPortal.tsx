import { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Copy, Loader2, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePortZenStore } from '../store/usePortZenStore';
import type { GenerateTokenResponse } from '../types';

interface PortalForm {
  customerId: string;
  password: string;
}

export function EditPortal() {
  const { register, handleSubmit, formState } = useForm<PortalForm>();
  const magicLink = usePortZenStore((state) => state.magicLink);
  const setMagicLink = usePortZenStore((state) => state.setMagicLink);

  const generateToken = useMutation({
    mutationFn: async ({ customerId, password }: PortalForm): Promise<GenerateTokenResponse> => {
      const { data, error } = await supabase.functions.invoke<GenerateTokenResponse & { error?: string }>('generate-token', {
        body: { customerId, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.magicLink) throw new Error('No magic link returned.');
      return data;
    },
  });

  const onSubmit = handleSubmit(async ({ customerId, password }) => {
    const result = await generateToken.mutateAsync({ customerId, password });
    setMagicLink(result.magicLink);
  });

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
        ) : (
          <form onSubmit={(event: FormEvent<HTMLFormElement>) => void onSubmit(event)} className="mt-7 grid grid-cols-1 gap-3">
            <input
              type="text"
              placeholder="Customer ID or subdomain"
              autoComplete="username"
              className="min-h-12 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
              {...register('customerId', { required: 'Customer ID is required.' })}
            />
            <input
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              className="min-h-12 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
              {...register('password', { required: 'Password is required.' })}
            />
            <button
              type="submit"
              disabled={generateToken.isPending}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {generateToken.isPending ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
              Get Edit Link
            </button>
          </form>
        )}

        {formState.errors.customerId ? (
          <p className="mt-3 text-sm text-red-600">{formState.errors.customerId.message}</p>
        ) : formState.errors.password ? (
          <p className="mt-3 text-sm text-red-600">{formState.errors.password.message}</p>
        ) : null}
        {generateToken.isError ? (
          <p className="mt-3 text-sm text-red-600">{generateToken.error.message}</p>
        ) : null}
        <p className="mt-5 text-xs text-forest/50">Magic links expire after 24 hours.</p>
      </div>
    </section>
  );
}
