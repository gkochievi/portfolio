import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as RadixTabs from '@radix-ui/react-tabs'
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, CheckCircle2, ChevronRight, Info, Loader2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { QueueMotif } from '@/components/brand/QueueMotif'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatIndex, formatMoney, formatRelative } from '@/lib/format'

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

/* ------------------------------------------------------------------- Card */

export function Card({ className, active, ...props }: HTMLAttributes<HTMLDivElement> & { active?: boolean }) {
  return <div className={cn('rounded-lg border border-hairline bg-panel', active && 'serving', className)} {...props} />
}

export interface CardHeaderProps {
  title?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
  children?: ReactNode
}

export function CardHeader({ title, description, eyebrow, actions, className, children }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-0.5">{eyebrow}</div> : null}
        {title ? <h3 className="font-display text-[15px] font-semibold leading-6">{title}</h3> : null}
        {description ? <p className="text-[13px] text-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-4 py-3 sm:px-5', className)} {...props} />
}

/* ------------------------------------------------------------- TicketCard */

export interface TicketCardProps {
  /** Marks the card with the "now serving" rule. */
  active?: boolean
  /** Below the dashed perforation. */
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Makes the whole card a router link. */
  to?: string
  onClick?: () => void
}

/** Ticket stub for tasks and invoices: notched corner + dashed perforation. */
export function TicketCard({ active, footer, children, className, to, onClick }: TicketCardProps) {
  const body = (
    <>
      <div className="px-4 py-3">{children}</div>
      {footer ? <div className="ticket-perf px-4 py-2.5 text-[13px] text-muted">{footer}</div> : null}
    </>
  )
  const cls = cn(
    'ticket block rounded-lg border border-hairline bg-panel text-left transition-colors duration-150 ease-rigi animate-rise',
    active && 'serving',
    (to || onClick) && 'cursor-pointer hover:border-hairline-strong hover:bg-row-hover',
    className,
  )
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full')}>{body}</button>
  return <div className={cls}>{body}</div>
}

/* ------------------------------------------------------------- PageHeader */

export interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Back link: a path, or {to, label}. */
  back?: string | { to: string; label: ReactNode }
  /** Chips / meta line under the title. */
  meta?: ReactNode
  icon?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, back, meta, icon, className }: PageHeaderProps) {
  const { t } = useTranslation('common')
  const backTo = typeof back === 'string' ? back : back?.to
  const backLabel = typeof back === 'object' ? back.label : t('actions.back')
  return (
    <header className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {backTo ? (
          <Link to={backTo} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="size-3.5 stroke-[1.75]" aria-hidden />
            {backLabel}
          </Link>
        ) : null}
        {eyebrow ? <div className="eyebrow mb-1">{eyebrow}</div> : null}
        <div className="flex items-center gap-2.5">
          {icon ? <span className="text-muted [&_svg]:size-5 [&_svg]:stroke-[1.75]">{icon}</span> : null}
          <h1 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] break-words sm:text-[28px] sm:leading-[34px]">{title}</h1>
        </div>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">{meta}</div> : null}
        {description ? <p className="mt-1.5 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/* ---------------------------------------------------------------- Section */

export function Section({ title, description, actions, children, className, eyebrow }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-8', className)}>
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            {eyebrow ? <div className="eyebrow mb-0.5">{eyebrow}</div> : null}
            {title ? <h2 className="font-display text-base font-semibold">{title}</h2> : null}
            {description ? <p className="text-[13px] text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/* -------------------------------------------------------------- Sparkline */

const toneVar: Record<Tone, string> = {
  neutral: 'var(--ink)',
  primary: 'var(--signal)',
  accent: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--info)',
}

export function Sparkline({ values, tone = 'primary', width = 96, height = 28, className, fill = true }: { values: number[]; tone?: Tone; width?: number; height?: number; className?: string; fill?: boolean }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const color = toneVar[tone]
  const last = pts[pts.length - 1]!
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn('overflow-visible', className)} aria-hidden>
      {fill ? <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={0.08} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="square" />
      <rect x={last[0] - 2.5} y={last[1] - 2.5} width={5} height={5} fill={color} />
    </svg>
  )
}

/* ---------------------------------------------------------------- KpiTile */

function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return value
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export interface KpiTileProps {
  /** 1-based tile index, rendered as a mono "01". */
  index?: number
  label: ReactNode
  /** Numbers count up once on mount; pass `format` to render them. */
  value: number | ReactNode
  format?: (n: number) => string
  /** Delta vs previous period: number (+/-), shown with an arrow. */
  delta?: number | null
  /** Rendered after the delta, e.g. "vs last month". */
  deltaLabel?: ReactNode
  /** Treat a negative delta as good (e.g. overdue count). */
  inverse?: boolean
  trend?: number[]
  href?: string
  tone?: Tone
  hint?: ReactNode
  loading?: boolean
  className?: string
}

export function KpiTile({ index, label, value, format, delta, deltaLabel, inverse, trend, href, tone = 'primary', hint, loading, className }: KpiTileProps) {
  const numeric = typeof value === 'number'
  const counted = useCountUp(numeric ? value : 0)
  const shown = numeric ? (format ? format(counted) : Math.round(counted).toLocaleString()) : value
  const good = delta === null || delta === undefined ? null : inverse ? delta <= 0 : delta >= 0
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          {index !== undefined ? <span className="font-mono text-[11px] text-subtle">{formatIndex(index)}</span> : null}
          <span className="truncate text-xs font-medium text-muted">{label}</span>
        </div>
        {href ? <ChevronRight className="size-4 shrink-0 stroke-[1.75] text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span className={cn('num font-display text-[28px] font-semibold leading-8 tracking-[-0.02em]', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{shown}</span>
        )}
        {trend && trend.length > 1 ? <Sparkline values={trend} tone={tone === 'neutral' ? 'neutral' : tone} /> : null}
      </div>
      {delta !== undefined && delta !== null ? (
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          <span className={cn('num inline-flex items-center gap-0.5 font-medium', good ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {delta >= 0 ? '+' : '−'}
            {Math.abs(delta).toLocaleString()}
          </span>
          {deltaLabel ? <span className="text-muted">{deltaLabel}</span> : null}
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-muted">{hint}</div>
      ) : null}
    </>
  )
  const cls = cn('group block rounded-lg border border-hairline bg-panel px-4 py-3.5', href && 'transition-colors hover:border-hairline-strong hover:bg-row-hover', className)
  return href ? <Link to={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>
}

/** Alias of KpiTile. */
export const StatCard = KpiTile

/** Responsive strip for 2-4 KpiTiles. */
export function KpiStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4', className)}>{children}</div>
}

/* ------------------------------------------------------------------ Badge */

const badgeTone: Record<Tone | 'outline', string> = {
  neutral: 'bg-ink/8 text-ink',
  primary: 'bg-primary/12 text-primary',
  accent: 'bg-accent/12 text-accent',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  outline: 'border border-ink/50 text-ink',
}

export interface BadgeProps {
  tone?: Tone | 'outline'
  /** 6px square status dot. Default true. */
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
  className?: string
  title?: string
}

/** Square-ish status chip (radius 4, 12% tint, square dot). */
export function Badge({ tone = 'neutral', dot = true, icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn('inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 text-xs font-medium leading-none [&_svg]:size-3.5 [&_svg]:stroke-[1.75]', badgeTone[tone], className)}
    >
      {icon ?? (dot ? <span className="size-1.5 shrink-0 bg-current" aria-hidden /> : null)}
      <span className="truncate">{children}</span>
    </span>
  )
}

/* ------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Replaces the queue motif. */
  icon?: ReactNode
  /** Smaller padding for use inside cards and tables. */
  compact?: boolean
  className?: string
}

export function EmptyState({ title, description, action, icon, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {icon ? <div className="text-subtle [&_svg]:size-8 [&_svg]:stroke-[1.5]">{icon}</div> : <QueueMotif count={4} size={compact ? 9 : 12} withTicket={!compact} />}
      <div className="max-w-sm">
        <p className="font-display text-[15px] font-semibold">{title}</p>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------- Skeleton/Spinner */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink/7', className)} aria-hidden />
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted', className)}>
      <Loader2 className="size-4 animate-spin stroke-[1.75]" aria-hidden />
      {label ? <span className="text-[13px]">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

/** Full-area loading placeholder for a page body. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

/* ------------------------------------------- Mono / Money / DateText / Kbd */

/** Inline record id (TCK-1187, INV-2026-09-000142, keys). */
export function Mono({ children, className, chip = true }: { children: ReactNode; className?: string; chip?: boolean }) {
  return (
    <span className={cn('num whitespace-nowrap font-mono text-[12px]', chip && 'rounded-[3px] bg-ink/6 px-1.5 py-0.5', className)}>{children}</span>
  )
}

export function Money({ amount, currency, className, tone }: { amount: number | null | undefined; currency: string; className?: string; tone?: 'auto' }) {
  useTranslation()
  return (
    <span className={cn('num whitespace-nowrap', tone === 'auto' && amount !== null && amount !== undefined && amount < 0 && 'text-danger', className)}>
      {formatMoney(amount, currency)}
    </span>
  )
}

export function DateText({ value, withTime, relative, className }: { value: string | null | undefined; withTime?: boolean; relative?: boolean; className?: string }) {
  useTranslation()
  if (!value) return <span className={cn('text-subtle', className)}>—</span>
  const exact = withTime ? formatDateTime(value) : formatDate(value)
  return (
    <time dateTime={value} title={relative ? exact : formatDateTime(value)} className={cn('num whitespace-nowrap', className)}>
      {relative ? formatRelative(value) : exact}
    </time>
  )
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-hairline-strong bg-surface px-1 font-mono text-[10px] text-muted', className)}>{children}</kbd>
}

/* ----------------------------------------------------------------- Avatar */

const AVATAR_TONES = ['bg-[#1A1B1E] text-[#ECECE7]', 'bg-[#2A7A2E] text-white', 'bg-[#8A6400] text-white', 'bg-[#0F7062] text-white', 'bg-[#5D6067] text-white', 'bg-[#2D5BA6] text-white']

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]!.charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : ''
  return (first + last).toUpperCase()
}

export function Avatar({ name, size = 'md', className, color }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; color?: string }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const dims = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' }[size]
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold', dims, !color && AVATAR_TONES[hash % AVATAR_TONES.length], className)}
      style={color ? { background: color, color: '#fff' } : undefined}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}

/* ------------------------------------------------------------ ProgressBar */

export function ProgressBar({ value, max = 100, tone = 'primary', label, showValue, className }: { value: number; max?: number; tone?: Tone; label?: ReactNode; showValue?: ReactNode; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">{label}</span>
          {showValue ? <span className="num font-medium">{showValue}</span> : null}
        </div>
      ) : null}
      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-ink/8" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="h-full transition-[width] duration-300 ease-rigi" style={{ width: `${pct}%`, background: toneVar[tone] }} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- FilterBar */

export interface FilterBarProps {
  children: ReactNode
  /** Right-aligned actions (export, create). */
  actions?: ReactNode
  /** Shows a "Clear" button when provided. */
  onClear?: () => void
  className?: string
}

export function FilterBar({ children, actions, onClear, className }: FilterBarProps) {
  const { t } = useTranslation('common')
  return (
    <div className={cn('mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between', className)}>
      <div className="flex flex-wrap items-center gap-2 [&>*]:max-w-full">
        {children}
        {onClear ? (
          <button type="button" onClick={onClear} className="h-8 px-2 text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline">
            {t('actions.clear')}
          </button>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Alias of FilterBar. */
export const Toolbar = FilterBar

/* ----------------------------------------------------------------- Banner */

const bannerIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info } as const

export function Banner({ tone = 'info', title, children, action, className }: { tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral'; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const Icon = bannerIcon[tone]
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', {
        'border-info/30 bg-info/8': tone === 'info',
        'border-success/30 bg-success/8': tone === 'success',
        'border-warning/30 bg-warning/8': tone === 'warning',
        'border-danger/30 bg-danger/8': tone === 'danger',
        'border-hairline bg-panel': tone === 'neutral',
      }, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0 stroke-[1.75]', { 'text-info': tone === 'info', 'text-success': tone === 'success', 'text-warning': tone === 'warning', 'text-danger': tone === 'danger', 'text-muted': tone === 'neutral' })} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-[13px]', title ? 'mt-0.5 text-muted' : '')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------- DescriptionList */

export function DescriptionList({ items, columns = 2, className }: { items: Array<{ label: ReactNode; value: ReactNode; mono?: boolean; full?: boolean } | null | false>; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.filter(Boolean).map((item, i) => {
        const it = item as { label: ReactNode; value: ReactNode; mono?: boolean; full?: boolean }
        return (
          <div key={i} className={cn('min-w-0', it.full && 'sm:col-span-full')}>
            <dt className="text-xs text-muted">{it.label}</dt>
            <dd className={cn('mt-0.5 break-words text-sm', it.mono && 'font-mono text-[13px]')}>{it.value ?? <span className="text-subtle">—</span>}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/* ---------------------------------------------------------------- JsonView */

function JsonNode({ value, depth, collapseAt }: { value: unknown; depth: number; collapseAt: number }) {
  if (value === null) return <span className="text-subtle">null</span>
  if (typeof value === 'string') return <span className="text-success">"{value}"</span>
  if (typeof value === 'number') return <span className="text-info">{value}</span>
  if (typeof value === 'boolean') return <span className="text-accent">{String(value)}</span>
  if (typeof value !== 'object') return <span>{String(value)}</span>
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>)
  const open = Array.isArray(value) ? '[' : '{'
  const close = Array.isArray(value) ? ']' : '}'
  if (entries.length === 0) return <span>{open}{close}</span>
  return (
    <details open={depth < collapseAt} className="inline [&:not([open])>summary]:after:content-['…']">
      <summary className="inline cursor-pointer list-none text-muted hover:text-ink">{open}</summary>
      <div className="pl-4">
        {entries.map(([k, v]) => (
          <div key={k}>
            {!Array.isArray(value) ? <span className="text-ink">"{k}"</span> : null}
            {!Array.isArray(value) ? <span className="text-muted">: </span> : null}
            <JsonNode value={v} depth={depth + 1} collapseAt={collapseAt} />
          </div>
        ))}
      </div>
      <span className="text-muted">{close}</span>
    </details>
  )
}

/** Collapsible JSON viewer (audit diffs, log payloads). */
export function JsonView({ value, collapseAt = 2, className }: { value: unknown; collapseAt?: number; className?: string }) {
  return (
    <div className={cn('max-h-96 overflow-auto rounded-md border border-hairline bg-sunken p-3 font-mono text-[12px] leading-5 scrollbar-thin', className)}>
      <JsonNode value={value} depth={0} collapseAt={collapseAt} />
    </div>
  )
}

/* ------------------------------------------------------------------- Tabs */

export const Tabs = RadixTabs.Root

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixTabs.List className={cn('mb-4 flex max-w-full gap-1 overflow-x-auto border-b border-hairline scrollbar-thin', className)}>
      {children}
    </RadixTabs.List>
  )
}

export function TabsTrigger({ value, children, count, icon, disabled }: { value: string; children: ReactNode; count?: number | null; icon?: ReactNode; disabled?: boolean }) {
  return (
    <RadixTabs.Trigger
      value={value}
      disabled={disabled}
      className="relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-[13px] font-medium text-muted transition-colors hover:text-ink disabled:opacity-50 data-[state=active]:border-signal data-[state=active]:text-ink [&_svg]:size-4 [&_svg]:stroke-[1.75]"
    >
      {icon}
      {children}
      {count !== undefined && count !== null ? <span className="num rounded-[3px] bg-ink/7 px-1 font-mono text-[11px] text-muted">{count}</span> : null}
    </RadixTabs.Trigger>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadixTabs.Content value={value} className={cn('outline-none animate-fade', className)}>
      {children}
    </RadixTabs.Content>
  )
}

/* ------------------------------------------------------- SegmentedControl */

export interface SegmentedControlProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: ReadonlyArray<{ value: V; label: ReactNode; icon?: ReactNode; title?: string }>
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

export function SegmentedControl<V extends string>({ value, onChange, options, size = 'md', className, ...rest }: SegmentedControlProps<V>) {
  return (
    <div role="radiogroup" aria-label={rest['aria-label']} className={cn('inline-flex shrink-0 rounded-md border border-hairline-strong bg-panel p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] font-medium transition-colors duration-150 ease-rigi [&_svg]:size-3.5 [&_svg]:stroke-[1.75]',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]',
              active ? 'bg-ink text-surface' : 'text-muted hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
