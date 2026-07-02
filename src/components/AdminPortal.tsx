import { useState, useEffect, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Check, Copy, DollarSign,
  Edit2, ExternalLink, Eye, EyeOff, LayoutTemplate, Link2, Plus,
  RefreshCw, Save, Search, Shield, Snowflake, Sun, Trash2, TrendingUp, Upload, Users, X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase, supabaseAdmin } from '../lib/supabase';
import type { Template, TemplateCategory } from '../types';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin123';
const CATEGORIES: TemplateCategory[] = ['Developer', 'Designer', 'Medical', 'Student', 'Creative'];

// ── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  subdomain: string;
  plan: 'trial' | 'six_months' | 'one_year' | 'custom';
  template_id: string;
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}

interface PricingPlan {
  id: string;
  name: string;
  price: string | null;
  period: string | null;
  features: string[];
}

// ── Root ─────────────────────────────────────────────────────────────────────
export function AdminPortal() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('portzen-admin') === '1',
  );

  function handleLogin() {
    sessionStorage.setItem('portzen-admin', '1');
    setAuthed(true);
  }
  function handleLogout() {
    sessionStorage.removeItem('portzen-admin');
    setAuthed(false);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-7">
      <div className="mb-8 flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest"
        >
          <ArrowLeft size={16} />
          Back to homepage
        </a>
        {authed && (
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-semibold text-forest/45 transition hover:text-red-500"
          >
            Log out
          </button>
        )}
      </div>

      {authed ? <Dashboard /> : <AdminLogin onLogin={handleLogin} />}
    </section>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError('Incorrect password.');
      setPassword('');
    }
  }

  return (
    <div className="mx-auto max-w-xs">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-forest to-primary shadow-glow">
          <Shield size={24} className="text-panel" />
        </div>
        <h1 className="font-display text-3xl font-bold text-forest">Admin Login</h1>
        <p className="mt-2 text-sm text-forest/55">PortZen dashboard access only</p>
      </div>
      <form
        onSubmit={submit}
        className="rounded-2xl border border-line bg-panel p-6 shadow-[0_24px_60px_rgba(101,146,135,0.14)]"
      >
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            autoComplete="current-password"
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Admin password"
            className="w-full min-h-12 rounded-xl border border-line bg-ink px-4 pr-11 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/35 transition hover:text-forest/70"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          className="mt-4 w-full min-h-12 rounded-xl bg-gradient-to-br from-forest to-primary text-sm font-semibold text-panel transition hover:brightness-110"
        >
          Access Dashboard
        </button>
      </form>
    </div>
  );
}

// ── Dashboard shell ───────────────────────────────────────────────────────────
type Tab = 'users' | 'templates' | 'pricing' | 'revenue';

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'users',     label: 'Users',     icon: Users },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'pricing',   label: 'Pricing',   icon: DollarSign },
  { key: 'revenue',   label: 'Revenue',   icon: TrendingUp },
];

function Dashboard() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-3xl font-bold text-forest">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-forest/55">
          Manage PortZen customers, templates, and pricing.
        </p>
      </div>

      <div className="mb-7 flex gap-1 border-b border-line">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'inline-flex items-center gap-2 -mb-px border-b-2 px-4 py-3 text-sm font-semibold transition',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-forest/50 hover:text-forest',
            ].join(' ')}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users'     && <AdminUsers />}
      {tab === 'templates' && <AdminTemplates />}
      {tab === 'pricing'   && <AdminPricing />}
      {tab === 'revenue'   && <AdminRevenue />}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function AdminUsers() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async (): Promise<Customer[]> => {
      if (!isSupabaseConfigured || !supabaseAdmin) return DEMO_CUSTOMERS;
      const { data, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.subdomain?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, subdomain…"
            className="w-full min-h-10 rounded-xl border border-line bg-ink pl-9 pr-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-forest/65 transition hover:border-primary/70 hover:text-forest"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
        <span className="ml-auto text-sm text-forest/45">{filtered.length} customers</span>
      </div>

      {isLoading ? (
        <Skeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={search ? 'No matching customers' : 'No customers yet'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-ink/50">
                <Th>Customer</Th>
                <Th>Subdomain</Th>
                <Th>Plan</Th>
                <Th>Template</Th>
                <Th>Status</Th>
                <Th>Expires</Th>
                <Th>Joined</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-ink/40">
                  <td className="py-3.5 pl-5 pr-3">
                    <div className="font-semibold text-forest">{c.name || '—'}</div>
                    <div className="text-xs text-forest/50">{c.email || '—'}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs text-primary">
                      {c.subdomain}.portzen.xyz
                    </span>
                  </td>
                  <td className="px-3 py-3.5"><PlanBadge plan={c.plan} /></td>
                  <td className="px-3 py-3.5 font-mono text-xs text-forest/55">{c.template_id || '—'}</td>
                  <td className="px-3 py-3.5"><StatusBadge active={c.is_active} /></td>
                  <td className="px-3 py-3.5 text-xs text-forest/50">
                    {c.expires_at ? fmtDate(c.expires_at) : '—'}
                  </td>
                  <td className="px-3 py-3.5 text-xs text-forest/50">{fmtDate(c.created_at)}</td>
                  <td className="py-3.5 pl-3 pr-5">
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="text-xs font-semibold text-primary transition hover:text-forest"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CustomerModal
          customer={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void refetch()}
        />
      )}
    </div>
  );
}

const PLAN_OPTIONS: { value: Customer['plan']; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'six_months', label: 'Six Months' },
  { value: 'one_year', label: 'One Year' },
  { value: 'custom', label: 'Custom' },
];

function CustomerModal({
  customer: c, onClose, onChanged,
}: { customer: Customer; onClose: () => void; onChanged: () => void }) {
  const [linkLoading, setLinkLoading] = useState(false);
  const [editLink, setEditLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [copied, setCopied] = useState(false);

  const [plan, setPlan] = useState(c.plan);
  const [expiresAt, setExpiresAt] = useState(c.expires_at ? c.expires_at.slice(0, 10) : '');
  const [manageSaving, setManageSaving] = useState(false);
  const [manageSaved, setManageSaved] = useState(false);
  const [manageError, setManageError] = useState('');

  const [isActive, setIsActive] = useState(c.is_active);
  const [freezeSaving, setFreezeSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [visits, setVisits] = useState<{ day: string; views: number }[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseAdmin) { setVisitsLoading(false); return; }
      const { data, error } = await supabaseAdmin
        .from('portfolio_visits')
        .select('day,views')
        .eq('customer_id', c.id)
        .order('day', { ascending: false })
        .limit(7);
      if (cancelled) return;
      setVisits(error ? [] : (data as { day: string; views: number }[]));
      setVisitsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [c.id]);

  async function saveManage() {
    if (!supabaseAdmin) return;
    setManageSaving(true);
    setManageError('');
    setManageSaved(false);
    try {
      const { error } = await supabaseAdmin
        .from('customers')
        .update({ plan, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })
        .eq('id', c.id);
      if (error) throw error;
      setManageSaved(true);
      onChanged();
      setTimeout(() => setManageSaved(false), 1500);
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setManageSaving(false);
    }
  }

  async function toggleFreeze() {
    if (!supabaseAdmin) return;
    setFreezeSaving(true);
    try {
      const next = !isActive;
      const { error } = await supabaseAdmin.from('customers').update({ is_active: next }).eq('id', c.id);
      if (error) throw error;
      setIsActive(next);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setFreezeSaving(false);
    }
  }

  async function deletePortfolio() {
    if (!supabaseAdmin) return;
    const confirmed = confirm(
      `Permanently delete "${c.name || c.subdomain}"'s portfolio? This removes their account, saved content, and edit links. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await supabaseAdmin.from('edit_tokens').delete().eq('customer_id', c.id);
      try { await supabaseAdmin.from('portfolio_visits').delete().eq('customer_id', c.id); } catch { /* table may not exist yet */ }
      await supabaseAdmin.from('portfolio_content').delete().eq('customer_id', c.id);
      const { error } = await supabaseAdmin.from('customers').delete().eq('id', c.id);
      if (error) throw error;
      onChanged();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const rows: [string, string][] = [
    ['ID',         c.id],
    ['Name',       c.name || '—'],
    ['Email',      c.email || '—'],
    ['WhatsApp',   c.whatsapp || '—'],
    ['Subdomain',  `${c.subdomain}.md-hanif.xyz`],
    ['Template',   c.template_id || '—'],
    ['Joined',     fmtDate(c.created_at)],
  ];

  async function getEditLink() {
    setLinkLoading(true);
    setLinkError('');
    setEditLink('');
    try {
      const res = await fetch(`https://${c.subdomain}.portzenx.com/api/edit-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_by: 'admin' }),
      });
      if (!res.ok) throw new Error(`Site responded with ${res.status}`);
      const data = await res.json() as { url?: string };
      if (!data.url) throw new Error('No URL returned from customer site');
      setEditLink(data.url);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLinkLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(editLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">{c.name || 'Customer'}</h2>
          <p className="text-sm text-forest/50">{c.email}</p>
        </div>
        <button type="button" onClick={onClose} className="text-forest/40 transition hover:text-forest">
          <X size={20} />
        </button>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-semibold text-forest/50">{label}</span>
            <span className="max-w-[60%] break-all text-right text-sm font-medium text-forest">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2">
        <PlanBadge plan={plan} />
        <StatusBadge active={isActive} label={isActive ? 'Active' : 'Frozen'} />
        <a
          href={`https://${c.subdomain}.md-hanif.xyz`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:text-forest"
        >
          Visit site
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Manage: plan + expiry + freeze */}
      <div className="mt-5 rounded-xl border border-line bg-ink/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-forest/50">Manage</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-forest/50">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Customer['plan'])}
              className="w-full min-h-9 rounded-lg border border-line bg-panel px-2 text-sm text-forest outline-none focus:border-primary"
            >
              {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-forest/50">Expires</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full min-h-9 rounded-lg border border-line bg-panel px-2 text-sm text-forest outline-none focus:border-primary"
            />
          </div>
        </div>
        {manageError && <p className="mt-2 text-xs text-red-500">{manageError}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void saveManage()}
            disabled={manageSaving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-forest to-primary px-3 py-2 text-xs font-semibold text-panel transition hover:brightness-110 disabled:opacity-60"
          >
            {manageSaved ? <Check size={13} /> : <Save size={13} />}
            {manageSaving ? 'Saving…' : manageSaved ? 'Saved' : 'Save plan & expiry'}
          </button>
          <button
            type="button"
            onClick={() => void toggleFreeze()}
            disabled={freezeSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-forest/70 transition hover:border-primary/70 hover:text-forest disabled:opacity-60"
          >
            {isActive ? <Snowflake size={13} /> : <Sun size={13} />}
            {freezeSaving ? '…' : isActive ? 'Freeze' : 'Unfreeze'}
          </button>
        </div>
      </div>

      {/* Visits */}
      <div className="mt-4 rounded-xl border border-line bg-ink/40 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-forest/50">
          <TrendingUp size={13} />
          Visits — last 7 days
        </p>
        {visitsLoading ? (
          <p className="text-xs text-forest/40">Loading…</p>
        ) : visits.length === 0 ? (
          <p className="text-xs text-forest/40">No visits recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {visits.map((v) => (
              <div key={v.day} className="flex items-center justify-between text-xs">
                <span className="text-forest/60">{fmtDate(v.day)}</span>
                <span className="font-semibold text-forest">{v.views}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit link section */}
      <div className="mt-4 border-t border-line pt-5">
        <button
          type="button"
          onClick={() => void getEditLink()}
          disabled={linkLoading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-4 py-2.5 text-sm font-semibold text-panel transition hover:brightness-110 disabled:opacity-60"
        >
          <Link2 size={15} />
          {linkLoading ? 'Requesting…' : 'Get Edit Link'}
        </button>
        {linkError && (
          <p className="mt-2 rounded-lg bg-red-500/8 px-3 py-2 text-xs text-red-500">{linkError}</p>
        )}
        {editLink && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3 py-2.5">
            <span className="flex-1 truncate font-mono text-xs text-forest">{editLink}</span>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 text-forest/50 transition hover:text-forest"
            >
              {copied ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/5 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">
          <AlertTriangle size={13} />
          Danger zone
        </p>
        <p className="mb-3 text-xs text-forest/55">
          Permanently deletes this customer's account, saved content, and edit links. Cannot be undone.
        </p>
        {deleteError && <p className="mb-2 text-xs text-red-500">{deleteError}</p>}
        <button
          type="button"
          onClick={() => void deletePortfolio()}
          disabled={deleting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-60"
        >
          <Trash2 size={13} />
          {deleting ? 'Deleting…' : 'Delete portfolio'}
        </button>
      </div>
    </Modal>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────
function AdminTemplates() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async (): Promise<Template[]> => {
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!supabaseAdmin) throw new Error('Admin client not configured');
      const { error } = await supabaseAdmin!.from('templates').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      if (!supabaseAdmin) throw new Error('Admin client not configured');
      const { error } = await supabaseAdmin!.from('templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-forest/45">{templates.length} DB templates</span>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-forest/65 transition hover:border-primary/70 hover:text-forest"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-4 py-2.5 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          <Plus size={16} />
          Add Template
        </button>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm text-forest/70">
          Supabase is not configured — showing static templates only. Connect Supabase to manage DB templates.
        </div>
      )}

      {isLoading ? (
        <Skeleton rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No database templates" body="Static templates always show in the store. Add DB templates here for additional products." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-ink/50">
                <Th>Name / ID</Th>
                <Th>Category</Th>
                <Th>Tags</Th>
                <Th>Status</Th>
                <Th>Added</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {templates.map((t) => (
                <tr key={t.id} className="transition hover:bg-ink/40">
                  <td className="py-3.5 pl-5 pr-3">
                    <div className="font-semibold text-forest">{t.name}</div>
                    <div className="font-mono text-xs text-forest/40">{t.id}</div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded bg-line/50 px-1.5 py-0.5 text-xs text-forest/60">
                          {tag}
                        </span>
                      ))}
                      {t.tags.length > 3 && (
                        <span className="text-xs text-forest/40">+{t.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleActive.mutate({ id: t.id, is_active: !t.is_active })}
                      className="transition hover:opacity-75"
                    >
                      <StatusBadge active={t.is_active} label={t.is_active ? 'Active' : 'Hidden'} />
                    </button>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-forest/50">{fmtDate(t.created_at)}</td>
                  <td className="py-3.5 pr-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${t.name}"? This cannot be undone.`)) {
                          deleteTemplate.mutate(t.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddTemplateModal
          onClose={() => {
            setShowAdd(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function slugify(filename: string) {
  return filename.replace(/\.html$/i, '').toLowerCase().replace(/\s+/g, '-');
}

function titleify(slug: string) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function AddTemplateModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    id: '', name: '', category: 'Developer' as TemplateCategory, tags: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const id = slugify(f.name);
      setForm((prev) => ({
        ...prev,
        id,
        name: prev.name || titleify(id),
      }));
    }
  }

  async function doUpload() {
    setError('');
    try {
      if (!supabaseAdmin) throw new Error('Admin client not configured — restart dev server');
      if (!file) throw new Error('Please select an HTML file');
      if (!form.id || !form.name) throw new Error('ID and Name are required');

      setSaving(true);
      const path = `${form.id.trim()}.html`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from('templates')
        .upload(path, file, { contentType: 'text/html', upsert: true });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage.from('templates').getPublicUrl(path);

      const { error: dbErr } = await supabaseAdmin.from('templates').insert({
        id:          form.id.trim(),
        name:        form.name.trim(),
        category:    form.category,
        preview_url: publicUrl,
        tags:        form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        is_active:   true,
        created_at:  new Date().toISOString(),
      });
      if (dbErr) throw new Error(`Database error: ${dbErr.message}`);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} width="max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest">Upload Template</h2>
        <button type="button" onClick={onClose} className="text-forest/40 transition hover:text-forest">
          <X size={20} />
        </button>
      </div>

      {/* Status indicators */}
      <div className="mb-4 flex gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${supabaseAdmin ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${supabaseAdmin ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {supabaseAdmin ? 'Admin ready' : 'Admin not configured — restart dev server'}
        </span>
        {file && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            File selected
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* File drop zone */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest/50">
            HTML File
          </span>
          <label
            htmlFor="tpl-file-input"
            className={[
              'flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 transition',
              file
                ? 'border-primary/50 bg-primary/8 text-primary'
                : 'border-line bg-ink/40 text-forest/40 hover:border-primary/40 hover:text-forest/70',
            ].join(' ')}
          >
            <Upload size={20} />
            <span className="text-sm font-medium">
              {file ? file.name : 'Click here to select .html file'}
            </span>
          </label>
          <input
            id="tpl-file-input"
            type="file"
            accept=".html"
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        <Field label="Template ID" value={form.id} onChange={(v) => setForm({ ...form, id: v })} placeholder="photographer-teal" />
        <Field label="Display Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Photographer — Teal" />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest/50">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
            className="w-full min-h-10 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none focus:border-primary"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Field label="Tags (comma-separated)" value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="Photography, Teal, Gallery" />

        <button
          type="button"
          onClick={() => void doUpload()}
          disabled={saving}
          className="mt-2 w-full min-h-11 rounded-xl bg-gradient-to-br from-forest to-primary text-sm font-semibold text-panel transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? 'Uploading…' : 'Upload & Add Template'}
        </button>
      </div>
    </Modal>
  );
}

// ── Pricing tab ───────────────────────────────────────────────────────────────
const INITIAL_PLANS: PricingPlan[] = [
  { id: 'trial',      name: 'Trial',      price: '৳50',  period: '1 month',  features: ['Live custom subdomain', 'Any one template', 'Magic edit link', 'WhatsApp onboarding'] },
  { id: 'six_months', name: 'Six Months', price: '৳300', period: '6 months', features: ['Everything in Trial', 'Template setup support', 'Basic content updates', 'Priority WhatsApp support'] },
  { id: 'one_year',   name: 'One Year',   price: '৳500', period: '1 year',   features: ['Everything in Six Months', 'Free template switch', 'Renewal reminder', 'Best long-term value'] },
  { id: 'custom',     name: 'Custom',     price: null,   period: null,       features: ['Everything in One Year', 'Custom domain support *', 'Tailored design modifications', 'Dedicated onboarding call', 'Multi-page portfolio layout', 'Analytics integration'] },
];

function loadPlans(): PricingPlan[] {
  try {
    const stored = localStorage.getItem('portzen-admin-plans');
    return stored ? (JSON.parse(stored) as PricingPlan[]) : INITIAL_PLANS;
  } catch {
    return INITIAL_PLANS;
  }
}

function AdminPricing() {
  const [plans, setPlans] = useState<PricingPlan[]>(loadPlans);
  const [editing, setEditing] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function update(id: string, field: keyof PricingPlan, value: string) {
    setPlans((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }

  function updateFeature(planId: string, idx: number, value: string) {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const features = [...p.features];
        features[idx] = value;
        return { ...p, features };
      }),
    );
  }

  function addFeature(planId: string) {
    setPlans((prev) =>
      prev.map((p) => p.id === planId ? { ...p, features: [...p.features, 'New feature'] } : p),
    );
  }

  function removeFeature(planId: string, idx: number) {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId ? { ...p, features: p.features.filter((_, i) => i !== idx) } : p,
      ),
    );
  }

  function savePlan(id: string) {
    localStorage.setItem('portzen-admin-plans', JSON.stringify(plans));
    setEditing(null);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1500);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-forest/55">
          Edit plan names, prices, and features. Changes are saved locally.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isEditing = editing === plan.id;
          const isSaved = savedId === plan.id;
          return (
            <div key={plan.id} className="rounded-2xl border border-line bg-panel p-5">
              {/* Plan header */}
              <div className="mb-3 flex items-center justify-between gap-2">
                {isEditing ? (
                  <input
                    value={plan.name}
                    onChange={(e) => update(plan.id, 'name', e.target.value)}
                    className="w-28 rounded-lg border border-primary/50 bg-ink px-2 py-1 text-sm font-bold text-forest outline-none"
                  />
                ) : (
                  <span className="font-display text-sm font-bold uppercase tracking-widest text-primary">
                    {plan.name}
                  </span>
                )}
                <div className="flex gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => savePlan(plan.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary/20"
                      >
                        <Save size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditing(null); setPlans(loadPlans()); }}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-line text-forest/40 transition hover:text-forest"
                      >
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(plan.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-line text-forest/40 transition hover:border-primary/70 hover:text-forest"
                    >
                      {isSaved ? <Check size={13} className="text-primary" /> : <Edit2 size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                {plan.price !== null ? (
                  isEditing ? (
                    <div className="flex gap-2">
                      <input
                        value={plan.price}
                        onChange={(e) => update(plan.id, 'price', e.target.value)}
                        className="w-24 rounded-lg border border-primary/50 bg-ink px-2 py-1 text-2xl font-bold text-forest outline-none"
                      />
                      <input
                        value={plan.period ?? ''}
                        onChange={(e) => update(plan.id, 'period', e.target.value)}
                        className="flex-1 self-end rounded-lg border border-primary/50 bg-ink px-2 py-1 text-xs text-forest outline-none"
                        placeholder="1 month"
                      />
                    </div>
                  ) : (
                    <div className="flex items-end gap-1.5">
                      <span className="font-display text-3xl font-bold text-forest">{plan.price}</span>
                      <span className="pb-1 text-xs text-forest/50">/ {plan.period}</span>
                    </div>
                  )
                ) : (
                  <span className="font-display text-xl font-bold text-forest">Let's Talk</span>
                )}
              </div>

              {/* Features */}
              <div className="space-y-2">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-primary" />
                    {isEditing ? (
                      <div className="flex flex-1 gap-1">
                        <input
                          value={f}
                          onChange={(e) => updateFeature(plan.id, i, e.target.value)}
                          className="flex-1 rounded border border-line bg-ink px-2 py-0.5 text-xs text-forest outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeFeature(plan.id, i)}
                          className="shrink-0 text-red-400 transition hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs leading-5 text-forest/70">{f}</span>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => addFeature(plan.id)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary transition hover:text-forest"
                  >
                    <Plus size={12} />
                    Add feature
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Revenue tab ───────────────────────────────────────────────────────────────
const PLAN_PRICE: Record<Customer['plan'], number | null> = {
  trial: 50,
  six_months: 300,
  one_year: 500,
  custom: null,
};

function AdminRevenue() {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async (): Promise<Customer[]> => {
      if (!isSupabaseConfigured || !supabaseAdmin) return DEMO_CUSTOMERS;
      const { data, error } = await supabaseAdmin.from('customers').select('*');
      if (error) throw error;
      return data as Customer[];
    },
  });

  if (isLoading) return <Skeleton rows={4} />;

  const active = customers.filter((c) => c.is_active);
  const byPlan = PLAN_OPTIONS.map(({ value, label }) => {
    const count = active.filter((c) => c.plan === value).length;
    const price = PLAN_PRICE[value];
    const subtotal = price !== null ? price * count : null;
    return { value, label, count, price, subtotal };
  });
  const total = byPlan.reduce((sum, p) => sum + (p.subtotal ?? 0), 0);
  const customCount = byPlan.find((p) => p.value === 'custom')?.count ?? 0;

  return (
    <div>
      <div className="mb-4 rounded-2xl border border-line bg-panel p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-forest/50">
          Estimated value of active plans
        </p>
        <p className="mt-2 font-display text-4xl font-bold text-forest">৳{total.toLocaleString()}</p>
        <p className="mt-2 text-xs text-forest/45">
          Sum of listed plan prices across {active.length} active customer{active.length === 1 ? '' : 's'}.
          Not a record of actual payments received — payments are confirmed manually over WhatsApp.
          {customCount > 0 && ` Excludes ${customCount} Custom-plan customer${customCount === 1 ? '' : 's'} (no fixed price).`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-ink/50">
              <Th>Plan</Th>
              <Th>Active customers</Th>
              <Th>Unit price</Th>
              <Th>Subtotal</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {byPlan.map((p) => (
              <tr key={p.value}>
                <td className="py-3.5 pl-5 pr-3 font-semibold text-forest">{p.label}</td>
                <td className="px-3 py-3.5 text-forest/70">{p.count}</td>
                <td className="px-3 py-3.5 text-forest/70">{p.price !== null ? `৳${p.price}` : '—'}</td>
                <td className="py-3.5 pl-3 pr-5 font-semibold text-forest">
                  {p.subtotal !== null ? `৳${p.subtotal.toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────
function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="py-3 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-forest/50 first:pl-5 last:pr-5">
      {children}
    </th>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    trial:      'bg-sage/20 text-forest/70',
    six_months: 'bg-primary/15 text-primary',
    one_year:   'bg-forest/10 text-forest',
    custom:     'bg-amber-500/10 text-amber-600',
  };
  const labels: Record<string, string> = {
    trial: 'Trial', six_months: '6 Months', one_year: '1 Year', custom: 'Custom',
  };
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${styles[plan] ?? 'bg-line/40 text-forest/60'}`}>
      {labels[plan] ?? plan}
    </span>
  );
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {label ?? (active ? 'Active' : 'Inactive')}
    </span>
  );
}

function Modal({ children, onClose, width = 'max-w-lg' }: { children: React.ReactNode; onClose: () => void; width?: string }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-forest/20 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${width} rounded-2xl border border-line bg-panel p-6 shadow-[0_32px_80px_rgba(29,53,48,0.18)]`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest/50">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-10 rounded-xl border border-line bg-ink px-4 text-sm text-forest outline-none transition placeholder:text-forest/40 focus:border-primary"
      />
    </div>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-line/40" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Users; title: string; body?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel py-16 text-center">
      <Icon className="mx-auto mb-3 text-forest/25" size={32} />
      <p className="font-semibold text-forest/50">{title}</p>
      {body && <p className="mt-1 max-w-xs mx-auto text-xs text-forest/35">{body}</p>}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Demo data shown when Supabase is not configured
const DEMO_CUSTOMERS: Customer[] = [
  { id: 'cust_001', name: 'Ayesha Rahman',  email: 'ayesha@email.com', whatsapp: '+8801712345678', subdomain: 'ayesha', plan: 'six_months', template_id: 'photographer-red',    is_active: true,  created_at: '2026-03-15T10:00:00Z', expires_at: '2026-09-15T10:00:00Z' },
  { id: 'cust_002', name: 'Karim Uddin',    email: 'karim@email.com',  whatsapp: '+8801812345678', subdomain: 'karim',  plan: 'trial',      template_id: 'photographer-rose',   is_active: true,  created_at: '2026-04-01T10:00:00Z', expires_at: '2026-05-01T10:00:00Z' },
  { id: 'cust_003', name: 'Nadia Islam',    email: 'nadia@email.com',  whatsapp: '+8801912345678', subdomain: 'nadia',  plan: 'one_year',   template_id: 'photographer-forest', is_active: true,  created_at: '2026-01-10T10:00:00Z', expires_at: '2027-01-10T10:00:00Z' },
  { id: 'cust_004', name: 'Rafiq Hassan',   email: 'rafiq@email.com',  whatsapp: '+8801612345678', subdomain: 'rafiq',  plan: 'custom',     template_id: 'photographer-red',    is_active: false, created_at: '2025-12-01T10:00:00Z' },
  { id: 'cust_005', name: 'Sadia Khanam',   email: 'sadia@email.com',  whatsapp: '+8801512345678', subdomain: 'sadia',  plan: 'six_months', template_id: 'photographer-rose',   is_active: true,  created_at: '2026-05-20T10:00:00Z', expires_at: '2026-11-20T10:00:00Z' },
];
