import type { HTMLAttributes, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Skeleton } from './Skeleton'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding (default 'md' = 20px). 'none' for tables/lists that bleed to the edge. */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Hover affordance for clickable cards. */
  interactive?: boolean
  /** Sunken cream background instead of panel. */
  muted?: boolean
}

/** Flat panel: 10px radius, 1px warm hairline, no shadow. */
export function Card({ padding = 'md', interactive, muted, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-ui border border-line',
        muted ? 'bg-sunken' : 'bg-panel',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        interactive && 'cursor-pointer transition-colors hover:border-line-strong hover:bg-hover/40',
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, description, icon, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-ui bg-accent-soft text-accent [&_svg]:size-[18px]">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex items-center justify-end gap-2 border-t border-line pt-4', className)} {...props} />
}

export interface StatCardProps {
  label: ReactNode
  value: ReactNode
  /** Secondary line under the value. */
  hint?: ReactNode
  icon?: ReactNode
  /** Change vs previous period. `good` decides the colour (default: up is good). */
  delta?: { value: ReactNode; direction: 'up' | 'down' | 'flat'; good?: boolean }
  loading?: boolean
  /** Small accent marker on the left edge: e.g. 'warning' for a queue tile with waiting chats. */
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success'
  onClick?: () => void
  className?: string
  children?: ReactNode
}

/** Flat KPI tile (dashboard KPI row of 4). */
export function StatCard({ label, value, hint, icon, delta, loading, tone = 'default', onClick, className, children }: StatCardProps) {
  const good = delta ? (delta.good ?? delta.direction === 'up') : true
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex min-w-0 flex-col gap-1 overflow-hidden rounded-ui border border-line bg-panel p-4 text-left',
        onClick && 'transition-colors hover:border-line-strong',
        className,
      )}
    >
      {tone !== 'default' ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            tone === 'accent' && 'bg-accent',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-danger',
            tone === 'success' && 'bg-success',
          )}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-muted">{label}</span>
        {icon ? <span className="text-muted [&_svg]:size-[18px]">{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-24" />
      ) : (
        <span className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink tabular">{value}</span>
      )}
      {delta || hint ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {delta ? (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', delta.direction === 'flat' ? 'text-muted' : good ? 'text-success' : 'text-danger')}>
              {delta.direction === 'up' ? <ArrowUpRight size={14} /> : delta.direction === 'down' ? <ArrowDownRight size={14} /> : null}
              {delta.value}
            </span>
          ) : null}
          {hint ? <span className="text-muted">{hint}</span> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  )
}
/** Alias used in the plan. */
export const KpiTile = StatCard
