import { format, subDays } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { fieldBase } from './Input'

export interface DateRange {
  /** 'yyyy-MM-dd' */
  from: string
  /** 'yyyy-MM-dd' */
  to: string
}

export interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  /** Preset day counts shown as chips (default [7, 30, 90]). Pass [] to hide. */
  presets?: number[]
  /** Latest selectable date (default today). */
  max?: string
  /** Maximum span in days (e.g. 92 for profile stats). */
  maxDays?: number
  className?: string
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Build a range ending today. */
export function lastDays(days: number, now: Date = new Date()): DateRange {
  return { from: iso(subDays(now, days - 1)), to: iso(now) }
}

/** Two native date inputs plus "7d / 30d / 90d" presets. */
export function DateRangePicker({ value, onChange, presets = [7, 30, 90], max, maxDays, className }: DateRangePickerProps) {
  const { t } = useTranslation()
  const today = max ?? iso(new Date())
  const clamp = (r: DateRange): DateRange => {
    let { from, to } = r
    if (from > to) [from, to] = [to, from]
    if (maxDays) {
      const minFrom = iso(subDays(new Date(to), maxDays - 1))
      if (from < minFrom) from = minFrom
    }
    return { from, to }
  }
  const input = cn(fieldBase, 'h-8 w-[9.5rem] px-2 text-[13px] tabular')
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {presets.length ? (
        <div className="inline-flex items-center gap-0.5 rounded-ui border border-line bg-sunken p-0.5">
          {presets.map((d) => {
            const r = lastDays(d, new Date(today))
            const active = r.from === value.from && r.to === value.to
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange(r)}
                aria-pressed={active}
                className={cn('h-7 rounded-[8px] px-2.5 text-xs font-medium tabular', active ? 'bg-panel text-ink shadow-[0_0_0_1px_var(--c-line)]' : 'text-muted hover:text-ink')}
              >
                {t('dateRange.lastDays', { count: d })}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <input type="date" aria-label={t('dateRange.from')} className={input} value={value.from} max={value.to} onChange={(e) => e.target.value && onChange(clamp({ ...value, from: e.target.value }))} />
        <span className="text-muted">-</span>
        <input type="date" aria-label={t('dateRange.to')} className={input} value={value.to} min={value.from} max={today} onChange={(e) => e.target.value && onChange(clamp({ ...value, to: e.target.value }))} />
      </div>
    </div>
  )
}
