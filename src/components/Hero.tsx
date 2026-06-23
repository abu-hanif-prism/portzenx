import { Grid2X2, MessageCircle } from 'lucide-react';

interface HeroProps {
  whatsappHref: string;
}

export function Hero({ whatsappHref }: HeroProps) {
  return (
    <>
      <section
        id="top"
        className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-14 sm:px-7 lg:grid-cols-[1.12fr_0.88fr] lg:pb-20 lg:pt-20"
      >
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_rgba(101,146,135,0.8)]" />
            For Bangladeshi freelancers and job seekers
          </div>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.04] tracking-normal text-forest sm:text-6xl lg:text-7xl">
            Professional Portfolio{' '}
            <span className="bg-gradient-to-r from-forest via-primary to-sage bg-clip-text text-transparent">
              Live in Minutes
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-forest/75 sm:text-lg">
            Custom subdomain, mobile-ready templates, Supabase-powered customer edits, and plans
            starting at <span className="font-semibold text-forest">৳50</span>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#templates"
              className="inline-flex items-center gap-2 rounded-[13px] bg-gradient-to-br from-forest to-primary px-6 py-3.5 text-sm font-semibold text-panel shadow-glow transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Browse Templates
              <Grid2X2 size={18} />
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[13px] bg-[#25D366] px-6 py-3.5 text-sm font-bold text-[#06281A] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <MessageCircle size={18} />
              WhatsApp CTA
            </a>
          </div>
        </div>
        <HeroPreview />
      </section>
      <StatsBar />
    </>
  );
}

function HeroPreview() {
  return (
    <div className="hero-float relative mx-auto w-full max-w-md">
      <div className="absolute inset-[-2rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[18px] border border-line bg-panel shadow-[0_34px_90px_rgba(101,146,135,0.22)]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="ml-2 truncate text-xs font-medium text-forest/40">ayesha.portzen.app</span>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-forest to-primary font-display text-xl font-bold text-panel">
              AR
            </div>
            <div>
              <p className="font-display text-xl font-bold text-forest">Ayesha Rahman</p>
              <p className="text-sm font-medium text-forest/65">Frontend Developer</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['React', 'UI/UX', 'Figma'].map((tag) => (
              <span key={tag} className="rounded-md bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {[92, 74, 61].map((width) => (
              <div key={width} className="h-2 overflow-hidden rounded-full bg-line/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-forest to-primary"
                  style={{ width: `${width}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBar() {
  return (
    <section className="border-y border-line bg-line/30">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-9 text-center sm:grid-cols-3 sm:px-7">
        <Stat value="500+" label="Portfolios Created" />
        <Stat value="10+" label="Templates" />
        <Stat value="৳50" label="Starting Price" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-4xl font-bold tracking-normal text-forest sm:text-5xl">{value}</div>
      <div className="mt-2 text-sm text-forest/60">{label}</div>
    </div>
  );
}
