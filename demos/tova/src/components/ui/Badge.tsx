import { Eye } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { EventStatus, ItemType, Role } from '@/types'

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'ink'

const TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  ink: 'bg-ink text-surface',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-muted',
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  ink: 'bg-surface',
}

export interface BadgeProps {
  tone?: Tone
  /** Leading status dot; `pulse` blinks it (live things). */
  dot?: boolean
  pulse?: boolean
  icon?: ReactNode
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
  title?: string
}

export function Badge({ tone = 'neutral', dot, pulse, icon, size = 'md', className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip font-semibold leading-none',
        size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
        TONES[tone],
        '[&_svg]:size-3.5',
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', DOTS[tone], pulse && 'animate-live-dot')} />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

const STATUS_TONE: Record<EventStatus, Tone> = { hold: 'neutral', upcoming: 'info', open: 'success', closed: 'warning' }

/** Event status: hold / upcoming / open (live dot) / closed. */
export function StatusBadge({ status, size, className }: { status: EventStatus; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone={STATUS_TONE[status]} dot pulse={status === 'open'} size={size} className={className}>
      {t(`common:status.${status}`)}
    </Badge>
  )
}

const ROLE_TONE: Record<Role, Tone> = { SUPERADMIN: 'ink', ADMIN: 'primary', SUPERVISOR: 'info', PLAYER: 'neutral' }

export function RoleBadge({ role, size, className }: { role: Role; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone={ROLE_TONE[role]} size={size} className={className}>
      {t(`common:roles.${role}`)}
    </Badge>
  )
}

const ITEM_TONE: Record<ItemType, Tone> = { GOOD: 'success', MINOR: 'warning', MAJOR: 'danger' }

/** GOOD = sponsor item, MINOR = small hazard, MAJOR = big hazard. */
export function ItemTypeBadge({ type, size, className }: { type: ItemType; size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone={ITEM_TONE[type]} size={size} className={className}>
      {t(`common:itemTypes.${type}`)}
    </Badge>
  )
}

/** Muted "view only" tag for read-only roles. */
export function ViewOnlyTag({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge tone="neutral" icon={<Eye aria-hidden />} className={className}>
      {t('common:viewOnly')}
    </Badge>
  )
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  count?: number
  icon?: ReactNode
}

/** 6px filter chip (toggle). */
export function Chip({ active, count, icon, className, children, type, ...props }: ChipProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip border-[1.5px] px-3 text-sm font-semibold transition-colors [&_svg]:size-4',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-panel text-muted hover:border-line-strong hover:text-ink',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={cn('tabular-nums text-xs', active ? 'text-primary' : 'text-muted')}>{count}</span>
      )}
    </button>
  )
}
