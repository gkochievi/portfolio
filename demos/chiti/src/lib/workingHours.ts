/**
 * Working-hours status (pure), computed in the tenant's timezone
 * (Asia/Tbilisi). Honours the temporary closure and the demo override.
 */
import type { DaySchedule, WorkingHours, WorkingHoursStatus } from '@/types'

const DAY = 86_400_000
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

interface LocalParts {
  year: number
  month: number
  day: number
  weekday: number
  minutes: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function localParts(date: Date, timeZone: string): LocalParts {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    })
    formatters.set(timeZone, format)
  }
  const parts: Record<string, string> = {}
  for (const part of format.formatToParts(date)) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY[parts.weekday ?? 'Sun'] ?? 0,
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
  }
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/** UTC instant of local `minutes` past midnight on the local date in `parts`. */
function instantOf(parts: LocalParts, minutes: number, timeZone: string): number {
  const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12)
  const noonLocal = localParts(new Date(noonUtc), timeZone)
  const offset = (noonLocal.minutes - 12 * 60) * 60_000 + (noonLocal.day !== parts.day ? Math.sign(noonLocal.day - parts.day) * DAY : 0)
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0, minutes) - offset
}

function scheduleFor(hours: WorkingHours, weekday: number): DaySchedule | undefined {
  return hours.weeklySchedule.find((entry) => entry.day === weekday)
}

/** Next opening at or after `fromMs` per the weekly schedule (null when no day is enabled). */
export function nextOpening(hours: WorkingHours, fromMs: number): string | null {
  const timeZone = hours.timezone || 'Asia/Tbilisi'
  for (let offset = 0; offset <= 7; offset += 1) {
    const parts = localParts(new Date(fromMs + offset * DAY), timeZone)
    const entry = scheduleFor(hours, parts.weekday)
    if (!entry?.enabled) continue
    const start = toMinutes(entry.start)
    if (offset === 0 && parts.minutes >= start) continue
    return new Date(instantOf(parts, start, timeZone)).toISOString()
  }
  return null
}

export function computeStatus(hours: WorkingHours, now: Date = new Date()): WorkingHoursStatus {
  const timeZone = hours.timezone || 'Asia/Tbilisi'
  const today = localParts(now, timeZone)
  const entry = scheduleFor(hours, today.weekday)
  const todayStart = entry?.enabled ? entry.start : null
  const todayEnd = entry?.enabled ? entry.end : null
  const nowMs = now.getTime()

  if (hours.demoOverride === 'open') return { isOpen: true, reason: 'demo_override', nextOpen: null, todayStart, todayEnd }
  if (hours.demoOverride === 'closed') return { isOpen: false, reason: 'demo_override', nextOpen: nextOpening(hours, nowMs), todayStart, todayEnd }

  if (hours.isTemporarilyClosed) {
    const from = hours.temporaryClosedFrom ? Date.parse(hours.temporaryClosedFrom) : -Infinity
    const until = hours.temporaryClosedUntil ? Date.parse(hours.temporaryClosedUntil) : Infinity
    if (nowMs >= from && nowMs < until) {
      const nextOpen = Number.isFinite(until) ? nextOpening(hours, until - 1) : null
      return { isOpen: false, reason: 'temporary_closure', nextOpen, todayStart, todayEnd }
    }
  }

  const open = !!entry?.enabled && today.minutes >= toMinutes(entry.start) && today.minutes < toMinutes(entry.end)
  return { isOpen: open, reason: 'schedule', nextOpen: open ? null : nextOpening(hours, nowMs), todayStart, todayEnd }
}
