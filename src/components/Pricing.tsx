import clsx from 'clsx';
import { ArrowRight, Check, Globe, MessageCircle, Palette, Rocket, Sparkles } from 'lucide-react';

interface PricingProps {
  whatsappHref: string;
}

const plans = [
  {
    id: 'trial' as const,
    name: 'Trial',
    price: 'Free',
    period: '7 days',
    features: [
      'Live custom subdomain',
      'Any one template',
      'Magic edit link',
      'Email verification, no card needed',
    ],
  },
  {
    id: 'six_months' as const,
    name: 'Six Months',
    price: '৳300',
    period: '6 months',
    highlight: true,
    features: [
      'Everything in Trial',
      'Template setup support',
      'Basic content updates',
      'Priority WhatsApp support',
    ],
  },
  {
    id: 'one_year' as const,
    name: 'One Year',
    price: '৳500',
    period: '1 year',
    features: [
      'Everything in Six Months',
      'Free template switch',
      'Renewal reminder',
      'Best long-term value',
    ],
  },
  {
    id: 'custom' as const,
    name: 'Custom',
    price: null,
    period: null,
    isCustom: true,
    features: [
      'Everything in One Year',
      'Custom domain support *',
      'Tailored design modifications',
      'Dedicated onboarding call',
      'Multi-page portfolio layout',
      'Analytics integration',
    ],
  },
];

export function Pricing({ whatsappHref }: PricingProps) {
  return (
    <>
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20 sm:px-7">
        <SectionHeading
          label="Pricing"
          title="Simple Taka Plans"
          copy="Four clean options for getting your portfolio online."
        />
        <PlanGrid whatsappHref={whatsappHref} />
      </section>
      <HowItWorks />
    </>
  );
}

export function PricingPage({ whatsappHref }: PricingProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-7">
      <SectionHeading
        label="Plans & Pricing"
        title="Simple Taka Plans"
        copy="No hidden fees. Pick the plan that fits your timeline and we'll get your portfolio live."
      />
      <PlanGrid whatsappHref={whatsappHref} />
      <DomainNotice whatsappHref={whatsappHref} />
      <CustomDomainInfo />
    </section>
  );
}

function PlanGrid({ whatsappHref }: PricingProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={clsx(
              'relative flex min-h-[26rem] flex-col rounded-2xl border p-7',
              plan.highlight
                ? 'border-primary bg-gradient-to-b from-primary/8 to-panel shadow-glow'
                : plan.isCustom
                  ? 'border-primary/40 bg-gradient-to-b from-sage/10 to-panel'
                  : 'border-line bg-panel',
            )}
          >
            {plan.highlight ? (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-forest to-primary px-4 py-1.5 text-xs font-bold text-panel">
                POPULAR
              </div>
            ) : plan.isCustom ? (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-sage to-[#B1D3B9] px-4 py-1.5 text-xs font-bold text-forest dark:text-panel">
                CUSTOM
              </div>
            ) : null}

            <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-primary">
              {plan.name}
            </p>

            <div className="mt-3 flex items-end gap-2">
              {plan.price ? (
                <>
                  <span className="font-display text-5xl font-bold text-forest">{plan.price}</span>
                  <span className="pb-2 text-sm text-forest/55">/ {plan.period}</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles size={20} className="text-primary" />
                  <span className="font-display text-2xl font-bold text-forest">Let's Talk</span>
                </div>
              )}
            </div>

            <div className="my-6 h-px bg-line" />

            <div className="flex flex-1 flex-col gap-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex gap-3 text-sm leading-6 text-forest/75">
                  <Check className="mt-0.5 shrink-0 text-primary" size={18} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {plan.isCustom ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-forest to-primary px-4 py-3 text-sm font-semibold text-panel transition hover:-translate-y-0.5"
              >
                Discuss my needs
                <MessageCircle size={16} />
              </a>
            ) : (
              <a
                href={`/start?plan=${plan.id}`}
                className={clsx(
                  'mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5',
                  plan.highlight
                    ? 'bg-gradient-to-br from-forest to-primary text-panel'
                    : 'border border-primary/60 text-primary hover:border-primary hover:bg-primary/10',
                )}
              >
                {`Start with ${plan.name}`}
                <ArrowRight size={16} />
              </a>
            )}
          </article>
        ))}
      </div>

      <p className="mt-5 text-center text-xs text-forest/45">
        * Custom domain (e.g. <span className="text-forest/70">yourname.com</span>) requires a
        separate domain registration fee — see below.
      </p>
    </>
  );
}

function DomainNotice({ whatsappHref }: PricingProps) {
  return (
    <div className="mt-14 rounded-2xl border border-primary/25 bg-primary/8 p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/12 text-primary">
          <Globe size={20} />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-forest">
            Want a custom domain?
          </h3>
          <p className="mt-1 text-sm leading-6 text-forest/75">
            Every plan includes a free subdomain like{' '}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-forest">
              yourname.portzen.xyz
            </span>{' '}
            at no extra cost.
          </p>
          <p className="mt-2 text-sm leading-6 text-forest/75">
            If you want your own domain (e.g.{' '}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-forest">
              yourname.com
            </span>
            ), you need to purchase it from a registrar. Domain prices typically range from{' '}
            <span className="font-semibold text-forest">৳1,000 – ৳2,500/year</span> depending
            on the extension (.com, .dev, .me, etc.) and registrar. PortZen handles the DNS setup
            and pointing — the domain fee is paid directly to the registrar.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-forest"
          >
            Ask us about custom domains <MessageCircle size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function CustomDomainInfo() {
  const faqs = [
    {
      q: 'Can I upgrade my plan later?',
      a: 'Yes. Message us on WhatsApp and we will prorate the remaining balance toward the new plan.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'bKash, Nagad, and bank transfer. We confirm every payment manually over WhatsApp.',
    },
    {
      q: 'What happens when my plan expires?',
      a: 'We send a renewal reminder before expiry. Your portfolio stays live for a short grace period while you renew.',
    },
    {
      q: 'Does the Custom plan include a domain purchase?',
      a: 'No. The Custom plan covers setup, hosting, and design work. Domain registration is always a separate cost paid directly to the registrar.',
    },
  ];

  return (
    <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
      {faqs.map((faq) => (
        <div key={faq.q} className="rounded-2xl border border-line bg-panel p-6">
          <p className="font-display text-sm font-semibold text-forest">{faq.q}</p>
          <p className="mt-2 text-sm leading-6 text-forest/75">{faq.a}</p>
        </div>
      ))}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Palette,
      title: 'Choose a template',
      copy: 'Pick a career-specific design from the template store.',
    },
    {
      icon: MessageCircle,
      title: 'Confirm on WhatsApp',
      copy: 'Share your details and complete payment through the PortZen support flow.',
    },
    {
      icon: Rocket,
      title: 'Go live',
      copy: 'Your portfolio is published on a custom subdomain and ready to share.',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-7">
      <SectionHeading
        label="How It Works"
        title="Get Live in 3 Steps"
        copy="A short path from template choice to hosted portfolio."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="rounded-2xl border border-line bg-panel p-7">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-primary/25 bg-primary/12 text-primary">
                  <Icon size={22} />
                </span>
                <span className="font-display text-3xl font-bold text-forest/20">0{index + 1}</span>
              </div>
              <h3 className="font-display text-xl font-semibold text-forest">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-forest/75">{step.copy}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({ label, title, copy }: { label: string; title: string; copy: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        {label}
      </div>
      <h2 className="font-display text-4xl font-bold tracking-normal text-forest sm:text-5xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-7 text-forest/70">{copy}</p>
    </div>
  );
}
