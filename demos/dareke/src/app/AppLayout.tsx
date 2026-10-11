/**
 * The signed-in shell: icon rail (72/232px), top bar with the
 * TopBarPortal slot, dialer badge, language + theme toggles, Cmd+K, user menu.
 * Below `lg` the rail becomes a left sheet behind a menu button.
 */
import { useQuery } from '@tanstack/react-query'
import { ChevronsLeft, ChevronsRight, Command as CommandIcon, Keyboard, LogOut, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Logo } from '@/components/brand'
import {
  Avatar,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Kbd,
  Sheet,
  Tooltip,
  TooltipProvider,
} from '@/components/ui'
import { get } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Role } from '@/types'
import { CommandPalette } from './CommandPalette'
import { LanguageToggle, ThemeToggle, useMe, useSignOut } from './controls'
import { RequireAuth } from './guards'
import { navFor, type NavItem } from './nav'
import { ShortcutsDialog } from './ShortcutsDialog'
import { registerTopBarSlot } from './TopBarPortal'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

const GROUP_ORDER: NavItem['group'][] = ['work', 'admin', 'supervise']

function NavList({ role, expanded, onNavigate }: { role: Role | undefined; expanded: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('shell')
  const items = navFor(role)
  const groups = GROUP_ORDER.map((g) => ({ g, items: items.filter((i) => i.group === g) })).filter((x) => x.items.length)
  return (
    <nav aria-label={t('nav.label')} className="flex flex-col gap-4">
      {groups.map(({ g, items: groupItems }) => (
        <div key={g} className="flex flex-col gap-1">
          {groups.length > 1 &&
            (expanded ? (
              <p className="px-3 pb-1 text-[11px] font-semibold text-muted">{t(`nav.groups.${g}`)}</p>
            ) : (
              <span className="mx-auto mb-1 h-px w-6 bg-hairline" aria-hidden />
            ))}
          {groupItems.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                aria-label={expanded ? undefined : t(`nav.${item.key}`)}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-control text-[13.5px] font-medium transition-colors',
                    expanded ? 'h-10 gap-3 px-1.5' : 'mx-auto size-11 justify-center',
                    isActive ? 'text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
                    isActive && expanded && 'bg-sunken',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-control transition-colors',
                        isActive ? 'bg-carbon text-lime dark:ring-1 dark:ring-hairline-strong' : 'group-hover:text-ink',
                      )}
                    >
                      <item.icon size={18} strokeWidth={isActive ? 2 : 1.75} />
                    </span>
                    {expanded && <span className="min-w-0 truncate">{t(`nav.${item.key}`)}</span>}
                  </>
                )}
              </NavLink>
            )
            return expanded ? (
              link
            ) : (
              <Tooltip key={item.to} content={t(`nav.${item.key}`)} side="right">
                {link}
              </Tooltip>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function DialerBadge() {
  const { t } = useTranslation('shell')
  const { data, isError } = useQuery({
    queryKey: ['dialer', 'status'],
    queryFn: () => get<{ connected: boolean; activeCalls: number }>('/dialer/status'),
    refetchInterval: 10_000,
    retry: false,
  })
  if (isError || !data) return null
  return (
    <Tooltip content={t('topbar.dialerHint', { count: data.activeCalls })}>
      <span className="hidden md:inline-flex">
        <Badge tone={data.connected ? 'success' : 'danger'} size="md" icon={<span className={cn('size-1.5 rounded-full', data.connected ? 'bg-success' : 'bg-danger')} />}>
          {data.connected ? t('topbar.dialerConnected') : t('topbar.dialerOffline')}
          <span className="ml-1 font-mono tabular opacity-80">· {data.activeCalls}</span>
        </Badge>
      </span>
    </Tooltip>
  )
}

function UserMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { t } = useTranslation()
  const { t: ts } = useTranslation('shell')
  const { account, user, name } = useMe()
  const signOut = useSignOut()
  if (!account) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-9 items-center gap-2 rounded-control pl-1 pr-1.5 hover:bg-sunken sm:pr-2.5" aria-label={ts('topbar.userMenu')}>
          <Avatar name={account.name} size={28} />
          <span className="hidden min-w-0 text-left leading-tight sm:block">
            <span className="block max-w-[160px] truncate text-[13px] font-semibold">{name}</span>
            <span className="block text-[11px] text-muted">{t(`roles.${account.role}`)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={account.name} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
          <Badge tone="ink">{t(`roles.${account.role}`)}</Badge>
          {user?.sipExtension && (
            <Badge tone="muted" mono>
              {ts('topbar.ext', { ext: user.sipExtension })}
            </Badge>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('tenant')}</DropdownMenuLabel>
        <DropdownMenuItem icon={<Keyboard size={16} strokeWidth={1.75} />} shortcut="?" onSelect={onShortcuts}>
          {ts('shortcuts.title')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut size={16} strokeWidth={1.75} />} onSelect={signOut} danger>
          {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const wide = () => typeof window !== 'undefined' && window.innerWidth >= 1280

export function AppLayout() {
  const { t } = useTranslation('shell')
  const { account } = useMe()
  const location = useLocation()
  const [expanded, setExpanded] = useState(wide)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <RequireAuth>
      <TooltipProvider delayDuration={250}>
        <div className="flex min-h-screen bg-paper text-ink">
          {/* Rail */}
          <aside
            className={cn(
              'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-hairline bg-panel transition-[width] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] lg:flex',
              expanded ? 'w-[232px]' : 'w-[72px]',
            )}
          >
            <div className={cn('flex h-14 shrink-0 items-center border-b border-hairline', expanded ? 'px-4' : 'justify-center')}>
              <NavLink to="/" aria-label={t('nav.home')} className="rounded-control">
                <Logo size={30} markOnly={!expanded} />
              </NavLink>
            </div>
            <div className={cn('min-h-0 flex-1 overflow-y-auto py-4', expanded ? 'px-3' : 'px-2')}>
              <NavList role={account?.role} expanded={expanded} />
            </div>
            <div className={cn('shrink-0 border-t border-hairline p-3', !expanded && 'flex justify-center')}>
              {expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex h-9 w-full items-center gap-2 rounded-control px-2 text-[13px] text-muted hover:bg-sunken hover:text-ink"
                >
                  <ChevronsLeft size={18} strokeWidth={1.75} />
                  {t('nav.collapse')}
                </button>
              ) : (
                <IconButton label={t('nav.expand')} icon={<ChevronsRight size={18} strokeWidth={1.75} />} onClick={() => setExpanded(true)} />
              )}
            </div>
          </aside>

          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen} title={t('nav.label')}>
            <div className="flex h-14 items-center border-b border-hairline px-4">
              <Logo size={28} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <NavList role={account?.role} expanded onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-hairline p-3">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-paper/95 px-3 backdrop-blur-[2px] sm:gap-3 sm:px-4 lg:px-6">
              <IconButton className="lg:hidden" label={t('nav.open')} icon={<Menu size={20} strokeWidth={1.75} />} onClick={() => setMobileOpen(true)} />
              <NavLink to="/" className="lg:hidden" aria-label={t('nav.home')}>
                <Logo size={26} markOnly />
              </NavLink>
              <div ref={registerTopBarSlot} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none" />
              <DialerBadge />
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-8 items-center gap-2 rounded-control border border-hairline bg-panel px-2.5 text-xs text-muted hover:border-hairline-strong hover:text-ink md:inline-flex dark:bg-sunken"
                aria-label={t('palette.title')}
              >
                <CommandIcon size={14} strokeWidth={1.75} />
                <span>{t('topbar.search')}</span>
                <Kbd className="ml-1">⌘K</Kbd>
              </button>
              <LanguageToggle className="hidden sm:inline-flex" />
              <ThemeToggle className="hidden sm:inline-flex" />
              <UserMenu onShortcuts={() => setShortcutsOpen(true)} />
            </header>

            <main id="main" className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8">
              <Outlet />
            </main>
          </div>
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onShowShortcuts={() => setShortcutsOpen(true)} />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </TooltipProvider>
    </RequireAuth>
  )
}
