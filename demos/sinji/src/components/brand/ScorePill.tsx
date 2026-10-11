import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export type ScoreTone = 'success' | 'primary' | 'warning' | 'danger' | 'muted'

/** Brand bands: 85+ success, 70-84 primary, 50-69 warning, <50 danger; null -> muted. */
export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null || !Number.isFinite(score)) return 'muted'
  if (score >= 85) return 'success'
  if (score >= 70) return 'primary'
  if (score >= 50) return 'warning'
  return 'danger'
}

const toneCls: Record<ScoreTone, string> = {
  success: 'bg-success/12 text-success',
  primary: 'bg-primary/12 text-primary',
  warning: 'bg-warning/14 text-warning',
  danger: 'bg-danger/12 text-danger',
  muted: 'bg-ink/7 text-muted',
}

/** Score pill (999px, 12% tint, full-strength text, tabular numerals). */
export function ScorePill({
  score,
  tone,
  suffix,
  size = 'md',
  className,
  children,
}: {
  score: number | null | undefined
  /** Override the band tone (e.g. from `pillTone()` with custom bands). */
  tone?: ScoreTone
  suffix?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Replace the number (e.g. a dash label). */
  children?: ReactNode
}) {
  const t = tone ?? scoreTone(score)
  return (
    <span
      className={cn(
        'tabular inline-flex items-center justify-center rounded-pill font-semibold',
        size === 'sm' && 'h-5 min-w-8 px-1.5 text-[11px]',
        size === 'md' && 'h-6 min-w-10 px-2 text-xs',
        size === 'lg' && 'h-8 min-w-12 px-3 font-display text-base',
        toneCls[t],
        className,
      )}
    >
      {children ?? (score == null || !Number.isFinite(score) ? '-' : Math.round(score))}
      {suffix && score != null ? <span className="ml-0.5 font-normal opacity-70">{suffix}</span> : null}
    </span>
  )
}
