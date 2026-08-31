/**
 * Filtering, ordering and pagination — a port of the hand-rolled `get_queryset`
 * filters across `apps/<app>/views.py` and of DRF's `PageNumberPagination` plus
 * `admin_api/pagination.py::AdminPageNumberPagination`.
 *
 * Django reaches into the ORM by field path; here each helper takes accessors
 * instead, so `barber__user__first_name` becomes
 * `(row) => userById(barberById(row.barber_id)?.user_id)?.first_name` at the
 * call site. Three of the Python behaviours are load-bearing and easy to lose
 * in translation: an unparseable **list filter** means "no filter" rather than
 * an empty result, a malformed relation value is ignored rather than raising,
 * and a page past the last one is a 404 rather than an empty page.
 *
 * The swallow is a property of the *filters*, not of dates in general. Where a
 * date is the subject of the request — `/availability/?date=`,
 * `/availability-summary/?from=&to=` — the backend raises a 400 and so must the
 * mock: use `mustDate()`, not `asDate()`.
 *
 * No endpoint in this API configures `filter_backends`, so there is no DRF
 * `SearchFilter` and no `ordering=` on most lists — `search` is a hand-written
 * `icontains` OR across a named set of columns, and ordering is hard-coded per
 * endpoint. `applyOrdering` exists for the two lists that do accept it.
 */

import { DemoApiError, dateKey, parseIso, validationError } from './base';
import { API_PREFIX } from './router';
import type { DemoParams, DemoRequest } from './router';
import type { DateKey } from './types';

export type TextField<T> = (row: T) => string | null | undefined;
export type OrderKey<T> = (row: T) => string | number | boolean | null | undefined;

export interface RelationLookup<T> {
  /** The foreign key, or every key of an M2M. */
  pk: (row: T) => number | number[] | null | undefined;
  /** Slug fallback, for the few filters that accept a code as well as an id. */
  slug?: (row: T) => string | string[] | null | undefined;
}

function holds<V>(value: V | V[] | null | undefined, wanted: V): boolean {
  if (value === null || value === undefined) return false;
  return Array.isArray(value) ? value.includes(wanted) : value === wanted;
}

/**
 * `YYYY-MM-DD` if the value is a real calendar date, else null.
 *
 * Django's `parse_date()` throws on a well-formed but impossible date such as
 * 2026-02-31, and every view swallows that so a malformed query string cannot
 * turn a list request into a 500.
 */
export function asDate(raw: string | undefined): DateKey | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const real = date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  return real ? `${year}-${month}-${day}` : null;
}

/**
 * The same parse, but a malformed value is a **400** rather than "no filter".
 *
 * `asDate`'s swallow is right for the admin list filters, which is what Django's
 * views do with `date_from`/`date_to`. It is wrong everywhere a date is the
 * subject of the request rather than a filter on it: `apps/barbers/views.py`
 * raises `ValidationError({"date": ["validation_error"]})` on
 * `/availability/?date=2026-02-31`. Swallowing it there returns a full
 * unfiltered slot list where the API returns a 400, and the wizard's error
 * branch becomes unreachable.
 *
 * The availability endpoints report `field: "date"` for *every* parse failure,
 * `service_id` included, so those handlers pass `'date'` explicitly.
 */
export function mustDate(params: DemoParams, key: string, field: string = key): DateKey {
  const parsed = asDate(params[key]);
  if (!parsed) throw validationError(field);
  return parsed;
}

/** `?flag=true` / `false`, case-insensitive. Anything else means "no filter". */
export function asBoolean(raw: string | undefined): boolean | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

/** A positive integer, or null. Used for every `?x_id=` filter. */
export function asId(raw: string | undefined): number | null {
  const value = (raw ?? '').trim();
  return /^\d+$/.test(value) ? Number(value) : null;
}

/**
 * `Q(a__icontains=term) | Q(b__icontains=term)` — one term, case-insensitive,
 * any field matching is enough. Not DRF's `SearchFilter`: no quoting, no
 * all-terms-must-match, because no endpoint here installs it.
 */
export function applySearch<T>(
  rows: T[],
  params: DemoParams,
  fields: TextField<T>[],
  param = 'search',
): T[] {
  const term = (params[param] ?? '').trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) => fields.some((read) => (read(row) ?? '').toLowerCase().includes(term)));
}

/**
 * A map of query param to accessor, compared for equality. Booleans are
 * normalised through `asBoolean`, so `?is_active=false` filters and
 * `?is_active=maybe` does not.
 */
export function applyFilters<T>(
  rows: T[],
  params: DemoParams,
  spec: Record<string, (row: T) => string | number | boolean | null | undefined>,
): T[] {
  let result = rows;
  for (const [param, read] of Object.entries(spec)) {
    const raw = (params[param] ?? '').trim();
    if (!raw) continue;
    const wantedBoolean = asBoolean(raw);
    result = result.filter((row) => {
      const value = read(row);
      // The column's own type decides how the string is read, so `?is_active=false`
      // filters and `?is_active=maybe` is ignored rather than emptying the list.
      if (typeof value === 'boolean') return wantedBoolean === null || value === wantedBoolean;
      return String(value ?? '') === raw;
    });
  }
  return result;
}

/** `?barber_id=3`, with an optional slug fallback for a code-style filter. */
export function applyRelationFilter<T>(
  rows: T[],
  params: DemoParams,
  param: string,
  lookup: RelationLookup<T>,
): T[] {
  const raw = (params[param] ?? '').trim();
  if (!raw) return rows;

  if (/^\d+$/.test(raw)) {
    const pk = Number(raw);
    return rows.filter((row) => holds(lookup.pk(row), pk));
  }

  const slug = lookup.slug;
  if (!slug) return rows;
  return rows.filter((row) => holds(slug(row), raw));
}

/**
 * `?status=pending&status=confirmed` — a repeated key, from `paramsAll`.
 *
 * **No endpoint in this API uses it.** Every backend filter is
 * `request.query_params.get(...)`, i.e. Django's last-value-wins QueryDict —
 * `grep -rn getlist backend/apps/` finds nothing — which is exactly what
 * `request.params` already reproduces. A handler that reaches for this returns
 * the union where the real API returns only the last value.
 *
 * Kept rather than deleted because `paramsAll` is what lets `paginate()` rebuild
 * a `next` URL without collapsing a repeated key, and because a filter that
 * grows a list is a one-line change away. Do not use it to model an existing
 * endpoint.
 */
export function applyMultiFilter<T>(
  paramsAll: Record<string, string[]>,
  rows: T[],
  param: string,
  read: (row: T) => string | number | null | undefined,
): T[] {
  const values = paramsAll[param];
  if (!values || values.length === 0) return rows;
  const wanted = new Set(values);
  return rows.filter((row) => wanted.has(String(read(row) ?? '')));
}

export interface DateRangeOptions {
  from?: string;
  to?: string;
}

/**
 * Inclusive on both ends, compared on the Tbilisi calendar date the way
 * `__date__gte` / `__date__lte` did. The param names vary by endpoint —
 * `date_from`/`date_to` on the admin lists, `from`/`to` on the availability
 * summary — so they are arguments rather than constants.
 */
export function applyDateRange<T>(
  rows: T[],
  params: DemoParams,
  field: (row: T) => string | null | undefined,
  options: DateRangeOptions = {},
): T[] {
  const from = asDate(params[options.from ?? 'date_from']);
  const to = asDate(params[options.to ?? 'date_to']);
  if (!from && !to) return rows;

  return rows.filter((row) => {
    const value = field(row);
    if (!value) return false;
    const key = dateKey(value);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  });
}

/**
 * Postgres puts NULLs last on ASC and first on DESC — and negating an ascending
 * comparison would do the opposite, so nulls are settled before the direction
 * is applied.
 */
function nullOrder(left: unknown, right: unknown, descending: boolean): number | null {
  const leftNull = left === null || left === undefined;
  const rightNull = right === null || right === undefined;
  if (!leftNull && !rightNull) return null;
  if (leftNull && rightNull) return 0;
  return (leftNull ? 1 : -1) * (descending ? -1 : 1);
}

/**
 * Numbers numerically, booleans as 0/1, everything else as text.
 *
 * A **Money accessor sorts as text** — `"100.00" < "60.00"` — because a 2-dp
 * string is a string. Any money column reached through `applyOrdering` needs
 * `toMinor()` in its accessor, the same way a date column needs `parseIso()`.
 */
function compare(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  // `localeCompare(…, 'ka')` gets close enough to the `en_US.UTF-8` collation
  // Postgres sorted Georgian names with; JS's default sort would not.
  return String(left).localeCompare(String(right), 'ka');
}

/**
 * `ordering=-created_at`, validated against `allowed`; anything else falls back.
 * `fallback` may be an array, matching a multi-field `Meta.ordering`.
 */
export function applyOrdering<T>(
  rows: T[],
  params: DemoParams,
  allowed: Record<string, OrderKey<T>>,
  fallback: string | string[],
): T[] {
  const raw = (params.ordering ?? '').trim();
  const bare = raw.replace(/^-+/, '');
  // `hasOwn`, not `in`: `?ordering=constructor` would otherwise resolve against
  // `Object.prototype`, pass the truthiness filter below, and sort by nothing
  // at all instead of falling back to the documented default.
  const spec = bare && Object.hasOwn(allowed, bare) ? [raw] : [fallback].flat();

  const keys = spec
    .map((entry) => ({
      descending: entry.startsWith('-'),
      read: allowed[entry.replace(/^-+/, '')],
    }))
    .filter((entry) => Boolean(entry.read));
  if (keys.length === 0) return rows;

  return [...rows].sort((leftRow, rightRow) => {
    for (const { descending, read } of keys) {
      const left = read(leftRow);
      const right = read(rightRow);
      const nulls = nullOrder(left, right, descending);
      if (nulls !== null) {
        if (nulls !== 0) return nulls;
        continue;
      }
      const result = descending ? -compare(left, right) : compare(left, right);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/** Newest first on an ISO column — the shape half the `Meta.ordering`s take. */
export function newestFirst<T>(rows: T[], at: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((left, right) => parseIso(at(right)) - parseIso(at(left)));
}

/** Oldest first, for the schedule views that read forwards. */
export function oldestFirst<T>(rows: T[], at: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((left, right) => parseIso(at(left)) - parseIso(at(right)));
}

// --------------------------------------------------------------------------- //
//  Pagination
// --------------------------------------------------------------------------- //

/** `REST_FRAMEWORK["PAGE_SIZE"]`. Every paginated list in the API uses it. */
export const PAGE_SIZE = 25;

/** `AdminPageNumberPagination.max_page_size`. */
const MAX_PAGE_SIZE = 100;

/** The DRF envelope. `admin/lib/paginated.ts` mirrors this interface exactly. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PaginateOptions {
  pageSize?: number;
  /**
   * `AdminPageNumberPagination` sets `page_size_query_param`, so `/admin/bookings/`
   * and `/admin/customers/` honour `?page_size=` up to 100. Every other list
   * uses the global paginator, which ignores it — pass nothing there.
   */
  clientPageSize?: boolean;
}

/**
 * `_positive_int(strict=True, cutoff=max_page_size)`: junk falls back to the
 * endpoint's default rather than erroring, and anything over the cap is clamped.
 * So `?page_size=0`, `?page_size=-3` and `?page_size=abc` all mean 25, and
 * `?page_size=500` means 100.
 */
function requestedPageSize(raw: string | undefined, fallback: number, allowed: boolean): number {
  if (!allowed || !raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return value > 0 ? Math.min(value, MAX_PAGE_SIZE) : fallback;
}

/**
 * The envelope every paginated endpoint returns, including working absolute
 * `next` and `previous` URLs.
 *
 * The console's `fetchAllPages()` loops until `next === null`, so a mock that
 * hard-codes `next: null` silently truncates every filter dropdown, every
 * working-hours grid and every client-side-filtered list at 25 rows — with no
 * error anywhere. The URLs are built off the request's own path and query
 * string, with `page` rewritten, exactly as DRF built them from the incoming
 * request; page 1 omits `page` entirely, which is also what `withPage()` does.
 *
 * A page past the last one is a 404 `not_found`, as DRF answers an
 * `InvalidPage`. Page 1 of an empty list is still a page.
 */
export function paginate<T, R = T>(
  rows: T[],
  request: DemoRequest,
  serialize?: (row: T) => R,
  options: PaginateOptions = {},
): Page<R> {
  const size = requestedPageSize(
    request.params.page_size,
    options.pageSize ?? PAGE_SIZE,
    options.clientPageSize ?? false,
  );
  const numPages = Math.max(1, Math.ceil(rows.length / size));

  const raw = (request.params.page ?? '1').trim();
  const page = raw === 'last' ? numPages : Number(raw);
  if (!Number.isInteger(page) || page < 1 || page > numPages) {
    throw new DemoApiError(404, 'not_found');
  }

  // Built from `paramsAll`, not `params`: the latter is last-value-wins, so a
  // list filtered with a repeated key would publish a `next` carrying one value
  // of it. And from `API_PREFIX`, not a bare `/api`, so the URL the demo
  // advertises is the URL the seam would actually call.
  const pageUrl = (target: number | null): string | null => {
    if (target === null) return null;
    const query = new URLSearchParams();
    for (const [key, values] of Object.entries(request.paramsAll)) {
      if (key === 'page') continue;
      for (const value of values) query.append(key, value);
    }
    if (target !== 1) query.set('page', String(target));
    const search = query.toString();
    return new URL(
      `${API_PREFIX}${request.url}${search ? `?${search}` : ''}`,
      window.location.origin,
    ).href;
  };

  const slice = rows.slice((page - 1) * size, page * size);
  return {
    count: rows.length,
    next: pageUrl(page < numPages ? page + 1 : null),
    previous: pageUrl(page > 1 ? page - 1 : null),
    // Without a serializer `R` resolves to `T`, so the rows are already results.
    results: serialize ? slice.map((row) => serialize(row)) : (slice as unknown as R[]),
  };
}
