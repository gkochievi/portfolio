/** `<input type="datetime-local">` speaks local wall-clock time; the API speaks ISO (UTC). */
import { addHours, format, startOfHour } from 'date-fns'

export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm")
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Default window for a new event: from the next full hour, for eight hours. */
export function defaultWindow(now: Date = new Date()): { startsAt: string; endsAt: string } {
  const start = addHours(startOfHour(now), 1)
  return { startsAt: format(start, "yyyy-MM-dd'T'HH:mm"), endsAt: format(addHours(start, 8), "yyyy-MM-dd'T'HH:mm") }
}
