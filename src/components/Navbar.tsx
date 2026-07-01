import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ArrowRight, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { usePortZenStore } from '../store/usePortZenStore';

interface NavbarProps {
  whatsappHref: string;
}

export function Navbar({ whatsappHref }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = usePortZenStore((state) => state.theme);
  const toggleTheme = usePortZenStore((state) => state.toggleTheme);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', menuOpen);
    return () => document.body.classList.remove('overflow-hidden');
  }, [menuOpen]);

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 border-b px-4 py-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 sm:px-7',
        scrolled || menuOpen
          ? 'border-line bg-ink/90 shadow-[0_10px_30px_rgba(101,146,135,0.15)] backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-forest to-primary font-display text-base font-bold text-panel shadow-[0_8px_20px_rgba(101,146,135,0.35)]">
            P
          </span>
          <span className="font-display text-xl font-bold tracking-normal text-forest">PortZen</span>
        </a>
        <div className="hidden items-center gap-1 md:flex">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/templates" target="_blank">Templates</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
          <NavLink href="/edit" target="_blank">Edit existing account</NavLink>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="ml-1 grid h-9 w-9 place-items-center rounded-lg border border-line text-forest/65 transition hover:border-primary/70 hover:text-forest"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="ml-1 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-forest to-primary px-5 py-2.5 text-sm font-semibold text-panel shadow-[0_8px_22px_rgba(101,146,135,0.35)] transition hover:brightness-110"
          >
            Get Started
            <ArrowRight size={16} />
          </a>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-line text-forest/65 transition hover:border-primary/70 hover:text-forest"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp"
            className="inline-grid h-10 w-10 place-items-center rounded-[10px] bg-[#25D366] text-[#06281A]"
          >
            <MessageCircle size={20} />
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="grid h-10 w-10 place-items-center rounded-[10px] border border-line text-forest/65 transition hover:border-primary/70 hover:text-forest"
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mx-auto mt-3 flex max-w-7xl flex-col gap-1 border-t border-line pb-1 pt-3 md:hidden">
          <MobileNavLink href="/" onNavigate={() => setMenuOpen(false)}>Home</MobileNavLink>
          <MobileNavLink href="/templates" target="_blank" onNavigate={() => setMenuOpen(false)}>Templates</MobileNavLink>
          <MobileNavLink href="/pricing" onNavigate={() => setMenuOpen(false)}>Pricing</MobileNavLink>
          <MobileNavLink href="/edit" target="_blank" onNavigate={() => setMenuOpen(false)}>Edit existing account</MobileNavLink>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-[10px] bg-gradient-to-br from-forest to-primary px-5 py-3 text-sm font-semibold text-panel shadow-[0_8px_22px_rgba(101,146,135,0.35)] transition hover:brightness-110"
          >
            Get Started
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children, target }: { href: string; children: string; target?: string }) {
  return (
    <a
      href={href}
      target={target}
      rel={target === '_blank' ? 'noreferrer' : undefined}
      className="rounded-lg px-3 py-2 text-sm font-medium text-forest/65 transition hover:bg-primary/10 hover:text-forest"
    >
      {children}
    </a>
  );
}

function MobileNavLink({
  href, children, target, onNavigate,
}: { href: string; children: string; target?: string; onNavigate: () => void }) {
  return (
    <a
      href={href}
      target={target}
      rel={target === '_blank' ? 'noreferrer' : undefined}
      onClick={onNavigate}
      className="rounded-lg px-3 py-3 text-base font-medium text-forest/75 transition hover:bg-primary/10 hover:text-forest"
    >
      {children}
    </a>
  );
}
