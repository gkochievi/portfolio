/**
 * Small status and rating atoms: Badge, StatusBadge, Chip, ScorePill, Stars.
 * Owner: design-system agent.
 */
import { CircleAlert, CircleCheck, Clock3, Link2Off, TimerOff } from 'lucide-react'
import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatRating } from '@/lib/format'
import { asLang, cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Badge */

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const toneClasses: Record<BadgeTone, { soft: string; outline: string; dot: string }> = {
  neutral: { soft: 'bg-ink/7 text-muted', outline: 'border-border-strong text-muted', dot: 'bg-muted' },
  primary: { soft: 'bg-primary-soft text-on-primary-soft', outline: 'border-primary/40 text-link', dot: 'bg-primary' },
  accent: { soft: 'bg-mint text-plum', outline: 'border-mint text-ink', dot: 'bg-mint' },
  success: { soft: 'bg-success/12 text-success', outline: 'border-success/40 text-success', dot: 'bg-success' },
  warning: { soft: 'bg-warning/12 text-warning', outline: 'border-warning/40 text-warning', dot: 'bg-warning' },
  danger: { soft: 'bg-danger/10 text-danger', outline: 'border-danger/40 text-danger', dot: 'bg-danger' },
  info: { soft: 'bg-info/12 text-info', outline: 'border-info/40 text-info', dot: 'bg-info' },
}

export interface BadgeProps {
  tone?: BadgeTone
  variant?: 'soft' | 'outline'
  size?: 'sm' | 'md'
  /** Leading coloured dot. */
  dot?: boolean
  icon?: ReactNode
  /** Monospace (tokens, sender IDs). */
  mono?: boolean
  className?: string
  title?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', dot, icon, mono, className, title, children }: BadgeProps) {
  const tones = toneClasses[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold leading-none [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-[13px]',
        variant === 'soft' ? tones.soft : cn('border bg-transparent', tones.outline),
        mono && 'font-mono font-medium tracking-tight',
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('size-1.5 rounded-full', tones.dot)} />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

/* ------------------------------------------------------------ StatusBadge */

export type LinkStatusKind = 'pending' | 'completed' | 'expired' | 'unknown' | 'missing'

const statusMeta: Record<LinkStatusKind, { tone: BadgeTone; icon: ReactNode }> = {
  pending: { tone: 'info', icon: <Clock3 strokeWidth={2} /> },
  completed: { tone: 'success', icon: <CircleCheck strokeWidth={2} /> },
  expired: { tone: 'warning', icon: <TimerOff strokeWidth={2} /> },
  unknown: { tone: 'danger', icon: <Link2Off strokeWidth={2} /> },
  missing: { tone: 'danger', icon: <CircleAlert strokeWidth={2} /> },
}

export interface StatusBadgeProps {
  status: LinkStatusKind
  /** Extra text after the label, e.g. "expires in 5 days". */
  detail?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

/** Survey-link status: Pending, Completed, Expired, Broken link, Missing ID. */
export function StatusBadge({ status, detail, size, className }: StatusBadgeProps) {
  const { t } = useTranslation('common')
  const meta = statusMeta[status]
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
      {t(`status.${status}`)}
      {detail ? <span className="font-medium opacity-80"> · {detail}</span> : null}
    </Badge>
  )
}

/* ------------------------------------------------------------------- Chip */

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  icon?: ReactNode
  /** Colour swatch dot (any CSS colour, e.g. a tenant primary). */
  color?: string
  /** Trailing count. */
  count?: number | string
  size?: 'sm' | 'md'
}

/** Toggleable pill (filters, tenant chips, quick picks). aria-pressed reflects `selected`. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, icon, color, count, size = 'md', className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border font-medium transition-[background-color,border-color,color] duration-200 ease-azri focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm',
        selected
          ? 'border-primary bg-primary-soft text-on-primary-soft'
          : 'border-border-strong bg-panel text-ink hover:border-ink/35 hover:bg-panel-2',
        className,
      )}
      {...props}
    >
      {color && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      {icon}
      {children}
      {count !== undefined && (
        <span className={cn('tabular text-xs', selected ? 'opacity-80' : 'text-muted')}>{count}</span>
      )}
    </button>
  )
})

/* ------------------------------------------------------------- ScorePill */

/** The rating's word label key (1..5) for a value; averages round. */
export function ratingLabelKey(value: number): `rating.${1 | 2 | 3 | 4 | 5}` {
  const n = Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5
  return `rating.${n}`
}

export interface ScorePillProps {
  /** 1..5, or an average (shown with one decimal). null = not rated. */
  value: number | null
  max?: number
  /** Append " · Good". Default true. */
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Mint pill with ink text: "4 / 5 · Good" or "4.3 / 5 · Good". */
export function ScorePill({ value, max = 5, showLabel = true, size = 'sm', className }: ScorePillProps) {
  const { t, i18n } = useTranslation('common')
  const lang = asLang(i18n.language)
  if (value === null || Number.isNaN(value)) {
    return (
      <span className={cn('inline-flex h-6 items-center rounded-full bg-ink/7 px-2.5 text-xs font-semibold text-muted', className)}>
        {t('rating.noRating')}
      </span>
    )
  }
  const shown = Number.isInteger(value) ? String(value) : formatRating(value, lang)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-mint font-semibold tabular text-plum',
        size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-8 px-3.5 text-sm',
        className,
      )}
    >
      {shown} / {max}
      {showLabel && <span className="font-medium">· {t(ratingLabelKey(value))}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------ Stars */

const STAR_PATH =
  'M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'

export interface StarsProps {
  /** 0..max; fractions fill partially. null = all outline. */
  value: number | null
  max?: number
  /** Star size in px (default 14). */
  size?: number
  className?: string
}

/**
 * Read-only rounded stars. Filled = text-primary (mulberry; mint in dark).
 * Inside the respondent frame pass className="text-brand".
 */
export function Stars({ value, max = 5, size = 14, className }: StarsProps) {
  const { t, i18n } = useTranslation('common')
  const uid = useId()
  const v = value ?? 0
  const label = value === null ? t('rating.noRating') : t('rating.outOf', { value: formatRating(value, asLang(i18n.language)), max })
  return (
    <span role="img" aria-label={label} className={cn('inline-flex items-center gap-0.5 text-primary', className)}>
      {Array.from({ length: max }, (_, index) => {
        const fill = Math.max(0, Math.min(1, v - index))
        const clip = `${uid}-s${index}`
        return (
          <svg key={index} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id={clip}>
                <rect x="0" y="0" width={24 * fill} height="24" />
              </clipPath>
            </defs>
            <path d={STAR_PATH} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth="1.75" strokeLinejoin="round" />
            {fill > 0 && (
              <path d={STAR_PATH} fill="currentColor" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" clipPath={`url(#${clip})`} />
            )}
          </svg>
        )
      })}
    </span>
  )
}

/** The star outline path (24x24) for feature agents drawing their own stars. */
export const STAR_SVG_PATH = STAR_PATH
