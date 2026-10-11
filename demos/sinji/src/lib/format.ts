/**
 * Locale-aware formatting (Intl, per UI language). Pass `lang` from
 * `useTranslation().i18n.language`, or call `useFormat()` inside components.
 */
import { useTranslation } from 'react-i18next'

export type FormatLang = 'en' | 'ka' | string

const tag = (lang?: FormatLang) => (lang === 'ka' ? 'ka-GE' : 'en-GB')

/** 754 -> "12:34"; 3754 -> "1:02:34". */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** 754 -> "12 min 34 s" / "12 წთ 34 წმ". */
export function formatDuration(seconds: number | null | undefined, lang?: FormatLang): string {
  if (seconds == null || !Number.isFinite(seconds)) return '-'
  const s = Math.max(0, Math.round(seconds))
  const ka = lang === 'ka'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts: string[] = []
  if (h) parts.push(`${h} ${ka ? 'სთ' : 'h'}`)
  if (m) parts.push(`${m} ${ka ? 'წთ' : 'min'}`)
  if (sec || parts.length === 0) parts.push(`${sec} ${ka ? 'წმ' : 's'}`)
  return parts.join(' ')
}

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value))

export function formatDate(value: string | number | Date | null | undefined, lang?: FormatLang): string {
  if (value == null) return '-'
  return new Intl.DateTimeFormat(tag(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(toDate(value))
}

export function formatDateTime(value: string | number | Date | null | undefined, lang?: FormatLang): string {
  if (value == null) return '-'
  return new Intl.DateTimeFormat(tag(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(value))
}

export function formatTime(value: string | number | Date | null | undefined, lang?: FormatLang): string {
  if (value == null) return '-'
  return new Intl.DateTimeFormat(tag(lang), { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(toDate(value))
}

/** "3 minutes ago" / "3 წუთის წინ". */
export function formatRelative(value: string | number | Date | null | undefined, lang?: FormatLang, now = Date.now()): string {
  if (value == null) return '-'
  const diff = (toDate(value).getTime() - now) / 1000
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(tag(lang), { numeric: 'auto' })
  if (abs < 45) return rtf.format(Math.round(diff), 'second')
  if (abs < 2700) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 79200) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 26) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 320) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

export function formatNumber(value: number | null | undefined, lang?: FormatLang, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat(tag(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value)
}

/** 12840 -> "12.8K"; small values stay exact. */
export function formatTokens(value: number | null | undefined, lang?: FormatLang): string {
  if (value == null || !Number.isFinite(value)) return '-'
  if (Math.abs(value) < 10_000) return formatNumber(value, lang)
  return new Intl.NumberFormat(tag(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatBytes(bytes: number | null | undefined, lang?: FormatLang): string {
  if (bytes == null || !Number.isFinite(bytes)) return '-'
  const units = lang === 'ka' ? ['ბ', 'კბ', 'მბ', 'გბ'] : ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (Math.abs(v) >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${formatNumber(v, lang, i === 0 ? 0 : 1)} ${units[i]}`
}

/** `formatPercent(0.873)` -> "87%"; pass `{ ratio: false }` for values already 0-100. */
export function formatPercent(value: number | null | undefined, lang?: FormatLang, opts: { ratio?: boolean; digits?: number } = {}): string {
  if (value == null || !Number.isFinite(value)) return '-'
  const ratio = opts.ratio ?? true
  return new Intl.NumberFormat(tag(lang), { style: 'percent', maximumFractionDigits: opts.digits ?? 0 }).format(ratio ? value : value / 100)
}

export function formatMoney(value: number | null | undefined, lang?: FormatLang, currency = 'USD'): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat(tag(lang), { style: 'currency', currency, maximumFractionDigits: value < 1 ? 4 : 2 }).format(value)
}

/** All formatters bound to the current UI language. */
export function useFormat() {
  const { i18n } = useTranslation()
  const lang = i18n.language
  return {
    lang,
    clock: formatClock,
    duration: (v: number | null | undefined) => formatDuration(v, lang),
    date: (v: string | number | Date | null | undefined) => formatDate(v, lang),
    dateTime: (v: string | number | Date | null | undefined) => formatDateTime(v, lang),
    time: (v: string | number | Date | null | undefined) => formatTime(v, lang),
    relative: (v: string | number | Date | null | undefined) => formatRelative(v, lang),
    number: (v: number | null | undefined, digits?: number) => formatNumber(v, lang, digits),
    tokens: (v: number | null | undefined) => formatTokens(v, lang),
    bytes: (v: number | null | undefined) => formatBytes(v, lang),
    percent: (v: number | null | undefined, opts?: { ratio?: boolean; digits?: number }) => formatPercent(v, lang, opts),
    money: (v: number | null | undefined, currency?: string) => formatMoney(v, lang, currency),
  }
}
