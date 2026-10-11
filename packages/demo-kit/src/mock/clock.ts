/**
 * Time helpers: a polite interval for simulated live activity, and the date
 * rebasing that keeps seeded data from going stale.
 */

const DAY = 86_400_000

/**
 * Call `fn` every `ms` milliseconds while the page is visible.
 *
 * A background tab (or an iframe scrolled out of a hidden page) pauses the
 * interval instead of queueing up a burst of simulated orders for the moment
 * the visitor comes back. Returns the stop function.
 */
export function every(ms: number, fn: () => void): () => void {
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  const hasDocument = typeof document !== 'undefined'

  const start = () => {
    if (timer === undefined && !stopped) timer = setInterval(fn, ms)
  }
  const pause = () => {
    if (timer === undefined) return
    clearInterval(timer)
    timer = undefined
  }
  const onVisibility = () => (document.hidden ? pause() : start())

  if (hasDocument) document.addEventListener('visibilitychange', onVisibility)
  if (!hasDocument || !document.hidden) start()

  return () => {
    stopped = true
    pause()
    if (hasDocument) document.removeEventListener('visibilitychange', onVisibility)
  }
}

/** Options for `rebaseDates()`. */
export interface RebaseOptions {
  /** The instant the seed was authored as "now", as an ISO string. */
  anchor: string
  /** The instant to shift onto. Default: the current time. */
  now?: Date | undefined
  /** Which keys hold timestamps. Default `/(At|Date|_at|date|time|Time)$/`. */
  keys?: RegExp | undefined
  /**
   * Round the shift to whole days so every timestamp keeps its time of day —
   * the seed's 09:00 stand-up stays at 09:00. Default false (exact shift).
   */
  wholeDays?: boolean | undefined
}

/** `YYYY-MM-DD`, optionally `THH:mm[:ss[.fff]]`, optionally `Z` or `±HH:mm`. */
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

const DEFAULT_KEYS = /(At|Date|_at|date|time|Time)$/

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

/**
 * Shift one ISO string by `delta` ms, keeping its shape: a date-only value
 * stays date-only (moved by whole days), a zoned timestamp comes back as UTC
 * `…Z` (the same instant re-expressed), and a floating local timestamp stays
 * floating. Anything that is not ISO comes back untouched.
 */
function shiftIso(value: string, delta: number): string {
  const match = ISO.exec(value)
  if (!match) return value
  const [, y, mo, d, h, mi, s, fraction, zone] = match
  const year = Number(y)
  const month = Number(mo) - 1
  const day = Number(d)

  if (h === undefined) {
    const at = new Date(Date.UTC(year, month, day + Math.round(delta / DAY)))
    if (!Number.isFinite(at.getTime())) return value
    return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`
  }

  if (zone !== undefined) {
    const parsed = Date.parse(value.replace(' ', 'T'))
    return Number.isFinite(parsed) ? new Date(parsed + delta).toISOString() : value
  }

  const ms = fraction ? Math.round(Number(`0${fraction}`) * 1000) : 0
  const local = new Date(year, month, day, Number(h), Number(mi), Number(s ?? 0), ms)
  const at = new Date(local.getTime() + delta)
  if (!Number.isFinite(at.getTime())) return value
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
  return `${date}T${time}${fraction ? `.${pad(at.getMilliseconds(), 3)}` : ''}`
}

/**
 * Shift every ISO timestamp in seed data by `now - anchor`, so seeded data
 * never looks stale: "3 hours ago" stays three hours ago on whatever day the
 * demo is opened.
 *
 * Deep-walks plain objects and arrays. A field is shifted when its key
 * matches `keys` and its value is an ISO string, a `Date`, or an array of
 * either; non-ISO strings under a matching key (`'tomorrow'`, `'—'`) are
 * skipped. Mutates in place and returns `value` — pass a copy if the original
 * must stay pristine (`createStore`'s `prepare` already hands you one).
 */
export function rebaseDates<T>(value: T, options: RebaseOptions): T {
  const anchor = Date.parse(options.anchor)
  if (!Number.isFinite(anchor)) throw new RangeError(`rebaseDates: anchor "${options.anchor}" is not an ISO date`)

  const exact = (options.now ?? new Date()).getTime() - anchor
  const delta = options.wholeDays ? Math.round(exact / DAY) * DAY : exact
  if (delta === 0) return value

  const keys = options.keys ?? DEFAULT_KEYS
  const isTimestampKey = (key: string) => {
    keys.lastIndex = 0 // a /g or /y pattern would otherwise remember its last match
    return keys.test(key)
  }
  const shift = (field: unknown): unknown => {
    if (typeof field === 'string') return shiftIso(field, delta)
    if (field instanceof Date) return new Date(field.getTime() + delta)
    return field
  }

  const seen = new WeakSet<object>()
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (Object.getPrototypeOf(node) !== Object.prototype && Object.getPrototypeOf(node) !== null) return

    const record = node as Record<string, unknown>
    for (const [key, field] of Object.entries(record)) {
      if (isTimestampKey(key)) {
        if (Array.isArray(field)) {
          for (let index = 0; index < field.length; index += 1) field[index] = shift(field[index])
          continue
        }
        if (typeof field === 'string' || field instanceof Date) {
          record[key] = shift(field)
          continue
        }
      }
      walk(field)
    }
  }

  walk(value)
  return value
}
