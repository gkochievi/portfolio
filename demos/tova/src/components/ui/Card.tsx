import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Skeleton } from './Feedback'

type Padding = 'none' | 'sm' | 'md' | 'lg'
const PADDING: Record<Padding, string> = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-7' }

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding
  /** 16px hero radius (hero panels, game frame). */
  hero?: boolean
  /** Sunken grey well instead of a raised white panel. */
  sunken?: boolean
  /** Hover lift for clickable cards. */
  interactive?: boolean
}

/** White panel, 1.5px border plus a short cool shadow. */
export function Card({ padding = 'md', hero, sunken, interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border-[1.5px] border-line text-ink',
        hero ? 'rounded-hero' : 'rounded-card',
        sunken ? 'bg-sunken' : 'bg-panel shadow-card',
        interactive && 'transition-[border-color,transform] hover:-translate-y-px hover:border-line-strong',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Right-aligned buttons or a badge. */
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}

export function CardHeader({ title, description, actions, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start gap-3', className)}>
      {icon && <span className="mt-0.5 text-muted [&_svg]:size-5">{icon}</span>}
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold leading-snug text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export interface StatTileProps {
  label: ReactNode
  value: ReactNode
  /** Small line under the value (delta, unit, context). */
  hint?: ReactNode
  icon?: ReactNode
  /** accent = the one tile to look at (persimmon value). */
  tone?: 'default' | 'primary' | 'accent'
  loading?: boolean
  className?: string
}

/** KPI tile: label, big tabular number in Unbounded, optional hint. */
export function StatTile({ label, value, hint, icon, tone = 'default', loading, className }: StatTileProps) {
  return (
    <Card padding="md" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted">
        <span className="truncate">{label}</span>
        {icon && <span className="text-muted [&_svg]:size-5">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-9 w-24" />
      ) : (
        <div
          className={cn(
            'font-display text-[28px] leading-tight tabular-nums sm:text-[32px]',
            tone === 'accent' && 'text-accent-ink',
            tone === 'primary' && 'text-primary',
          )}
        >
          {value}
        </div>
      )}
      {hint && <div className="text-sm text-muted">{hint}</div>}
    </Card>
  )
}

/** Alias kept for feature agents that look for StatCard. */
export const StatCard = StatTile
