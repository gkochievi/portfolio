/**
 * Formatting. Dates DD.MM.YYYY, times HH:mm (both
 * languages), durations m:ss, phones in the synthetic +995 500 0X XX XX block,
 * money in lari (₾). Every function tolerates null/undefined and returns '—'.
 */
import { formatDistanceToNowStrict } from 'date-fns'
import { enGB, ka } from 'date-fns/locale'

import type { Lang } from '@/types'

const DASH = '—'

type DateLike = string | number | Date | null | undefined

function toDate(value: DateLike): Date | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 08.10.2026 */
export function formatDate(value: DateLike): string {
  const d = toDate(value)
  if (!d) return DASH
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** 14:05 (or 14:05:09 with seconds) */
export function formatTime(value: DateLike, withSeconds = false): string {
  const d = toDate(value)
  if (!d) return DASH
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
}

/** 08.10.2026 14:05 */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value)
  if (!d) return DASH
  return `${formatDate(d)} ${formatTime(d)}`
}

/** Seconds -> 0:42, 12:05, 1:02:09. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return DASH
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Seconds elapsed since an ISO timestamp (for live timers; call every second). */
export function secondsSince(value: DateLike, now: number = Date.now()): number {
  const d = toDate(value)
  return d ? Math.max(0, Math.floor((now - d.getTime()) / 1000)) : 0
}

function digits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** +995500012345 -> +995 500 01 23 45. Other shapes are returned as-is. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return DASH
  const d = digits(phone)
  if (d.startsWith('995') && d.length === 12) {
    const n = d.slice(3)
    return `+995 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`
  }
  return phone
}

/** +995500012345 -> +995 5•• ••• 345 (shown before a call connects). */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return DASH
  const d = digits(phone)
  if (d.length < 6) return '•••'
  const last = d.slice(-3)
  if (d.startsWith('995')) return `+995 ${d[3]}•• ••• ${last}`
  return `${'•'.repeat(Math.max(3, d.length - 3))} ${last}`
}

/** Percent given 0-100 -> "42%" (digits = decimals). */
export function formatPercent(value: number | null | undefined, digitsAfter = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return `${value.toFixed(digitsAfter)}%`
}

/** 12345 -> "12 345" (thin grouping that reads the same in both languages). */
export function formatNumber(value: number | null | undefined, digitsAfter = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH
  const fixed = value.toFixed(digitsAfter)
  const [int = '0', frac] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return frac ? `${grouped}.${frac}` : grouped
}

/** Lari: 1250 -> "1 250 ₾". */
export function formatMoney(value: number | null | undefined, digitsAfter = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH
  return `${formatNumber(value, digitsAfter)} ₾`
}

/** "3 minutes ago" / "3 წუთის წინ". */
export function formatRelative(value: DateLike, lang: Lang = 'en'): string {
  const d = toDate(value)
  if (!d) return DASH
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: lang === 'ka' ? ka : enGB })
}

/** True when the timestamp falls on today's local date. */
export function isToday(value: DateLike): boolean {
  const d = toDate(value)
  if (!d) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

/** ISO -> value for <input type="date"> (local). */
export function toDateInput(value: DateLike): string {
  const d = toDate(value)
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : ''
}

/** ISO -> value for <input type="datetime-local"> (local). */
export function toDateTimeInput(value: DateLike): string {
  const d = toDate(value)
  return d ? `${toDateInput(d)}T${formatTime(d)}` : ''
}

/** Initials for avatars: "Mariam Gelashvili" -> "MG". */
export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}
