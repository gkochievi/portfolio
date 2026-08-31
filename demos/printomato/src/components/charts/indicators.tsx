import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { PaperState } from '@/types'

/* --------------------------------------------------------------- StatTile */

export function StatTile({
  label,
  value,
  unit,
  icon,
  hint,
  trend,
  accent = false,
  loading,
}: {
  label: string
  value: ReactNode
  unit?: string
  icon?: ReactNode
  hint?: string
  trend?: { value: number; direction: 'up' | 'down' | 'flat'; label: string }
  accent?: boolean
  loading?: boolean
}) {
  const TrendIcon =
    trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : Minus

  return (
    <div className={cn('panel bracketed group px-4 py-3.5 transition-colors duration-200 hover:border-hairline-strong')}>
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps">{label}</p>
        {icon && (
          <span className="shrink-0 text-ink-faint transition-colors duration-200 group-hover:text-gold">
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        {loading ? (
          <span className="animate-sheen inline-block h-8 w-20 rounded bg-white/8" />
        ) : (
          <>
            <span
              className={cn(
                'numeral text-[30px] leading-none font-semibold',
                accent ? 'text-gold' : 'text-ink',
              )}
            >
              {value}
            </span>
            {unit && <span className="text-sm font-medium text-ink-faint">{unit}</span>}
          </>
        )}
      </div>

      {(trend || hint) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                trend.direction === 'up' && 'text-online',
                trend.direction === 'down' && 'text-danger',
                trend.direction === 'flat' && 'text-ink-faint',
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden />
              {trend.direction === 'flat' ? '—' : `${trend.value}%`}
            </span>
          )}
          <span className="truncate text-ink-faint">{trend?.label ?? hint}</span>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- PaperMeter */

const STATE_STYLES: Record<PaperState, { fill: string; text: string }> = {
  // Emerald / gold / rose — the validated triad. The numeric label below
  // carries the same information, so colour is never the only signal.
  healthy: { fill: 'bg-online', text: 'text-online' },
  warning: { fill: 'bg-warn', text: 'text-warn' },
  critical: { fill: 'bg-danger', text: 'text-danger' },
}

const SEGMENTS = 12

export function PaperMeter({
  count,
  capacity,
  state,
  showLabel = true,
  size = 'md',
}: {
  count: number
  capacity: number
  state: PaperState
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const ratio = capacity > 0 ? Math.min(count / capacity, 1) : 0
  const filled = Math.round(ratio * SEGMENTS)
  const styles = STATE_STYLES[state]

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex items-center gap-[2px]"
        role="meter"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`Paper: ${count} of ${capacity}`}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={cn(
              'flex-1 rounded-[1.5px] transition-colors duration-300',
              size === 'sm' ? 'h-1.5' : 'h-2',
              index < filled ? styles.fill : 'bg-white/8',
            )}
          />
        ))}
      </div>
      {showLabel && (
        <div className="flex items-baseline justify-between">
          <span className={cn('numeral text-xs font-semibold', styles.text)}>{formatNumber(count)}</span>
          <span className="numeral text-[11px] text-ink-faint">/ {formatNumber(capacity)}</span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- ProgressBar */

export function ProgressBar({
  percent,
  tone = 'gold',
  className,
}: {
  percent: number
  tone?: 'gold' | 'online' | 'danger'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(percent, 100))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'gold' && 'bg-gold',
          tone === 'online' && 'bg-online',
          tone === 'danger' && 'bg-danger',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
