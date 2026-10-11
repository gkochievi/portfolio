import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { Flakes } from '@/components/brand/Flakes'
import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-chip bg-sunken', className)} />
}

/** Stack of skeleton lines, e.g. while a card loads. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  /** A button or link. */
  action?: ReactNode
  icon?: ReactNode
  /** Less vertical padding (inside tables and cards). */
  compact?: boolean
  className?: string
}

/** 3-5 drifting flakes above one short line of copy. */
export function EmptyState({ title, description, action, icon, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center overflow-hidden text-center',
        compact ? 'px-4 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div className="relative mb-4 h-16 w-40" aria-hidden>
        <Flakes count={4} persimmon={false} className="opacity-80" />
      </div>
      {icon && <div className="mb-2 text-muted [&_svg]:size-6">{icon}</div>}
      <p className="max-w-sm text-base font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Translate any thrown error: an ApiError carries an i18n key as its message. */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation()
  return (error: unknown) => {
    if (error instanceof ApiError) return t(error.message, { defaultValue: t('common:errors.generic') })
    return t('common:errors.generic')
  }
}

export interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  className?: string
}

/** A failed query: translated message plus Retry. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation()
  const message = useErrorMessage()
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <AlertTriangle className="mb-3 size-6 text-danger" aria-hidden />
      <p className="font-semibold text-ink">{message(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          {t('common:actions.retry')}
        </Button>
      )}
    </div>
  )
}

const AVATAR_SIZES = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm', xl: 'size-16 text-lg' } as const

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  return (Array.from(first)[0] ?? '').concat(Array.from(last)[0] ?? '').toUpperCase()
}

export interface AvatarProps {
  name: string
  size?: keyof typeof AVATAR_SIZES
  /** primary (default), ink, accent or muted fill. */
  tone?: 'primary' | 'ink' | 'accent' | 'muted'
  className?: string
}

/** Initials in a circle. */
export function Avatar({ name, size = 'md', tone = 'primary', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 select-none place-items-center rounded-full font-bold leading-none',
        AVATAR_SIZES[size],
        tone === 'primary' && 'bg-primary text-on-primary',
        tone === 'ink' && 'bg-ink text-surface',
        tone === 'accent' && 'bg-accent text-on-accent',
        tone === 'muted' && 'bg-sunken text-muted',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
