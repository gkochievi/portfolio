/**
 * Organiser console: 232px rail (64px icons under 1024px, bottom-sheet menu
 * on phones), top bar with the event switcher, view-only tag, KA/EN, theme,
 * role badge and account menu; content up to 1200px.
 */
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  CalendarDays,
  ContactRound,
  Gift,
  LayoutDashboard,
  ListChecks,
  Menu,
  MonitorPlay,
  Settings2,
  Snowflake,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { Lockup, Logo } from '@/components/brand'
import { BottomSheet, IconButton, RoleBadge, Select, StatusBadge, Tooltip, ViewOnlyTag } from '@/components/ui'
import { http } from '@/lib/api'
import { cn } from '@/lib/cn'
import { canEditRole, isSuperRole } from '@/lib/roles'
import type { EventSummary } from '@/types'
import { eventIdFromPath, useAdminEventId } from './adminEvent'
import { LanguageToggle, ThemeToggle, UserMenu } from './controls'
import { useCurrentUser } from './session'

interface RailItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

function useEventList() {
  return useQuery({
    queryKey: ['events', 'switcher'],
    queryFn: () => http.get<EventSummary[]>('/admin/events'),
    staleTime: 10_000,
  })
}

function useRail() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const eventId = useAdminEventId()
  const { data: events } = useEventList()
  const role = user?.role ?? 'SUPERVISOR'
  const editor = canEditRole(role)

  const main: RailItem[] = [
    { to: '/admin', label: t('shell:nav.dashboard'), icon: LayoutDashboard, end: true },
    ...(editor ? [{ to: '/admin/events', label: t('shell:nav.events'), icon: CalendarDays, end: true }] : []),
    { to: '/admin/leaderboard', label: t('shell:nav.standings'), icon: Trophy },
    { to: '/admin/participants', label: t('shell:nav.participants'), icon: ContactRound },
    { to: '/admin/insights', label: t('shell:nav.insights'), icon: BarChart3 },
    ...(isSuperRole(role) ? [{ to: '/admin/people', label: t('shell:nav.people'), icon: Users }] : []),
  ]
  const eventItems: RailItem[] =
    editor && eventId
      ? [
          { to: `/admin/events/${eventId}`, label: t('shell:nav.eventSettings'), icon: Settings2, end: true },
          { to: `/admin/events/${eventId}/items`, label: t('shell:nav.items'), icon: Snowflake },
          { to: `/admin/events/${eventId}/trivia`, label: t('shell:nav.trivia'), icon: ListChecks },
          { to: `/admin/events/${eventId}/prizes`, label: t('shell:nav.eventPrizes'), icon: Gift },
        ]
      : []
  const eventName = events?.find((event) => event.id === eventId)?.name ?? null
  return { main, eventItems, eventName }
}

function RailLink({ item, collapsed, onNavigate }: { item: RailItem; collapsed?: boolean; onNavigate?: () => void }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex h-10 items-center gap-3 rounded-card px-3 text-[15px] font-medium transition-colors',
          collapsed && 'justify-center px-0 lg:justify-start lg:px-3',
          isActive ? 'bg-primary-soft font-semibold text-primary' : 'text-muted hover:bg-sunken hover:text-ink',
        )
      }
    >
      <item.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className={cn('truncate', collapsed && 'hidden lg:inline')}>{item.label}</span>
    </NavLink>
  )
  if (!collapsed) return link
  return (
    <>
      <span className="hidden lg:contents">{link}</span>
      <span className="contents lg:hidden">
        <Tooltip content={item.label} side="right">
          {link}
        </Tooltip>
      </span>
    </>
  )
}

function RailNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { main, eventItems, eventName } = useRail()
  return (
    <nav aria-label={t('shell:rail.console')} className="flex flex-col gap-1">
      {main.map((item) => (
        <RailLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
      {eventItems.length > 0 && (
        <>
          <div className={cn('mt-5 px-3 pb-1', collapsed && 'hidden lg:block')}>
            <div className="text-xs font-semibold text-muted">{t('shell:rail.event')}</div>
            {eventName && <div className="truncate text-sm font-semibold text-ink">{eventName}</div>}
          </div>
          {collapsed && <div className="mx-3 my-3 h-[1.5px] bg-line lg:hidden" aria-hidden />}
          {eventItems.map((item) => (
            <RailLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </>
      )}
    </nav>
  )
}

function EventSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { data: events, isLoading } = useEventList()
  const eventId = useAdminEventId()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const onChange = (id: string) => {
    const routeId = eventIdFromPath(pathname)
    if (routeId) {
      navigate(pathname.replace(`/admin/events/${routeId}`, `/admin/events/${id}`))
      return
    }
    const next = new URLSearchParams(params)
    next.set('event', id)
    setParams(next, { replace: true })
  }

  return (
    <Select
      size="sm"
      aria-label={t('shell:switcher.label')}
      icon={<CalendarDays />}
      value={eventId && events?.some((event) => event.id === eventId) ? eventId : undefined}
      onValueChange={onChange}
      disabled={isLoading || !events?.length}
      placeholder={events && events.length === 0 ? t('shell:switcher.empty') : t('shell:switcher.placeholder')}
      options={(events ?? []).map((event) => ({
        value: event.id,
        label: event.name,
        hint: <StatusBadge status={event.status} size="sm" />,
      }))}
      className={className}
    />
  )
}

export function AdminShell() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <div className="min-h-dvh bg-surface md:pl-16 lg:pl-[232px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r-[1.5px] border-line bg-panel md:flex lg:w-[232px]">
        <Link to="/admin" className="flex h-16 shrink-0 items-center justify-center px-3 lg:justify-start lg:px-5" aria-label={t('shell:nav.dashboard')}>
          <span className="lg:hidden">
            <Logo size={32} />
          </span>
          <span className="hidden lg:inline-flex">
            <Lockup size={30} />
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto px-2 py-3 lg:px-3">
          <RailNav collapsed />
        </div>
        <div className="border-t-[1.5px] border-line px-2 py-3 lg:px-3">
          <RailLink item={{ to: '/', label: t('shell:nav.playerView'), icon: MonitorPlay, end: true }} collapsed />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b-[1.5px] border-line bg-panel">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:px-8">
          <IconButton className="md:hidden" label={t('shell:rail.openMenu')} icon={<Menu />} onClick={() => setMenuOpen(true)} />
          <Link to="/admin" className="md:hidden" aria-label={t('shell:nav.dashboard')}>
            <Logo size={30} />
          </Link>
          <EventSwitcher className="hidden w-[300px] md:flex" />
          <div className="flex-1" />
          {user?.role === 'SUPERVISOR' && <ViewOnlyTag className="hidden sm:inline-flex" />}
          {user && <RoleBadge role={user.role} className="hidden lg:inline-flex" />}
          <LanguageToggle />
          <ThemeToggle />
          <UserMenu />
        </div>
        <div className="flex items-center gap-2 border-t border-line px-3 py-2 md:hidden">
          <EventSwitcher className="min-w-0 flex-1" />
          {user?.role === 'SUPERVISOR' && <ViewOnlyTag className="sm:hidden" />}
        </div>
      </header>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title={t('shell:rail.console')}>
        <div className="flex flex-col gap-1 pb-20 pt-1">
          <RailNav onNavigate={() => setMenuOpen(false)} />
          <div className="my-2 h-[1.5px] bg-line" aria-hidden />
          <RailLink item={{ to: '/', label: t('shell:nav.playerView'), icon: MonitorPlay, end: true }} onNavigate={() => setMenuOpen(false)} />
        </div>
      </BottomSheet>

      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 lg:px-8 lg:pt-8">
        <Outlet />
      </main>
    </div>
  )
}
