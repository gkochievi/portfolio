/**
 * Partner portal shell: guard (signed out -> /partner/login?next=, staff ->
 * /403, disabled partner -> "account disabled"), ochre band, identity, tabs.
 * Owner: shell.
 */
import { Suspense } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isNavActive, PORTAL_NAV } from '@/app/nav'
import { Logo, LogoMark, QueueMotif } from '@/components/brand'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { LanguageToggle, SearchTrigger, ThemeToggle, UserMenu } from '@/components/layout/chrome'
import { Button, PageSkeleton } from '@/components/ui'
import { http, isApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { signOutTo, useMe } from '@/lib/session'
import type { Currency } from '@/types'

export interface PortalMe {
  account: { id: string; name: string; nameKa: string; email: string; username: string | null; partnerId: string | null }
  partner: { id: string; name: string; legalName: string; currency: Currency }
}

/** The signed-in partner admin and their partner (`['me', 'portal']`). */
export function usePortalMe() {
  return useQuery({ queryKey: ['me', 'portal'], queryFn: () => http.get<PortalMe>('/portal/me') })
}

function DisabledScreen() {
  const { t } = useTranslation('shell')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <QueueMotif count={4} size={12} />
      <div className="mt-6 inline-flex size-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <Lock className="size-5 stroke-[1.75]" aria-hidden />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold tracking-[-0.02em]">{t('disabled.title')}</h1>
      <p className="mt-2 text-sm text-muted">{t('disabled.body')}</p>
      <Button className="mt-6" variant="secondary" icon={<LogOut aria-hidden />} onClick={() => void signOutTo('/partner/login')}>
        {t('common:actions.signOut')}
      </Button>
    </div>
  )
}

export function PortalLayout() {
  const { t } = useTranslation('common')
  const me = useMe()
  const location = useLocation()
  const portal = useQuery({
    queryKey: ['me', 'portal'],
    queryFn: () => http.get<PortalMe>('/portal/me'),
    enabled: me?.realm === 'partner',
  })

  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/partner/login?next=${next}`} replace />
  }
  if (me.realm !== 'partner') return <Navigate to="/403" replace />

  const disabled = isApiError(portal.error, 403)

  return (
    <div data-realm="partner" className="min-h-dvh bg-surface">
      <div className="h-1 bg-primary" aria-hidden />
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1360px] items-center gap-3 px-4 sm:px-6">
          <Link to="/partner" aria-label={t('chrome.home')} className="shrink-0 rounded-md">
            <span className="hidden sm:inline-flex"><Logo variant="partner" size={26} /></span>
            <span className="sm:hidden"><LogoMark variant="partner" size={26} /></span>
          </Link>
          <span className="hidden h-5 w-px bg-hairline-strong md:block" aria-hidden />
          <div className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="eyebrow">{t('app.partnerSpace')}</span>
            <span className="truncate text-[13px] font-semibold">{portal.data?.partner.name ?? ' '}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <SearchTrigger />
            <LanguageToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        {!disabled ? (
          <nav aria-label={t('nav.mainLabel')} className="mx-auto w-full max-w-[1360px] px-2 sm:px-4">
            <ul className="flex gap-1 overflow-x-auto scrollbar-thin">
              {PORTAL_NAV.map((item) => {
                const active = isNavActive(item, location.pathname, location.search)
                const Icon = item.icon
                return (
                  <li key={item.to} className="shrink-0">
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        '-mb-px inline-flex h-10 items-center gap-2 border-b-2 px-2.5 text-[13px] font-medium transition-colors',
                        active ? 'border-signal text-ink' : 'border-transparent text-muted hover:text-ink',
                      )}
                    >
                      <Icon className="size-4 stroke-[1.75]" aria-hidden />
                      {t(`nav.${item.label}`)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        ) : null}
      </header>
      <main id="main" className="mx-auto w-full max-w-[1360px] px-4 pb-24 pt-6 sm:px-6">
        {disabled ? (
          <DisabledScreen />
        ) : (
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        )}
      </main>
      <CommandPalette />
    </div>
  )
}
