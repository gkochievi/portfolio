import { formatPeriod } from '@/lib/format'

/** "September 2026" for a month, the bare year when no month is chosen. */
export function formatMonthYear(year: number, month: number | null): string {
  return month === null ? String(year) : formatPeriod(year, month)
}
