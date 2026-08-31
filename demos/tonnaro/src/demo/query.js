/**
 * Filtering, searching, ordering and pagination — a port of the three DRF
 * filter backends this project turns on globally (`DjangoFilterBackend`,
 * `SearchFilter`, `OrderingFilter`) plus `PageNumberPagination`.
 *
 * Django reaches into the ORM by field path; here each helper takes accessors
 * instead, so `assigned_driver__last_name` becomes
 * `(row) => driverById(row.assigned_driver)?.last_name` at the call site.
 *
 * Three of the Python behaviours are load-bearing and easy to lose in
 * translation:
 *   · `SearchFilter` splits the term on whitespace and requires *every* word
 *     to match, each one ORed across the search fields — so "tbilisi crane"
 *     finds a row only if both words appear somewhere in it.
 *   · `OrderingFilter` silently ignores a field that is not whitelisted and
 *     falls back to the view's default, rather than erroring.
 *   · An unparseable date means "no filter" rather than "no results", so a
 *     malformed query string cannot turn a list into an empty screen.
 */
import { DemoApiError } from './router'

/* ------------------------------------------------------------------ search */

/**
 * DRF quotes-aware term splitting: `foo "bar baz"` is two terms, not three.
 */
function searchTerms(raw) {
  const terms = []
  const pattern = /"([^"]*)"|(\S+)/g
  let match = pattern.exec(raw)
  while (match) {
    const term = (match[1] ?? match[2] ?? '').trim()
    if (term) terms.push(term.toLowerCase())
    match = pattern.exec(raw)
  }
  return terms
}

/**
 * `?search=` across the view's `search_fields`, `icontains` semantics.
 * `fields` are accessors; one may return an array (an m2m or a multilingual
 * `{en, ka, ru}` flattened by the caller) and every element is searched.
 */
export function applySearch(rows, params, fields) {
  const terms = searchTerms((params.search ?? '').trim())
  if (!terms.length) return rows

  return rows.filter((row) => {
    const haystack = fields
      .flatMap((read) => {
        const value = read(row)
        return Array.isArray(value) ? value : [value]
      })
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value).toLowerCase())

    // Every term must land somewhere; a term may land in any field.
    return terms.every((term) => haystack.some((text) => text.includes(term)))
  })
}

/* ----------------------------------------------------------------- filters */

function holds(value, wanted) {
  if (value === null || value === undefined) return false
  if (Array.isArray(value)) return value.some((item) => String(item) === wanted)
  return String(value) === wanted
}

/**
 * `filterset_fields` — exact match on a scalar or membership in an m2m.
 * `spec` maps a query-param name to an accessor. A param that is absent, or
 * whose accessor is not registered, is ignored exactly as django-filter
 * ignores an unknown key.
 *
 * Booleans arrive as the strings django-filter accepts (`true`/`false`), so
 * they are compared after normalising both sides.
 */
export function applyFilters(rows, params, spec) {
  let out = rows
  for (const [param, read] of Object.entries(spec)) {
    const raw = (params[param] ?? '').trim()
    if (!raw) continue

    const wanted = /^(true|false)$/i.test(raw) ? String(raw.toLowerCase() === 'true') : raw
    out = out.filter((row) => {
      const value = read(row)
      const normalised = typeof value === 'boolean' ? String(value) : value
      return holds(normalised, wanted)
    })
  }
  return out
}

/**
 * `?field=a&field=b` — django-filter's `ModelMultipleChoiceFilter`, which the
 * order list uses for status. Matches any of the supplied values.
 */
export function applyMultiFilter(rows, paramsAll, param, read) {
  const wanted = paramsAll[param]
  if (!wanted || !wanted.length) return rows
  return rows.filter((row) => wanted.some((value) => holds(read(row), value)))
}

/* ------------------------------------------------------------------- dates */

/**
 * `YYYY-MM-DD` if the value is a real calendar date, else null.
 *
 * Django's `parse_date()` throws on a well-formed but impossible date such as
 * 2026-02-31; the view swallows that, so a malformed query string cannot turn
 * a list request into a 500 or an empty page.
 */
function asDate(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim())
  if (!match) return null

  const [, year, month, day] = match
  const at = new Date(Number(year), Number(month) - 1, Number(day))
  const real = at.getMonth() === Number(month) - 1 && at.getDate() === Number(day)
  return real ? `${year}-${month}-${day}` : null
}

/** Inclusive on both ends, compared on the calendar date like `__date__`. */
export function applyDateRange(rows, params, read, { from = 'date_from', to = 'date_to' } = {}) {
  const start = asDate(params[from])
  const end = asDate(params[to])
  if (!start && !end) return rows

  return rows.filter((row) => {
    const value = read(row)
    if (!value) return false
    const key = dateKey(value)
    if (start && key < start) return false
    if (end && key > end) return false
    return true
  })
}

/**
 * `YYYY-MM-DD` in the zone Django ran in — see `demo/store.js`. Exported so
 * date bucketing in the analytics handler draws its day boundaries the same
 * way the filters do.
 */
export const TIME_ZONE = 'Asia/Tbilisi'

const DAY_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dateKey(value) {
  const at = value instanceof Date ? value : new Date(value)
  const parts = DAY_PARTS.formatToParts(at)
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? '00'
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function todayKey() {
  return dateKey(new Date())
}

/** Day arithmetic on the key itself, through UTC, so stepping a series never
 *  has to care what either zone is doing about daylight saving. */
export function shiftDayKey(key, days) {
  const [year, month, day] = key.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1, day))
  at.setUTCDate(at.getUTCDate() + days)
  const pad = (part) => String(part).padStart(2, '0')
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`
}

/* ---------------------------------------------------------------- ordering */

function compare(a, b) {
  if (a === b) return 0
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
  return String(a).localeCompare(String(b)) < 0 ? -1 : 1
}

/** Postgres puts NULLs last on ASC and first on DESC — and negating an
 *  ascending comparison would do the opposite, so nulls are settled before the
 *  direction is applied. */
function nullOrder(a, b, descending) {
  const aNull = a === null || a === undefined || a === ''
  const bNull = b === null || b === undefined || b === ''
  if (!aNull && !bNull) return null
  if (aNull && bNull) return 0
  return (aNull ? 1 : -1) * (descending ? -1 : 1)
}

/**
 * `?ordering=-requested_date`, validated against the view's `ordering_fields`.
 * Anything not whitelisted falls back to the model's default `Meta.ordering`,
 * which is what `OrderingFilter.get_ordering` does.
 *
 * `fallback` may name several keys — `['-created_at']`, or `['status', 'id']` —
 * applied left to right, matching a multi-field `Meta.ordering`.
 */
export function applyOrdering(rows, params, allowed, fallback) {
  const requested = (params.ordering ?? '').trim()
  const bare = requested.replace(/^-+/, '')
  const specs = bare && bare in allowed
    ? [requested]
    : (Array.isArray(fallback) ? fallback : [fallback])

  const keys = specs
    .map((spec) => ({ descending: spec.startsWith('-'), read: allowed[spec.replace(/^-+/, '')] }))
    .filter((entry) => Boolean(entry.read))

  if (!keys.length) return rows

  return [...rows].sort((a, b) => {
    for (const { descending, read } of keys) {
      const left = read(a)
      const right = read(b)
      const nulls = nullOrder(left, right, descending)
      if (nulls !== null) {
        if (nulls !== 0) return nulls
        continue
      }
      const result = descending ? -compare(left, right) : compare(left, right)
      if (result !== 0) return result
    }
    return 0
  })
}

/* -------------------------------------------------------------- pagination */

const PAGE_SIZE = 20

/**
 * DRF's `PageNumberPagination` envelope, as configured globally here:
 * `PAGE_SIZE = 20` and no `page_size_query_param`, so `?page_size=` is
 * genuinely ignored — reproducing that is what keeps a mocked list from
 * disagreeing with the real one about how many rows a page holds.
 *
 * `next`/`previous` are absolute URLs upstream. Nothing in this app reads them
 * (every table drives off `count` and its own page state), but they are built
 * anyway so the payload is the shape it claims to be.
 *
 * A page past the last one is a 404 `{detail: 'Invalid page.'}`, exactly as
 * DRF answers an `InvalidPage`. Page 1 of an empty list is still a page.
 */
export function paginate(rows, params, path, serialize) {
  const size = PAGE_SIZE
  const count = rows.length
  const numPages = Math.max(1, Math.ceil(count / size))

  const raw = (params.page ?? '1').trim()
  const page = raw === 'last' ? numPages : Number(raw)
  if (!Number.isInteger(page) || page < 1 || page > numPages) {
    throw new DemoApiError(404, 'Invalid page.', { detail: 'Invalid page.' })
  }

  const slice = rows.slice((page - 1) * size, page * size)
  const pageUrl = (target) => {
    if (!target) return null
    const query = new URLSearchParams(params)
    if (target === 1) query.delete('page')
    else query.set('page', String(target))
    const search = query.toString()
    return `${window.location.origin}/api${path}${search ? `?${search}` : ''}`
  }

  return {
    count,
    next: pageUrl(page < numPages ? page + 1 : null),
    previous: pageUrl(page > 1 ? page - 1 : null),
    results: serialize ? slice.map((row) => serialize(row)) : slice,
  }
}
