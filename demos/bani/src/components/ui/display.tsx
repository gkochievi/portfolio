/** Surfaces, status, headings and small display pieces. */
import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  X,
  XOctagon,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PolyphonyMotif } from '@/components/brand'
import { cn } from '@/lib/cn'
import type { CdrSource, UserRole } from '@/types'

/* -------------------------------------------------------------------- tones */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'bronze'

const toneText: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  neutral: 'text-muted',
  bronze: 'text-primary',
}
const toneFill: Record<Tone, string> = {
  success: 'bg-success/12',
  warning: 'bg-warning/12',
  danger: 'bg-danger/12',
  info: 'bg-info/12',
  neutral: 'bg-muted/12',
  bronze: 'bg-primary/12',
}
const toneDot: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted',
  bronze: 'bg-primary',
}
export const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XOctagon,
  info: Info,
  neutral: Circle,
  bronze: Circle,
}
/** Text-colour class for a tone (for numbers, icons). */
export const toneClass = (tone: Tone): string => toneText[tone]

/* --------------------------------------------------------------- StatusChip */

export interface StatusChipProps {
  tone: Tone
  /** Override the default per-tone Lucide icon; `false` hides it. */
  icon?: LucideIcon | false
  size?: 'sm' | 'md'
  className?: string
  title?: string
  children: ReactNode
}

/** 12% tone fill, full-strength text, pill radius, always an icon. */
export function StatusChip({ tone, icon, size = 'md', className, title, children }: StatusChipProps) {
  const Icon = icon === false ? null : (icon ?? TONE_ICON[tone])
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium',
        size === 'sm' ? 'h-5 px-2 text-[11.5px]' : 'h-6 px-2.5 text-[12.5px]',
        toneFill[tone],
        toneText[tone],
        className,
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 12 : 13} strokeWidth={2} aria-hidden className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** A plain label chip without a status icon (counts, tags, types). */
export function Badge({
  tone = 'neutral',
  className,
  children,
  mono,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
  mono?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium',
        toneFill[tone],
        toneText[tone],
        mono && 'font-mono tabular',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Core Cluster / Edge PBX tag. */
export function SourceBadge({ source, className }: { source: CdrSource; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium',
        source === 'core' ? 'border-pine-3/35 text-pine-3 dark:border-sage/40 dark:text-sage' : 'border-info/35 text-info',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', source === 'core' ? 'bg-pine-3 dark:bg-sage' : 'bg-info')} aria-hidden />
      {t(`sources.${source}`)}
    </span>
  )
}

const roleTone: Record<UserRole, Tone> = {
  superadmin: 'bronze',
  admin: 'bronze',
  'cc-admin': 'info',
  'tel-admin': 'info',
  'cc-operator': 'neutral',
  'tel-operator': 'neutral',
  'it-support': 'success',
  user: 'neutral',
  api_service: 'warning',
}

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <Badge tone={roleTone[role] ?? 'neutral'} className={className}>
      {t(`roles.${role}`)}
    </Badge>
  )
}

/** Slow 2.4s breathing dot for live things (live campaign, healthy platform). */
export function LiveDot({ tone = 'success', className, still }: { tone?: Tone; className?: string; still?: boolean }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)} aria-hidden>
      <span className={cn('absolute inset-0 rounded-full', toneDot[tone], !still && 'animate-breathe')} />
    </span>
  )
}

/* ------------------------------------------------------------------- Avatar */

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/[\s.\-_]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function Avatar({
  name,
  color,
  size = 28,
  className,
}: {
  name: string | null | undefined
  color?: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-[#FBFCF8]', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)), background: color ?? '#2F5D4E' }}
    >
      {initials(name)}
    </span>
  )
}

/* --------------------------------------------------------------------- Card */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('min-w-0 rounded-[10px] border border-line bg-panel', className)} {...rest}>
      {children}
    </div>
  )
}

export interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: LucideIcon
  className?: string
}

export function CardHeader({ title, subtitle, actions, icon: Icon, className }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden />}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-4 sm:px-5', className)} {...rest}>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- PageHeader */

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Small line under the subtitle (counts, last refreshed, chips). */
  meta?: ReactNode
  /** Eyebrow above the title. */
  eyebrow?: ReactNode
  className?: string
}

/** Page title sitting on the full-width 2px bronze baseline (the bass line). */
export function PageHeader({ title, subtitle, actions, meta, eyebrow, className }: PageHeaderProps) {
  return (
    <header className={cn('relative mb-5 pb-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="text-[24px] font-bold leading-tight text-ink sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-[14px] text-muted">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-full bg-primary animate-draw" />
    </header>
  )
}

/** Small section heading inside a page. */
export function SectionTitle({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center justify-between gap-2', className)}>
      <h2 className="text-[17px] font-semibold text-ink">{children}</h2>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- Sparkline */

const sparkStroke: Record<Tone, string> = {
  success: 'var(--bani-success)',
  warning: 'var(--bani-warning)',
  danger: 'var(--bani-danger)',
  info: 'var(--bani-info)',
  neutral: 'var(--bani-muted)',
  bronze: 'var(--bani-primary)',
}

export function Sparkline({
  values,
  tone = 'bronze',
  height = 28,
  className,
}: {
  values: readonly number[]
  tone?: Tone
  height?: number
  className?: string
}) {
  if (values.length < 2) return <div style={{ height }} className={className} />
  const w = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const stroke = sparkStroke[tone]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cn('block w-full', className)} style={{ height }} aria-hidden>
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={stroke} fillOpacity="0.1" />
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* ------------------------------------------------------------ KpiTile / Stat */

export interface KpiTileProps {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  spark?: readonly number[]
  icon?: LucideIcon
  className?: string
}

export function KpiTile({ label, value, hint, tone, spark, icon: Icon, className }: KpiTileProps) {
  return (
    <Card className={cn('flex flex-col gap-1.5 px-4 py-3.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        {Icon && <Icon size={16} strokeWidth={1.75} className={cn('shrink-0', tone ? toneText[tone] : 'text-muted')} aria-hidden />}
      </div>
      <div
        className={cn('font-display text-[26px] font-bold leading-none tabular', tone && tone !== 'neutral' ? toneText[tone] : 'text-ink')}
        style={{ letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      {hint && <div className="text-[12.5px] text-muted">{hint}</div>}
      {spark && spark.length > 1 && <Sparkline values={spark} tone={tone ?? 'bronze'} className="mt-1" />}
    </Card>
  )
}
/** Alias of KpiTile. */
export const StatCard = KpiTile

/* ------------------------------------------------------------------- Banner */

export interface BannerProps {
  tone: Tone
  title?: ReactNode
  children?: ReactNode
  onDismiss?: () => void
  actions?: ReactNode
  className?: string
}

export function Banner({ tone, title, children, onDismiss, actions, className }: BannerProps) {
  const { t } = useTranslation('common')
  const Icon = TONE_ICON[tone]
  return (
    <div
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-[10px] border px-4 py-3', toneFill[tone], 'border-current/20', toneText[tone], className)}
    >
      <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn('text-[13.5px]', title ? 'mt-0.5 text-muted' : '')}>{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('actions.close')}
          className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
        >
          <X size={15} aria-hidden />
        </button>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  compact?: boolean
  className?: string
}

/** Polyphony motif + calm copy. `icon` replaces the motif. */
export function EmptyState({ title, body, action, icon: Icon, compact, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      {Icon ? (
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
      ) : (
        <PolyphonyMotif className={cn('mb-4 opacity-90', compact ? 'w-24' : 'w-36')} />
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-[13.5px] text-muted">{body}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Generic error panel with a retry button. */
export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation('common')
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t('states.error')}
      body={message}
      className={className}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center rounded-[8px] border border-line-strong bg-panel px-3 text-[13px] font-medium hover:bg-hover"
          >
            {t('actions.retry')}
          </button>
        ) : undefined
      }
    />
  )
}

/* ----------------------------------------------------------------- Skeleton */

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn('skeleton rounded-md', className ?? 'h-4 w-full')} style={style} />
}

/** A few skeleton lines (card bodies, drawers). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)} aria-busy>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ Tooltip */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>
}

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  if (content == null || content === '') return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-xs rounded-md bg-pine px-2.5 py-1.5 text-[12.5px] leading-snug text-linen shadow-pop animate-fade-in dark:border dark:border-pop-border"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/* --------------------------------------------------------------------- Tabs */

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...rest }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn('scrollbar-thin flex max-w-full items-end gap-1 overflow-x-auto border-b border-line', className)}
      {...rest}
    />
  )
}

export function TabsTrigger({ className, ...rest }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-[13.5px] font-medium text-muted transition-colors duration-[160ms] hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  )
}

export function TabsContent({ className, ...rest }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn('pt-4 focus-visible:outline-none', className)} {...rest} />
}

/* ------------------------------------------------- ChipRow / FilterChip / Bar */

/** One row of filter chips above a table; wraps on narrow screens. */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

export interface FilterChipProps {
  label: ReactNode
  /** Current value shown after the label; chip is "active" when set. */
  value?: ReactNode
  active?: boolean
  onClick?: () => void
  onClear?: () => void
  icon?: LucideIcon
  className?: string
}

export function FilterChip({ label, value, active, onClick, onClear, icon: Icon, className }: FilterChipProps) {
  const { t } = useTranslation('common')
  const on = active ?? (value != null && value !== '')
  return (
    <span
      className={cn(
        'inline-flex h-8 max-w-full items-center rounded-full border text-[13px] transition-colors duration-[160ms]',
        on ? 'border-primary/50 bg-primary/8 text-ink' : 'border-line-strong bg-panel text-muted hover:text-ink',
        className,
      )}
    >
      <button type="button" onClick={onClick} className="inline-flex h-full min-w-0 items-center gap-1.5 rounded-full px-3">
        {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden className={on ? 'text-primary' : undefined} />}
        <span className="whitespace-nowrap">{label}</span>
        {on && value != null && value !== '' && <span className="truncate font-medium text-ink">{value}</span>}
      </button>
      {on && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t('ui.clear')}
          className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </span>
  )
}

/** Toolbar above a table: filters on the left, actions on the right. */
export function Toolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
export const FilterBar = Toolbar

/** Label/value grid for detail drawers. */
export function DescriptionList({
  items,
  className,
  columns = 1,
}: {
  items: readonly { label: ReactNode; value: ReactNode; mono?: boolean }[]
  className?: string
  columns?: 1 | 2
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12px] text-muted">{item.label}</dt>
          <dd className={cn('mt-0.5 break-words text-[13.5px] text-ink', item.mono && 'font-mono text-[12.5px] tabular')}>
            {item.value ?? '-'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
