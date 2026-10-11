/**
 * Player header (logo, Play, My card, Standings, Prizes, Console, KA/EN,
 * theme, account) and the single centred column (520px; the standings board
 * gets the full 1200px for the booth TV layout). On phones the nav becomes a
 * compact icon row under the header.
 */
import { Gamepad2, Gift, LayoutDashboard, Trophy, UserRound, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { Lockup } from '@/components/brand'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useCurrentEvents } from '@/lib/queries'
import { isStaffRole } from '@/lib/roles'
import { LanguageToggle, ThemeToggle, UserMenu } from './controls'
import { useCurrentUser } from './session'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const WIDE_ROUTES = ['/leaderboard']

export function PlayerShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const staff = user ? isStaffRole(user.role) : false
  const current = useCurrentEvents().data?.current ?? null

  const items: NavItem[] = [
    { to: '/play', label: t('shell:nav.play'), icon: Gamepad2 },
    ...(user ? [{ to: '/me', label: t('shell:nav.myCard'), icon: UserRound }] : []),
    ...(staff || current?.leaderboardVisible !== false ? [{ to: '/leaderboard', label: t('shell:nav.standings'), icon: Trophy }] : []),
    ...(staff || current?.awardsVisible !== false ? [{ to: '/awards', label: t('shell:nav.prizes'), icon: Gift }] : []),
    ...(staff ? [{ to: '/admin', label: t('shell:nav.console'), icon: LayoutDashboard }] : []),
  ]
  const wide = WIDE_ROUTES.includes(pathname)

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b-[1.5px] border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-2 px-4">
          <Link to="/" className="mr-2 shrink-0 rounded-card" aria-label={t('shell:nav.home')}>
            <Lockup size={30} />
          </Link>
          <nav aria-label={t('shell:nav.main')} className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-10 items-center gap-2 rounded-card px-3 text-[15px] font-semibold transition-colors [&_svg]:size-[18px]',
                    isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-sunken hover:text-ink',
                  )
                }
              >
                <item.icon strokeWidth={1.75} aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <LanguageToggle />
          <ThemeToggle />
          {user ? (
            <UserMenu />
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link to={`/login?next=${encodeURIComponent(pathname)}`}>{t('common:actions.signIn')}</Link>
            </Button>
          )}
        </div>
        <nav
          aria-label={t('shell:nav.main')}
          className="grid border-t border-line md:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 px-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted',
                )
              }
            >
              <item.icon className="size-5" strokeWidth={1.75} aria-hidden />
              <span className="w-full truncate text-center">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main
        id="main"
        className={cn('mx-auto w-full flex-1 px-4 pb-28 pt-6 sm:pt-8', wide ? 'max-w-[1200px]' : 'max-w-[520px]')}
      >
        <Outlet />
      </main>
    </div>
  )
}
