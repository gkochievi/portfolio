/**
 * Pure formatting helpers shared by every surface (owner: design-system).
 * All take ISO strings from the mock API; none read the clock except via arguments.
 */
import { format, isToday, isYesterday } from 'date-fns'
import { enGB, ka } from 'date-fns/locale'

import type { LocalizedText, PersonName } from '@/types'

type AnyLang = string | undefined | null

const isKa = (lang: AnyLang) => (lang ?? '').startsWith('ka')
const dfLocale = (lang: AnyLang) => (isKa(lang) ? ka : enGB)

/** Pick the string for `lang`; falls back to en, then ka, then ru. */
export function pickText(text: LocalizedText | null | undefined, lang: AnyLang): string {
  if (!text) return ''
  const key = (lang ?? 'en').slice(0, 2) as keyof LocalizedText
  return text[key] || text.en || text.ka || text.ru || ''
}

/** Staff name in the UI language. */
export function personName(name: PersonName | null | undefined, lang: AnyLang): string {
  if (!name) return ''
  return isKa(lang) ? name.ka || name.en : name.en || name.ka
}

const toDate = (iso: string | number | Date) => (iso instanceof Date ? iso : new Date(iso))

/** 14:05 */
export function formatTime(iso: string | number | Date): string {
  return format(toDate(iso), 'HH:mm')
}

/** 5 Oct 2026 */
export function formatDate(iso: string | number | Date, lang?: AnyLang): string {
  return format(toDate(iso), 'd MMM yyyy', { locale: dfLocale(lang) })
}

/** 5 Oct 2026, 14:05 */
export function formatDateTime(iso: string | number | Date, lang?: AnyLang): string {
  return format(toDate(iso), 'd MMM yyyy, HH:mm', { locale: dfLocale(lang) })
}

/** "14:05", "Yesterday 14:05" / "გუშინ 14:05", or "5 Oct, 14:05" - for chat lists and day dividers. */
export function formatSmartDate(iso: string | number | Date, lang?: AnyLang): string {
  const d = toDate(iso)
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return `${isKa(lang) ? 'გუშინ' : 'Yesterday'} ${format(d, 'HH:mm')}`
  return format(d, 'd MMM, HH:mm', { locale: dfLocale(lang) })
}

/** Day divider label: "Today", "Yesterday", "Monday 5 October". */
export function formatDay(iso: string | number | Date, lang?: AnyLang): string {
  const d = toDate(iso)
  if (isToday(d)) return isKa(lang) ? 'დღეს' : 'Today'
  if (isYesterday(d)) return isKa(lang) ? 'გუშინ' : 'Yesterday'
  return format(d, 'EEEE d MMMM', { locale: dfLocale(lang) })
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago" in the UI language. */
export function formatRelative(iso: string | number | Date, lang?: AnyLang, nowMs: number = Date.now()): string {
  const diffSec = Math.round((toDate(iso).getTime() - nowMs) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 45) return isKa(lang) ? 'ახლახან' : 'just now'
  const rtf = new Intl.RelativeTimeFormat(isKa(lang) ? 'ka' : 'en', { numeric: 'auto', style: 'short' })
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  return formatDate(iso, lang)
}

/** 35s, 4m 12s, 1h 05m, 2d 3h */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '-'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export type WaitTier = 'fresh' | 'amber' | 'late'

/** Waiting-time chip: "0:42", "3:10", "12m", "2h 05m"; tier < 2 min fresh, 2-5 amber, > 5 late. */
export function formatWait(sinceIso: string | number | Date, nowMs: number): { label: string; tier: WaitTier; seconds: number } {
  const seconds = Math.max(0, Math.floor((nowMs - toDate(sinceIso).getTime()) / 1000))
  const tier: WaitTier = seconds < 120 ? 'fresh' : seconds <= 300 ? 'amber' : 'late'
  let label: string
  if (seconds < 600) label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  else if (seconds < 3600) label = `${Math.floor(seconds / 60)}m`
  else label = formatDuration(seconds).replace(/ \d+s$/, '')
  return { label, tier, seconds }
}

/** 1,234 / 1 234 */
export function formatNumber(n: number, lang?: AnyLang, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(isKa(lang) ? 'ka-GE' : 'en-GB', options).format(n)
}

/** 0.873 -> "87%" (pass a ratio). */
export function formatPercent(ratio: number, lang?: AnyLang, digits = 0): string {
  return formatNumber(ratio, lang, { style: 'percent', maximumFractionDigits: digits })
}

/** Up to two initials, letters only ("Luka Beridze" -> "LB", "ლუკა ბერიძე" -> "ლბ"). */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = Array.from(parts[0] ?? '')[0] ?? ''
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1] ?? '')[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** Stable 0-359 hue for a string (avatars, tags). */
export function hueFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % 360
}

/** Mask a secret for display: "sk-chiti-••••••••4f2a". */
export function maskSecret(value: string, visible = 4): string {
  if (value.length <= visible) return '•'.repeat(value.length)
  return `${value.slice(0, Math.min(8, value.length - visible))}${'•'.repeat(8)}${value.slice(-visible)}`
}
