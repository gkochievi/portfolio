/**
 * The demo clock. The seed is authored as of SEED_ANCHOR and rebased to "now"
 * on every store reset; product "minutes" for timers run at DEMO_MINUTE_MS.
 */

/** Monday 2026-10-05 15:00 Asia/Tbilisi. */
export const SEED_ANCHOR = '2026-10-05T11:00:00Z'

/** One product minute in demo time (warn 5 min → 45 s, close 10 min → 90 s). */
export const DEMO_MINUTE_MS = 9_000

export const TIMEZONE = 'Asia/Tbilisi'

/**
 * Keys `rebaseDates` shifts. Covers every ISO field in `ChitiDb`:
 * `…At`, `timestamp`, `lastActivity`, `lastSeen`, `inactiveSince`, `…From`,
 * `…Until`, `until`, `at`, `from`, `to` (audit-log date ranges; non-ISO values such
 * as `{ from: 'Salome', to: 'Salo' }` are left alone), `date` and `nextOpen`.
 */
export const TIMESTAMP_KEYS = /(At|Date|date|stamp|Since|From|Until|^until|^at|^from|^to|^lastActivity|^lastSeen|^nextOpen)$/

export function nowIso(): string {
  return new Date().toISOString()
}

/** Milliseconds for `n` product minutes in demo time. */
export function demoMinutes(n: number): number {
  return n * DEMO_MINUTE_MS
}

/** ISO string `ms` milliseconds from now (negative = in the past). */
export function isoFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}
