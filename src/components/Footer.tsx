import { MessageCircle } from 'lucide-react';

interface FooterProps {
  whatsappHref: string;
}

export function Footer({ whatsappHref }: FooterProps) {
  return (
    <footer className="relative z-10 border-t border-line bg-line/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-9 sm:px-7 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-forest to-primary font-display font-bold text-white">
              P
            </span>
            <span className="font-display text-lg font-bold text-forest">PortZen</span>
          </div>
          <p className="mt-2 text-sm text-forest/65">Your Portfolio. Live in Minutes.</p>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          <MessageCircle size={18} />
          Chat on WhatsApp
        </a>
      </div>
      <div className="border-t border-line px-4 py-5 text-center text-xs text-forest/45">
        © 2026 PortZen. All rights reserved.
      </div>
    </footer>
  );
}
