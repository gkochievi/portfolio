import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2, Lock, X } from 'lucide-react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { BellCurve } from '@/components/brand/BellCurve'
import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------- Card */

export function Card({
  className,
  padded = true,
  as: Tag = 'div',
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean; as?: 'div' | 'section' | 'article' }) {
  return <Tag className={cn('rounded-card border border-line bg-panel', padded && 'p-5 sm:px-6', className)} {...props} />
}

/** Card with a header row (title, description, actions) and a body. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush,
  icon,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  bodyClassName?: string
  /** No body padding (tables, lists that run edge to edge). */
  flush?: boolean
  icon?: ReactNode
}) {
  return (
    <section className={cn('rounded-card border border-line bg-panel', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start gap-3 border-b border-line px-5 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 font-sans text-[15px] font-semibold tracking-normal [&_svg]:size-[18px] [&_svg]:stroke-[1.75] [&_svg]:text-muted">
              {icon}
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(!flush && 'p-5 sm:px-6', bodyClassName)}>{children}</div>
    </section>
  )
}

/* ---------------------------------------------------------- PageHeader */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  back,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  /** Right-aligned buttons. */
  actions?: ReactNode
  /** Small line above the title (section name, breadcrumb). */
  eyebrow?: ReactNode
  /** A back link element rendered above everything (e.g. <Link>). */
  back?: ReactNode
  /** Row of badges / key facts under the description. */
  meta?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end', className)}>
      <div className="min-w-0 flex-1">
        {back ? <div className="mb-2 text-[13px] text-muted">{back}</div> : null}
        {eyebrow ? <div className="mb-1 text-xs font-medium text-accent">{eyebrow}</div> : null}
        <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-[15px] text-muted">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Horizontal bar for filters/search above a table. Wraps on phones. */
export function Toolbar({ children, className, end }: { children?: ReactNode; className?: string; end?: ReactNode }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
      {end ? <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div> : null}
    </div>
  )
}
export const FilterBar = Toolbar

/* -------------------------------------------------------- Badge & chips */

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 whitespace-nowrap font-medium [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:stroke-2',
  {
    variants: {
      tone: {
        neutral: 'bg-ink/7 text-muted',
        primary: 'bg-primary/12 text-primary',
        accent: 'bg-accent/12 text-accent',
        success: 'bg-success/12 text-success',
        warning: 'bg-warning/14 text-warning',
        danger: 'bg-danger/12 text-danger',
        info: 'bg-info/12 text-info',
      },
      shape: { pill: 'rounded-pill', tag: 'rounded-[5px]' },
      size: { sm: 'h-5 px-1.5 text-[11px]', md: 'h-6 px-2 text-xs' },
      outline: { true: 'bg-transparent ring-1 ring-inset ring-current/35' },
    },
    defaultVariants: { tone: 'neutral', shape: 'pill', size: 'md' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: ReactNode
}

export function Badge({ tone, shape, size, outline, icon, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, shape, size, outline }), className)} {...props}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Badge with a leading status dot; `pulse` for running states. */
export function StatusChip({
  tone = 'neutral',
  children,
  pulse,
  className,
  size,
}: {
  tone?: Tone
  children: ReactNode
  pulse?: boolean
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span className={cn(badgeVariants({ tone, size }), 'gap-1.5', className)}>
      <span className="relative inline-flex size-1.5">
        {pulse ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" /> : null}
        <span className="relative size-1.5 rounded-full bg-current" />
      </span>
      <span className="truncate">{children}</span>
    </span>
  )
}

/** Toggleable filter chip (999px). Shows a count and an x when removable. */
export function FilterChip({
  active,
  onClick,
  children,
  count,
  onRemove,
  icon,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  count?: number
  onRemove?: () => void
  icon?: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center rounded-pill border text-[13px] font-medium transition-colors',
        active ? 'border-primary bg-primary/10 text-primary' : 'border-line-strong bg-panel text-ink hover:bg-sunken',
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn('inline-flex h-full items-center gap-1.5 pl-3 [&_svg]:size-4 [&_svg]:stroke-[1.75]', onRemove ? 'pr-1' : 'pr-3')}
      >
        {icon}
        {children}
        {count != null ? (
          <span className={cn('tabular rounded-pill px-1.5 text-[11px]', active ? 'bg-primary/15' : 'bg-ink/7 text-muted')}>{count}</span>
        ) : null}
      </button>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label="x" className="mr-1 grid size-6 place-items-center rounded-full hover:bg-ink/8">
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  )
}

/* -------------------------------------------------------------- Avatar */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({
  name,
  color,
  size = 32,
  className,
}: {
  name: string
  /** Any CSS colour; defaults to verdigris. */
  color?: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: color ?? 'var(--color-primary)' }}
    >
      {initials(name)}
    </span>
  )
}

/* ------------------------------------------------------------ StatTile */

export function StatTile({
  label,
  value,
  hint,
  icon,
  delta,
  tone,
  className,
  onClick,
}: {
  label: ReactNode
  /** Big number (Newsreader, tabular). Pre-format it. */
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** e.g. { value: '+4.2%', direction: 'up', good: true } */
  delta?: { value: ReactNode; direction: 'up' | 'down' | 'flat'; good?: boolean }
  tone?: Tone
  className?: string
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col rounded-card border border-line bg-panel p-4 text-left sm:px-5',
        onClick && 'transition-colors hover:border-line-strong hover:bg-sunken/50',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] text-muted [&_svg]:size-4 [&_svg]:stroke-[1.75]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'tabular mt-2 font-display text-[30px] font-semibold leading-none',
          tone && tone !== 'neutral' ? `text-${tone}` : 'text-ink',
        )}
      >
        {value}
      </div>
      {hint || delta ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {delta ? (
            <span
              className={cn(
                'tabular font-medium',
                delta.direction === 'flat' ? 'text-muted' : delta.good === false ? 'text-danger' : 'text-success',
              )}
            >
              {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'} {delta.value}
            </span>
          ) : null}
          {hint ? <span className="truncate">{hint}</span> : null}
        </div>
      ) : null}
    </Tag>
  )
}
export const StatCard = StatTile

/* -------------------------------------------------------------- KeyValue */

export function KeyValue({
  items,
  columns = 1,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; mono?: boolean }[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3 text-sm',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={cn('mt-0.5 break-words text-ink', item.mono && 'font-mono text-[13px]')}>{item.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Shown on settings screens a member can view but not change. */
export function ReadOnlyNote({ children, className }: { children?: ReactNode; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <div className={cn('flex items-start gap-2 rounded-ctl border border-accent/30 bg-accent/8 px-3 py-2 text-[13px] text-ink', className)}>
      <Lock className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} aria-hidden />
      <span>{children ?? t('readOnly')}</span>
    </div>
  )
}

/** Inline notice: info / success / warning / danger. */
export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  action,
  className,
}: {
  tone?: Exclude<Tone, 'neutral'>
  title?: ReactNode
  children?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-ctl border px-3.5 py-2.5 text-[13px] [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.75]',
        {
          primary: 'border-primary/30 bg-primary/8 [&>svg]:text-primary',
          accent: 'border-accent/30 bg-accent/8 [&>svg]:text-accent',
          success: 'border-success/30 bg-success/8 [&>svg]:text-success',
          warning: 'border-warning/35 bg-warning/10 [&>svg]:text-warning',
          danger: 'border-danger/30 bg-danger/8 [&>svg]:text-danger',
          info: 'border-info/30 bg-info/8 [&>svg]:text-info',
        }[tone],
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        {title ? <div className="font-semibold text-ink">{title}</div> : null}
        {children ? <div className={cn('text-ink/85', title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  title,
  body,
  action,
  icon,
  compact,
  className,
}: {
  title?: ReactNode
  body?: ReactNode
  action?: ReactNode
  /** Replace the bell-curve illustration (e.g. a lucide icon). */
  icon?: ReactNode
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation('common')
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {icon ? (
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary [&_svg]:size-6 [&_svg]:stroke-[1.5]">{icon}</div>
      ) : (
        <BellCurve className={compact ? 'w-28' : 'w-40'} />
      )}
      <div className="max-w-sm">
        <div className={cn('font-display font-semibold', compact ? 'text-base' : 'text-lg')}>{title ?? t('empty.title')}</div>
        <p className="mt-1 text-[13px] text-muted">{body ?? t('empty.body')}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

/* ---------------------------------------------------- loading primitives */

export function Spinner({ size = 18, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex text-muted', className)}>
      <Loader2 className="animate-spin" style={{ width: size, height: size }} strokeWidth={1.75} aria-hidden />
    </span>
  )
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('animate-shimmer rounded-ctl bg-ink/8', className)} style={style} />
}

/** Several text-line skeletons. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${i === lines - 1 ? 60 : 100 - ((i * 7) % 20)}%` }} />
      ))}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  tone = 'primary',
  indeterminate,
  className,
  label,
  showValue,
}: {
  value?: number
  max?: number
  tone?: Exclude<Tone, 'neutral'>
  indeterminate?: boolean
  className?: string
  label?: ReactNode
  showValue?: boolean
}) {
  const pct = Math.max(0, Math.min(100, ((value ?? 0) / (max || 1)) * 100))
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>{label}</span>
          {showValue ? <span className="tabular font-mono">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        className="h-1.5 overflow-hidden rounded-pill bg-ink/8"
      >
        <div
          className={cn('h-full rounded-pill transition-[width] duration-300', `bg-${tone}`, indeterminate && 'w-1/3 animate-shimmer')}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Ticked meter (assay rim, horizontal): `ticks` fine segments, filled up to value.
 * Tone follows score bands unless given.
 */
export function Meter({
  value,
  max = 100,
  ticks = 20,
  tone,
  className,
  label,
}: {
  value: number
  max?: number
  ticks?: number
  tone?: Exclude<Tone, 'neutral'>
  className?: string
  label?: string
}) {
  const ratio = Math.max(0, Math.min(1, value / (max || 1)))
  const filled = Math.round(ratio * ticks)
  const autoTone = tone ?? (ratio >= 0.85 ? 'success' : ratio >= 0.7 ? 'primary' : ratio >= 0.5 ? 'warning' : 'danger')
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn('flex h-3 items-end gap-[2px]', className)}>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className={cn('h-full flex-1 rounded-[1px]', i < filled ? `bg-${autoTone}` : 'bg-ink/10')} />
      ))}
    </div>
  )
}
