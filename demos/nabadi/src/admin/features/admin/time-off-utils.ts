import type { AdminTimeOff } from './crud-hooks';

/**
 * Shared time-off helpers — used by the global /time-off page and the
 * barber-detail "Time off" tab (extracted rather than duplicated).
 */

export type TimeOffKind = 'day_off' | 'vacation' | 'custom';

/** Local wall-clock date+time → ISO instant, matching the add-form semantics. */
export function localISO(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

export function detectKind(t: Pick<AdminTimeOff, 'start_datetime' | 'end_datetime'>): TimeOffKind {
  const s = new Date(t.start_datetime);
  const e = new Date(t.end_datetime);
  if (s.toDateString() !== e.toDateString()) return 'vacation';
  const isFullDay = s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() >= 23;
  return isFullDay ? 'day_off' : 'custom';
}
