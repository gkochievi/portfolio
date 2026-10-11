/**
 * Formatting helpers. Owner: design-system.
 * Every function reads the current i18n language. Dates are DD.MM.YYYY in both
 * languages; numbers use tabular figures in the UI (`num` class / font-mono).
 */
import { format as dfFormat, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { enGB, ka } from 'date-fns/locale'

import i18n from '@/i18n'
import type { Currency } from '@/types'

type Lng = 'en' | 'ka'

export function currentLang(): Lng {
  return i18n.language === 'ka' ? 'ka' : 'en'
}

function numberLocale(): string {
  return currentLang() === 'ka' ? 'ka-GE' : 'en-US'
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : parseISO(value)
  return isValid(date) ? date : null
}

export const CURRENCY_SYMBOL: Record<Currency, string> = { GEL: '₾', USD: '$', EUR: '€' }

/** `formatNumber(1234.5)` -> "1,234.5" (en) / "1 234,5" (ka). */
export function formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 2, ...options }).format(value)
}

/** `formatMoney(1234.5, 'GEL')` -> "₾1,234.50" (en) / "1 234,50 ₾" (ka). */
export function formatMoney(amount: number | null | undefined, currency: Currency | string = 'GEL'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  const symbol = CURRENCY_SYMBOL[currency as Currency] ?? currency
  const abs = formatNumber(Math.abs(amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = amount < 0 ? '−' : ''
  return currentLang() === 'ka' ? `${sign}${abs} ${symbol}` : `${sign}${symbol}${abs}`
}

/** `formatPoints(12.5)` -> "12.5 pts" / "12,5 ქულა". `{ unit: false }` -> "12.5". */
export function formatPoints(value: number | null | undefined, options: { unit?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const n = formatNumber(value, { maximumFractionDigits: 2 })
  if (options.unit === false) return n
  return `${n} ${i18n.t('common:units.points')}`
}

/** `formatPercent(0.183)` -> "18.3%". */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—'
  return new Intl.NumberFormat(numberLocale(), { style: 'percent', maximumFractionDigits: digits }).format(ratio)
}

/** DD.MM.YYYY */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dfFormat(date, 'dd.MM.yyyy') : '—'
}

/** DD.MM.YYYY HH:mm */
export function formatDateTime(value: string | number | Date | null | undefined, withSeconds = false): string {
  const date = toDate(value)
  return date ? dfFormat(date, withSeconds ? 'dd.MM.yyyy HH:mm:ss' : 'dd.MM.yyyy HH:mm') : '—'
}

/** HH:mm */
export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dfFormat(date, 'HH:mm') : '—'
}

const MONTHS: Record<Lng, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
}

/** Month name for month 1-12. */
export function monthName(month: number, short = false): string {
  const name = MONTHS[currentLang()][(month - 1 + 12) % 12] ?? String(month)
  return short ? name.slice(0, 3) : name
}

/** `formatPeriod(2026, 9)` -> "September 2026" / "სექტემბერი 2026". Month is 1-12. */
export function formatPeriod(year: number, month: number, short = false): string {
  return `${monthName(month, short)} ${year}`
}

/** "3 minutes ago" / "3 წუთის წინ". */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: currentLang() === 'ka' ? ka : enGB })
}

/** `formatBytes(2048)` -> "2 KB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${formatNumber(value, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

/** `formatTaskNumber(1187)` -> "TCK-1187". */
export function formatTaskNumber(n: number | string): string {
  return `TCK-${n}`
}

/** `formatProjectNumber(12)` -> "PRJ-12". */
export function formatProjectNumber(n: number | string): string {
  return `PRJ-${n}`
}

/** Two-digit row index: 1 -> "01". */
export function formatIndex(n: number): string {
  return String(n).padStart(2, '0')
}

/** A staff or account display name in the current language. */
export function localName(person: { name?: string; fullName?: string; nameKa?: string | null; fullNameKa?: string | null }): string {
  const latin = person.fullName ?? person.name ?? ''
  if (currentLang() !== 'ka') return latin
  return person.fullNameKa ?? person.nameKa ?? latin
}
