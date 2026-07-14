import clsx from 'clsx';
import { ArrowLeft, ArrowRight, ExternalLink, MonitorSmartphone, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TEMPLATE_REGISTRY } from '../../templates/registry';
import { useCategories } from '../hooks/useCategories';
import { useTemplate, useTemplates } from '../hooks/useTemplates';
import { usePortZenStore } from '../store/usePortZenStore';
import type { Template } from '../types';

function useBlobUrl(previewUrl: string | undefined): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string>();

  useEffect(() => {
    if (!previewUrl) { setBlobUrl(undefined); return; }

    if (previewUrl.startsWith('local:')) {
      const key = previewUrl.slice('local:'.length);
      const html = TEMPLATE_REGISTRY[key];
      if (!html) return;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }

    // Remote HTML stored in Supabase Storage — fetch and re-wrap as blob so the
    // browser always sees text/html regardless of what the storage server returns.
    if (previewUrl.endsWith('.html')) {
      let cancelled = false;
      fetch(previewUrl)
        .then((r) => r.text())
        .then((html) => {
          if (cancelled) return;
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }

    setBlobUrl(undefined);
  }, [previewUrl]);

  return blobUrl;
}

interface TemplateDetailProps {
  templateId: string;
}

// Category is now an admin-editable free string (not a closed set), so tones
// are picked deterministically by hashing the name instead of a fixed map.
const CATEGORY_TONES = [
  'from-primary/12 to-sage/8',
  'from-sage/18 to-[#B1D3B9]/12',
  'from-[#B1D3B9]/20 to-primary/8',
  'from-sage/12 to-primary/6',
  'from-primary/18 to-sage/12',
];

function categoryTone(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return CATEGORY_TONES[Math.abs(hash) % CATEGORY_TONES.length];
}

export function TopTemplates() {
  const templatesQuery = useTemplates('All');
  const templates = (templatesQuery.data ?? []).slice(0, 3);

  return (
    <section id="templates" className="mx-auto max-w-7xl px-4 py-20 sm:px-7">
      <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          align="left"
          label="Top Templates"
          title="Start With a Proven Layout"
          copy="A short list of portfolio templates for the homepage. Open the full store to browse everything."
        />
        <a
          href="/templates"
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          All templates
          <ExternalLink size={16} />
        </a>
      </div>

      {templatesQuery.isLoading ? (
        <TemplateSkeleton count={3} />
      ) : templatesQuery.isError ? (
        <Notice title="Could not load templates" copy={templatesQuery.error.message} />
      ) : templates.length === 0 ? (
        <Notice title="No templates found" copy="Add active rows to the templates table." />
      ) : (
        <TemplateGrid templates={templates} />
      )}
    </section>
  );
}

export function Templates() {
  const activeFilter = usePortZenStore((state) => state.activeFilter);
  const setActiveFilter = usePortZenStore((state) => state.setActiveFilter);
  const templatesQuery = useTemplates(activeFilter);
  const templates = templatesQuery.data ?? [];
  const categoriesQuery = useCategories();
  const filters: string[] = ['All', ...(categoriesQuery.data ?? []).map((c) => c.label)];

  return (
    <section id="templates" className="mx-auto max-w-7xl px-4 py-20 sm:px-7">
      <div className="mb-8">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
          <ArrowLeft size={16} />
          Back to homepage
        </a>
      </div>
      <SectionHeading
        label="Template Store"
        title="Choose Your Template"
        copy="Browse every active PortZen portfolio template. Click a template to see details and buy from its page."
      />

      <div className="mb-9 flex flex-wrap justify-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={clsx(
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              activeFilter === filter
                ? 'border-primary bg-primary text-panel'
                : 'border-line bg-transparent text-forest/55 hover:border-primary/70 hover:text-forest',
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {templatesQuery.isLoading ? (
        <TemplateSkeleton count={6} />
      ) : templatesQuery.isError ? (
        <Notice title="Could not load templates" copy={templatesQuery.error.message} />
      ) : templates.length === 0 ? (
        <Notice title="No templates found" copy="Add active rows to the templates table for this category." />
      ) : (
        <TemplateGrid templates={templates} />
      )}
    </section>
  );
}

export function TemplateDetail({ templateId }: TemplateDetailProps) {
  const templateQuery = useTemplate(templateId);
  const template = templateQuery.data;
  const blobUrl = useBlobUrl(template?.preview_url);

  function openPreview() {
    if (blobUrl) window.open(blobUrl, '_blank', 'noreferrer');
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-7 lg:py-18">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <a href="/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-forest/65 transition hover:text-forest">
          <ArrowLeft size={16} />
          All templates
        </a>
        <a href="/" className="text-sm font-semibold text-forest/45 transition hover:text-forest">
          Homepage
        </a>
      </div>

      {templateQuery.isLoading ? (
        <DetailSkeleton />
      ) : templateQuery.isError || !template ? (
        <Notice title="Template not found" copy="This template may be inactive or the link may be wrong." />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div
            className={clsx(
              'overflow-hidden rounded-2xl border border-line bg-gradient-to-br p-3 shadow-[0_30px_90px_rgba(101,146,135,0.18)]',
              categoryTone(template.category),
            )}
          >
            <div className="overflow-hidden rounded-xl border border-line/50 bg-ink">
              <TemplatePreviewMedia template={template} mode="detail" />
            </div>
          </div>

          <aside className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles size={14} />
              {template.category} template
            </div>
            <h1 className="font-display text-4xl font-bold text-forest sm:text-5xl">{template.name}</h1>
            <p className="mt-4 text-base leading-7 text-forest/75">
              A ready-to-host PortZen portfolio UI with responsive layout, animated dark theme, custom subdomain support,
              and magic-link editing after purchase.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-forest/80 sm:grid-cols-2">
              {['Custom subdomain', 'Mobile responsive', 'Edit portal access', 'WhatsApp setup support'].map((item) => (
                <div key={item} className="rounded-xl border border-line bg-ink/55 px-4 py-3">
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`/start?template=${encodeURIComponent(template.id)}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-5 py-3.5 text-sm font-semibold text-panel transition hover:brightness-110"
              >
                <Sparkles size={17} />
                Get this template
              </a>
              <button
                type="button"
                onClick={openPreview}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3.5 text-sm font-semibold text-forest/80 transition hover:border-primary/70 hover:text-forest"
              >
                Preview
                <ExternalLink size={17} />
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function TemplatePreviewMedia({ template, mode }: { template: Template; mode: 'card' | 'detail' }) {
  const isLocal = template.preview_url?.startsWith('local:');
  const isHtmlUrl = template.preview_url?.endsWith('.html');
  const shouldUseIframe = isLocal || isHtmlUrl;
  const blobUrl = useBlobUrl(template.preview_url);

  if (!template.preview_url) {
    return (
      <div className={clsx('grid place-items-center text-sm font-semibold text-forest/45', mode === 'card' ? 'h-full' : 'aspect-[16/10]')}>
        Preview
      </div>
    );
  }

  if (shouldUseIframe) {
    return (
      <div className={clsx('relative overflow-hidden', mode === 'detail' ? 'aspect-[16/10]' : 'h-full w-full')}>
        {blobUrl && (
          <iframe
            src={blobUrl}
            title={template.name}
            scrolling="no"
            tabIndex={-1}
            className="pointer-events-none absolute left-0 top-0 border-none"
            style={{
              width: '400%',
              height: '400%',
              transform: 'scale(0.25)',
              transformOrigin: 'top left',
            }}
          />
        )}
      </div>
    );
  }

  return (
    <img
      src={template.preview_url}
      alt={`${template.name} preview`}
      className={clsx('w-full object-cover', mode === 'detail' ? 'aspect-[16/10]' : 'h-full transition duration-500 group-hover:scale-105')}
    />
  );
}

function TemplateGrid({ templates }: { templates: Template[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <article className="group rounded-2xl border border-line bg-panel p-3.5 transition duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-glow">
      <a
        href={`/templates/${template.id}`}
        className={clsx(
          'relative block aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br',
          categoryTone(template.category),
        )}
      >
        <TemplatePreviewMedia template={template} mode="card" />
        <span className="absolute right-3 top-3 inline-grid h-9 w-9 place-items-center rounded-lg border border-forest/10 bg-forest/60 text-panel backdrop-blur">
          <ArrowRight size={17} />
        </span>
      </a>
      <div className="px-1 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold text-forest">{template.name}</h3>
          <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-forest/55">
            {template.category}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.tags.map((tag) => (
            <span key={tag} className="rounded-md bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary">
              {tag}
            </span>
          ))}
        </div>
        <a
          href={`/templates/${template.id}`}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-4 py-3 text-sm font-semibold text-panel transition hover:brightness-110"
        >
          View details
          <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}

function SectionHeading({
  label,
  title,
  copy,
  align = 'center',
}: {
  label: string;
  title: string;
  copy: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={clsx('max-w-2xl', align === 'center' && 'mx-auto mb-10 text-center', align === 'left' && 'text-left')}>
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">{label}</div>
      <h2 className="font-display text-4xl font-bold tracking-normal text-forest sm:text-5xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-forest/70">{copy}</p>
    </div>
  );
}

function Notice({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-panel p-7 text-center">
      <MonitorSmartphone className="mx-auto mb-3 text-primary" size={28} />
      <h3 className="font-display text-xl font-semibold text-forest">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-forest/70">{copy}</p>
    </div>
  );
}

function TemplateSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-line bg-panel p-3.5">
          <div className="aspect-[16/9] animate-pulse rounded-xl bg-line/40" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded bg-line/40" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-line/40" />
          <div className="mt-5 h-11 animate-pulse rounded-xl bg-line/40" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="aspect-[16/10] animate-pulse rounded-2xl border border-line bg-line/40" />
      <div className="rounded-2xl border border-line bg-panel p-8">
        <div className="h-6 w-36 animate-pulse rounded bg-line/40" />
        <div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-line/40" />
        <div className="mt-5 h-24 animate-pulse rounded bg-line/40" />
        <div className="mt-8 h-12 animate-pulse rounded-xl bg-line/40" />
      </div>
    </div>
  );
}
