import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'

import { useAccount } from '@/lib/account'
import { Avatar, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui'
import { accountName, useSignOut } from '../session'
import type { Operator } from '@/types'

/** Avatar button -> name, role, email, profile (operators), sign out. */
export function UserMenu({ operator, extraItems }: { operator?: Operator | null; extraItems?: { label: string; to: string; icon?: ReactNode }[] }) {
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const doSignOut = useSignOut()
  if (!account) return null
  const name = accountName(account, i18n.language)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('header.userMenu')}
          className="inline-flex h-9 items-center gap-2 rounded-full pl-0.5 pr-2 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Avatar name={name} size="sm" avatarId={operator?.avatarId} avatarUrl={operator?.avatarUrl} status={operator?.status} />
          <span className="hidden max-w-36 truncate text-[13px] font-medium lg:inline">{name}</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar name={name} size="md" avatarId={operator?.avatarId} avatarUrl={operator?.avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{name}</span>
            <span className="truncate text-xs text-muted">
              {t(`common:role.${account.role}`)} · {account.email}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account.role === 'operator' ? (
          <DropdownMenuItem asChild>
            <Link to="/operator/profile">
              <UserRound className="text-muted" strokeWidth={1.75} />
              {t('nav.profile')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {extraItems?.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>
              {item.icon}
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem tone="danger" icon={<LogOut strokeWidth={1.75} />} onSelect={() => void doSignOut()}>
          {t('common:actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
