/**
 * Reading a query string the way Django-Ninja reads one, and putting the answer
 * in the envelope this API actually uses.
 *
 * A port of the hand-written `if q: qs = qs.filter(...)` blocks across the five
 * admin list views plus the `page = max(1, page)` / `page_size = max(1, min(...))`
 * pair every one of them opens with. There is no DRF here and no paginator
 * class: Ninja's list endpoints assemble `{items, total, page, page_size}` by
 * hand, and `by_alias=True` renders the last key as `pageSize`.
 *
 * Four things in this file are load-bearing:
 *
 * - **There is no ordering parameter anywhere in this API.** `grep` finds no
 *   `ordering=` and no `order_by` driven by a request value; every list sorts by
 *   its model's `Meta.ordering`, which `store.ts`'s `ordered*` walkers reproduce.
 *   A handler that wants a different order is describing a route that does not
 *   exist. Do not add one here.
 * - **A page past the last one is an empty page, not a 404.** Ninja slices a
 *   Python list, and `rows[200:225]` on a 64-row list is `[]`. DRF would have
 *   raised `InvalidPage`; nabadi's `paginate()` answers 404 for exactly that
 *   reason. Different backend, different edge case — copying the sibling demo
 *   here would 404 the admin list every time a filter shrinks the result set
 *   under the page the URL still remembers.
 * - **`total` counts the filtered rows, not the page.** `qs.count()` runs before
 *   the slice. The admin tables render "Showing 25 of 64" from it, and a `total`
 *   that echoed `items.length` would make the pager vanish on page 1.
 * - **`page` and `pageSize` are echoed after clamping**, not as they arrived, so
 *   the response tells the client what it actually got.
 *
 * Query values arrive as strings, and a *malformed* one is treated as "no
 * filter". Upstream, Ninja's typed parameters (`is_active: bool | None`,
 * `date_from: date | None`, `page: int`) would answer **422** to junk instead —
 * a divergence taken knowingly: nothing in the app can produce a malformed
 * value, `buildQuery` drops empty strings and serialises the rest itself, and a
 * hand-typed URL emptying a list is friendlier than one that errors.
 */

import { utcDateKey } from './base';
import type { DateKey } from './types';

/**
 * The query string as `dispatch()` normalises it: one value per key, the last
 * one winning, exactly as Django's `QueryDict.get()` behaves. Declared here
 * rather than imported from `router.ts` so this module has no dependency to
 * cycle through; `DemoRequest['params']` is the same shape structurally.
 */
export type DemoParams = Record<string, string>;

// --------------------------------------------------------------------------- //
//  Scalars
// --------------------------------------------------------------------------- //

/**
 * `?flag=true` / `?flag=false`, and nothing else.
 *
 * Truthiness is the trap here. `lib/api.ts::buildQuery` keeps a `false` and
 * sends it as the string `"false"`, which is truthy in JavaScript — so a reader
 * that tested the raw string would make `?is_active=false` mean "no filter" and
 * the admin's Inactive tab would silently list everybody.
 *
 * Pydantic's own bool parser accepts a wider vocabulary (`1`, `on`, `yes`, `t`,
 * …). None of it can reach here: every boolean in this API is written by
 * `buildQuery` from a real `boolean`.
 */
export function asBoolean(raw: string | undefined): boolean | null {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * A base-ten integer, or null. Negatives parse — `?page=-1` has to reach
 * `paginate()` so the clamp can be the thing that repairs it, rather than this
 * function quietly turning it into the default.
 */
export function asInt(raw: string | undefined): number | null {
  const value = (raw ?? '').trim();
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * `YYYY-MM-DD`, round-tripped as written and checked for being a real calendar
 * date — Python's `date` constructor rejects 2026-02-31 and so does this.
 *
 * The key is compared as a **string** against `utcDateKey(row.created_at)`,
 * never parsed into an instant, because `created_at__date__gte` compares dates
 * and a parsed midnight would drag the browser's zone into it.
 */
export function asDateKey(raw: string | undefined): DateKey | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw ?? '').trim());
  if (!match) return null;

  const [, year, month, day] = match;
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const real =
    probe.getUTCFullYear() === Number(year) &&
    probe.getUTCMonth() === Number(month) - 1 &&
    probe.getUTCDate() === Number(day);
  return real ? `${year}-${month}-${day}` : null;
}

/**
 * `__icontains`. A null column never matches; an empty needle always does,
 * which is Python's `"" in x` and is why every call site guards with
 * `if (!q) return rows` before reaching for it.
 */
export function icontains(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? '').toLowerCase().includes(needle.toLowerCase());
}

// --------------------------------------------------------------------------- //
//  Filters
// --------------------------------------------------------------------------- //

/**
 * `created_at__date__gte=date_from` / `__date__lte=date_to`, inclusive at both
 * ends.
 *
 * The comparison is on the **UTC** date part, because upstream runs
 * `TIME_ZONE = "UTC"` and `__date` truncates in the database's zone. The admin
 * UI, meanwhile, builds its Today / Last 7 days presets from the *browser's*
 * calendar (`use-date-range-filter.ts` assembles `YYYY-MM-DD` by hand precisely
 * to avoid `toISOString()`). Those two zones disagree for a visitor far enough
 * east or west, and that disagreement is real upstream behaviour: it is
 * reproduced, not repaired. Using the browser's zone here would fix a bug the
 * product has and hide it from whoever reads this demo.
 *
 * A row with an empty timestamp is excluded once either bound is set, the way a
 * `NULL` fails both comparisons in SQL.
 */
export function applyDateRange<T>(
  rows: T[],
  params: DemoParams,
  field: (row: T) => string | null | undefined,
  keys: { from?: string; to?: string } = {},
): T[] {
  const from = asDateKey(params[keys.from ?? 'date_from']);
  const to = asDateKey(params[keys.to ?? 'date_to']);
  if (!from && !to) return rows;

  return rows.filter((row) => {
    const value = field(row);
    if (!value) return false;
    const key = utcDateKey(value);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  });
}

// --------------------------------------------------------------------------- //
//  Envelopes
//
//  Two shapes, and the API uses each in exactly the places listed. There is no
//  `count` / `next` / `previous` anywhere in this backend — that is DRF's
//  envelope and belongs to a different application. `admin/lib/*.ts` reads
//  `items` and `total`, so inventing a third shape breaks a table silently.
// --------------------------------------------------------------------------- //

/** `{items, total, page, pageSize}` — the five admin lists and `GET /orders`. */
export interface PageEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** `{items, total}` — `GET /admin/collections` alone, which does not paginate. */
export interface CountEnvelope<T> {
  items: T[];
  total: number;
}

export interface PaginateOptions {
  /** What `page_size` defaults to when absent. 25 everywhere except `GET /orders`, which is 20. */
  defaultPageSize: number;
  /** The `min(...)` ceiling. 100 everywhere except `GET /orders`, which is 50. */
  maxPageSize: number;
}

/**
 * The admin default. `GET /orders` is the **one** route that must pass its own
 * `{defaultPageSize: 20, maxPageSize: 50}` — `orders/api.py::list_my_orders`
 * clamps at 50, not 100, and the account page's pager would over-fetch by half
 * a page without it.
 */
const ADMIN_PAGINATION: PaginateOptions = { defaultPageSize: 25, maxPageSize: 100 };

/**
 * Ninja's pagination, clamp for clamp:
 *
 * ```py
 * page = max(1, page)
 * page_size = max(1, min(100, page_size))
 * total = qs.count()
 * items = list(qs[(page - 1) * page_size : page * page_size])
 * ```
 *
 * `rows` arrives already filtered **and already ordered** — ordering is the
 * model's, so it belongs to `store.ts`'s walkers, not to a parameter here.
 *
 * A page past the end yields `items: []` with the true `total`, so the admin
 * table can render its "no rows on this page" state and its pager at once. See
 * the module note for why this is not a 404.
 */
export function paginate<T, R>(
  rows: T[],
  params: DemoParams,
  serialize: (row: T) => R,
  options: PaginateOptions = ADMIN_PAGINATION,
): PageEnvelope<R> {
  const page = Math.max(1, asInt(params.page) ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(options.maxPageSize, asInt(params.page_size) ?? options.defaultPageSize),
  );

  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize).map(serialize),
    // Counted before the slice, as `qs.count()` is.
    total: rows.length,
    // Echoed after the clamp, so `?page=0` answers `page: 1`.
    page,
    pageSize,
  };
}

/**
 * `CollectionListOut` — `{items, total}` and nothing else.
 *
 * `catalog/admin_api.py::list_collections` takes no `page` and no `page_size`:
 * six rows never needed a pager, and the console's collection picker reads the
 * whole list. Reusing `paginate()` here would add two keys the schema does not
 * declare and quietly cap the picker at 25 the day a seventh collection exists.
 */
export function countEnvelope<T, R>(rows: T[], serialize: (row: T) => R): CountEnvelope<R> {
  return { items: rows.map(serialize), total: rows.length };
}
