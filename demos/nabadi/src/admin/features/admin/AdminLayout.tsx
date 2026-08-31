import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetTitleHidden } from '@/components/Sheet';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const STORAGE_KEY = 'admin-sidebar-collapsed';

export function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('admin');
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Storage access itself can throw (blocked cookies, some webviews);
      // a sidebar preference is not worth taking the whole console down.
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);

  // Auto-close mobile drawer on route change.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-ink focus:text-bg focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {t('skip_to_main')}
      </a>
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile nav drawer — Radix Sheet gives us focus trap, Esc-to-close,
          and role=dialog for free (same primitive as the detail sheets). */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="md:hidden p-0 w-64 border-line"
          closeLabel={t('a11y.close_menu')}
        >
          <SheetTitleHidden>{t('a11y.menu')}</SheetTitleHidden>
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          collapsed={collapsed}
          onToggleSidebar={toggleSidebar}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 md:px-8 py-6 md:py-8 overflow-x-auto focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
