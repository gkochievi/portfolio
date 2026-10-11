/**
 * Owner: data agent. Seed time helpers.
 *
 * The seed is authored as of SEED_ANCHOR. The store rebases every `...At`
 * timestamp by (load time - anchor), so "two hours ago" stays two hours ago on
 * whatever day the demo is opened. Fair hours are written in UTC; Tbilisi is
 * UTC+4, so 07:00Z-16:00Z is the 11:00-20:00 hall day.
 */

export const SEED_ANCHOR = '2026-10-01T10:00:00.000Z'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const ANCHOR_MS = Date.parse(SEED_ANCHOR)
/** Midnight UTC of the anchor day. */
const ANCHOR_DAY_MS = Date.parse('2026-10-01T00:00:00.000Z')

export const iso = (ms: number): string => new Date(ms).toISOString()

/** `hours` after (positive) or before (negative) the anchor. */
export const fromAnchor = (hours: number): string => iso(ANCHOR_MS + hours * HOUR)

/** UTC wall-clock time `day` days from the anchor day (0 = anchor day, -1 = yesterday). */
export const onDay = (day: number, hourUtc: number, minute = 0): string =>
  iso(ANCHOR_DAY_MS + day * DAY + hourUtc * HOUR + minute * MINUTE)

/** Same, as epoch milliseconds. */
export const onDayMs = (day: number, hourUtc: number, minute = 0): number =>
  ANCHOR_DAY_MS + day * DAY + hourUtc * HOUR + minute * MINUTE
