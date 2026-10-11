import * as TabsPrimitive from '@radix-ui/react-tabs'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef, type HTMLAttributes, type ReactNode } from 'react'
import { Toaster as Sonner } from 'sonner'

import { DialMotif, RingPulse } from '@/components/brand'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { toneClasses } from '@/lib/tone'
import type { Tone } from '@/types'

/* ------------------------------------------------------ Badge / ToneDot */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  variant?: 'soft' | 'solid' | 'outline'
  icon?: ReactNode
  size?: 'sm' | 'md'
  /** Monospace (codes, IDs). */
  mono?: boolean
}

export function Badge({ tone = 'muted', variant = 'soft', icon, size = 'sm', mono, className, children, ...props }: BadgeProps) {
  const t = toneClasses(tone)
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-medium leading-none [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' ? 'h-[22px] px-2 text-[11.5px]' : 'h-7 px-2.5 text-xs',
        variant === 'soft' && t.soft,
        variant === 'solid' && t.solid,
        variant === 'outline' && cn('border bg-transparent', t.border, t.text),
        mono && 'font-mono tracking-tight',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function ToneDot({ tone = 'muted', pulse, className, size = 8 }: { tone?: Tone; pulse?: boolean; className?: string; size?: number }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      {pulse && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', toneClasses(tone).dot)} />}
      <span className={cn('relative inline-block size-full rounded-full', toneClasses(tone).dot, tone === 'lime' && 'ring-1 ring-ink/25 dark:ring-0')} />
    </span>
  )
}

/* -------------------------------------------------------------- StatusPill */

export interface StatusPillProps {
  tone: Tone
  label: ReactNode
  /** lucide icon element; every state carries an icon as well as a colour. */
  icon?: ReactNode
  /** `hatch` for paused statuses, `outline` for offline, `call` = lime fill with the two-arc ring. */
  pattern?: 'solid' | 'hatch' | 'outline' | 'call'
  /** Trailing text, e.g. a live timer (rendered mono). */
  meta?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function StatusPill({ tone, label, icon, pattern = 'solid', meta, size = 'md', className }: StatusPillProps) {
  const t = toneClasses(tone)
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none [&_svg]:shrink-0',
        size === 'sm' ? 'h-6 px-2 text-[11.5px] [&_svg]:size-3.5' : 'h-7 px-2.5 text-xs [&_svg]:size-4',
        pattern === 'solid' && t.soft,
        pattern === 'hatch' && cn(t.soft, 'hatch'),
        pattern === 'outline' && 'border border-hairline-strong bg-transparent text-muted',
        pattern === 'call' && 'bg-lime text-on-lime',
        className,
      )}
    >
      {pattern === 'call' ? (
        <svg viewBox="0 0 40 40" className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden>
          <path d="M13 10 A17 17 0 0 1 30 27" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M13 17 A10 10 0 0 1 23 27" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="13" cy="27" r="5.5" fill="currentColor" />
        </svg>
      ) : (
        icon
      )}
      <span className="truncate">{label}</span>
      {meta != null && <span className="font-mono text-[0.95em] font-medium tabular opacity-80">{meta}</span>}
    </span>
  )
}

/* ------------------------------------------------------------ Panel / Card */

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  /** Right side of the header (buttons, selects). */
  actions?: ReactNode
  /** Header icon. */
  icon?: ReactNode
  /** Padding for the body (default true). */
  padded?: boolean
  /** Footer row. */
  footer?: ReactNode
  bodyClassName?: string
}

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { title, description, actions, icon, padded = true, footer, className, bodyClassName, children, ...props },
  ref,
) {
  const hasHeader = title != null || actions != null
  return (
    <section ref={ref} className={cn('flex min-w-0 flex-col rounded-card border border-hairline bg-panel', className)} {...props}>
      {hasHeader && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-3">
          {icon && <span className="text-muted [&_svg]:size-[18px]">{icon}</span>}
          <div className="min-w-0 flex-1">
            {title != null && <h2 className="font-display text-[15px] font-bold leading-tight tracking-[-0.01em]">{title}</h2>}
            {description != null && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', padded && 'p-4', bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-hairline px-4 py-3">{footer}</footer>}
    </section>
  )
})

/** Alias for Panel. */
export const Card = Panel

/* ------------------------------------------------------ KpiNumeral / Stat */

/** A big tabular numeral that ticks over (200ms) when its value changes. */
export function KpiNumeral({ value, className, wide }: { value: ReactNode; className?: string; wide?: boolean }) {
  const [tick, setTick] = useState(0)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setTick((n) => n + 1)
    }
  }, [value])
  return (
    <span className={cn('inline-block overflow-hidden align-bottom', className)}>
      <span key={tick} className={cn('inline-block font-display font-extrabold tabular leading-none', tick > 0 && 'animate-tick', wide && 'numeral-wide')}>
        {value}
      </span>
    </span>
  )
}

export interface StatProps {
  label: ReactNode
  value: ReactNode
  /** Small line under the value. */
  hint?: ReactNode
  icon?: ReactNode
  /** Colours the value (and a 3px top rule). */
  tone?: Tone
  /** `wall`: 48-64px scoreboard numerals. */
  size?: 'sm' | 'md' | 'wall'
  className?: string
  /** Render without the card frame (inside an existing panel). */
  bare?: boolean
}

/** KPI tile. Alias: `StatCard`. */
export function Stat({ label, value, hint, icon, tone, size = 'md', className, bare }: StatProps) {
  const tc = tone ? toneClasses(tone) : null
  return (
    <div className={cn('relative min-w-0', !bare && 'overflow-hidden rounded-card border border-hairline bg-panel p-4', className)}>
      {tc && !bare && <span className={cn('absolute inset-x-0 top-0 h-[3px]', tc.dot)} aria-hidden />}
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted [&_svg]:size-4">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'mt-2',
          size === 'sm' && 'text-2xl',
          size === 'md' && 'text-[32px]',
          size === 'wall' && 'text-5xl xl:text-[64px]',
          tc && tone !== 'lime' ? tc.text : 'text-ink',
          tone === 'lime' && 'dark:text-lime',
        )}
      >
        <KpiNumeral value={value} wide={size === 'wall'} />
      </div>
      {hint != null && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

export const StatCard = Stat

/* ------------------------------------------------------------- ProgressBar */

export interface ProgressBarProps {
  /** 0-100. */
  value: number
  tone?: Tone
  size?: 'xs' | 'sm' | 'md'
  /** Label left + value right above the bar. */
  label?: ReactNode
  valueLabel?: ReactNode
  /** Stacked segments instead of one value: [{value (0-100), tone}]. */
  segments?: { value: number; tone: Tone; label?: string }[]
  className?: string
}

export function ProgressBar({ value, tone = 'ink', size = 'sm', label, valueLabel, segments, className }: ProgressBarProps) {
  const h = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2.5'
  const clamp = (n: number) => Math.max(0, Math.min(100, n))
  return (
    <div className={cn('min-w-0', className)}>
      {(label != null || valueLabel != null) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate text-muted">{label}</span>
          <span className="font-mono tabular text-ink">{valueLabel}</span>
        </div>
      )}
      <div
        className={cn('flex w-full overflow-hidden rounded-full bg-ink/8 dark:bg-ink/10', h)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp(value))}
      >
        {segments ? (
          segments.map((s, i) => (
            <span key={i} title={s.label} className={cn('h-full transition-[width] duration-300', toneClasses(s.tone).dot)} style={{ width: `${clamp(s.value)}%` }} />
          ))
        ) : (
          <span className={cn('h-full rounded-full transition-[width] duration-300', toneClasses(tone).dot)} style={{ width: `${clamp(value)}%` }} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({ name, size = 32, tone, className }: { name: string; size?: number; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 select-none place-items-center rounded-full font-display font-bold leading-none',
        tone ? toneClasses(tone).solid : 'bg-carbon text-lime',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/* ------------------------------------------------------- Kbd / Skeleton etc */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-hairline-strong bg-panel px-1 font-mono text-[11px] font-medium leading-none text-muted dark:bg-sunken',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('block animate-shimmer rounded-control bg-ink/8 dark:bg-ink/10', className)} aria-hidden />
}

export function Spinner({ size = 18, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex text-muted', className)}>
      <Loader2 size={size} strokeWidth={2} className="animate-spin" />
    </span>
  )
}

/** Full-area loading state with the ring. */
export function LoadingBlock({ label, className }: { label?: ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-h-[200px] place-items-center', className)} role="status">
      <div className="flex flex-col items-center gap-3 text-sm text-muted">
        <RingPulse size={44} />
        {label}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Replace the brand motif with an icon. */
  icon?: ReactNode
  compact?: boolean
  className?: string
}

export function EmptyState({ title, description, action, icon, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {icon ? (
        <span className="grid size-12 place-items-center rounded-card border border-hairline bg-sunken text-muted [&_svg]:size-6">{icon}</span>
      ) : (
        <DialMotif size={compact ? 84 : 128} className="text-ink" />
      )}
      <div className="max-w-sm">
        <p className={cn('font-display font-bold text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------- Alert */

const ALERT_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle }

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const Icon = ALERT_ICON[tone]
  const t = toneClasses(tone)
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-card border border-hairline bg-panel px-3.5 py-3 text-sm', t.edge, className)}>
      <Icon size={18} strokeWidth={1.75} className={cn('mt-px shrink-0', t.text)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn('text-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------------------------------- PageHeader etc */

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Line above the title (breadcrumb / back link). */
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Horizontal row of filters and actions that wraps on small screens. Alias: `FilterBar`. */
export function Toolbar({ children, className, end }: { children?: ReactNode; className?: string; end?: ReactNode }) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>
      {children}
      {end && <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div>}
    </div>
  )
}

export const FilterBar = Toolbar

/** Label/value pairs (lead card, detail drawers). */
export function DescriptionList({
  items,
  columns = 1,
  className,
}: {
  items: { label: ReactNode; value: ReactNode; mono?: boolean }[]
  columns?: 1 | 2
  className?: string
}) {
  return (
    <dl className={cn('grid gap-x-4 gap-y-2.5', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={cn('mt-0.5 break-words text-sm text-ink', item.mono && 'font-mono tabular')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* -------------------------------------------------------------------- Tabs */

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn('scrollbar-none mb-4 flex max-w-full gap-1 overflow-x-auto border-b border-hairline', className)}
      {...props}
    />
  )
})

export interface TabsTriggerProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  icon?: ReactNode
  /** Count bubble after the label. */
  count?: ReactNode
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger({ className, icon, count, children, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        '-mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] border-transparent px-3 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink dark:data-[state=active]:border-lime [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count != null && <span className="rounded-full bg-sunken px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted">{count}</span>}
    </TabsPrimitive.Trigger>
  )
})

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('focus-visible:outline-none', className)} {...props} />
})

/* ------------------------------------------------------------------ Toaster */

/** Mounted once by the shell. Use `toast` from `@/lib/toast` to show one. */
export function Toaster({ theme = 'light' }: { theme?: 'light' | 'dark' }) {
  return <Sonner position="top-right" theme={theme} richColors={false} closeButton duration={4000} offset={16} />
}
