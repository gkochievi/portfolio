/**
 * Locale-aware formatting. Every helper takes an optional `lang`; without it
 * the current i18next language is used. Dates use ka-GE / en-GB via Intl.
 */
import i18n from '@/i18n'

export type Lang = 'en' | 'ka'
type DateInput = string | number | Date

export function resolveLang(lang?: string | null): Lang {
  return (lang ?? i18n.language) === 'ka' ? 'ka' : 'en'
}

export function dateLocale(lang?: string | null): string {
  return resolveLang(lang) === 'ka' ? 'ka-GE' : 'en-GB'
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value)
}

/** 8 Oct 2026 */
export function formatDate(value: DateInput, lang?: string | null, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(lang), options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(
    toDate(value),
  )
}

/** 8 Oct 2026, 14:05 */
export function formatDateTime(value: DateInput, lang?: string | null): string {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(toDate(value))
}

/** 14:05 (or 14:05:09 with seconds). */
export function formatTime(value: DateInput, lang?: string | null, seconds = false): string {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(toDate(value))
}

/** 8 Oct (short day + month, for charts and compact rows). */
export function formatDayMonth(value: DateInput, lang?: string | null): string {
  return new Intl.DateTimeFormat(dateLocale(lang), { day: 'numeric', month: 'short' }).format(toDate(value))
}

/** 1,234 (en) / 1 234 (ka). Always render inside a tabular-nums element. */
export function formatNumber(value: number, lang?: string | null, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(dateLocale(lang), options).format(value)
}

/** +50 / −10 / 0 (true minus sign). */
export function formatSigned(value: number, lang?: string | null): string {
  const abs = formatNumber(Math.abs(value), lang)
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

/** 62% from 0.62 */
export function formatPercent(ratio: number, lang?: string | null, digits = 0): string {
  return formatNumber(ratio, lang, { style: 'percent', maximumFractionDigits: digits })
}

/** "5 minutes ago" / "in 2 days". */
export function formatRelative(value: DateInput, lang?: string | null, now: number = Date.now()): string {
  const diffSec = Math.round((toDate(value).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(dateLocale(lang), { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 45) return rtf.format(diffSec, 'second')
  if (abs < 45 * 60) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 22 * 3600) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}

/**
 * Countdown text: `2d 04:05:06`, or `04:05:06` under a day. Negative or zero
 * reads as `00:00:00`. Georgian uses `დ` for days.
 */
export function formatCountdown(ms: number, lang?: string | null): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`
  if (days === 0) return clock
  return `${days}${resolveLang(lang) === 'ka' ? 'დ' : 'd'} ${clock}`
}

/** 0:42 for a duration in seconds. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
