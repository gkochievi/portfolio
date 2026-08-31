import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLogout } from '@/auth/hooks';
import { SITE_URL } from '@/lib/site';

/** Map route path → translation key under admin.page.* */
const TITLE_KEYS: Record<string, string> = {
  '/': 'dashboard',
  '/bookings': 'bookings',
  '/walk-in': 'walk_in',
  '/time-off': 'time_off',
  '/customers': 'customers',
  '/services': 'services',
  '/barbers': 'barbers',
  '/promotions': 'promotions',
  '/audit': 'audit',
  '/analytics': 'analytics',
  '/landing': 'landing',
  '/settings': 'settings',
  '/notifications': 'notifications',
  '/reviews': 'reviews',
  '/users': 'users',
  '/profile': 'profile',
};

interface Props {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

export function Topbar({ collapsed, onToggleSidebar, onOpenMobile }: Props) {
  const { t } = useTranslation('admin');
  const { pathname } = useLocation();
  const key = TITLE_KEYS[pathname];
  const title = key
    ? t(`page.${key}`)
    : pathname.startsWith('/barbers/')
      ? t('page.barbers')
      : 'Nabadi Admin';
  const logout = useLogout();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-30 h-16 bg-bg border-b border-line flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobile}
          className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-muted hover:text-ink hover:bg-line/50 transition"
          aria-label={t('a11y.open_menu')}
        >
          <Menu className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-muted hover:text-ink hover:bg-line/50 transition"
          aria-label={collapsed ? t('a11y.expand_sidebar') : t('a11y.collapse_sidebar')}
        >
          <ToggleIcon className="h-4 w-4" />
        </button>
        <h1 className="font-display text-lg font-semibold text-ink truncate tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition px-3 py-1.5 rounded-pill hover:bg-line/50"
        >
          {t('view_site')} ↗
        </a>
        <Link
          to="/profile"
          aria-label={t('page.profile')}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink hover:bg-line/50 transition px-3 py-1.5 rounded-pill"
        >
          <UserRound className="h-4 w-4" />
          <span className="hidden sm:inline">{t('page.profile')}</span>
        </Link>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink hover:bg-line/50 transition px-3 py-1.5 rounded-pill disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t('sign_out')}</span>
        </button>
      </div>
    </header>
  );
}
