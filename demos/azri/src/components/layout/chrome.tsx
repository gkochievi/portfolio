/**
 * Shared shell pieces: navigation config per role, the account menu and the
 * header control cluster (language, theme, account). Owner: shell agent.
 */
import { useSession } from '@portfolio/demo-kit'
import {
  Braces,
  Gauge,
  House,
  Inbox,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  MessageSquarePlus,
  MessagesSquare,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  LangSwitch,
  ThemeToggle,
} from '@/components/ui'
import { session } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { cn } from '@/lib/utils'
import type { AzriAccount, Role } from '@/types'

export interface NavItem {
  to: string
  /** Key under shell:nav.* */
  key: string
  icon: LucideIcon
  /** Exact match for NavLink (index routes). */
  end?: boolean
}

export const CONSOLE_NAV: Record<Exclude<Role, 'respondent'>, NavItem[]> = {
  admin: [
    { to: '/console', key: 'overview', icon: LayoutDashboard, end: true },
    { to: '/console/responses', key: 'responses', icon: MessagesSquare },
    { to: '/console/campaigns', key: 'campaigns', icon: Megaphone },
    { to: '/console/links', key: 'links', icon: ScrollText },
    { to: '/console/send', key: 'send', icon: MessageSquarePlus },
  ],
  agent: [
    { to: '/console/me', key: 'me', icon: Gauge },
    { to: '/console/send', key: 'send', icon: MessageSquarePlus },
  ],
}

export const DEMO_NAV: NavItem[] = [
  { to: '/', key: 'openInbox', icon: Inbox, end: true },
  { to: '/playground', key: 'playground', icon: Braces },
]

/** Where the "Console" link should go for the current visitor. */
export function consoleHref(me: AzriAccount | null): string {
  if (me?.role === 'admin' || me?.role === 'agent') return me.home
  return `/login?next=${encodeURIComponent('/console')}`
}

export function accountName(account: AzriAccount, lang: string): string {
  return lang === 'ka' ? account.nameKa : account.name
}

/** Avatar button with name / role / sign out. Signed out: a "Sign in" button. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const me = useSession(session)
  const { t } = useTranslation('shell')
  const lang = useLang()
  const navigate = useNavigate()

  if (!me) {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link to="/login">
          <LogIn className="size-4" strokeWidth={1.75} />
          {t('account.signIn')}
        </Link>
      </Button>
    )
  }

  const name = accountName(me, lang)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('account.menu')}
        className={cn(
          'inline-flex h-10 items-center gap-2.5 rounded-full pl-1 transition-colors hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          compact ? 'pr-1' : 'pr-3',
        )}
      >
        <Avatar name={me.name} color={me.avatarColor} size="sm" />
        {!compact && (
          <span className="hidden min-w-0 flex-col text-left leading-tight md:flex">
            <span className="max-w-40 truncate text-[13px] font-semibold text-ink">{name}</span>
            <span className="max-w-40 truncate text-[11px] text-muted">{t(`roles.${me.role}`)}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 pb-2">
          <Avatar name={me.name} color={me.avatarColor} size="md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{name}</span>
            <span className="truncate text-xs font-normal">{t(`roles.${me.role}`)}</span>
            <span className="truncate font-mono text-[11px] font-normal">{me.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<House strokeWidth={1.75} />} onSelect={() => navigate(me.home)}>
          {t('account.home')}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<LogOut strokeWidth={1.75} />}
          onSelect={() => {
            session.signOut()
            navigate('/login')
          }}
        >
          {t('account.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Language pill + theme toggle + account menu. */
export function HeaderControls({ compactUser = false, className }: { compactUser?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 sm:gap-2', className)}>
      <LangSwitch />
      <ThemeToggle size="sm" />
      <UserMenu compact={compactUser} />
    </div>
  )
}

/** Visually hidden skip link, shown on focus. */
export function SkipLink() {
  const { t } = useTranslation('shell')
  return (
    <a
      href="#main"
      onClick={(event) => {
        event.preventDefault()
        document.getElementById('main')?.focus()
      }}
      className="sr-only z-[80] rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      {t('skip')}
    </a>
  )
}
