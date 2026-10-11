import { useQuery } from '@tanstack/react-query'
import { Eye, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Logo, LogoMark } from '@/components/brand'
import { Drawer, IconButton, Tooltip } from '@/components/ui'
import { get } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAccount, useActingTenantId } from '@/lib/session'
import { GlossToggle, LangToggle, TenantSwitcher, ThemeToggle, UserMenu } from './controls'
import { navFor } from './nav'

/** Rail expanded state lives in memory for the session (no storage). */
let railExpanded = true

function Rail({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  const account = useAccount()
  const sections = navFor(account)
  return (
    <nav aria-label={t('nav.main')} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
      {sections.map((section, si) => (
        <div key={si} className={cn(si > 0 && 'mt-4')}>
          {section.heading ? (
            expanded ? (
              <div className="caps mb-1.5 px-3 text-[10.5px] font-semibold text-subtle">{t(section.heading)}</div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden />
            )
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const label = t(item.label)
              const link = (
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  aria-label={expanded ? undefined : label}
                  className={({ isActive }) =>
                    cn(
                      'relative flex h-10 items-center gap-3 rounded-ctl text-[13.5px] font-medium transition-colors',
                      expanded ? 'px-3' : 'justify-center',
                      isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-ink/5 hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute inset-y-2 -left-3 w-0.5 rounded-full bg-primary" aria-hidden /> : null}
                      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      {expanded ? <span className="truncate">{label}</span> : null}
                    </>
                  )}
                </NavLink>
              )
              return (
                <li key={item.to}>
                  {expanded ? link : <Tooltip content={label} side="right">{link}</Tooltip>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

interface TenantOption {
  id: string
  name: string
  name_ka: string
}

/** Bronze strip shown while the operator acts inside a tenant workspace. */
function ActingStrip() {
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const acting = useActingTenantId()
  const { pathname } = useLocation()
  const isOperator = account?.role === 'operator'
  const { data } = useQuery({
    queryKey: ['shell', 'tenants'],
    queryFn: () => get<TenantOption[]>('/auth/tenants'),
    enabled: isOperator,
    staleTime: 60_000,
  })
  const inWorkspace = pathname.startsWith('/workspace') || pathname.startsWith('/copilot')
  if (!isOperator || !acting || !inWorkspace) return null
  const tenant = data?.find((tn) => tn.id === acting)
  if (!tenant) return null
  return (
    <div className="flex h-8 items-center justify-center gap-2 border-b border-accent/25 bg-accent/12 px-4 text-[12.5px] font-medium text-accent" role="status">
      <Eye className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{t('actingAs', { name: i18n.language === 'ka' ? tenant.name_ka : tenant.name })}</span>
      <span className="hidden truncate font-normal text-accent/80 md:inline">· {t('actingAsHint')}</span>
    </div>
  )
}

/** Signed-in chrome: left rail (72/248 px), top bar, act-as strip. */
export function AppShell() {
  const { t } = useTranslation('shell')
  const account = useAccount()
  const [expanded, setExpandedState] = useState(railExpanded)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const setExpanded = (v: boolean) => {
    railExpanded = v
    setExpandedState(v)
  }
  useEffect(() => setMobileOpen(false), [pathname])
  const home = account?.home ?? '/'

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-ctl focus:bg-panel focus:px-3 focus:py-2">
        {t('skip')}
      </a>
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 lg:flex',
          expanded ? 'w-[248px]' : 'w-[72px]',
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center border-b border-line', expanded ? 'justify-between pl-5 pr-2' : 'justify-center')}>
          <Link to={home} className="rounded-ctl" aria-label={t('common:brand.name')}>
            {expanded ? <Logo size={28} className="text-[22px]" /> : <LogoMark size={30} />}
          </Link>
          {expanded ? (
            <IconButton size="sm" label={t('nav.collapse')} icon={<PanelLeftClose />} onClick={() => setExpanded(false)} />
          ) : null}
        </div>
        <Rail expanded={expanded} />
        {!expanded ? (
          <div className="flex justify-center border-t border-line py-2">
            <IconButton size="sm" label={t('nav.expand')} icon={<PanelLeftOpen />} onClick={() => setExpanded(true)} />
          </div>
        ) : null}
      </aside>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen} side="left" width={280} title={<Logo size={26} className="text-xl" />}>
        <div className="-mx-5 -my-4 flex h-full flex-col">
          <Rail expanded onNavigate={() => setMobileOpen(false)} />
        </div>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg px-3 sm:px-4 lg:px-6">
          <IconButton className="lg:hidden" size="sm" label={t('nav.openMenu')} icon={<Menu />} onClick={() => setMobileOpen(true)} noTooltip />
          <Link to={home} className="lg:hidden" aria-label={t('common:brand.name')}>
            <LogoMark size={26} />
          </Link>
          <TenantSwitcher />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <GlossToggle />
            <LangToggle />
            <ThemeToggle />
            <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
            <UserMenu />
          </div>
        </header>
        <ActingStrip />
        <main id="main" className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
