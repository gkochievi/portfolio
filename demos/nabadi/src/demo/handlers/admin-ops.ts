/**
 * `/admin/promotions/`, `/admin/reviews/`, `/admin/audit/`, `/admin/analytics/`,
 * `/admin/settings/`, `/admin/landing/`, `/admin/notification-templates/` —
 * 26 routes.
 *
 * A port of `apps/admin_api/views/{promotions,reviews,audit,analytics,cms,notifications}.py`
 * plus `apps/bookings/services/analytics.py`, whose KPI math this module owns.
 *
 * Two things about this module are worth knowing before reading it:
 *
 * - **Analytics is computed, never stored.** Every metric walks `store.bookings`
 *   at call time, so a booking the visitor makes on the customer site moves the
 *   console's numbers on the next poll. That is the whole reason the two
 *   surfaces share one store, and it is why nothing here is memoised.
 * - **Every route registers the same gate.** `admin` is the only role that
 *   signs into the console, so `ADMIN_ONLY` is the whole authority model here —
 *   including on `/admin/settings/` and `/admin/landing/`, where upstream's
 *   `_ReadStaff_WriteFeature(key)` used to let a wider staff role read what it
 *   could not write.
 *
 * This module exports nothing, as `schema.md` §4 asks. The two things it used
 * to export both had to be shared and are now kernel modules, which is where
 * `routes.md` said they belonged all along:
 *
 * - `summaryPayload()` is `serialize.ts`'s. It answers `/admin/analytics/summary/`,
 *   the `summary` key of `/admin/analytics/barber/{id}/` and both XLSX summary
 *   sheets, and those have to agree digit for digit.
 * - The workbook writer is `xlsx.ts` + `zip.ts`. There are three XLSX exports
 *   and now one writer; `admin-bookings.ts` owns the other two.
 */

import {
  bodyOf,
  decimalStringOrNull,
  fail,
  file,
  fromMinor,
  has,
  instantAt,
  normalizePhone,
  notFound,
  nowIso,
  parseIso,
  readBoolean,
  roundHalfEven,
  shiftDayKey,
  toApiDateTime,
  toMinor,
  todayKey,
  validationError,
} from '../base';
import { applyDateRange, applyOrdering, asBoolean, asId, newestFirst, paginate } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import { barberName, serializePromotion, summaryPayload } from '../serialize';
import type { AnalyticsSummary } from '../serialize';
import { styled, workbook } from '../xlsx';
import type { Row, SheetInput } from '../xlsx';
import {
  barberById,
  bookingById,
  nextId,
  promotionByCode,
  renderTemplate,
  serviceById,
  smsNotificationsEnabled,
  store,
  userById,
  writeAudit,
} from '../store';
import type {
  AuditLogRow,
  BookingRow,
  DateKey,
  IsoDateTime,
  Money,
  NotificationTemplateRow,
  PromotionRow,
  ReviewRow,
  Role,
  SiteSettingRow,
} from '../types';

// --------------------------------------------------------------------------- //
//  Shared little readers
// --------------------------------------------------------------------------- //

// `bodyOf`, `has` and `readBoolean` are `base.ts`'s — three modules wanted the
// same three. `has` counts an explicit `undefined` as absent, which is what a
// JSON round-trip does anyway and what the console's live objects mean by it.

/**
 * Three modules declare a `readText` and they are **not** the same function —
 * the three serializers behind them declare `CharField` three different ways,
 * and the differences are load-bearing. Do not merge them.
 *
 * | module | signature | `null` | a number | max length |
 * |---|---|---|---|---|
 * | `admin-bookings` | `(body, key) -> string \| undefined` | `""` | 400 | — |
 * | `admin-catalog` | `(value, field) -> string` | 400 | stringified | caller's |
 * | `admin-ops` | `(raw, field, max) -> string` | `""` | 400 | required |
 *
 */
/** A `CharField(max_length=n)`: text, length-checked, `null` read as `""`. */
function readText(raw: unknown, field: string, maxLength: number): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw !== 'string') throw validationError(field);
  if (raw.length > maxLength) throw validationError(field);
  return raw;
}

/** A nullable `IntegerField`. `null` stays null; anything unparseable is a 400. */
function readNullableInt(raw: unknown, field: string): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^[+-]?\d+$/.test(raw.trim())) return Number(raw.trim());
  throw validationError(field);
}

/** A nullable `DateTimeField`, normalised onto the `+04:00` wire format. */
function readNullableDateTime(raw: unknown, field: string): IsoDateTime | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') throw validationError(field);
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) throw validationError(field);
  return toApiDateTime(at);
}

/**
 * Deep JSON equality, for the `{old, new}` diffs.
 *
 * `SiteSetting.value` and `gallery_image_urls` hold arbitrary documents, so a
 * `!==` would report every save of an unchanged object as a change and fill the
 * audit log with noise. Key order is stable because both sides come from the
 * same source shape.
 */
function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/**
 * The gate on every route in this module. `admin` is the only role that reaches
 * the console at all, so there is one constant rather than one per section —
 * and it is declared up here because `register()` runs at module scope and a
 * `const` below its first use is still in its temporal dead zone.
 */
const ADMIN_ONLY: Role[] = ['admin'];

// --------------------------------------------------------------------------- //
//  1. Promotions — `views/promotions.py`
// --------------------------------------------------------------------------- //

interface PromotionInput {
  code: string;
  description: string;
  percent_off: number | null;
  amount_off: Money | null;
  valid_from: IsoDateTime | null;
  valid_until: IsoDateTime | null;
  max_uses: number | null;
  is_active: boolean;
}

/**
 * `PromotionAdminSerializer.validate` — which mirrors `Promotion.clean()` — run
 * over *incoming ∪ persisted*, so a PATCH is judged on the merged row.
 *
 * The consequence worth keeping: switching a promo from percent to amount needs
 * **both** keys in one request. Sending only `amount_off` leaves the stored
 * `percent_off` in place, both are non-null, and rule 1 rejects it on
 * `percent_off` — which is why the console's form always sends the pair with
 * one of them null.
 */
function readPromotion(
  body: Record<string, unknown>,
  existing: PromotionRow | null,
): PromotionInput {
  // Field-level validation first, in declaration order: DRF finishes every
  // field before `validate()` runs, and only the first problem is ever
  // reported, so the order decides which `field` the client sees.
  let code = existing?.code ?? '';
  if (has(body, 'code') || !existing) {
    const raw = body.code;
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text || text.length > 40) throw validationError('code');
    // `UniqueValidator` on a unique column; `promotionByCode` matches
    // case-insensitively, which is how the booking flow redeems one.
    const clash = promotionByCode(text);
    if (clash && clash.id !== existing?.id) throw validationError('code');
    code = text;
  }

  const description = has(body, 'description')
    ? readText(body.description, 'description', 255)
    : (existing?.description ?? '');

  const percentOff = has(body, 'percent_off')
    ? readNullableInt(body.percent_off, 'percent_off')
    : (existing?.percent_off ?? null);

  let amountOff = existing?.amount_off ?? null;
  if (has(body, 'amount_off')) {
    const raw = body.amount_off;
    if (raw === null || raw === undefined || raw === '') amountOff = null;
    else {
      const money = decimalStringOrNull(raw as string | number);
      if (money === null) throw validationError('amount_off');
      amountOff = money;
    }
  }

  const validFrom = has(body, 'valid_from')
    ? readNullableDateTime(body.valid_from, 'valid_from')
    : (existing?.valid_from ?? null);
  const validUntil = has(body, 'valid_until')
    ? readNullableDateTime(body.valid_until, 'valid_until')
    : (existing?.valid_until ?? null);

  const maxUses = has(body, 'max_uses')
    ? readNullableInt(body.max_uses, 'max_uses')
    : (existing?.max_uses ?? null);

  const isActive = has(body, 'is_active')
    ? readBoolean(body.is_active, 'is_active')
    : (existing?.is_active ?? true);

  // `validate()` — the four cross-field rules, in the source's order.
  if ((percentOff === null) === (amountOff === null)) throw validationError('percent_off');
  if (percentOff !== null && (percentOff < 1 || percentOff > 100)) {
    throw validationError('percent_off');
  }
  if (amountOff !== null && toMinor(amountOff) <= 0) throw validationError('amount_off');
  if (validFrom && validUntil && parseIso(validFrom) >= parseIso(validUntil)) {
    throw validationError('valid_until');
  }

  return {
    code,
    description,
    percent_off: percentOff,
    amount_off: amountOff,
    valid_from: validFrom,
    valid_until: validUntil,
    max_uses: maxUses,
    is_active: isActive,
  };
}

register(
  'GET',
  '/admin/promotions/',
  (request) =>
    paginate(
      newestFirst(store.promotions, (row) => row.created_at),
      request,
      serializePromotion,
    ),
  { auth: ADMIN_ONLY },
);

register(
  'POST',
  '/admin/promotions/',
  (request) => {
    const body = bodyOf(request);
    const input = readPromotion(body, null);
    const row: PromotionRow = {
      id: nextId('promotions'),
      ...input,
      // Read-only on the serializer: the booking flow owns it, and a create
      // that accepted it could hand a fresh promo a spent budget.
      uses_count: 0,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    store.promotions.push(row);
    writeAudit(request, 'promotion.create', 'promotion', row.id, { ...input });
    return serializePromotion(row);
  },
  { auth: ADMIN_ONLY },
);

register(
  'PATCH',
  '/admin/promotions/:id/',
  (request) => {
    const row = store.promotions.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    const body = bodyOf(request);
    const input = readPromotion(body, row);
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    for (const [key, value] of Object.entries(input)) {
      // Only the fields the request actually sent, and only where the value
      // moved — `AuditedModelViewSetMixin.perform_update` diffs `validated_data`
      // against the instance, not the whole row.
      if (!has(body, key)) continue;
      const previous = row[key as keyof PromotionInput];
      if (sameJson(previous, value)) continue;
      changes[key] = { old: previous, new: value };
    }

    Object.assign(row, input);
    row.updated_at = nowIso();
    writeAudit(request, 'promotion.update', 'promotion', row.id, { changes });
    return serializePromotion(row);
  },
  { auth: ADMIN_ONLY },
);

register(
  'DELETE',
  '/admin/promotions/:id/',
  (request) => {
    const row = store.promotions.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    // The snapshot is the whole point of auditing a hard delete: once the row
    // is gone, `entity_id` alone says nothing about what was destroyed.
    const snapshot = serializePromotion(row);
    // `Booking.promotion` is `on_delete=SET_NULL`, so past bookings keep their
    // discounted `price_at_booking` and simply lose the pointer.
    for (const booking of store.bookings) {
      if (booking.promotion_id === row.id) booking.promotion_id = null;
    }
    store.promotions.splice(store.promotions.indexOf(row), 1);
    writeAudit(request, 'promotion.delete', 'promotion', snapshot.id, { snapshot });
    return undefined;
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  2. Reviews — `views/reviews.py`, `IsAdmin` only
//
//  No create and no update: admins never author or edit a customer's words.
//  They publish, unpublish or delete, and the router answers the other verbs
//  with its own 405.
// --------------------------------------------------------------------------- //

interface AdminReviewOut {
  id: number;
  booking_id: number;
  rating: number;
  text: string;
  is_published: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  customer_name: string;
  customer_phone: string;
  barber_id: number;
  barber_name: string;
  service_name: string;
  booking_start_at: IsoDateTime;
}

/**
 * `AdminReviewSerializer` — **not** the public `serializeReview` in
 * `serialize.ts`, despite sharing the `customer_name` key.
 *
 * This one is un-redacted: the full name, the full phone, and a fall back to
 * `walk_in_name`/`walk_in_phone` for a walk-in. The console is staff-only and a
 * receptionist moderating a review needs to know who wrote it; the public
 * payload reduces the same person to `"Nino K."` and omits the number. Do not
 * reconcile the two.
 */
function serializeAdminReview(row: ReviewRow): AdminReviewOut {
  const booking = bookingById(row.booking_id);
  const customer = userById(booking?.customer_id);
  return {
    id: row.id,
    booking_id: row.booking_id,
    rating: row.rating,
    text: row.text,
    is_published: row.is_published,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: customer
      ? `${customer.first_name} ${customer.last_name}`.trim()
      : (booking?.walk_in_name ?? ''),
    customer_phone: customer ? customer.phone : (booking?.walk_in_phone ?? ''),
    barber_id: booking?.barber_id ?? 0,
    barber_name: barberName(barberById(booking?.barber_id)),
    // The KA name only — this serializer has no `service_name_en`.
    service_name: serviceById(booking?.service_id)?.name ?? '',
    booking_start_at: booking?.start_at ?? '',
  };
}

register(
  'GET',
  '/admin/reviews/',
  (request) => {
    let rows = newestFirst(store.reviews, (row) => row.created_at);

    // All three filters swallow a malformed value rather than raising or
    // emptying the list — `test_malformed_filters_ignored` pins it, and the
    // landing-page picker walks every page of `?is_published=true`.
    const published = asBoolean(request.params.is_published);
    if (published !== null) rows = rows.filter((row) => row.is_published === published);

    const barberId = asId(request.params.barber_id);
    if (barberId !== null) {
      rows = rows.filter((row) => bookingById(row.booking_id)?.barber_id === barberId);
    }

    const rating = asId(request.params.rating);
    if (rating !== null) rows = rows.filter((row) => row.rating === rating);

    return paginate(rows, request, serializeAdminReview);
  },
  { auth: ADMIN_ONLY },
);

/** Publish and unpublish are the same transition with the flag flipped. */
function moderateReview(request: DemoRequest, published: boolean): AdminReviewOut {
  const row = store.reviews.find((entry) => entry.id === Number(request.path.id));
  if (!row) throw notFound();

  const previous = row.is_published;
  row.is_published = published;
  row.updated_at = nowIso();
  // Idempotent, and audited either way: republishing an already-published
  // review still writes `{old: true, new: true}`, because the moderation trail
  // is a record of who pressed what, not of what changed.
  writeAudit(request, published ? 'review.publish' : 'review.unpublish', 'review', row.id, {
    is_published: { old: previous, new: published },
  });
  return serializeAdminReview(row);
}

register('POST', '/admin/reviews/:id/publish/', (request) => moderateReview(request, true), {
  auth: ADMIN_ONLY,
});

register('POST', '/admin/reviews/:id/unpublish/', (request) => moderateReview(request, false), {
  auth: ADMIN_ONLY,
});

register(
  'DELETE',
  '/admin/reviews/:id/',
  (request) => {
    const row = store.reviews.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    const snapshot = serializeAdminReview(row);
    // The `cms_landingcontent_featured_reviews` join rows cascade with the
    // review upstream. Leaving the id behind would strand it in a column the
    // CMS renders, and `GET /admin/landing/` would have to guess.
    const featured = store.landing_content.featured_reviews;
    const featuredIndex = featured.indexOf(row.id);
    if (featuredIndex >= 0) featured.splice(featuredIndex, 1);

    store.reviews.splice(store.reviews.indexOf(row), 1);
    writeAudit(request, 'review.delete', 'review', snapshot.id, { snapshot });
    return undefined;
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  3. Audit log — `views/audit.py`, list only. Append-only: there is no write
//  route anywhere in the API, and the rows arrive through `writeAudit()`.
// --------------------------------------------------------------------------- //

interface AuditOut {
  id: number;
  created_at: IsoDateTime;
  actor: number | null;
  actor_phone: string;
  actor_first_name: string;
  actor_last_name: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string;
  payload: unknown;
  ip: string | null;
  user_agent: string;
}

function serializeAuditLog(row: AuditLogRow): AuditOut {
  // `on_delete=SET_NULL`: the actor may be gone. The three name columns then
  // serialise as `""` while `actor_role` — a denormalised snapshot taken at
  // write time — survives, which is the only reason that column exists.
  const actor = userById(row.actor_id);
  return {
    id: row.id,
    created_at: row.created_at,
    actor: row.actor_id,
    actor_phone: actor?.phone ?? '',
    actor_first_name: actor?.first_name ?? '',
    actor_last_name: actor?.last_name ?? '',
    actor_role: row.actor_role,
    action: row.action,
    entity: row.entity,
    entity_id: row.entity_id,
    payload: row.payload,
    ip: row.ip,
    user_agent: row.user_agent,
  };
}

register(
  'GET',
  '/admin/audit/',
  (request) => {
    let rows: AuditLogRow[] = store.audit_logs;

    const actorId = asId(request.params.actor_id);
    if (actorId !== null) rows = rows.filter((row) => row.actor_id === actorId);

    // Exact match, not `icontains`, despite the free-text inputs the Audit page
    // renders over them — `get_queryset` uses `action=` and `entity=`.
    const action = (request.params.action ?? '').trim();
    if (action) rows = rows.filter((row) => row.action === action);

    const entity = (request.params.entity ?? '').trim();
    if (entity) rows = rows.filter((row) => row.entity === entity);

    // Upstream feeds a malformed `date_from` or `actor_id` straight into the
    // ORM lookup, Django raises, and the request 500s. The mock swallows
    // instead: `schema.md` §7 makes "an unparseable date in a list filter means
    // no filter" a property of every list in this API, and a demo that answers
    // 500 to a hand-edited query string reads as broken rather than as faithful.
    rows = applyDateRange(rows, request.params, (row) => row.created_at);

    // `ordering_fields = ["created_at"]`; anything else falls back to the
    // default, which `applyOrdering` does on its own.
    rows = applyOrdering(
      rows,
      request.params,
      { created_at: (row) => parseIso(row.created_at) },
      '-created_at',
    );

    return paginate(rows, request, serializeAuditLog);
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  4. Analytics — `views/analytics.py` + `apps/bookings/services/analytics.py`
//
//  Seven routes, five shapes, one date-range parser. Everything is computed
//  over the live store at call time, so the console's numbers move when the
//  visitor books on the customer site.
// --------------------------------------------------------------------------- //

/**
 * `_parse_range`: today-29 … today by default, a reversed range silently
 * swapped, and a malformed date an uncaught `ValueError`.
 *
 * The 500 is deliberate rather than lazy. `spec/api-admin-c.md` §9 rules that
 * literal fidelity is the right answer here, because the console's inputs are
 * `type="date"` and cannot produce one — inventing a 400 would be a divergence
 * with no caller to justify it. Contrast the audit list above, where the
 * kernel's list-filter doctrine applies instead.
 */
function parseRange(request: DemoRequest): [DateKey, DateKey] {
  const today = todayKey();
  const read = (raw: string | undefined, fallback: DateKey): DateKey => {
    if (!raw) return fallback;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!match) throw fail('server_error');
    const [, year, month, day] = match;
    const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const real = probe.getUTCMonth() === Number(month) - 1 && probe.getUTCDate() === Number(day);
    if (!real) throw fail('server_error');
    return `${year}-${month}-${day}`;
  };

  const from = read(request.params.date_from, shiftDayKey(today, -29));
  const to = read(request.params.date_to, today);
  return from > to ? [to, from] : [from, to];
}

/**
 * `_parse_barber_id`: `""`, `"null"` and anything non-numeric all mean "no
 * filter" — never a 404. A valid id that matches nothing yields all zeros,
 * which is the honest answer for a barber with no bookings in the window.
 */
function parseBarberId(request: DemoRequest): number | null {
  const raw = (request.params.barber_id ?? '').trim();
  if (!raw || raw === 'null') return null;
  return /^[+-]?\d+$/.test(raw) ? Number(raw) : null;
}

/** `int(request.query_params.get("limit", 5))` — junk and negatives both 500. */
function parseLimit(request: DemoRequest): number {
  const raw = request.params.limit;
  if (raw === undefined) return 5;
  if (!/^\s*[+-]?\d+\s*$/.test(raw)) throw fail('server_error');
  const value = Number(raw.trim());
  // Django refuses a negative slice, which surfaces the same way a bad `limit`
  // does: an unhandled exception, i.e. a 500.
  if (value < 0) throw fail('server_error');
  return value;
}

/**
 * `base_qs`: bucketed on **`start_at`**, never `created_at`, and on the Tbilisi
 * calendar date — a booking at 21:00 UTC belongs to the next local day.
 *
 * No status filter at this level: `total_bookings` counts everything in the
 * window and the individual metrics narrow to `completed` themselves.
 */
function bookingsInRange(from: DateKey, to: DateKey, barberId: number | null): BookingRow[] {
  return store.bookings.filter((row) => {
    const key = toApiDateTime(row.start_at).slice(0, 10);
    if (key < from || key > to) return false;
    return barberId === null || row.barber_id === barberId;
  });
}

/**
 * The KPI payload is `serialize.ts::summaryPayload`, not a local function.
 *
 * `routes.md` §7 pins `GET /admin/analytics/summary/`, the `summary` key of
 * `GET /admin/analytics/barber/{id}/` and both XLSX summary sheets to the same
 * numbers — share the helper or the three screens will disagree — so all three
 * call sites below import the kernel's and none owns a copy. Everything the
 * arithmetic gets right on purpose (the three rates not summing to 1, the
 * divisor on `avg_ticket_size`, walk-ins counted a second time) is documented at
 * the definition.
 */

/**
 * `str(row["revenue"] or 0)`.
 *
 * `Decimal("0.00")` is falsy in Python, so a day whose completed bookings total
 * exactly zero — a free service, a fully-discounted promo — emits **`"0"`**
 * while every other day emits two decimals. Reproduced because it is the kind
 * of thing a chart's axis formatter notices and a reader does not.
 */
function seriesMoney(minor: number): string {
  return minor === 0 ? '0' : fromMinor(minor);
}

interface RevenuePointOut {
  date: DateKey;
  revenue: string;
  count: number;
}

/** `TruncDate("start_at")` over completed rows: sparse, ascending, no zero-fill. */
function revenueSeries(rows: BookingRow[]): RevenuePointOut[] {
  const byDay = new Map<DateKey, { minor: number; count: number }>();
  for (const row of rows) {
    if (row.status !== 'completed') continue;
    const key = toApiDateTime(row.start_at).slice(0, 10);
    const bucket = byDay.get(key) ?? { minor: 0, count: 0 };
    bucket.minor += toMinor(row.price_at_booking);
    bucket.count += 1;
    byDay.set(key, bucket);
  }
  return [...byDay.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .map(([date, bucket]) => ({ date, revenue: seriesMoney(bucket.minor), count: bucket.count }));
}

interface StatusRowOut {
  status: string;
  count: number;
}

/** Every status present in the window, `-count`. Absent statuses do not appear. */
function statusBreakdown(rows: BookingRow[]): StatusRowOut[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    // Postgres resolves a `-count` tie arbitrarily; the mock breaks it on the
    // status name so two identical requests cannot disagree. Invisible in the
    // UI, which renders the pair either way round.
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
}

interface TopServiceOut {
  service_id: number;
  service_name: string;
  service_name_en: string;
  count: number;
  revenue: string;
}

function topServices(rows: BookingRow[], limit: number): TopServiceOut[] {
  const byService = new Map<number, { minor: number; count: number }>();
  for (const row of rows) {
    if (row.status !== 'completed') continue;
    const bucket = byService.get(row.service_id) ?? { minor: 0, count: 0 };
    bucket.minor += toMinor(row.price_at_booking);
    bucket.count += 1;
    byService.set(row.service_id, bucket);
  }
  return [...byService.entries()]
    .map(([serviceId, bucket]) => {
      const service = serviceById(serviceId);
      return {
        service_id: serviceId,
        service_name: service?.name ?? '',
        service_name_en: service?.name_en ?? '',
        count: bucket.count,
        revenue: seriesMoney(bucket.minor),
      };
    })
    .sort((left, right) => right.count - left.count || left.service_id - right.service_id)
    .slice(0, limit);
}

interface TopBarberOut {
  barber_id: number;
  first_name: string;
  last_name: string;
  count: number;
  revenue: string;
}

function topBarbers(rows: BookingRow[], limit: number): TopBarberOut[] {
  const byBarber = new Map<number, { minor: number; count: number }>();
  for (const row of rows) {
    if (row.status !== 'completed') continue;
    const bucket = byBarber.get(row.barber_id) ?? { minor: 0, count: 0 };
    bucket.minor += toMinor(row.price_at_booking);
    bucket.count += 1;
    byBarber.set(row.barber_id, bucket);
  }
  return [...byBarber.entries()]
    .map(([barberId, bucket]) => {
      const user = userById(barberById(barberId)?.user_id);
      return {
        barber_id: barberId,
        first_name: user?.first_name ?? '',
        last_name: user?.last_name ?? '',
        count: bucket.count,
        revenue: seriesMoney(bucket.minor),
      };
    })
    // A barber with no completed booking in the window does not appear at all.
    .sort((left, right) => right.count - left.count || left.barber_id - right.barber_id)
    .slice(0, limit);
}

register(
  'GET',
  '/admin/analytics/summary/',
  (request) => {
    const [from, to] = parseRange(request);
    return summaryPayload(bookingsInRange(from, to, parseBarberId(request)), from, to);
  },
  { auth: ADMIN_ONLY },
);

register(
  'GET',
  '/admin/analytics/revenue/',
  (request) => {
    const [from, to] = parseRange(request);
    return revenueSeries(bookingsInRange(from, to, parseBarberId(request)));
  },
  { auth: ADMIN_ONLY },
);

register(
  'GET',
  '/admin/analytics/bookings-by-status/',
  (request) => {
    const [from, to] = parseRange(request);
    return statusBreakdown(bookingsInRange(from, to, parseBarberId(request)));
  },
  { auth: ADMIN_ONLY },
);

register(
  'GET',
  '/admin/analytics/top-services/',
  (request) => {
    const [from, to] = parseRange(request);
    const limit = parseLimit(request);
    return topServices(bookingsInRange(from, to, parseBarberId(request)), limit);
  },
  { auth: ADMIN_ONLY },
);

register(
  'GET',
  '/admin/analytics/top-barbers/',
  (request) => {
    const [from, to] = parseRange(request);
    const limit = parseLimit(request);
    // `?barber_id=` is deliberately NOT read here: the view calls the base
    // queryset without it, so filtering to one barber and then ranking barbers
    // would answer a question nobody asked.
    return topBarbers(bookingsInRange(from, to, null), limit);
  },
  { auth: ADMIN_ONLY },
);

register(
  'GET',
  '/admin/analytics/barber/:barberId/',
  (request) => {
    // The URL pattern upstream captures digits only, so a non-numeric segment
    // 404s at the resolver. Here `Number('x')` is NaN, the lookup misses, and
    // the handler answers the same 404 — the query string, meanwhile, lands
    // after this path's trailing slash like any other.
    const barber = barberById(Number(request.path.barberId));
    // No active/inactive filter: a deactivated barber's history stays readable.
    if (!barber) throw notFound();

    const [from, to] = parseRange(request);
    const rows = bookingsInRange(from, to, barber.id);
    const user = userById(barber.user_id);
    return {
      barber_id: barber.id,
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      summary: summaryPayload(rows, from, to),
      revenue: revenueSeries(rows),
      by_status: statusBreakdown(rows),
      // Hard-coded 10 here, not the `?limit=` param.
      top_services: topServices(rows, 10),
    };
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  4.1 The analytics workbook
// --------------------------------------------------------------------------- //

/**
 * `f"{round(float(rate) * 100, 2)}%"`.
 *
 * Python prints a float, so a whole number keeps its `.0`: `75.0%`, not `75%`.
 * `String(75)` would drop it and that column would look hand-edited beside the
 * rows that kept theirs.
 */
function percentCell(rate: number): string {
  const value = roundHalfEven(rate * 100, 2);
  return `${Number.isInteger(value) ? `${value}.0` : String(value)}%`;
}

function barberLabel(barberId: number): string {
  const user = userById(barberById(barberId)?.user_id);
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
}

/** A header row: the kernel's `header` style on every label. */
function headerRow(labels: string[]): Row {
  return labels.map((label) => styled(label, 'header'));
}

/**
 * openpyxl's autosize on these sheets is `max(12, min(longest + 2, 40))`,
 * narrower than the two row exports' `[10, 50]`; `xlsx.ts` takes the clamp per
 * sheet, so the whole workbook is built with this one.
 */
const ANALYTICS_WIDTHS: readonly [number, number] = [12, 40];

function summarySheet(name: string, summary: AnalyticsSummary, note: string | null): SheetInput {
  const rows: Row[] = [
    [styled('Nabadi Barbershop — Analytics', 'title')],
    [`Range: ${summary.date_from} → ${summary.date_to}`],
    // Row 3 is the barber note in per-barber mode and blank otherwise, which is
    // what keeps the label/value block at A4:B13 in both.
    note === null ? [] : [styled(note, 'note')],
    [styled('Total bookings', 'label'), summary.total_bookings],
    [styled('Completed', 'label'), summary.completed_bookings],
    [styled('Cancelled', 'label'), summary.cancelled_bookings],
    [styled('No-show', 'label'), summary.no_show_bookings],
    [styled('Completion rate', 'label'), percentCell(summary.completion_rate)],
    [styled('Cancellation rate', 'label'), percentCell(summary.cancellation_rate)],
    [styled('No-show rate', 'label'), percentCell(summary.no_show_rate)],
    // Written as the 2-dp **string**, not as a number: openpyxl stores what the
    // serializer produced and Excel shows it left-aligned as text.
    [styled('Revenue (GEL)', 'label'), summary.revenue_completed],
    [styled('Average ticket (GEL)', 'label'), summary.avg_ticket_size],
    [styled('Unique customers', 'label'), summary.unique_customers],
  ];
  return { name, rows };
}

function revenueSheet(series: RevenuePointOut[]): SheetInput {
  return {
    name: 'Daily revenue',
    rows: [
      headerRow(['Date', 'Bookings completed', 'Revenue (GEL)']),
      // The revenue column is a real number here, unlike the summary sheet's
      // string, so a chart a reader builds over it works.
      ...series.map((point): Row => [point.date, point.count, Number(point.revenue)]),
    ],
  };
}

function statusSheet(rows: StatusRowOut[]): SheetInput {
  return {
    name: 'By status',
    rows: [
      headerRow(['Status', 'Count']),
      // The raw enum value, e.g. `completed` — not the human label.
      ...rows.map((row): Row => [row.status, row.count]),
    ],
  };
}

function topServicesSheet(rows: TopServiceOut[]): SheetInput {
  return {
    name: 'Top services',
    rows: [
      headerRow(['Service (KA)', 'Service (EN)', 'Bookings', 'Revenue (GEL)']),
      ...rows.map(
        (row): Row => [row.service_name, row.service_name_en, row.count, Number(row.revenue)],
      ),
    ],
  };
}

function topBarbersSheet(rows: TopBarberOut[]): SheetInput {
  return {
    name: 'Top barbers',
    rows: [
      headerRow(['Barber', 'Bookings', 'Revenue (GEL)']),
      ...rows.map(
        (row): Row => [
          `${row.first_name} ${row.last_name}`.trim(),
          row.count,
          Number(row.revenue),
        ],
      ),
    ],
  };
}

/**
 * `_all_barber_summaries`: **every** barber, active and inactive, ordered
 * `display_order, id`, so a barber with no bookings in the window shows up as a
 * row of zeros rather than vanishing. That is the sheet's whole purpose — a
 * manager reading it wants to see the quiet chair.
 */
function allBarbersSheet(from: DateKey, to: DateKey): SheetInput {
  const barbers = [...store.barbers].sort(
    (left, right) => left.display_order - right.display_order || left.id - right.id,
  );
  return {
    name: 'All barbers detail',
    rows: [
      headerRow([
        'Barber',
        'Total',
        'Completed',
        'Cancelled',
        'No-show',
        'Completion %',
        'Revenue (GEL)',
        'Avg ticket (GEL)',
        'Unique customers',
      ]),
      ...barbers.map((barber): Row => {
        const summary = summaryPayload(bookingsInRange(from, to, barber.id), from, to);
        return [
          barberLabel(barber.id),
          summary.total_bookings,
          summary.completed_bookings,
          summary.cancelled_bookings,
          summary.no_show_bookings,
          percentCell(summary.completion_rate),
          Number(summary.revenue_completed),
          Number(summary.avg_ticket_size),
          summary.unique_customers,
        ];
      }),
    ],
  };
}

register(
  'GET',
  '/admin/analytics/export-xlsx/',
  (request) => {
    const [from, to] = parseRange(request);

    // The export resolves `barber_id` differently from every JSON endpoint
    // above: a non-empty value that is not a real barber — including a
    // non-numeric one — is a 404 rather than "no filter". Reproduced because
    // the audit row below depends on the order.
    const rawBarberId = (request.params.barber_id ?? '').trim();
    let barberId: number | null = null;
    if (rawBarberId) {
      if (!/^[+-]?\d+$/.test(rawBarberId) || !barberById(Number(rawBarberId))) throw notFound();
      barberId = Number(rawBarberId);
    }

    // Written only after the 404 check, so a failed export leaves no trace —
    // the audit log records exports that happened, not ones that were asked for.
    writeAudit(request, 'analytics.export', 'analytics', null, {
      date_from: from,
      date_to: to,
      barber_id: barberId,
    });

    const rows = bookingsInRange(from, to, barberId);
    const summary = summaryPayload(rows, from, to);

    const sheets: SheetInput[] =
      barberId === null
        ? [
            summarySheet('Summary', summary, null),
            revenueSheet(revenueSeries(rows)),
            statusSheet(statusBreakdown(rows)),
            topServicesSheet(topServices(rows, 20)),
            topBarbersSheet(topBarbers(rows, 20)),
            allBarbersSheet(from, to),
          ]
        : [
            summarySheet(
              // Excel refuses a sheet name over 31 characters and openpyxl
              // raises rather than truncating; upstream's
              // `label[:25] + " — Summary"` can reach 35, so the final name is
              // clipped here. The label is still the barber's, which is what
              // the sheet is for.
              `${barberLabel(barberId).slice(0, 25)} — Summary`.slice(0, 31),
              summary,
              `Barber: ${barberLabel(barberId)}`,
            ),
            revenueSheet(revenueSeries(rows)),
            statusSheet(statusBreakdown(rows)),
            topServicesSheet(topServices(rows, 20)),
          ];

    const filename =
      barberId === null
        ? `analytics_overall_${from}_${to}.xlsx`
        : `analytics_barber_${barberId}_${from}_${to}.xlsx`;

    // `demo/xlsx.ts` + `demo/zip.ts`, the same writer the two row exports use.
    // A `number` cell becomes a real number and a `string` stays text, which is
    // the distinction the summary sheet turns on: `revenue_completed` and
    // `avg_ticket_size` are written as the serializer's 2-dp **strings**, while
    // the daily-revenue column is a `Number(...)` a reader can chart.
    return file(
      workbook({ sheets: sheets.map((sheet) => ({ ...sheet, widths: ANALYTICS_WIDTHS })) }),
      filename,
    );
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  5. Site settings — `views/cms.py::AdminSiteSettingViewSet`
//
//  Upstream splits read from write (`_ReadStaff_WriteFeature("manage_settings")`);
//  with `admin` the only console role the GET and the three writes gate alike.
// --------------------------------------------------------------------------- //

interface SiteSettingOut {
  id: number;
  key: string;
  value: unknown;
  description: string;
  updated_at: IsoDateTime;
}

function serializeSetting(row: SiteSettingRow): SiteSettingOut {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    description: row.description,
    updated_at: row.updated_at,
  };
}

register(
  'GET',
  '/admin/settings/',
  (request) =>
    // `Meta.ordering = ["key"]`, and no filter backend: `?ordering=`, `?search=`
    // and `?key=` are all ignored. The Settings page reads every page and
    // indexes the result by key, so `next` has to be a real URL.
    paginate(
      [...store.site_settings].sort((left, right) => left.key.localeCompare(right.key, 'ka')),
      request,
      serializeSetting,
    ),
  { auth: ADMIN_ONLY },
);

register(
  'POST',
  '/admin/settings/',
  (request) => {
    const body = bodyOf(request);
    const key = readText(body.key, 'key', 80).trim();
    if (!key) throw validationError('key');
    if (store.site_settings.some((entry) => entry.key === key)) throw validationError('key');

    // `value` has `default=dict` on the model and no validation of any kind on
    // the serializer: an object, an array, a string, a number, a boolean or
    // JSON null are all stored verbatim. `Settings.tsx` round-trips a string
    // for `business_phone`, an object for `business_address`/`social_links`, a
    // number for the four booking knobs and a boolean for the SMS switch.
    const value = has(body, 'value') ? body.value : {};
    const description = has(body, 'description')
      ? readText(body.description, 'description', 255)
      : '';

    const row: SiteSettingRow = {
      id: nextId('site_settings'),
      key,
      value,
      description,
      updated_at: nowIso(),
    };
    store.site_settings.push(row);

    const payload: Record<string, unknown> = { key };
    if (has(body, 'value')) payload.value = value;
    if (has(body, 'description')) payload.description = description;
    writeAudit(request, 'site_setting.create', 'site_setting', row.id, payload);
    return serializeSetting(row);
  },
  { auth: ADMIN_ONLY },
);

register(
  'PATCH',
  '/admin/settings/:id/',
  (request) => {
    const row = store.site_settings.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    const body = bodyOf(request);
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    // `key` is not editable through this path. The serializer upstream would
    // accept a rename; `routes.md` §7 pins it shut, and nothing in the console
    // sends one — a renamed `sms_notifications_enabled` would silently
    // re-enable SMS with no visible cause.
    if (has(body, 'value') && !sameJson(row.value, body.value)) {
      changes.value = { old: row.value, new: body.value };
      row.value = body.value;
    }
    if (has(body, 'description')) {
      const description = readText(body.description, 'description', 255);
      if (description !== row.description) {
        changes.description = { old: row.description, new: description };
        row.description = description;
      }
    }
    row.updated_at = nowIso();

    // No cache to clear: `settings_helpers`' 30-second per-process cache has no
    // analogue here, so `getSetting()` reads the row on its next call and the
    // booking knobs take effect on the very next request.
    writeAudit(request, 'site_setting.update', 'site_setting', row.id, { changes });
    return serializeSetting(row);
  },
  { auth: ADMIN_ONLY },
);

register(
  'DELETE',
  '/admin/settings/:id/',
  (request) => {
    const row = store.site_settings.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    // Deleting a booking knob restores its static Django default (15/30/60/2)
    // and deleting `sms_notifications_enabled` re-enables SMS, because
    // `getSetting()` reads an absent row as "unset" rather than as "off".
    const snapshot = serializeSetting(row);
    store.site_settings.splice(store.site_settings.indexOf(row), 1);
    writeAudit(request, 'site_setting.delete', 'site_setting', snapshot.id, { snapshot });
    return undefined;
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  6. Landing CMS — `views/cms.py::AdminLandingViewSet`
//
//  A list route that returns an object and a detail PATCH whose pk is a lie:
//  `LandingContent.save()` forces `pk = 1`, so the table can never hold a second
//  row and the console's hard-coded `/admin/landing/1/` is always right.
// --------------------------------------------------------------------------- //

interface LandingOut {
  hero_heading_ka: string;
  hero_heading_en: string;
  hero_subheading_ka: string;
  hero_subheading_en: string;
  hero_image_url: string;
  about_text_ka: string;
  about_text_en: string;
  gallery_image_urls: unknown;
  featured_review_ids: number[];
  updated_at: IsoDateTime;
}

/** The text columns and their `max_length`, in serializer declaration order. */
const LANDING_TEXT_FIELDS: Array<[keyof LandingOut, number]> = [
  ['hero_heading_ka', 255],
  ['hero_heading_en', 255],
  ['hero_subheading_ka', 500],
  ['hero_subheading_en', 500],
  ['hero_image_url', 500],
  // `TextField` — no length limit upstream.
  ['about_text_ka', Number.POSITIVE_INFINITY],
  ['about_text_en', Number.POSITIVE_INFINITY],
];

/**
 * The M2M read, ordered by `Review.Meta.ordering = ["-created_at"]` rather than
 * by the order the ids were saved in — a related manager sorts by the *related*
 * model's ordering, and the CMS picker renders them in that order.
 *
 * Unpublished ids survive here. Unpublishing a featured review does not touch
 * the singleton (the write path is the only place publication is checked), so
 * the console shows the stranded selection and `GET /landing/` filters it out
 * at read time. That asymmetry is upstream's, and it is what lets an admin
 * re-publish without re-picking.
 */
function featuredReviewIds(): number[] {
  return store.landing_content.featured_reviews
    .map((id) => store.reviews.find((review) => review.id === id))
    .filter((review): review is ReviewRow => review !== undefined)
    .sort((left, right) => parseIso(right.created_at) - parseIso(left.created_at))
    .map((review) => review.id);
}

function serializeLanding(): LandingOut {
  const row = store.landing_content;
  return {
    hero_heading_ka: row.hero_heading_ka,
    hero_heading_en: row.hero_heading_en,
    hero_subheading_ka: row.hero_subheading_ka,
    hero_subheading_en: row.hero_subheading_en,
    // The raw stored path, never `mediaUrl()`: the CMS edits this string in a
    // text input and PATCHes it back, so qualifying it here would write an
    // absolute URL into the column on the next save.
    hero_image_url: row.hero_image_url,
    about_text_ka: row.about_text_ka,
    about_text_en: row.about_text_en,
    gallery_image_urls: row.gallery_image_urls,
    featured_review_ids: featuredReviewIds(),
    updated_at: row.updated_at,
  };
}

// `id` is deliberately absent from the payload — the serializer does not expose
// it, and the console never needs it because the pk is a constant.
register('GET', '/admin/landing/', () => serializeLanding(), { auth: ADMIN_ONLY });

register(
  'PATCH',
  '/admin/landing/:id/',
  (request) => {
    // The capture is never read. `routes.md` §10 is explicit: register the
    // pattern, ignore the pk, never register `/admin/landing/1/` literally.
    const row = store.landing_content;
    const body = bodyOf(request);
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const [field, maxLength] of LANDING_TEXT_FIELDS) {
      if (!has(body, field)) continue;
      const value = readText(body[field], field, maxLength);
      const previous = row[field as keyof typeof row] as string;
      if (value === previous) continue;
      changes[field] = { old: previous, new: value };
      // Every one of these columns is a plain string on the row.
      (row as unknown as Record<string, unknown>)[field] = value;
    }

    if (has(body, 'gallery_image_urls')) {
      // A validation gap to reproduce, not to fix: `gallery_image_urls` is a
      // plain `JSONField` on the serializer and `LandingContent.clean()` —
      // which would require a list — is never called by DRF. So
      // `PATCH {"gallery_image_urls": "oops"}` succeeds upstream and stores the
      // string, and it succeeds here too.
      const value = body.gallery_image_urls;
      if (!sameJson(row.gallery_image_urls, value)) {
        changes.gallery_image_urls = { old: row.gallery_image_urls, new: value };
        row.gallery_image_urls = value as string[];
      }
    }

    if (has(body, 'featured_review_ids')) {
      const raw = body.featured_review_ids;
      if (!Array.isArray(raw)) throw validationError('featured_review_ids');
      const ids: number[] = [];
      for (const entry of raw) {
        const id = typeof entry === 'number' ? entry : Number(entry);
        const review = store.reviews.find((candidate) => candidate.id === id);
        // `PrimaryKeyRelatedField(queryset=Review.objects.filter(is_published=True))`:
        // an unpublished or unknown id is `does_not_exist`, which is not a
        // registry code, so it degrades to `validation_error` on this field.
        if (!review || !review.is_published) throw validationError('featured_review_ids');
        ids.push(id);
      }
      const before = [...row.featured_reviews].sort((left, right) => left - right);
      const after = [...ids].sort((left, right) => left - right);
      if (!sameJson(before, after)) {
        // Keyed by the **model** field name, because the diff reads
        // `validated_data`, which uses the serializer field's `source`. M2M
        // values are sorted id arrays on both sides.
        changes.featured_reviews = { old: before, new: after };
      }
      row.featured_reviews = ids;
    }

    row.updated_at = nowIso();
    // An audit row is written even when nothing moved — a no-op `PATCH {}`
    // still records that someone opened the CMS and pressed Save.
    writeAudit(request, 'landing.update', 'landing_content', row.id, { changes });
    return serializeLanding();
  },
  { auth: ADMIN_ONLY },
);

// --------------------------------------------------------------------------- //
//  7. Notification templates — `views/notifications.py`, `IsAdmin` on every
//  route, `preview` and `test-send` included.
//
//  The console can edit the 16 seeded rows and can neither add nor remove one,
//  so only the list, the PATCH and the two actions are registered.
// --------------------------------------------------------------------------- //

interface TemplateOut {
  id: number;
  key: string;
  channel: string;
  language: string;
  subject: string;
  body: string;
  is_active: boolean;
  updated_at: IsoDateTime;
}

function serializeTemplate(row: NotificationTemplateRow): TemplateOut {
  return {
    id: row.id,
    key: row.key,
    channel: row.channel,
    language: row.language,
    subject: row.subject,
    body: row.body,
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

register(
  'GET',
  '/admin/notification-templates/',
  (request) =>
    // `Meta.ordering = ["key", "channel", "language"]`. All 16 rows fit on one
    // page; the console still walks `next`, so the envelope has to be honest.
    paginate(
      [...store.notification_templates].sort(
        (left, right) =>
          left.key.localeCompare(right.key) ||
          left.channel.localeCompare(right.channel) ||
          left.language.localeCompare(right.language),
      ),
      request,
      serializeTemplate,
    ),
  { auth: ADMIN_ONLY },
);

register(
  'PATCH',
  '/admin/notification-templates/:id/',
  (request) => {
    const row = store.notification_templates.find((entry) => entry.id === Number(request.path.id));
    if (!row) throw notFound();

    const body = bodyOf(request);
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (has(body, 'subject')) {
      // An SMS row has no subject line to send and the editor does not render
      // the field for one, so it stays `""` whatever arrives (`routes.md` §7).
      const subject = row.channel === 'sms' ? '' : readText(body.subject, 'subject', 255);
      if (subject !== row.subject) {
        changes.subject = { old: row.subject, new: subject };
        row.subject = subject;
      }
    }
    if (has(body, 'body')) {
      const text = typeof body.body === 'string' ? body.body : '';
      // `TextField` with `blank=False`: a template with no body would render an
      // empty SMS and log it as delivered.
      if (!text.trim()) throw validationError('body');
      if (text !== row.body) {
        changes.body = { old: row.body, new: text };
        row.body = text;
      }
    }
    if (has(body, 'is_active')) {
      const isActive = readBoolean(body.is_active, 'is_active');
      if (isActive !== row.is_active) {
        changes.is_active = { old: row.is_active, new: isActive };
        row.is_active = isActive;
      }
    }

    row.updated_at = nowIso();
    writeAudit(request, 'notification_template.update', 'notification_template', row.id, {
      changes,
    });
    return serializeTemplate(row);
  },
  { auth: ADMIN_ONLY },
);

/**
 * `sample_context()` — a **static** dict, so a preview reads the same all day.
 * `booking_id` is an int upstream and a string here only because
 * `renderTemplate` interpolates strings; the rendered output is identical.
 */
const SAMPLE_CONTEXT: Record<string, string> = {
  customer_first_name: 'Nika',
  customer_phone: '+995555111222',
  barber_first_name: 'Giorgi',
  barber_last_name: 'Beridze',
  service_name: 'Classic haircut',
  start_at: '2026-05-10 14:00',
  start_at_local: '2026-05-10 14:00',
  price: '30.00',
  booking_id: '42',
};

/** `test_send_context()` — the same, with a live time: tomorrow at 14:00 Tbilisi. */
function testSendContext(): Record<string, string> {
  const day = shiftDayKey(todayKey(), 1);
  return {
    ...SAMPLE_CONTEXT,
    start_at: toApiDateTime(instantAt(day, '14:00:00')),
    // `strftime("%Y-%m-%d %H:%M")`, shop-local.
    start_at_local: `${day} 14:00`,
  };
}

/**
 * Django raises `TemplateSyntaxError` on an unclosed `{{` or an unknown block
 * tag. `store.renderTemplate` is a `{{ var }}` substituter with no tag support
 * at all, so nothing inside it can raise — but a template reaching for a tag
 * would render the tag as literal text, which reads as a broken template rather
 * than as an invalid one.
 *
 * Detected here so the two cases stay distinguishable. **`routes.md` pins the
 * failure body as a non-standard `{"error": string}` 400** — the one route in
 * the mock that does not use the three-key envelope — and `base.ts` offers no
 * way to emit a body that is not that envelope, so this raises the standard
 * `validation_error` on `body` instead. The divergence is invisible to both
 * front ends: the seam rebuilds `ApiError` from `status`/`code`/`message`/`field`
 * and never reads the raw body.
 */
function templateSyntaxProblem(text: string): boolean {
  if (/\{%/.test(text)) return true;
  const opens = (text.match(/\{\{/g) ?? []).length;
  const closes = (text.match(/\}\}/g) ?? []).length;
  return opens !== closes;
}

// A literal segment beats a capture, so `preview` and `:id` coexist without any
// ordering game — the router resolves on literal count, not registration order.
register(
  'POST',
  '/admin/notification-templates/preview/',
  (request) => {
    const body = bodyOf(request);
    const text = typeof body.body === 'string' ? body.body : '';
    if (!text.trim()) throw validationError('body');
    const subject = has(body, 'subject') ? readText(body.subject, 'subject', 255) : '';

    if (templateSyntaxProblem(text) || templateSyntaxProblem(subject)) {
      throw validationError('body');
    }
    // Renders arbitrary unsaved text — the editor previews what is in the
    // textarea, not what is in the store. No audit row: nothing was written.
    return renderTemplate({ subject, body: text }, SAMPLE_CONTEXT);
  },
  { auth: ADMIN_ONLY },
);

register(
  'POST',
  '/admin/notification-templates/:id/test-send/',
  (request) => {
    // 1. The row, before anything is validated.
    const template = store.notification_templates.find(
      (entry) => entry.id === Number(request.path.id),
    );
    if (!template) throw notFound();

    // 2. The recipient, validated against the *template's* channel. A rejected
    //    recipient writes no audit row: nothing was attempted.
    const body = bodyOf(request);
    const raw = typeof body.recipient === 'string' ? body.recipient.trim() : '';
    if (!raw) throw validationError('recipient');

    let recipient: string;
    if (template.channel === 'sms') {
      const normalized = normalizePhone(raw);
      // `phone_invalid` raised somewhere other than its usual `phone` field —
      // one of the four documented `FIELD_TABLE` overrides.
      if (!normalized) throw fail('phone_invalid', 'recipient');
      recipient = normalized;
    } else {
      if (!/^\S+@\S+\.\S+$/.test(raw)) throw validationError('recipient');
      recipient = raw;
    }

    const auditPayload: Record<string, unknown> = {
      template_id: template.id,
      key: template.key,
      channel: template.channel,
      language: template.language,
      recipient,
      success: true,
    };

    // 3. The kill switch, and the only endpoint in the API that raises
    //    `sms_disabled`. A booking write never does — it just stays quiet on
    //    the SMS channel. The refusal is still audited, because an admin who
    //    pressed Send deserves a trail whether or not anything was sent.
    if (template.channel === 'sms' && !smsNotificationsEnabled()) {
      writeAudit(request, 'notification.test_send', 'notification_template', template.id, {
        ...auditPayload,
        success: false,
        error: 'sms_disabled',
      });
      throw fail('sms_disabled');
    }

    // 4-5. Render the **saved** row and "deliver" it. There is no gateway to
    //      fail, so `success` is always true and upstream's 502
    //      `test_send_failed` branch is unreachable here.
    const rendered = renderTemplate(template, testSendContext());
    store.notification_logs.push({
      id: nextId('notification_logs'),
      // A test send belongs to no booking, which is why the column is nullable.
      booking_id: null,
      template_key: template.key,
      channel: template.channel,
      language: template.language,
      recipient,
      subject: rendered.subject,
      body: rendered.body,
      success: true,
      error: '',
      created_at: nowIso(),
    });

    // 6. The audit row, written for both outcomes.
    writeAudit(
      request,
      'notification.test_send',
      'notification_template',
      template.id,
      auditPayload,
    );

    return {
      // `gettext` with no `LocaleMiddleware` installed: always English.
      detail: `Test message sent to ${recipient}.`,
      rendered:
        template.channel === 'email'
          ? { subject: rendered.subject, body: rendered.body }
          : // No `subject` key at all on an SMS reply — the dialog tests for the
            // key's presence, not for a non-empty string.
            { body: rendered.body },
    };
  },
  { auth: ADMIN_ONLY },
);
