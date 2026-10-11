import { useQuery } from '@tanstack/react-query'
import { Building2, Check, ChevronsUpDown, Languages, LogOut, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, DropdownMenu, IconButton, Switch, Tooltip, type MenuItem } from '@/components/ui'
import { get } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useGloss, setGlossEnabled } from '@/lib/gloss'
import { useAccount, useActingTenantId } from '@/lib/session'
import { actAs, signOut } from './actions'
import { toggleTheme, useTheme } from './theme'

/** EN / ქარ toggle (two-state segmented button). */
export function LangToggle({ className }: { className?: string }) {
  const { t, i18n } = useTranslation('shell')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  return (
    <div role="group" aria-label={t('topbar.language')} className={cn('inline-flex h-8 items-center rounded-ctl border border-line bg-sunken p-0.5', className)}>
      <Languages className="mx-1.5 hidden size-4 text-muted sm:block" strokeWidth={1.75} aria-hidden />
      {(['en', 'ka'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => void i18n.changeLanguage(code)}
          className={cn(
            'h-7 min-w-9 rounded-[6px] px-2 text-xs font-semibold text-muted transition-colors hover:text-ink',
            lang === code && 'bg-panel text-ink shadow-[0_1px_0_var(--color-line)]',
          )}
        >
          {code === 'en' ? 'EN' : 'ქარ'}
        </button>
      ))}
    </div>
  )
}

export function ThemeToggle() {
  const { t } = useTranslation('shell')
  const { theme } = useTheme()
  return (
    <IconButton
      size="sm"
      label={theme === 'dark' ? t('topbar.toLight') : t('topbar.toDark')}
      icon={theme === 'dark' ? <Sun /> : <Moon />}
      onClick={toggleTheme}
    />
  )
}

/** "English gloss" switch: only meaningful while the UI is English. */
export function GlossToggle() {
  const { t, i18n } = useTranslation('shell')
  const { enabled } = useGloss()
  if (i18n.language !== 'en') return null
  return (
    <Tooltip content={t('topbar.glossHint')}>
      <label className="hidden h-8 cursor-pointer items-center gap-2 rounded-ctl px-2 text-xs font-medium text-muted hover:text-ink md:inline-flex">
        <Switch size="sm" checked={enabled} onCheckedChange={setGlossEnabled} aria-label={t('topbar.gloss')} />
        {t('topbar.gloss')}
      </label>
    </Tooltip>
  )
}

interface TenantOption {
  id: string
  name: string
  name_ka: string
  slug: string
  is_active: boolean
}

/** Operator-only: pick the workspace to act as. */
export function TenantSwitcher() {
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  const acting = useActingTenantId()
  const isOperator = account?.role === 'operator'
  const { data } = useQuery({
    queryKey: ['shell', 'tenants'],
    queryFn: () => get<TenantOption[]>('/auth/tenants'),
    enabled: isOperator,
    staleTime: 60_000,
  })
  if (!isOperator) return null
  const tenants = data ?? []
  const name = (tn?: TenantOption) => (tn ? (i18n.language === 'ka' ? tn.name_ka : tn.name) : '-')
  const current = tenants.find((tn) => tn.id === acting)
  const items: MenuItem[] = [
    { type: 'label', label: t('topbar.switchWorkspace') },
    ...tenants.map<MenuItem>((tn) => ({
      label: (
        <span className="flex items-center gap-2">
          {name(tn)}
          {!tn.is_active ? <span className="text-xs text-muted">({t('topbar.inactive')})</span> : null}
        </span>
      ),
      icon: tn.id === acting ? <Check className="text-primary" /> : <span className="size-4" />,
      onSelect: () => actAs(tn.id),
    })),
  ]
  return (
    <DropdownMenu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          className="inline-flex h-9 min-w-0 max-w-[16rem] items-center gap-2 rounded-ctl border border-line bg-panel px-2.5 text-left text-[13px] hover:bg-sunken"
          aria-label={t('topbar.switchWorkspace')}
        >
          <Building2 className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
          <span className="hidden text-muted sm:inline">{t('topbar.workspace')}:</span>
          <span className="truncate font-medium">{name(current)}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted" />
        </button>
      }
    />
  )
}

export function UserMenu() {
  const { t, i18n } = useTranslation('shell')
  const account = useAccount()
  if (!account) return null
  const ka = i18n.language === 'ka'
  const name = ka ? account.name_ka : account.name
  const roleKey = account.persona === 'agent' ? 'agent' : account.role
  return (
    <DropdownMenu
      header={
        <div className="flex items-center gap-3 py-1">
          <Avatar name={account.name} color={account.avatarColor} size={36} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{ka ? account.roleLabel_ka : account.roleLabel}</div>
            <div className="truncate font-mono text-[11px] text-subtle">{account.email}</div>
          </div>
        </div>
      }
      items={[{ label: t('user.signOut'), icon: <LogOut />, onSelect: signOut }]}
      trigger={
        <button type="button" aria-label={t('user.menu')} className="inline-flex h-9 items-center gap-2 rounded-ctl pl-1 pr-1 hover:bg-ink/6 md:pr-2.5">
          <Avatar name={account.name} color={account.avatarColor} size={28} />
          <span className="hidden min-w-0 flex-col text-left leading-tight md:flex">
            <span className="max-w-40 truncate text-[13px] font-medium">{name}</span>
            <span className="max-w-40 truncate text-[11px] text-muted">{t(`user.role.${roleKey}`)}</span>
          </span>
        </button>
      }
    />
  )
}
