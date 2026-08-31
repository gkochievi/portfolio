import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  CreditCard,
  Images,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Printer,
  Search,
  UserRound,
  X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { APP_BASE } from '@/lib/bootstrap'
import { useOverlay } from '@/lib/overlay'
import { useSocket } from '@/lib/socket'
import { useLogout, useSession, useUnreadCount } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { LogoLockup } from './Logo'
import { CommandPalette } from './CommandPalette'

export interface NavItem {
  to: string
  labelKey: string
  icon: typeof LayoutGrid
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutGrid, end: true },
  { to: '/devices', labelKey: 'nav.devices', icon: Printer },
  { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
  { to: '/photos', labelKey: 'nav.photos', icon: Images },
  { to: '/notifications', labelKey: 'nav.notifications', icon: Bell },
  { to: '/payments', labelKey: 'nav.payments', icon: CreditCard },
]

/* ------------------------------------------------------------ LiveIndicator */

function LiveIndicator({ state }: { state: 'connecting' | 'open' | 'closed' }) {
  const { t } = useTranslation()
  const live = state === 'open'
  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 md:inline-flex"
      title={live ? t('common.liveConnected') : t('common.liveReconnecting')}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          live ? 'animate-pulse-ring bg-online' : 'bg-warn',
        )}
      />
      <span className={cn('text-[10px] font-semibold tracking-[0.1em] uppercase', live ? 'text-online' : 'text-warn')}>
        {live ? t('common.liveConnected') : t('common.liveReconnecting')}
      </span>
    </span>
  )
}

/* ----------------------------------------------------------------- UserMenu */

function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: user } = useSession()
  const logout = useLogout()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const signOut = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        window.location.assign(`${APP_BASE}/login`)
      },
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'grid size-9 place-items-center rounded-full border text-xs font-semibold transition-colors',
          open
            ? 'border-gold/60 bg-gold/15 text-gold'
            : 'border-hairline-strong bg-surface-2 text-ink-muted hover:border-white/25 hover:text-ink',
        )}
      >
        {user?.initials ?? '·'}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-control border border-hairline-strong bg-surface-2 shadow-raised"
        >
          <div className="border-b border-hairline px-3.5 py-3">
            <p className="truncate text-sm font-medium text-ink">{user?.full_name ?? '—'}</p>
            <p className="truncate text-xs text-ink-faint">{user?.email || user?.username}</p>
          </div>
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/account')
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-white/6 hover:text-ink"
            >
              <UserRound className="size-4" />
              {t('nav.account')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate('/account?tab=password')
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-white/6 hover:text-ink"
            >
              <KeyRound className="size-4" />
              {t('nav.password')}
            </button>
          </div>
          <div className="border-t border-hairline p-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger/85 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="size-4" />
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- AppShell */

export function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const client = useQueryClient()
  const toast = useToast()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  useOverlay({ open: drawerOpen, onClose: closeDrawer, containerRef: drawerRef })

  const { data: unread } = useUnreadCount()

  // One socket for live device presence and prints, another for alert toasts.
  const fleet = useSocket('/ws/fleet/', {
    onMessage: (message) => {
      const payload = message as { type?: string }
      if (payload.type === 'device.presence' || payload.type === 'device.print') {
        void client.invalidateQueries({ queryKey: ['devices'] })
        void client.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
  })

  useSocket('/ws/notifications/', {
    onMessage: (message) => {
      const alert = message as { id?: number; device?: { name?: string }; message?: string }
      if (!alert?.id) return
      toast.push({
        tone: 'alert',
        title: alert.device?.name ?? t('notifications.liveToast'),
        body: alert.message,
        duration: 8000,
      })
      void client.invalidateQueries({ queryKey: ['notifications'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  useEffect(() => setDrawerOpen(false), [location.pathname])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const unreadCount = unread?.unread ?? 0

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:h-16 sm:gap-4 sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation"
            className="-ml-1 grid size-9 place-items-center rounded-[9px] text-ink-muted transition-colors hover:bg-white/6 hover:text-ink lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <NavLink to="/" className="shrink-0">
            <LogoLockup />
          </NavLink>

          <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex items-center gap-2 rounded-[9px] px-3 py-2 text-sm font-medium transition-colors duration-150',
                    isActive ? 'text-ink' : 'text-ink-faint hover:bg-white/5 hover:text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn('size-4', isActive && 'text-gold')} />
                    {t(item.labelKey)}
                    {item.to === '/notifications' && unreadCount > 0 && (
                      <span className="numeral ml-0.5 rounded-full bg-gold px-1.5 py-px text-[10px] font-bold text-void">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-gold" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LiveIndicator state={fleet.state} />

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                'hidden items-center gap-2 rounded-[9px] border border-hairline bg-white/3 py-1.5 pr-2 pl-2.5',
                'text-xs text-ink-faint transition-colors hover:border-hairline-strong hover:text-ink-muted md:flex',
              )}
            >
              <Search className="size-3.5" />
              <span>{t('common.search')}</span>
              <kbd className="numeral rounded border border-hairline bg-void/60 px-1 py-px text-[10px]">⌘K</kbd>
            </button>

            <NavLink
              to="/notifications"
              aria-label={t('nav.notifications')}
              className="relative grid size-9 place-items-center rounded-[9px] border border-hairline bg-white/3 text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink lg:hidden"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-void">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>

            <UserMenu />
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade absolute inset-0 bg-void/80 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <nav
            ref={drawerRef}
            id="mobile-navigation"
            aria-label={t('nav.dashboard')}
            className="animate-slide-in absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col border-r border-hairline bg-surface p-3"
          >
            <div className="mb-4 flex items-center justify-between px-1 pt-1">
              <LogoLockup compact />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('common.close')}
                className="grid size-8 place-items-center rounded-md text-ink-faint hover:bg-white/6 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border border-gold/25 bg-gold/12 text-gold'
                        : 'text-ink-muted hover:bg-white/5 hover:text-ink',
                    )
                  }
                >
                  <item.icon className="size-4" />
                  {t(item.labelKey)}
                  {item.to === '/notifications' && unreadCount > 0 && (
                    <span className="numeral ml-auto rounded-full bg-gold px-1.5 py-px text-[10px] font-bold text-void">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}

      <main className="stack-above mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 sm:px-5 sm:py-7">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
