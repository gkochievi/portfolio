import { bootstrap } from './bootstrap'

const LOCALE = 'en-GB'
const TZ = bootstrap.timeZone

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
})

const dayShort = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  timeZone: TZ,
})

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat(LOCALE)

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date)
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '—' : dateOnly.format(date)
}

export function formatDayShort(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return dayShort.format(date)
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.348],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
]

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'

  let delta = (date.getTime() - Date.now()) / 1000
  for (const [unit, span] of RELATIVE_STEPS) {
    if (Math.abs(delta) < span) {
      return relative.format(Math.round(delta), unit)
    }
    delta /= span
  }
  return dateOnly.format(date)
}

export function formatNumber(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '0'
  return plain.format(numeric)
}

export function formatCompact(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '0'
  return numeric >= 10_000 ? compact.format(numeric) : plain.format(numeric)
}

/** Prices are Georgian lari; the API sends decimals as strings. */
export function formatMoney(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '—'
  return `₾${numeric.toFixed(2)}`
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

/** Signed change between two counters, for the dashboard deltas. */
export function delta(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return { value: current === 0 ? 0 : 100, direction: current > 0 ? 'up' : 'flat' }
  }
  const change = ((current - previous) / previous) * 100
  return {
    value: Math.abs(Math.round(change)),
    direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
  }
}

/** Datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time. */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
