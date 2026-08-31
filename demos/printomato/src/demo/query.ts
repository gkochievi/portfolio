/**
 * Filtering, ordering and pagination — a port of `core/admin_api/filters.py`
 * and `pagination.py`.
 *
 * Django reaches into the ORM by field path; here each helper takes accessors
 * instead, so `device__name` becomes `(row) => deviceById(row.device_id)?.name`
 * at the call site. Two of the Python behaviours are load-bearing and easy to
 * lose in translation: an unparseable date means "no filter" rather than an
 * empty result, and a non-numeric relation value with no slug to fall back on
 * is ignored rather than raising.
 */
import type { Page } from '@/types'

import { DemoApiError, type DemoParams } from '@/demo/router'
import { localDateKey } from '@/demo/store'

/** Reads one searchable field off a row. */
export type TextField<T> = (row: T) => string | null | undefined

/** Reads an ordering key; decimal strings should be read as numbers so they
 *  sort the way the database sorts them. */
export type OrderKey<T> = (row: T) => string | number | null | undefined

export interface RelationLookup<T> {
  /** The foreign key, or every key of an M2M. */
  pk: (row: T) => number | number[] | null | undefined
  /** Slug fallback. In Django only `device` gets one implicitly. */
  slug?: (row: T) => string | string[] | null | undefined
}

function holds<V>(value: V | V[] | null | undefined, wanted: V): boolean {
  if (value === null || value === undefined) return false
  return Array.isArray(value) ? value.includes(wanted) : value === wanted
}

/**
 * `YYYY-MM-DD` if the value is a real calendar date, else null.
 *
 * `parse_date()` throws on a well-formed but impossible date such as
 * 2026-02-31, which the Python swallows so a malformed query string cannot
 * turn a list request into a 500.
 */
function asDate(raw: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim())
  if (!match) return null

  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  const real = date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
  return real ? `${year}-${month}-${day}` : null
}

export function applySearch<T>(rows: T[], params: DemoParams, fields: TextField<T>[]): T[] {
  const term = (params.search ?? '').trim().toLowerCase()
  if (!term) return rows
  return rows.filter((row) => fields.some((read) => (read(row) ?? '').toLowerCase().includes(term)))
}

export function applyRelationFilter<T>(
  rows: T[],
  params: DemoParams,
  param: string,
  lookup: RelationLookup<T>,
): T[] {
  const raw = (params[param] ?? '').trim()
  if (!raw) return rows

  if (/^\d+$/.test(raw)) {
    const pk = Number(raw)
    return rows.filter((row) => holds(lookup.pk(row), pk))
  }

  const slug = lookup.slug
  if (!slug) return rows
  return rows.filter((row) => holds(slug(row), raw))
}

/** Inclusive on both ends, compared on the local calendar date like `__date__`. */
export function applyDateRange<T>(rows: T[], params: DemoParams, field: TextField<T>): T[] {
  const from = asDate(params.date_from)
  const to = asDate(params.date_to)
  if (!from && !to) return rows

  return rows.filter((row) => {
    const value = field(row)
    if (!value) return false
    const key = localDateKey(value)
    if (from && key < from) return false
    if (to && key > to) return false
    return true
  })
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a === b) return 0
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
  return String(a) < String(b) ? -1 : 1
}

/** Postgres puts NULLs last on ASC and first on DESC — and negating an
 *  ascending comparison would do the opposite, so nulls are settled before the
 *  direction is applied. */
function nullOrder(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  descending: boolean,
): number | null {
  const aNull = a === null || a === undefined
  const bNull = b === null || b === undefined
  if (!aNull && !bNull) return null
  if (aNull && bNull) return 0
  return (aNull ? 1 : -1) * (descending ? -1 : 1)
}

/** `ordering=-amount`, validated against `allowed`; anything else falls back. */
export function applyOrdering<T>(
  rows: T[],
  params: DemoParams,
  allowed: Record<string, OrderKey<T>>,
  fallback: string,
): T[] {
  const raw = (params.ordering ?? '').trim()
  const bare = raw.replace(/^-+/, '')
  const spec = bare && bare in allowed ? raw : fallback

  const descending = spec.startsWith('-')
  const key = allowed[spec.replace(/^-+/, '')]
  if (!key) return rows

  return [...rows].sort((a, b) => {
    const left = key(a)
    const right = key(b)
    const nulls = nullOrder(left, right, descending)
    if (nulls !== null) return nulls
    return descending ? -compare(left, right) : compare(left, right)
  })
}

const MAX_PAGE_SIZE = 200

/** DRF's `_positive_int(strict=True, cutoff=max_page_size)`: junk falls back
 *  to the endpoint's default rather than erroring. */
function requestedPageSize(raw: string | undefined, fallback: number): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback
  const value = Number(raw)
  return value > 0 ? Math.min(value, MAX_PAGE_SIZE) : fallback
}

/**
 * The envelope every paginated endpoint returns. A page past the last one is a
 * 404 `{detail: 'Invalid page.'}`, exactly as DRF answers an `InvalidPage`;
 * page 1 of an empty list is still a page.
 */
export function paginate<T, R = T>(
  rows: T[],
  params: DemoParams,
  pageSize: number,
  serialize?: (row: T) => R,
): Page<R> {
  const size = requestedPageSize(params.page_size, pageSize)
  const numPages = Math.max(1, Math.ceil(rows.length / size))

  const raw = (params.page ?? '1').trim()
  const page = raw === 'last' ? numPages : Number(raw)
  if (!Number.isInteger(page) || page < 1 || page > numPages) {
    throw new DemoApiError(404, 'Invalid page.')
  }

  const slice = rows.slice((page - 1) * size, page * size)
  return {
    count: rows.length,
    num_pages: numPages,
    page,
    page_size: size,
    has_next: page < numPages,
    has_previous: page > 1,
    // Without a serializer `R` resolves to `T`, so the rows are already the results.
    results: serialize ? slice.map((row) => serialize(row)) : (slice as unknown as R[]),
  }
}
