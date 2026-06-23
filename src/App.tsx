import { useEffect, useMemo } from 'react';
import { AdminPortal } from './components/AdminPortal';
import { EditPortal } from './components/EditPortal';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { Navbar } from './components/Navbar';
import { Pricing, PricingPage } from './components/Pricing';
import { TemplateDetail, Templates, TopTemplates } from './components/Templates';
import { whatsappNumber } from './lib/supabase';
import { usePortZenStore } from './store/usePortZenStore';

function App() {
  const theme = usePortZenStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent('Hi PortZen, I want to host my portfolio.');
    return `https://wa.me/${whatsappNumber}?text=${text}`;
  }, []);
  const path = window.location.pathname;
  const templateId = path.startsWith('/templates/') ? decodeURIComponent(path.replace('/templates/', '')) : undefined;
  const isTemplateCatalog = path === '/templates';
  const isEditPortal = path === '/edit';
  const isPricingPage = path === '/pricing';
  const isAdminPortal = path === '/admin';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink text-forest">
      <BackgroundGlow />
      <Navbar whatsappHref={whatsappHref} />
      <main className="relative z-10">
        {isAdminPortal ? (
          <AdminPortal />
        ) : isEditPortal ? (
          <EditPortal />
        ) : templateId ? (
          <TemplateDetail templateId={templateId} whatsappHref={whatsappHref} />
        ) : isTemplateCatalog ? (
          <Templates />
        ) : isPricingPage ? (
          <PricingPage whatsappHref={whatsappHref} />
        ) : (
          <>
            <Hero whatsappHref={whatsappHref} />
            <TopTemplates />
            <Pricing whatsappHref={whatsappHref} />
          </>
        )}
      </main>
      <Footer whatsappHref={whatsappHref} />
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="bg-glow-one absolute -top-32 left-4 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--c-primary) / 0.16), transparent 68%)' }}
      />
      <div
        className="bg-glow-two absolute right-[-8rem] top-[28rem] h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--c-sage) / 0.13), transparent 68%)' }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-72 w-[48rem] -translate-x-1/2 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--c-line) / 0.10), transparent 70%)' }}
      />
    </div>
  );
}

export default App;
