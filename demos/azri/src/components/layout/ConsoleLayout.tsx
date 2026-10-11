import { useSession } from '@portfolio/demo-kit'
import { MonitorCog } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { AzriLogo } from '@/components/brand/Logo'
import { Avatar, Tooltip } from '@/components/ui'
import { session } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { cn } from '@/lib/utils'
import { accountName, CONSOLE_NAV, DEMO_NAV, HeaderControls, SkipLink, type NavItem } from './chrome'

/**
 * Console frame: 240px left rail (role-aware nav), top bar with the account
 * menu, ENG | ქარ and theme; "Simulated CRM view" label. On phones the rail
 * collapses into a scrollable tab row under the top bar. Base text is 14px.
 * Pages render inside a max-w-[1280px] padded <main>. Owner: shell agent.
 */
export function ConsoleLayout() {
  const me = useSession(session)
  const { t } = useTranslation('shell')
  const lang = useLang()
  const role = me?.role === 'admin' || me?.role === 'agent' ? me.role : 'admin'
  const items = CONSOLE_NAV[role]

  const railLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors [&_svg]:size-5 [&_svg]:shrink-0',
      isActive ? 'bg-primary-soft font-semibold text-on-primary-soft' : 'text-muted hover:bg-ink/6 hover:text-ink',
    )
  const tabLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
      isActive ? 'bg-primary-soft font-semibold text-on-primary-soft' : 'text-muted hover:bg-ink/6 hover:text-ink',
    )

  const renderItem = (item: NavItem, className: typeof railLink) => {
    const Icon = item.icon
    return (
      <NavLink key={item.to + item.key} to={item.to} end={item.end} className={className}>
        <Icon strokeWidth={1.75} aria-hidden="true" />
        <span className="truncate">{t(`nav.${item.key}`)}</span>
      </NavLink>
    )
  }

  const simulated = (
    <Tooltip content={t('console.simulatedHint')}>
      <span
        tabIndex={0}
        className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full border border-dashed border-border-strong px-2.5 text-xs font-semibold text-muted"
      >
        <MonitorCog className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        {t('console.simulated')}
      </span>
    </Tooltip>
  )

  return (
    <div className="min-h-dvh bg-surface text-sm text-ink lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-border bg-panel px-3 pb-20 pt-5 lg:flex">
        <Link to={me?.home ?? '/console'} className="mb-4 w-fit rounded-lg px-2" aria-label="Azri">
          <AzriLogo size={26} />
        </Link>
        <div className="mb-5 px-2">{simulated}</div>
        <nav aria-label={t('nav.consoleSection')} className="flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{t('nav.consoleSection')}</p>
          {items.map((item) => renderItem(item, railLink))}
        </nav>
        <nav aria-label={t('nav.demoSection')} className="mt-6 flex flex-col gap-0.5">
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{t('nav.demoSection')}</p>
          {DEMO_NAV.map((item) => renderItem(item, railLink))}
        </nav>
        {me && (
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-panel-2 p-3">
            <Avatar name={me.name} color={me.avatarColor} size="md" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{accountName(me, lang)}</p>
              <p className="truncate text-xs text-muted">{t(`roles.${me.role}`)}</p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
            <Link to={me?.home ?? '/console'} className="rounded-lg lg:hidden" aria-label="Azri">
              <AzriLogo size={24} />
            </Link>
            <div className="hidden sm:block lg:hidden">{simulated}</div>
            <HeaderControls className="ml-auto" />
          </div>
          <nav aria-label={t('nav.consoleSection')} className="scrollbar-none flex gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">
            {items.map((item) => renderItem(item, tabLink))}
            <span className="mx-1 my-2 w-px shrink-0 bg-border" aria-hidden="true" />
            {DEMO_NAV.map((item) => renderItem(item, tabLink))}
          </nav>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-24 pt-6 focus:outline-none lg:px-8 lg:pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
