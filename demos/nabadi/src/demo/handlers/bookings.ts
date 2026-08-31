/**
 * `/bookings/*` — the customer's own booking surface.
 *
 * A port of `apps/bookings/views.py`: create, the two `/me/` reads and the
 * customer's own cancel. Staff drive a booking's lifecycle from the console's
 * own prefix instead, `/admin/bookings/:id/complete|no-show/`.
 *
 * Four routes, three of the product's load-bearing rules:
 *
 * - **Placement.** Every "can this booking go here" question goes through
 *   `slotProblem()`, which is the same engine `/barbers/:id/availability/` uses
 *   to decide what to *offer*. A second implementation here would eventually
 *   disagree by a minute and the wizard would offer a slot the POST refuses,
 *   which is the worst thing a booking flow can do.
 * - **The status matrix.** These endpoints do not use the admin PATCH's
 *   `is_valid_status_transition` — they use the stricter rule the dedicated
 *   views carry: the source status must be **active** (`pending`/`confirmed`).
 *   `cancelled`, `completed` and `no_show` are terminal here. The one exception
 *   is cancelling an already-`cancelled` booking, which is an idempotent 204.
 * - **The cancellation window.** A customer may cancel only up to
 *   `start_at - cancellation_window_hours` (default 2). Staff bypass it through
 *   `DELETE /admin/bookings/:id/`, which carries no window check at all. A
 *   consequence worth knowing: an elapsed but still-`pending` booking can never
 *   be cancelled by its customer, because its deadline is already behind.
 *
 * What this module deliberately does **not** do: write audit rows. Audit
 * logging is admin-side only upstream, so no route here writes one — create and
 * cancel leave notification logs and nothing else.
 */

import {
  CLOCK,
  MINUTE,
  bodyOf,
  fail,
  fromMinor,
  instantAt,
  notAuthenticated,
  nowIso,
  parseIso,
  toApiDateTime,
  toMinor,
  validationError,
} from '../base';
import { newestFirst, oldestFirst, paginate } from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import {
  applyPromotion,
  barberName,
  canCancel,
  cancellableUntil,
  linkDuration,
  linkPrice,
  mediaUrl,
  promotionRedeemable,
} from '../serialize';
import { slotProblem } from '../availability';
import {
  barberById,
  barberServiceFor,
  bookingById,
  duplicatesActiveBooking,
  logNotification,
  nextId,
  overlapsExistingBooking,
  promotionByCode,
  serviceById,
  store,
} from '../store';
import { ACTIVE_BOOKING_STATUSES } from '../types';
import type { BookingRow, BookingStatus, IsoDateTime, Money, UserRow } from '../types';

// --------------------------------------------------------------------------- //
//  Small shared pieces
// --------------------------------------------------------------------------- //

/**
 * The signed-in row, narrowed. The gate has already refused an anonymous
 * request on every route here, so the throw is unreachable — it exists because
 * `DemoRequest.user` is nullable for the `'public'` routes and TypeScript is
 * right to insist.
 */
function actor(request: DemoRequest): UserRow {
  if (!request.user) throw notAuthenticated();
  return request.user;
}

/** `ACTIVE_STATUSES` — the two that reserve the chair and arm both constraints. */
function isActive(status: BookingStatus): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

/**
 * A JSON body as a bag of fields. A non-object body reaches the field readers as
 * an empty bag and fails on the first required key, which is what DRF's
 * `ValidationError` for a missing field collapses to anyway (§2.2: a missing or
 * ill-typed field never produces a domain code, only `validation_error` with the
 * field name preserved).
 */
/** `IntegerField(required=True)` — DRF coerces a numeric string, so this does too. */
function requiredInt(body: Record<string, unknown>, key: string): number {
  const raw = body[key];
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) return Number(raw.trim());
  throw validationError(key);
}

/**
 * `DateTimeField(required=True)`, as an instant.
 *
 * DRF's `enforce_timezone` reads a **naive** datetime in the current default
 * zone — Asia/Tbilisi for this backend, not the visitor's. `Date.parse` would
 * read it in the browser's, so a naive string from a Los Angeles tab would land
 * the appointment twelve hours out. Both front ends always send an offset, so
 * the naive branch is a guard rather than a path.
 */
function requiredInstant(body: Record<string, unknown>, key: string): number {
  const raw = body[key];
  if (typeof raw !== 'string') throw validationError(key);
  const text = raw.trim();
  const naive = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(text);
  const at = naive ? instantAt(naive[1], naive[2]) : parseIso(text);
  if (!Number.isFinite(at)) throw validationError(key);
  return at;
}

/**
 * `CharField(required=False, allow_blank=True)` — absent and null both mean `""`.
 *
 * `admin-catalog.ts` has one of these too and it is a different function: that
 * one takes the fallback from the caller and stringifies a number. Same name,
 * two serializers; neither is the other's default.
 */
function optionalText(body: Record<string, unknown>, key: string): string {
  const raw = body[key];
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw validationError(key);
  return raw;
}

// --------------------------------------------------------------------------- //
//  The two output shapes
//
//  A booking is serialised three ways and each shape lives with the endpoints
//  that send it; `serialize.ts` carries only what all three need. These are two
//  of the three — the admin shape belongs to `admin-bookings.ts`.
// --------------------------------------------------------------------------- //

/**
 * `BookingOutSerializer` — what the customer site reads, declared as
 * `BookingItem` in `customer/features/booking/hooks.ts:65-83`.
 *
 * The last two keys are the interesting ones. Upstream does not send them; the
 * front end declares them optional and, when they are present, hides the Cancel
 * button the moment the window closes instead of letting the visitor discover
 * the rule by being refused. `serialize.ts` exports the pair precisely so this
 * module can answer them, so they are sent.
 */
interface BookingOut {
  id: number;
  barber: number;
  barber_name: string;
  service: number;
  service_name: string;
  service_name_en: string;
  service_image: string | null;
  service_icon_key: string;
  start_at: IsoDateTime;
  end_at: IsoDateTime;
  price_at_booking: Money;
  status: BookingStatus;
  notes: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  can_cancel: boolean;
  cancellable_until: IsoDateTime;
}

function serializeBooking(row: BookingRow): BookingOut {
  const service = serviceById(row.service_id);
  return {
    id: row.id,
    barber: row.barber_id,
    barber_name: barberName(barberById(row.barber_id)),
    service: row.service_id,
    service_name: service?.name ?? '',
    service_name_en: service?.name_en ?? '',
    service_image: mediaUrl(service?.image),
    service_icon_key: service?.icon_key ?? '',
    start_at: row.start_at,
    end_at: row.end_at,
    price_at_booking: row.price_at_booking,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    can_cancel: canCancel(row, CLOCK.now()),
    cancellable_until: cancellableUntil(row),
  };
}

// --------------------------------------------------------------------------- //
//  POST /bookings/ — the demo's centrepiece
// --------------------------------------------------------------------------- //

/**
 * Nine ordered checks, and **only the first failure is ever reported** — the
 * exception handler replaces the body wholesale, so there is no per-field dict
 * to carry a second problem. That makes the order the contract, not an
 * implementation detail, and `routes.md` §4 states it:
 *
 * 1. field validation — `barber_id`, `service_id`, `start_at`, in that order
 * 2. `barber_not_active` — a nonexistent barber gets the same code, never a 404
 * 3. `service_not_active`
 * 4. `barber_does_not_offer_service`
 * 5. `lead_time_too_short` — through `slotProblem`
 * 6. `too_far_in_advance` — ”
 * 7. `outside_working_hours` — ”
 * 8. `time_off_overlap` — ”
 * 9. `slot_taken` (409), then `duplicate_active_booking` (409)
 *
 * Two departures from `apps/bookings/serializers.py` worth naming, both taken
 * from the route table:
 *
 * - Upstream runs the **duplicate pre-check at step 5**, before the time rules;
 *   here both constraint predicates sit together after placement. The only input
 *   that can tell the two apart is "same service, at a time that overlaps my own
 *   existing booking with the same barber", which reports `slot_taken` here and
 *   `duplicate_active_booking` upstream — and which the wizard cannot produce,
 *   because it never offers a slot the barber is already in. The behaviour the
 *   test suite pins (same service, *different free time* ⇒
 *   `duplicate_active_booking`, never `slot_taken`) is identical either way.
 * - The promo is resolved **last**, after placement and after both constraints,
 *   so a booking that is going to be refused never burns a use of the code.
 *   Upstream validates the promo before the insert and re-checks it under the
 *   lock; with one thread there is nothing to re-check and nothing to race.
 *
 * `end_at` is always server-computed from the barber's effective duration and
 * `price_at_booking` is a snapshot: a later price edit never rewrites history.
 */
register(
  'POST',
  '/bookings/',
  (request) => {
    const user = actor(request);
    const body = bodyOf(request);
    const barberId = requiredInt(body, 'barber_id');
    const serviceId = requiredInt(body, 'service_id');
    const startAt = requiredInstant(body, 'start_at');
    const notes = optionalText(body, 'notes');
    const promoCode = optionalText(body, 'promo_code').trim();

    const barber = barberById(barberId);
    if (!barber || !barber.is_active) throw fail('barber_not_active');

    const service = serviceById(serviceId);
    if (!service || !service.is_active) throw fail('service_not_active');

    const link = barberServiceFor(barberId, serviceId);
    if (!link) throw fail('barber_does_not_offer_service');

    // Lead time, horizon, working hours, time off — the same intervals the
    // wizard's slot list was built from, so a slot it offered cannot fail here.
    const problem = slotProblem(barberId, serviceId, startAt);
    if (problem) throw fail(problem);

    const candidate = {
      customer_id: user.id,
      barber_id: barberId,
      service_id: serviceId,
      start_at: toApiDateTime(startAt),
      end_at: toApiDateTime(startAt + linkDuration(link) * MINUTE),
      status: 'pending' as const,
    };
    // The two DB constraints, as predicates. Upstream has no overlap query at
    // all and lets the EXCLUDE raise, which is why this is a 409 `slot_taken`
    // and not a 400 alongside the placement codes.
    if (overlapsExistingBooking(candidate)) throw fail('slot_taken');
    if (duplicatesActiveBooking(candidate)) throw fail('duplicate_active_booking');

    let price = linkPrice(link);
    let promotionId: number | null = null;
    if (promoCode) {
      // `code__iexact`, already stripped. `promo_invalid` is the unknown-code
      // answer; the other four come from `is_redeemable_now()` in its own order.
      const promotion = promotionByCode(promoCode);
      if (!promotion) throw fail('promo_invalid');
      const [, refusal] = promotionRedeemable(promotion, CLOCK.now());
      if (refusal) throw fail(refusal);
      price = applyPromotion(promotion, price);
      promotion.uses_count += 1;
      promotion.updated_at = nowIso();
      promotionId = promotion.id;
    }

    const stamp = nowIso();
    const booking: BookingRow = {
      id: nextId('bookings'),
      customer_id: user.id,
      // An account booking, so all three walk-in columns stay `""`. The seed
      // invariant is "either a customer or a walk-in name", never both.
      walk_in_name: '',
      walk_in_phone: '',
      walk_in_email: '',
      barber_id: barberId,
      service_id: serviceId,
      start_at: candidate.start_at,
      end_at: candidate.end_at,
      price_at_booking: price,
      status: 'pending',
      notes,
      promotion_id: promotionId,
      cancellation_reason: '',
      reminder_24h_sent_at: null,
      reminder_1h_sent_at: null,
      cancelled_by_id: null,
      created_at: stamp,
      updated_at: stamp,
    };
    store.bookings.push(booking);

    // `post_save(created=True)` → `on_commit` → the confirmation task. Deferred
    // inside `logNotification`, so it cannot fail the write that caused it.
    logNotification(booking, 'booking_confirmation');
    return serializeBooking(booking);
  },
  { auth: 'any' },
);

// --------------------------------------------------------------------------- //
//  GET /bookings/me/ and /bookings/me/stats/
// --------------------------------------------------------------------------- //

/**
 * The customer's own bookings, one tab per `?status=`.
 *
 * An unrecognised value is not an error and not an empty list — it drops the
 * status filter entirely and returns every row, newest start first, which is
 * upstream's `else` branch. Only an **absent** param means `upcoming`.
 *
 * `upcoming` is the only ascending tab, because it is a queue: the next
 * appointment belongs at the top. It is also the only one that reads the clock,
 * which leaves a documented gap — an elapsed `pending` booking is in no tab at
 * all. That gap is exactly what the stale-booking sweep exists to close, and it
 * runs on every dispatch.
 */
register(
  'GET',
  '/bookings/me/',
  (request) => {
    const user = actor(request);
    const now = CLOCK.now();
    const mine = store.bookings.filter((row) => row.customer_id === user.id);

    const upcoming = (row: BookingRow): boolean =>
      isActive(row.status) && parseIso(row.start_at) > now;
    const startAt = (row: BookingRow): string => row.start_at;

    let rows: BookingRow[];
    switch (request.params.status ?? 'upcoming') {
      case 'upcoming':
        rows = oldestFirst(mine.filter(upcoming), startAt);
        break;
      case 'past':
        rows = newestFirst(
          mine.filter((row) => row.status === 'completed' || row.status === 'no_show'),
          startAt,
        );
        break;
      case 'cancelled':
        rows = newestFirst(
          mine.filter((row) => row.status === 'cancelled'),
          startAt,
        );
        break;
      default:
        rows = newestFirst(mine, startAt);
    }
    return paginate(rows, request, serializeBooking);
  },
  { auth: 'any' },
);

/**
 * The profile header's five numbers, hand-built upstream rather than serialised.
 *
 * `total_bookings` counts **every** status and every date; only
 * `completed_bookings`, `total_spent` and `last_visit_at` are restricted to
 * completed rows, so a customer whose only bookings were cancelled sees
 * `total_spent: "0.00"` and `last_visit_at: null` rather than a blank card.
 *
 * The sum runs in tetri. Accumulating `"45.50"` strings as floats is how a
 * total lands on `150.00000000000003`, and `total_spent` is printed verbatim.
 */
register(
  'GET',
  '/bookings/me/stats/',
  (request) => {
    const user = actor(request);
    const now = CLOCK.now();
    const mine = store.bookings.filter((row) => row.customer_id === user.id);
    const completed = mine.filter((row) => row.status === 'completed');

    let lastVisit: IsoDateTime | null = null;
    for (const row of completed) {
      if (lastVisit === null || parseIso(row.start_at) > parseIso(lastVisit)) {
        lastVisit = row.start_at;
      }
    }

    return {
      total_bookings: mine.length,
      completed_bookings: completed.length,
      upcoming_bookings: mine.filter(
        (row) => isActive(row.status) && parseIso(row.start_at) > now,
      ).length,
      total_spent: fromMinor(
        completed.reduce((total, row) => total + toMinor(row.price_at_booking), 0),
      ),
      last_visit_at: lastVisit,
    };
  },
  { auth: 'any' },
);

// --------------------------------------------------------------------------- //
//  DELETE /bookings/:id/ — the customer's own cancel
// --------------------------------------------------------------------------- //

/**
 * Upstream looks the row up with `get(pk=..., customer=request.user)`, so
 * somebody else's booking and a nonexistent one are literally the same query
 * miss and answer identically: **404 `booking_not_found`**, never a 403. Telling
 * them apart would turn the endpoint into an id oracle.
 *
 * Note the asymmetry with `complete/` below: cancelling an already-cancelled
 * booking is an idempotent 204 that mutates nothing and fires no second
 * notification, while re-completing a completed booking is a 409. That is the
 * shipped pair, not an oversight — a cancel is a request to reach a state, a
 * completion is a record that something happened.
 *
 * There is no admin bypass here. Staff cancel through
 * `DELETE /admin/bookings/:id/`, which carries no window check at all.
 */
register(
  'DELETE',
  '/bookings/:id/',
  (request) => {
    const user = actor(request);
    const booking = bookingById(Number(request.path.id));
    if (!booking || booking.customer_id !== user.id) throw fail('booking_not_found');

    if (booking.status === 'cancelled') return undefined;
    if (!isActive(booking.status)) throw fail('invalid_transition');
    if (CLOCK.now() > parseIso(cancellableUntil(booking))) {
      throw fail('cancellation_window_passed');
    }

    booking.status = 'cancelled';
    booking.cancelled_by_id = user.id;
    booking.updated_at = nowIso();
    // `cancellation_reason` stays `""` — only the admin PATCH can write it.
    logNotification(booking, 'booking_cancellation');
    return undefined;
  },
  { auth: 'any' },
);
