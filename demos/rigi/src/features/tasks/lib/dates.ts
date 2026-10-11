import { format } from 'date-fns'

/** `YYYY-MM-DD` from a date input -> end of that local day as an ISO instant. */
export function deadlineFromDay(day: string): string {
  return new Date(`${day}T23:59:59`).toISOString()
}

/** ISO instant -> `YYYY-MM-DD` for a date input ('' when none). */
export function dayInputOf(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), 'yyyy-MM-dd') : ''
}
