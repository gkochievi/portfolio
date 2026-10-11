/**
 * Surfaces and page scaffolding: Card, CardHeader, BubbleCard, StatTile
 * (alias StatCard), Skeleton, EmptyState, ErrorState, PageHeader, Toolbar
 * (alias FilterBar), ActionBar, DescriptionList, Section.
 * Owner: design-system agent.
 */
import { ArrowDownRight, ArrowUpRight, ChevronLeft, Minus } from 'lucide-react'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { Illustration, type IllustrationKind } from './Illustration'

/* ------------------------------------------------------------------- Card */

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  /** Inner padding: none | sm (12) | md (16, console default) | lg (24). */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Hover affordance for clickable cards. */
  interactive?: boolean
}

const pads = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const

export function Card({ as: Tag = 'div', padding = 'md', interactive, className, ...props }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-border bg-panel text-ink',
        pads[padding],
        interactive && 'cursor-pointer transition-[border-color,transform] duration-200 ease-azri hover:border-ink/25 active:scale-[.995]',
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Right side: buttons, a select, a "View all" link. */
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}

export function CardHeader({ title, description, actions, icon, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start gap-3', className)}>
      {icon && <span className="mt-0.5 shrink-0 text-muted [&_svg]:size-5">{icon}</span>}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-tight text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------------------------------------- BubbleCard */

export interface BubbleCardProps extends HTMLAttributes<HTMLDivElement> {
  /** panel (white), tint (brand tint), brand (solid brand colour), sunken. */
  tone?: 'panel' | 'tint' | 'brand' | 'sunken'
  padding?: 'sm' | 'md' | 'lg'
}

/** The signature shape: 20px radius with the bottom-left corner at 4px. */
export function BubbleCard({ tone = 'panel', padding = 'md', className, ...props }: BubbleCardProps) {
  return (
    <div
      className={cn(
        'rounded-bubble',
        { sm: 'p-3.5', md: 'p-5', lg: 'p-6' }[padding],
        tone === 'panel' && 'border border-border bg-panel text-ink',
        tone === 'tint' && 'bg-brand-tint text-ink',
        tone === 'brand' && 'bg-brand text-on-brand',
        tone === 'sunken' && 'bg-sunken text-ink',
        className,
      )}
      {...props}
    />
  )
}

/* --------------------------------------------------------------- StatTile */

export interface StatTileProps {
  label: ReactNode
  /** Pre-formatted value ("87%", "4.3"). */
  value: ReactNode
  /** Small text after the value ("/ 5"). */
  unit?: ReactNode
  /** Change vs the previous period. Sign drives the arrow and colour. */
  delta?: number | null
  /** Pre-formatted delta text (default: the number with a sign). */
  deltaLabel?: ReactNode
  /** Lower is better (flips the colour). */
  invertDelta?: boolean
  /** Muted line under the value. */
  hint?: ReactNode
  icon?: ReactNode
  /** Small chart under the value (e.g. <Sparkline/>). */
  chart?: ReactNode
  loading?: boolean
  /** Emphasised tile (brand fill). */
  highlight?: boolean
  className?: string
}

export function StatTile({ label, value, unit, delta, deltaLabel, invertDelta, hint, icon, chart, loading, highlight, className }: StatTileProps) {
  const good = delta === null || delta === undefined || delta === 0 ? null : (delta > 0) !== Boolean(invertDelta)
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border p-4',
        highlight ? 'border-transparent bg-primary text-on-primary' : 'border-border bg-panel text-ink',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className={cn('shrink-0 [&_svg]:size-4', highlight ? 'opacity-80' : 'text-muted')}>{icon}</span>}
        <span className={cn('truncate text-[13px] font-medium', highlight ? 'opacity-85' : 'text-muted')}>{label}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[30px] font-semibold leading-none tabular tracking-tight">{value}</span>
          {unit && <span className={cn('text-sm', highlight ? 'opacity-80' : 'text-muted')}>{unit}</span>}
          {delta !== undefined && delta !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular [&_svg]:size-3.5',
                highlight
                  ? 'bg-white/15'
                  : good === null
                    ? 'bg-ink/7 text-muted'
                    : good
                      ? 'bg-success/12 text-success'
                      : 'bg-danger/10 text-danger',
              )}
            >
              {delta > 0 ? <ArrowUpRight /> : delta < 0 ? <ArrowDownRight /> : <Minus />}
              {deltaLabel ?? `${delta > 0 ? '+' : ''}${delta}`}
            </span>
          )}
        </div>
      )}
      {hint && <p className={cn('mt-1.5 text-xs', highlight ? 'opacity-80' : 'text-muted')}>{hint}</p>}
      {chart && <div className="mt-3">{chart}</div>}
    </div>
  )
}

/** Alias for StatTile. */
export const StatCard = StatTile

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-lg bg-ink/8', className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  /** Brand illustration (default 'empty'); pass null for icon-only. */
  illustration?: IllustrationKind | null
  icon?: ReactNode
  /** Buttons / links. */
  action?: ReactNode
  /** Tighter version for table bodies and cards. */
  compact?: boolean
  /** Draw inside a dashed bubble frame. */
  framed?: boolean
  className?: string
}

export function EmptyState({ title, description, illustration = 'empty', icon, action, compact, framed, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12',
        framed && 'rounded-bubble border border-dashed border-border-strong',
        className,
      )}
    >
      {illustration && !icon && <Illustration kind={illustration} size={compact ? 112 : 168} />}
      {icon && <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-on-primary-soft [&_svg]:size-6">{icon}</span>}
      <h3 className={cn('font-display font-semibold text-ink', compact ? 'text-base' : 'text-xl')}>{title}</h3>
      {description && <p className={cn('max-w-md text-muted', compact ? 'text-[13px]' : 'text-sm')}>{description}</p>}
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Load failure with a retry button. */
export function ErrorState({ title, description, onRetry, compact, className }: { title?: ReactNode; description?: ReactNode; onRetry?: () => void; compact?: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <EmptyState
      illustration="error"
      compact={compact}
      className={className}
      title={title ?? t('errors.generic')}
      description={description ?? t('errors.loadFailed')}
      action={onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>{t('actions.retry')}</Button> : undefined}
    />
  )
}

/* ------------------------------------------------------------- PageHeader */

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title (breadcrumb text, tenant name, badge). */
  eyebrow?: ReactNode
  /** Right-side actions. Wraps under the title on phones. */
  actions?: ReactNode
  /** Back link: { to, label }. */
  back?: { to: string; label: ReactNode }
  className?: string
}

export function PageHeader({ title, description, eyebrow, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
            <ChevronLeft className="size-4" strokeWidth={1.75} />
            {back.label}
          </Link>
        )}
        {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/* ---------------------------------------------------------------- Toolbar */

/** Horizontal wrap of filters / actions. Put <ToolbarSpacer/> to push the rest right. */
export function Toolbar({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div role="toolbar" aria-label={label} className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  )
}
export const FilterBar = Toolbar
export function ToolbarSpacer() {
  return <span className="hidden flex-1 sm:block" />
}

/* -------------------------------------------------------------- ActionBar */

/** Sticky bottom bar for the respondent flow (holds the 56px pill button). */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-5 mt-auto border-t border-border bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-float',
        className,
      )}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------- DescriptionList */

export interface DescriptionItem {
  label: ReactNode
  value: ReactNode
  /** Monospace value (tokens, phone). */
  mono?: boolean
}

/** Label/value rows (detail drawers, settings panels). */
export function DescriptionList({ items, columns = 1, className }: { items: DescriptionItem[]; columns?: 1 | 2; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs font-medium text-muted">{item.label}</dt>
          <dd className={cn('min-w-0 break-words text-sm text-ink', item.mono && 'font-mono text-[13px]')}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------------------------------------------------------- Section */

/** A titled block inside a page (h2 + optional actions). */
export function Section({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-8 first:mt-0', className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="text-[13px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
