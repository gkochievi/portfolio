/**
 * Calendar helpers. Owner: seed. Calendar days are local `YYYY-MM-DD`
 * strings; periods are `{year, month}` with month 1-12.
 */
import type { ISODate, ISODateTime } from '@/types'

export interface Period {
  year: number
  /** 1-12 */
  month: number
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Local midnight of a `YYYY-MM-DD` day. */
export function parseIsoDate(day: ISODate): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDate(value: Date | string): Date {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIsoDate(value)
  return new Date(value)
}

/** Local calendar day of a Date / ISO timestamp. */
export function isoDate(value: Date | string): ISODate {
  const d = toDate(value)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function periodOf(value: Date | string): Period {
  const d = toDate(value)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function addMonths(year: number, month: number, n: number): Period {
  const index = year * 12 + (month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function firstDayOfPeriod(year: number, month: number): ISODate {
  return `${year}-${pad(month)}-01`
}

export function lastDayOfPeriod(year: number, month: number): ISODate {
  return `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`
}

/** `2026-09` */
export function periodKey(year: number, month: number): string {
  return `${year}-${pad(month)}`
}

/** Negative when a is before b, in months. */
export function comparePeriod(a: Period, b: Period): number {
  return (a.year - b.year) * 12 + (a.month - b.month)
}

export function inPeriod(value: Date | string, year: number, month: number): boolean {
  const p = periodOf(value)
  return p.year === year && p.month === month
}

export function addDays(day: ISODate, n: number): ISODate {
  const d = parseIsoDate(day)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Whole days from b to a (a - b). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseIsoDate(a).getTime() - parseIsoDate(b).getTime()) / 86_400_000)
}

/** 23:59:59 local on that day, as an ISO timestamp (portal deadlines). */
export function endOfDayIso(day: ISODate): ISODateTime {
  const d = parseIsoDate(day)
  d.setHours(23, 59, 59, 0)
  return d.toISOString()
}

/** Timestamp + n days (fractional allowed). */
export function addDaysIso(value: Date | string, n: number): ISODateTime {
  return new Date(toDate(value).getTime() + n * 86_400_000).toISOString()
}
