/**
 * Display formatting shared by every screen. Pass the UI language from
 * `useLang()`. Owner: design-system agent.
 */
import { differenceInCalendarDays, format, formatDistanceStrict, isValid, parseISO } from 'date-fns'
import { enGB, ka } from 'date-fns/locale'

import type { Lang } from '@/types'

type DateInput = Date | string | number | null | undefined

const LOCALES = { en: enGB, ka } as const
const NUMBER_LOCALE: Record<Lang, string> = { en: 'en-GB', ka: 'ka-GE' }

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(date) ? date : null
}

/** "1 Oct 2026" (en) / "1 ოქტ. 2026" (ka). */
export function formatDate(value: DateInput, lang: Lang = 'en', pattern = 'd MMM yyyy'): string {
  const date = toDate(value)
  return date ? format(date, pattern, { locale: LOCALES[lang] }) : '—'
}

/** "1 Oct" - for chart ticks and compact rows. */
export function formatDateShort(value: DateInput, lang: Lang = 'en'): string {
  return formatDate(value, lang, 'd MMM')
}

/** "1 Oct 2026, 14:05". */
export function formatDateTime(value: DateInput, lang: Lang = 'en'): string {
  return formatDate(value, lang, 'd MMM yyyy, HH:mm')
}

/** "14:05". */
export function formatTime(value: DateInput, lang: Lang = 'en'): string {
  return formatDate(value, lang, 'HH:mm')
}

/**
 * "3 hours ago" / "in 5 days" (and the Georgian equivalents). Under 45 s
 * reads "just now". `now` defaults to the real clock; pass the demo clock
 * when the distance must follow time travel.
 */
export function formatRelative(value: DateInput, lang: Lang = 'en', now: DateInput = new Date()): string {
  const date = toDate(value)
  const base = toDate(now) ?? new Date()
  if (!date) return '—'
  if (Math.abs(date.getTime() - base.getTime()) < 45_000) return lang === 'ka' ? 'ახლახან' : 'just now'
  return formatDistanceStrict(date, base, { addSuffix: true, locale: LOCALES[lang] })
}

/** Whole calendar days from `now` to `value` (negative when in the past). */
export function daysUntil(value: DateInput, now: DateInput = new Date()): number | null {
  const date = toDate(value)
  const base = toDate(now)
  if (!date || !base) return null
  return differenceInCalendarDays(date, base)
}

/** 1234 -> "1,234" (en) / "1 234" (ka). */
export function formatNumber(value: number | null | undefined, lang: Lang = 'en', digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(NUMBER_LOCALE[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** 87.25 -> "87%" (input is already 0..100). */
export function formatPercent(value: number | null | undefined, lang: Lang = 'en', digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${formatNumber(value, lang, digits)}%`
}

/** 4.257 -> "4.3" (always one decimal; "—" when there is no rating). */
export function formatRating(value: number | null | undefined, lang: Lang = 'en'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return formatNumber(Math.round(value * 10) / 10, lang, 1)
}

/** Signed delta for KPI tiles: +3.2 / −1.0. */
export function formatDelta(value: number, lang: Lang = 'en', digits = 1): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±'
  return `${sign}${formatNumber(Math.abs(value), lang, digits)}`
}

/** 238.4 -> "238 ms". */
export function formatMs(value: number): string {
  return `${Math.round(value)} ms`
}
