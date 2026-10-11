import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileTabBar } from './MobileTabBar';
import { CartDrawer } from './CartDrawer';
import { DemoConsole } from './DemoConsole';
import { AuthModal, StampCelebration } from './Overlays';
import { Toaster } from '../ui/Toaster';

export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    // Deep links (#blend-studio, #explore-3d…): wait for lazy sections to mount, then scroll
    let tries = 0;
    const id = window.setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 30) {
        window.clearInterval(id);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [pathname, hash]);
  return null;
}

/** Shared chrome for every page. `overlay` lets the hero sit under a transparent nav. */
export function AppShell({ children, overlay = false, footer = true, tabBar = true }: { children: ReactNode; overlay?: boolean; footer?: boolean; tabBar?: boolean }) {
  return (
    <div className="relative min-h-screen">
      <Navbar overlay={overlay} />
      <main className={overlay ? '' : 'pt-[64px] md:pt-[72px]'}>{children}</main>
      {footer && <Footer />}
      {tabBar && <MobileTabBar />}
      <CartDrawer />
      <AuthModal />
      <StampCelebration />
      <DemoConsole />
      <Toaster />
    </div>
  );
}
