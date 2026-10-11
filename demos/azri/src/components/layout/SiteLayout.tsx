import { useSession } from '@portfolio/demo-kit'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { AzriLogo, AzriMark } from '@/components/brand/Logo'
import { session } from '@/demo/core'
import { cn } from '@/lib/utils'
import { consoleHref, HeaderControls, SkipLink } from './chrome'

/**
 * Azri-branded chrome for the public launcher surfaces (SMS inbox, API
 * playground, 404): logo, nav (Inbox, Playground, Console), ENG | ქარ, theme,
 * account. Pages render inside a max-w-6xl container with side gutters, so
 * they should not add their own outer padding. Owner: shell agent.
 */
export function SiteLayout() {
  const { t } = useTranslation('shell')
  const me = useSession(session)
  const year = new Date().getFullYear()

  const links = [
    { to: '/', label: t('nav.inbox'), end: true },
    { to: '/playground', label: t('nav.playground'), end: false },
    { to: consoleHref(me), label: t('nav.console'), end: false },
  ]

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors',
      isActive ? 'bg-primary-soft font-semibold text-on-primary-soft' : 'text-muted hover:bg-ink/6 hover:text-ink',
    )

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0 rounded-lg" aria-label="Azri">
            <AzriLogo size={28} />
          </Link>
          <nav aria-label={t('nav.primary')} className="ml-2 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink key={link.label} to={link.to} end={link.end} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <HeaderControls className="ml-auto" />
        </div>
        <nav aria-label={t('nav.primary')} className="scrollbar-none flex gap-1 overflow-x-auto px-4 pb-2.5 md:hidden">
          {links.map((link) => (
            <NavLink key={link.label} to={link.to} end={link.end} className={navClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-24 pt-8 text-[13px] text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex max-w-md items-start gap-3">
            <AzriMark size={28} />
            <div>
              <p className="font-display text-[15px] font-semibold text-ink">{t('common:tagline')}</p>
              <p className="mt-1">{t('site.about')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-mint" aria-hidden="true" />
              {t('site.resetNote')}
            </span>
            <span>{t('site.rights', { year })}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
