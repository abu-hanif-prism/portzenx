import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, MessageCircle, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { functionErrorMessage, siteUrl as siteUrlBase, supabase, whatsappNumber } from '../lib/supabase';

interface Site {
  id: string;
  subdomain: string;
  template_id: string;
  plan: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial',
  six_months: 'Six Months',
  one_year: 'One Year',
  custom: 'Custom',
};

export function CustomerDashboard() {
  const { session, profile, loading } = useAuth();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [templateNames, setTemplateNames] = useState<Record<string, string>>({});
  const [fetchError, setFetchError] = useState('');
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session || !profile) {
      window.location.href = `/login?redirect=${encodeURIComponent('/dashboard')}`;
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id,subdomain,template_id,plan,is_active,expires_at,created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) { setFetchError(error.message); return; }
      const rows = (data as Site[]) ?? [];
      setSites(rows);

      const ids = [...new Set(rows.map((r) => r.template_id))];
      if (ids.length > 0) {
        const { data: templates } = await supabase.from('templates').select('id,name').in('id', ids);
        const map: Record<string, string> = {};
        for (const t of (templates as { id: string; name: string }[] | null) ?? []) map[t.id] = t.name;
        setTemplateNames(map);
      }
    })();
  }, [session, profile, loading]);

  async function getEditLink(customerId: string) {
    setLinkError('');
    setLinkFor(customerId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-token', {
        body: { customerId },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error as string);
      if (!data?.magicLink) throw new Error('No magic link returned.');
      setLinks((prev) => ({ ...prev, [customerId]: data.magicLink as string }));
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Could not generate an edit link');
    } finally {
      setLinkFor(null);
    }
  }

  function renewHref(site: Site) {
    const text = encodeURIComponent(`Hi PortZen, I'd like to renew my site ${site.subdomain}.portzenx.com (${PLAN_LABEL[site.plan] ?? site.plan}).`);
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  }

  if (loading || !sites) {
    return (
      <section className="mx-auto flex max-w-4xl justify-center px-4 pb-24 pt-24 sm:px-7">
        <Loader2 size={22} className="animate-spin text-forest/40" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 pb-24 pt-12 sm:px-7">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">My Dashboard</h1>
          <p className="mt-1 text-sm text-forest/60">Hi {profile?.name} — here's everything you've bought from PortZen.</p>
        </div>
        <a
          href="/templates"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-4 py-2.5 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          <Plus size={16} />
          New portfolio
        </a>
      </div>

      {fetchError && <p className="mb-4 text-sm text-red-600">{fetchError}</p>}

      {sites.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-panel p-9 text-center">
          <p className="text-sm text-forest/60">You don't have any portfolios yet.</p>
          <a href="/templates" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Browse templates <ExternalLink size={14} />
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => {
            const expired = site.expires_at ? new Date(site.expires_at).getTime() < Date.now() : false;
            const status = !site.is_active ? 'Frozen' : expired ? 'Expired' : 'Active';
            return (
              <div key={site.id} className="rounded-[20px] border border-line bg-panel p-6 shadow-[0_16px_40px_rgba(101,146,135,0.12)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-semibold text-forest">{site.subdomain}.portzenx.com</p>
                    <p className="mt-1 text-sm text-forest/55">{templateNames[site.template_id] ?? site.template_id} · {PLAN_LABEL[site.plan] ?? site.plan}</p>
                  </div>
                  <span className={[
                    'rounded-full px-3 py-1 text-xs font-semibold',
                    status === 'Active' ? 'bg-emerald-500/10 text-emerald-600'
                      : status === 'Expired' ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-red-500/10 text-red-600',
                  ].join(' ')}>
                    {status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-forest/50 sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-wide">Purchased</p>
                    <p className="mt-1 text-sm font-medium text-forest">{new Date(site.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide">Expires</p>
                    <p className="mt-1 text-sm font-medium text-forest">
                      {site.expires_at ? new Date(site.expires_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>

                {links[site.id] ? (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3">
                    <span className="flex-1 break-all font-mono text-xs text-forest">{links[site.id]}</span>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(links[site.id])}
                      className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-forest/65 transition hover:border-primary/70"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void getEditLink(site.id)}
                      disabled={linkFor === site.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest disabled:opacity-60"
                    >
                      {linkFor === site.id ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      Get edit link
                    </button>
                    <a
                      href={renewHref(site)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest"
                    >
                      <MessageCircle size={15} />
                      Renew
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {linkError && <p className="mt-4 text-sm text-red-600">{linkError}</p>}
    </section>
  );
}
