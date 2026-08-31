import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gold text-void font-semibold hover:bg-gold-bright active:bg-gold shadow-[0_6px_20px_-8px_rgba(248,190,98,0.65)] disabled:bg-gold/40 disabled:text-void/60',
  secondary:
    'bg-surface-2 text-ink border border-hairline-strong hover:bg-surface-3 hover:border-white/20',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/6',
  danger: 'bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20 hover:border-danger/50',
  outline: 'border border-gold/40 text-gold hover:bg-gold/10 hover:border-gold/70',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[8px]',
  md: 'h-10 px-4 text-sm gap-2 rounded-control',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-control',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

/* -------------------------------------------------------------- IconButton */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: 'default' | 'danger' | 'gold'
  size?: 'sm' | 'md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'default', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-grid place-items-center rounded-[9px] border transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'size-7' : 'size-9',
        variant === 'default' &&
          'border-hairline bg-white/3 text-ink-muted hover:border-hairline-strong hover:bg-white/8 hover:text-ink',
        variant === 'gold' && 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/60',
        variant === 'danger' && 'border-danger/25 bg-danger/8 text-danger/85 hover:bg-danger/18 hover:text-danger',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/* ------------------------------------------------------------------- Badge */

type Tone = 'neutral' | 'online' | 'offline' | 'gold' | 'warn' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/6 text-ink-muted border-hairline',
  online: 'bg-online/12 text-online border-online/25',
  offline: 'bg-white/5 text-ink-faint border-hairline',
  gold: 'bg-gold/12 text-gold border-gold/28',
  warn: 'bg-warn/12 text-warn border-warn/28',
  danger: 'bg-danger/12 text-danger border-danger/28',
  info: 'bg-info/12 text-info border-info/28',
}

export function Badge({
  tone = 'neutral',
  dot,
  pulse,
  className,
  children,
}: {
  tone?: Tone
  dot?: boolean
  pulse?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px]',
        'text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn('size-1.5 shrink-0 rounded-full bg-current', pulse && 'animate-pulse-ring')}
          aria-hidden
        />
      )}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------- Panel */

export function Panel({
  className,
  bracketed,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { bracketed?: boolean }) {
  return (
    <div className={cn('panel', bracketed && 'bracketed', className)} {...props}>
      {children}
    </div>
  )
}

export function PanelHeader({
  title,
  meta,
  action,
  icon,
}: {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="text-gold/80">{icon}</span>}
        <h2 className="truncate text-[13px] font-semibold tracking-[0.08em] text-ink uppercase">{title}</h2>
        {meta && <span className="numeral shrink-0 text-xs text-ink-faint">{meta}</span>}
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------- Spinner */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-gold', className)} aria-hidden />
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-sheen rounded-[8px] bg-white/6', className)}
      aria-hidden
    />
  )
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-full border border-hairline bg-white/4 text-ink-faint">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-ink-faint">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- PageTitle */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1.5">{breadcrumb}</div>}
        <h1 className="text-[26px] leading-none font-semibold text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-faint">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
