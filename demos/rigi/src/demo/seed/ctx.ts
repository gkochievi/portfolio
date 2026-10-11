/**
 * Seed build context: the clock the seed is generated against, a deterministic
 * PRNG and timestamp helpers. Everything is relative to `now`, so the data
 * never looks stale (the store regenerates it on load and on every reset).
 */
import { createRandom, type Random } from '@portfolio/demo-kit'

import { addMonths, isoDate, type Period } from '@/demo/domain/dates'
import type { DemoData, ISODate, ISODateTime } from '@/types'

export interface SeedCtx {
  now: Date
  rng: Random
  data: DemoData
  /** now - days (fractional), clamped to the past. */
  ago(days: number): ISODateTime
  /** Local day `dayOffset` from today at hh:mm, clamped to the past. */
  at(dayOffset: number, hour?: number, minute?: number): ISODateTime
  /** Local calendar day `dayOffset` from today. */
  day(dayOffset: number): ISODate
  /** P(n): 0 = current month, -1 = last month... */
  period(n: number): Period
  /** A working-hours moment `frac` (0-1) of the way through the elapsed part of P(n). */
  inPeriod(n: number, frac: number): ISODateTime
  /** Never later than a few minutes before now. */
  clamp(value: ISODateTime | Date | number): ISODateTime
  hex(length: number): string
  /** Uppercase letters + digits (keys, refs). */
  code(length: number): string
}

const DAY = 86_400_000

export function createSeedCtx(now: Date, data: DemoData): SeedCtx {
  const rng = createRandom('rigi')
  const latest = now.getTime() - 3 * 60_000
  const clamp = (value: ISODateTime | Date | number): ISODateTime => {
    const t = typeof value === 'number' ? value : new Date(value).getTime()
    return new Date(Math.min(t, latest)).toISOString()
  }
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 }
  return {
    now,
    rng,
    data,
    ago: (days) => clamp(now.getTime() - days * DAY),
    at: (dayOffset, hour = 10, minute = 0) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute)
      return clamp(d)
    },
    day: (dayOffset) => isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)),
    period: (n) => addMonths(current.year, current.month, n),
    inPeriod: (n, frac) => {
      const p = addMonths(current.year, current.month, n)
      const start = new Date(p.year, p.month - 1, 1, 9, 0).getTime()
      const end = Math.min(new Date(p.year, p.month, 0, 18, 0).getTime(), now.getTime() - 2 * 3_600_000)
      const t = new Date(start + Math.max(0, Math.min(1, frac)) * Math.max(0, end - start))
      t.setHours(9 + rng.int(0, 8), rng.int(0, 59), rng.int(0, 59))
      return clamp(Math.max(start, Math.min(t.getTime(), end)))
    },
    clamp,
    hex: (length) => Array.from({ length }, () => '0123456789abcdef'[rng.int(0, 15)]).join(''),
    code: (length) => Array.from({ length }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[rng.int(0, 31)]).join(''),
  }
}

/** ISO timestamp + hours. */
export function plusHours(iso: ISODateTime, hours: number): ISODateTime {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

/** Evenly spaced timestamps from `start` to `end` (inclusive), `count` of them. */
export function spread(start: ISODateTime, end: ISODateTime, count: number): ISODateTime[] {
  const a = new Date(start).getTime()
  const b = Math.max(a, new Date(end).getTime())
  if (count <= 1) return [new Date(a).toISOString()]
  return Array.from({ length: count }, (_, i) => new Date(a + ((b - a) * i) / (count - 1)).toISOString())
}

export function maxIso(...values: ISODateTime[]): ISODateTime {
  return values.reduce((a, b) => (a > b ? a : b))
}

export function minIso(...values: ISODateTime[]): ISODateTime {
  return values.reduce((a, b) => (a < b ? a : b))
}
