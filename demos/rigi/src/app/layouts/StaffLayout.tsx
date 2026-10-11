/**
 * Staff shell: guard (signed out -> /login?next=, wrong role -> /403), the
 * light 232px sidebar for `area`, the 56px top bar. Owner: shell.
 */
import { Suspense, useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isNavActive, STAFF_NAV, AREA_HOME } from '@/app/nav'
import { LogoMark } from '@/components/brand'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { LanguageToggle, SearchTrigger, ThemeToggle, UserMenu } from '@/components/layout/chrome'
import { Sidebar, SidebarContent } from '@/components/layout/Sidebar'
import { Drawer, IconButton, PageSkeleton } from '@/components/ui'
import { canOpenArea, useMe } from '@/lib/session'
import type { StaffArea } from '@/types'

function Breadcrumb({ area }: { area: StaffArea }) {
  const { t } = useTranslation('common')
  const { pathname, search } = useLocation()
  const items = STAFF_NAV[area].flatMap((g) => g.items)
  const current = items.filter((i) => !i.end).find((i) => isNavActive(i, pathname, search))
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link to={AREA_HOME[area]} className="truncate text-muted hover:text-ink">{t(`nav.areas.${area}`)}</Link>
      {current ? (
        <>
          <ChevronRight className="size-3.5 shrink-0 stroke-[1.75] text-subtle" aria-hidden />
          <Link to={current.to} className="truncate font-medium text-ink">{t(`nav.${current.label}`)}</Link>
        </>
      ) : null}
    </nav>
  )
}

export function StaffLayout({ area }: { area: StaffArea }) {
  const { t } = useTranslation('common')
  const me = useMe()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (!canOpenArea(me, area)) return <Navigate to="/403" replace state={{ from: location.pathname }} />

  return (
    <div data-area={area} data-realm="staff" className="min-h-dvh bg-surface">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-panel focus:px-3 focus:py-2">
        {t('chrome.skipToContent')}
      </a>
      <Sidebar area={area} />
      <Drawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="left"
        title={t('nav.mainLabel')}
        widthClassName="w-[272px]"
        className="lg:hidden [&>div:first-child]:hidden [&>div:nth-child(2)]:p-0"
      >
        <SidebarContent area={area} onNavigate={() => setMenuOpen(false)} />
      </Drawer>
      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-hairline bg-surface/90 px-4 backdrop-blur sm:px-6">
          <IconButton label={t('chrome.openMenu')} icon={<Menu aria-hidden />} onClick={() => setMenuOpen(true)} className="-ml-2 lg:hidden" tooltip={false} />
          <Link to={me.home} className="lg:hidden" aria-label={t('chrome.home')}>
            <LogoMark size={24} />
          </Link>
          <div className="hidden min-w-0 flex-1 sm:flex">
            <Breadcrumb area={area} />
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SearchTrigger />
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1360px] px-4 pb-24 pt-6 sm:px-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
