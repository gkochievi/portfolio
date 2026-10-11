import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  Eye,
  Headset,
  History,
  LayoutDashboard,
  Menu as MenuIcon,
  MessagesSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'

import type { Role } from '@/types'
import { request } from '@/lib/api'
import { signInAs, useAccount } from '@/lib/account'
import { useInvalidateOn } from '@/lib/realtime'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/format'
import { Logo } from '@/components/brand'
import { Badge, Button, CountBubble, Drawer, IconButton } from '@/components/ui'
import { useRouteGuard } from '../components/Guard'
import { HeaderControls, MobilePrefs } from '../components/HeaderControls'
import { HoursPill } from '../components/HoursPill'
import { useMe } from '../session'

interface NavItem {
  to: string
  key: string
  icon: ReactNode
  roles: Role[]
  end?: boolean
  badge?: 'team'
}

const ADMIN: Role[] = ['admin']
const BOTH: Role[] = ['admin', 'supervisor']
const ic = { strokeWidth: 1.75 }

const GROUPS: { key: string; items: NavItem[] }[] = [
  {
    key: 'nav.groupLive',
    items: [
      { to: '/admin', key: 'nav.dashboard', icon: <LayoutDashboard {...ic} />, roles: BOTH, end: true },
      { to: '/admin/chats', key: 'nav.chats', icon: <MessagesSquare {...ic} />, roles: BOTH },
      { to: '/admin/team', key: 'nav.team', icon: <UsersRound {...ic} />, roles: ADMIN, badge: 'team' },
    ],
  },
  {
    key: 'nav.groupInsights',
    items: [
      { to: '/admin/history', key: 'nav.history', icon: <History {...ic} />, roles: BOTH },
      { to: '/admin/statistics', key: 'nav.statistics', icon: <BarChart3 {...ic} />, roles: BOTH },
      { to: '/admin/activity', key: 'nav.activity', icon: <Activity {...ic} />, roles: ADMIN },
    ],
  },
  {
    key: 'nav.groupPeople',
    items: [
      { to: '/admin/operators', key: 'nav.operators', icon: <Users {...ic} />, roles: BOTH },
      { to: '/admin/admins', key: 'nav.admins', icon: <ShieldCheck {...ic} />, roles: ADMIN },
      { to: '/admin/supervisors', key: 'nav.supervisors', icon: <UserCog {...ic} />, roles: ADMIN },
    ],
  },
  {
    key: 'nav.groupConfig',
    items: [{ to: '/admin/settings', key: 'nav.settings', icon: <Settings {...ic} />, roles: ADMIN }],
  },
]

/** Sum of unread counts from GET /api/team/conversations, whatever its exact row shape. */
function useTeamUnread(enabled: boolean): number {
  useInvalidateOn(['staff:message', 'staff:conversation'], ['team', 'conversations'])
  const q = useQuery({
    queryKey: ['team', 'conversations'],
    queryFn: () => request<unknown>('GET', '/team/conversations'),
    enabled,
  })
  const rows: unknown[] = Array.isArray(q.data) ? q.data : Array.isArray((q.data as { conversations?: unknown[] } | undefined)?.conversations) ? (q.data as { conversations: unknown[] }).conversations : []
  return rows.reduce<number>((sum, r) => {
    const row = r as { unread?: unknown; unreadCount?: unknown }
    const n = typeof row.unreadCount === 'number' ? row.unreadCount : typeof row.unread === 'number' ? row.unread : 0
    return sum + n
  }, 0)
}

function SideNav({ role, teamUnread, onNavigate }: { role: Role; teamUnread: number; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-5">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => i.roles.includes(role))
        if (!items.length) return null
        return (
          <div key={g.key}>
            <p className="mb-1 px-3 text-[11px] font-medium text-muted">{t(g.key)}</p>
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    end={i.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'relative flex h-9 items-center gap-2.5 rounded-ui px-3 text-[13.5px] font-medium transition-colors [&_svg]:size-[18px]',
                        isActive
                          ? 'bg-accent-soft text-ink before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-accent [&_svg]:text-accent'
                          : 'text-muted hover:bg-hover hover:text-ink',
                      )
                    }
                  >
                    {i.icon}
                    <span className="flex-1 truncate">{t(i.key)}</span>
                    {i.badge === 'team' ? <CountBubble count={teamUnread} /> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

/** Admin + supervisor console: left nav per role, header with working-hours pill. */
export function AdminLayout() {
  const guard = useRouteGuard()
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const me = useMe()
  const [menuOpen, setMenuOpen] = useState(false)
  const role = account?.role ?? 'admin'
  const teamUnread = useTeamUnread(role === 'admin' && !guard)
  useEffect(() => setMenuOpen(false), [location.pathname])

  if (guard) return guard
  const tenantName = pickText(me.data?.tenant?.name, i18n.language)
  const linkedOperator = role === 'admin' ? me.data?.operator : null

  const brand = (
    <div className="flex items-center gap-3 px-3">
      <Logo size={28} />
    </div>
  )
  const tenantCard = (
    <div className="mx-0 rounded-ui border border-line bg-sunken px-3 py-2.5">
      <p className="truncate text-[13px] font-semibold text-ink">{tenantName || ' '}</p>
      <p className="text-[11px] text-muted">{t(role === 'supervisor' ? 'surface.supervisor' : 'surface.admin')}</p>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-panel px-3 py-4 md:flex">
        {brand}
        {tenantCard}
        <SideNav role={role} teamUnread={teamUnread} />
      </aside>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen} side="left" width={280} title={<Logo size={26} />} bodyClassName="flex flex-col gap-5 px-3" footer={<div className="w-full"><MobilePrefs /></div>}>
        {tenantCard}
        <SideNav role={role} teamUnread={teamUnread} onNavigate={() => setMenuOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel/95 px-3 backdrop-blur-sm sm:px-6">
          <IconButton className="md:hidden" label={t('nav.openMenu')} icon={<MenuIcon strokeWidth={1.75} />} onClick={() => setMenuOpen(true)} />
          <span className="truncate text-[13px] font-semibold md:hidden">{tenantName}</span>
          <HoursPill status={me.data?.workingHours} />
          {role === 'supervisor' ? (
            <Badge tone="info" icon={<Eye />} className="hidden sm:inline-flex">
              {t('header.readOnly')}
            </Badge>
          ) : null}
          <div className="flex-1" />
          {linkedOperator ? (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Headset strokeWidth={1.75} />}
              className="hidden sm:inline-flex"
              onClick={() => {
                const op = signInAs(linkedOperator.id)
                qc.clear()
                navigate(op.homeRoute)
              }}
            >
              {t('header.goOperator')}
            </Button>
          ) : null}
          <HeaderControls />
        </header>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
