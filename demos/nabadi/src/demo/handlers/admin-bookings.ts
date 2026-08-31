/**
 * `/admin/bookings/`, `/admin/customers/`, `/admin/users/` — the console's
 * people-and-appointments surface, and two of the three XLSX exports.
 *
 * A port of `apps/admin_api/views/{bookings,customers,users}.py` and the
 * serializers beside them. Seventeen routes, one gate: `IsAdmin`. All three
 * surfaces are staff-only and `admin` is the only role that signs into the
 * console, so nothing below is delegated a verb at a time.
 *
 * Two things here are easy to get subtly wrong and expensive to notice:
 *
 * - **Staff placement rules are not the customer's.** Walk-in create and
 *   reschedule call `slotProblem(..., {mode: 'staff'})`, which drops the
 *   minimum-lead and maximum-advance windows and keeps only "not in the past":
 *   a receptionist booking the chair for ten minutes' time is the normal case,
 *   and the wizard's 30-minute lead would refuse it.
 * - **`/admin/customers/` is the one genuinely server-filtered, server-paginated
 *   list in the console.** Its three annotations (`booking_count`,
 *   `last_visit_at`, `total_spent`) are recomputed per row per request, exactly
 *   as the `annotate()` did, and the page is sliced after filtering — a list
 *   that filtered client-side would page over the wrong population.
 *
 * Every mutation writes an audit row. The action vocabulary and the payload
 * shapes are `schema.md` §6.5; `writeAudit()` owns the id, the actor snapshot
 * and the sensitive-key backstop.
 */

import { slotProblem } from '../availability';
import {
  EMAIL_PATTERN,
  MINUTE,
  assertStrongPassword,
  bodyOf,
  fail,
  file,
  fromMinor,
  has,
  normalizePhone,
  nowIso,
  optionalBoolean,
  parseIso,
  toApiDateTime,
  toMinor,
  todayKey,
  validationError,
} from '../base';
import { workbook } from '../xlsx';
import {
  applyDateRange,
  applyFilters,
  applyRelationFilter,
  applySearch,
  newestFirst,
  paginate,
} from '../query';
import { register } from '../router';
import type { DemoRequest } from '../router';
import {
  barberName,
  customerName,
  customerPhone,
  linkDuration,
  linkPrice,
  searchablePhones,
} from '../serialize';
import {
  STAFF_ROLES,
  barberById,
  barberForUser,
  barberServiceFor,
  bookingById,
  duplicatesActiveBooking,
  nextId,
  overlapsExistingBooking,
  serviceById,
  session,
  signOut,
  store,
  userById,
  writeAudit,
} from '../store';
import type {
  BookingRow,
  BookingStatus,
  IsoDateTime,
  Money,
  Role,
  UserRow,
} from '../types';
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUSES } from '../types';

// --------------------------------------------------------------------------- //
//  Reading a request body
//
//  DRF's own field errors are not registry codes: they degrade to
//  `validation_error` with the field preserved, and **only the first one is ever
//  reported** — the exception handler replaces the body wholesale, so a
//  serializer that found three problems still sends one. Everything below
//  therefore raises on the first bad field, in the serializer's declaration
//  order.
// --------------------------------------------------------------------------- //

type Body = Record<string, unknown>;

// `bodyOf`, `has`, `EMAIL_PATTERN` and the boolean reader are `base.ts`'s —
// every handler module wanted the same four, and a `BooleanField` that reads
// `"false"` as true in one module and false in another is the kind of drift
// nobody notices until a deactivation activates.

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
/** `CharField(allow_blank=True)`: a string, or a 400 naming the field. */
function readText(body: Body, key: string): string | undefined {
  if (!has(body, key)) return undefined;
  const value = body[key];
  if (value === null) return '';
  if (typeof value !== 'string') throw validationError(key);
  return value;
}

/**
 * `EmailField(allow_null=True, allow_blank=True)` — falsy stores `null`, which
 * is what keeps the unique index usable: `""` would collide on the second
 * account without an address.
 */
function readEmail(body: Body, key: string): string | null | undefined {
  const text = readText(body, key);
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!EMAIL_PATTERN.test(trimmed)) throw validationError(key);
  return trimmed;
}

/** `IntegerField` — the foreign keys on the walk-in create body. */
function readId(body: Body, key: string): number | null | undefined {
  if (!has(body, key)) return undefined;
  const value = body[key];
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  throw validationError(key);
}

/** `DateTimeField` — epoch ms, or a 400 naming the field. */
function readInstant(body: Body, key: string): number | undefined {
  const text = readText(body, key);
  if (text === undefined) return undefined;
  const at = parseIso(text);
  if (!Number.isFinite(at)) throw validationError(key);
  return at;
}

/** The first key in `required` the body does not carry, in declaration order. */
function requireKeys(body: Body, required: string[]): void {
  for (const key of required) {
    if (!has(body, key) || body[key] === null || body[key] === '') throw validationError(key);
  }
}

// `normalizePhone` and the password stack are `base.ts`'s. Upstream has exactly
// one of each and `LoginSerializer` runs the first before it looks a row up, so
// a create path that normalises differently mints an account nobody can sign in
// as — and a password list that differs by a word makes `/admin/users/` and
// `/auth/register/` disagree about the same string.

// --------------------------------------------------------------------------- //
//  §3 — `/admin/bookings/`
// --------------------------------------------------------------------------- //

interface AdminBookingOut {
  id: number;
  customer: number | null;
  customer_phone: string | null;
  customer_name: string;
  walk_in_name: string;
  walk_in_phone: string;
  walk_in_email: string;
  barber: number;
  barber_name: string;
  service: number;
  service_name: string;
  service_name_en: string;
  start_at: IsoDateTime;
  end_at: IsoDateTime;
  price_at_booking: Money;
  status: BookingStatus;
  notes: string;
  cancellation_reason: string;
  cancelled_by: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * `BookingAdminOutSerializer`. The foreign keys travel as bare names
 * (`customer`, `barber`, `service`) while the create serializer takes `_id`
 * suffixes — a shipped asymmetry the console's own `AdminBooking` interface
 * already encodes, so it is reproduced rather than tidied.
 *
 * `promotion` and the two reminder markers are deliberately absent: the console
 * has no column for either, and the reminder stamps are scheduler bookkeeping.
 */
function serializeAdminBooking(row: BookingRow): AdminBookingOut {
  const service = serviceById(row.service_id);
  return {
    id: row.id,
    customer: row.customer_id,
    customer_phone: customerPhone(row),
    customer_name: customerName(row),
    walk_in_name: row.walk_in_name,
    walk_in_phone: row.walk_in_phone,
    walk_in_email: row.walk_in_email,
    barber: row.barber_id,
    barber_name: barberName(barberById(row.barber_id)),
    service: row.service_id,
    service_name: service?.name ?? '',
    service_name_en: service?.name_en ?? '',
    start_at: row.start_at,
    end_at: row.end_at,
    price_at_booking: row.price_at_booking,
    status: row.status,
    notes: row.notes,
    cancellation_reason: row.cancellation_reason,
    cancelled_by: row.cancelled_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * The six filters, then the fixed `-start_at` ordering. A function rather than
 * two copies because the list and the export must filter identically — an export
 * that disagreed with the screen it was launched from is worse than no export.
 *
 * `customer_phone` is `Q(customer__phone__icontains) | Q(walk_in_phone__icontains)`,
 * the one filter that treats the account number and the walk-in number as a
 * single column, which is what `searchablePhones()` exists for.
 */
function bookingQueryset(request: DemoRequest): BookingRow[] {
  let rows: BookingRow[] = store.bookings.slice();
  rows = applyFilters(rows, request.params, { status: (row) => row.status });
  rows = applyRelationFilter(rows, request.params, 'barber_id', { pk: (row) => row.barber_id });
  rows = applyRelationFilter(rows, request.params, 'service_id', { pk: (row) => row.service_id });
  rows = applySearch(rows, request.params, [searchablePhones], 'customer_phone');
  rows = applyDateRange(rows, request.params, (row) => row.start_at);
  return newestFirst(rows, (row) => row.start_at);
}

register(
  'GET',
  '/admin/bookings/',
  (request) =>
    paginate(bookingQueryset(request), request, serializeAdminBooking, { clientPageSize: true }),
  { auth: ['admin'] },
);

/**
 * `is_valid_status_transition`. Anything an active booking asks for is allowed,
 * a terminal one may only re-assert itself, and `cancelled` may be corrected
 * back to active — the staff un-cancel, which is why this is not the simple
 * "terminal is final" rule it looks like.
 */
function isValidTransition(current: BookingStatus, next: BookingStatus): boolean {
  if (current === next) return true;
  if ((ACTIVE_BOOKING_STATUSES as readonly string[]).includes(current)) return true;
  return current === 'cancelled' && (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(next);
}

function isActiveStatus(status: BookingStatus): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

/** 404 `booking_not_found`, never a bare `not_found` — the console branches on it. */
function bookingOr404(request: DemoRequest): BookingRow {
  const row = bookingById(Number(request.path.id));
  if (!row) throw fail('booking_not_found');
  return row;
}

/**
 * `POST /admin/bookings/` — the walk-in, and the staff-created booking for an
 * account holder.
 *
 * The order below is the serializer's, and only the first failure is ever
 * reported, so the order *is* the contract: identity, barber, service, the link
 * between the two, then placement, then the two database constraints.
 */
register(
  'POST',
  '/admin/bookings/',
  (request) => {
    const body = bodyOf(request);

    // Field-level validation runs before `validate()`, so a malformed `start_at`
    // is reported ahead of "neither a customer nor a walk-in name".
    const customerId = readId(body, 'customer_id') ?? null;
    const walkInName = readText(body, 'walk_in_name') ?? '';
    const walkInPhone = readText(body, 'walk_in_phone') ?? '';
    const walkInEmail = readText(body, 'walk_in_email') ?? '';
    if (walkInEmail && !EMAIL_PATTERN.test(walkInEmail)) throw validationError('walk_in_email');
    requireKeys(body, ['barber_id', 'service_id', 'start_at']);
    const barberId = readId(body, 'barber_id') as number;
    const serviceId = readId(body, 'service_id') as number;
    const startAt = readInstant(body, 'start_at') as number;
    const notes = readText(body, 'notes') ?? '';

    // 1. An appointment belongs to somebody: an account, or a name on a card.
    if (customerId === null && !walkInName.trim()) throw validationError('walk_in_name');

    // 2-3. Existence only. Both codes say "not active", but `is_active` is never
    // consulted on this path — staff book for a barber the public list hides.
    const barber = barberById(barberId);
    if (!barber) throw fail('barber_not_active');
    const service = serviceById(serviceId);
    if (!service) throw fail('service_not_active');

    // 4. The link carries the price and the duration. Without it there is
    // nothing to quote and nothing to schedule.
    const link = barberServiceFor(barberId, serviceId);
    if (!link) throw fail('barber_does_not_offer_service');

    // 5-6. Placement. Staff mode keeps only "not in the past"; the lead-time and
    // advance-horizon rules belong to the customer wizard.
    const problem = slotProblem(barberId, serviceId, startAt, { mode: 'staff' });
    if (problem) throw fail(problem);

    const start = toApiDateTime(startAt);
    const end = toApiDateTime(startAt + linkDuration(link) * MINUTE);
    if (
      overlapsExistingBooking({ barber_id: barberId, start_at: start, end_at: end, status: 'pending' })
    ) {
      throw fail('slot_taken');
    }
    // A walk-in never collides: the partial unique index is `customer IS NOT NULL`.
    if (duplicatesActiveBooking({ customer_id: customerId, service_id: serviceId, status: 'pending' })) {
      // Upstream this surfaces as an IntegrityError on the insert rather than as
      // a pre-check, and `booking_integrity_error_code` reports it on `start_at`.
      throw fail('duplicate_active_booking', 'start_at');
    }
    // Upstream does not validate `customer_id` at all: a bogus one becomes an FK
    // IntegrityError, and the catch-all branch of `booking_integrity_error_code`
    // reports it as a misleading 409 `slot_taken`. Unreachable from the console,
    // which picks the customer from a list — reproduced rather than "corrected"
    // into a code the real API never sends here.
    if (customerId !== null && !userById(customerId)) throw fail('slot_taken');

    const isAccountBooking = customerId !== null;
    const row: BookingRow = {
      id: nextId('bookings'),
      customer_id: customerId,
      // A booking is one thing or the other, never both (seed invariant 8): the
      // console reads `booking.customer` to decide which name to print.
      walk_in_name: isAccountBooking ? '' : walkInName,
      walk_in_phone: isAccountBooking ? '' : walkInPhone,
      walk_in_email: isAccountBooking ? '' : walkInEmail,
      barber_id: barberId,
      service_id: serviceId,
      start_at: start,
      end_at: end,
      price_at_booking: linkPrice(link),
      status: 'pending',
      notes,
      promotion_id: null,
      cancellation_reason: '',
      reminder_24h_sent_at: null,
      reminder_1h_sent_at: null,
      cancelled_by_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    store.bookings.push(row);

    writeAudit(request, 'booking.walk_in_create', 'booking', row.id, {
      barber_id: barberId,
      service_id: serviceId,
      customer_id: customerId,
      start_at: row.start_at,
      walk_in_name: row.walk_in_name,
      walk_in_phone: row.walk_in_phone,
      walk_in_email: row.walk_in_email,
      notes: row.notes,
    });

    // No notification log: upstream's admin create does not enqueue one. The
    // customer-facing `POST /bookings/` does, and that is the only difference
    // between the two write paths' side effects.
    return serializeAdminBooking(row);
  },
  { auth: ['admin'] },
);

register(
  'PATCH',
  '/admin/bookings/:id/',
  (request) => {
    const booking = bookingOr404(request);
    const body = bodyOf(request);

    const startAt = readInstant(body, 'start_at');
    const statusText = readText(body, 'status');
    if (statusText !== undefined && !(BOOKING_STATUSES as readonly string[]).includes(statusText)) {
      throw validationError('status');
    }
    const status = statusText as BookingStatus | undefined;
    const notes = readText(body, 'notes');
    const cancellationReason = readText(body, 'cancellation_reason');

    if (status !== undefined && !isValidTransition(booking.status, status)) {
      throw fail('invalid_transition');
    }

    const nextStatus = status ?? booking.status;
    const unCancelling = booking.status === 'cancelled' && isActiveStatus(nextStatus);
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    let nextStart = booking.start_at;
    let nextEnd = booking.end_at;
    if (startAt !== undefined) {
      // `end_at` is recomputed from the effective duration and never taken from
      // the client. A barber who has dropped the service from their menu since
      // the appointment was taken has no `barber_services` row to read, and
      // upstream falls back to the catalogue row rather than refusing the move
      // — a booking that already exists is not a booking being offered. So the
      // duration is resolved here and handed to `slotProblem`, which then
      // validates the placement instead of reporting the missing link.
      const link = barberServiceFor(booking.barber_id, booking.service_id);
      const duration = link ? linkDuration(link) : serviceById(booking.service_id)?.duration_minutes;
      // Neither a link nor a catalogue row: the service was deleted out from
      // under the booking and there is no length to move. That one really is
      // unmovable.
      if (duration === undefined) throw fail('barber_does_not_offer_service');
      const problem = slotProblem(booking.barber_id, booking.service_id, startAt, {
        mode: 'staff',
        duration,
      });
      if (problem) throw fail(problem);
      nextStart = toApiDateTime(startAt);
      nextEnd = toApiDateTime(startAt + duration * MINUTE);
      changes.start_at = { old: booking.start_at, new: nextStart };
      changes.end_at = { old: booking.end_at, new: nextEnd };
    }

    // Both constraints are re-armed by a status change as well as by a move: an
    // un-cancel puts the row back into the two partial indexes. The field the 409
    // carries names the input that caused it, which is what lets the reschedule
    // dialog and the status menu each surface their own error.
    const raceField = startAt !== undefined ? 'start_at' : 'status';
    if (
      overlapsExistingBooking({
        id: booking.id,
        barber_id: booking.barber_id,
        start_at: nextStart,
        end_at: nextEnd,
        status: nextStatus,
      })
    ) {
      throw fail('slot_taken', raceField);
    }
    if (
      duplicatesActiveBooking({
        id: booking.id,
        customer_id: booking.customer_id,
        service_id: booking.service_id,
        status: nextStatus,
      })
    ) {
      throw fail('duplicate_active_booking', raceField);
    }

    if (status !== undefined) changes.status = { old: booking.status, new: status };
    if (notes !== undefined) changes.notes = { old: booking.notes, new: notes };
    if (cancellationReason !== undefined) {
      changes.cancellation_reason = { old: booking.cancellation_reason, new: cancellationReason };
    }

    if (startAt !== undefined) {
      booking.start_at = nextStart;
      booking.end_at = nextEnd;
      // A moved appointment is a different appointment: both reminders re-arm.
      booking.reminder_24h_sent_at = null;
      booking.reminder_1h_sent_at = null;
    }
    if (notes !== undefined) booking.notes = notes;
    if (cancellationReason !== undefined) booking.cancellation_reason = cancellationReason;
    if (status !== undefined) booking.status = status;

    if (unCancelling) {
      // Stale cancellation forensics must not survive on a row that is live again.
      changes.cancelled_by = { old: booking.cancelled_by_id, new: null };
      booking.cancelled_by_id = null;
      // `setdefault`: an explicitly supplied reason wins over the clear.
      if (cancellationReason === undefined) {
        changes.cancellation_reason = { old: booking.cancellation_reason, new: '' };
        booking.cancellation_reason = '';
      }
    } else if (status === 'cancelled') {
      booking.cancelled_by_id = request.user?.id ?? null;
    }
    booking.updated_at = nowIso();

    // Unlike the generic audit mixin this payload keeps every supplied field,
    // moved or not: "somebody re-sent the same status" is itself worth having.
    writeAudit(request, 'booking.update', 'booking', booking.id, { changes });
    return serializeAdminBooking(booking);
  },
  { auth: ['admin'] },
);

register(
  'DELETE',
  '/admin/bookings/:id/',
  (request) => {
    const booking = bookingOr404(request);
    // Idempotent: no mutation, no audit row, and `cancelled_by` is not
    // overwritten with whoever pressed the button a second time.
    if (booking.status === 'cancelled') return undefined;
    // Cancelling a completed or no-show booking would silently rewrite revenue
    // and no-show reporting, so it is refused even to staff.
    if (!isActiveStatus(booking.status)) throw fail('invalid_transition');

    const previous = booking.status;
    booking.status = 'cancelled';
    booking.cancelled_by_id = request.user?.id ?? null;
    // `cancellation_reason` is untouched: DELETE carries no body to put in it.
    booking.updated_at = nowIso();

    writeAudit(request, 'booking.cancel', 'booking', booking.id, {
      status: { old: previous, new: 'cancelled' },
      cancellation_reason: booking.cancellation_reason,
    });
    return undefined;
  },
  // A staff cancel carries no window check: this is the route that exists to
  // undo a booking the customer can no longer reach.
  { auth: ['admin'] },
);

/**
 * `complete/` and `no-show/` are one function twice. Both refuse a booking that
 * is not currently active — including one already in the target status, which
 * the PATCH path would have accepted as a no-op transition. The dedicated
 * endpoints are stricter than the bundle on purpose: they are the buttons on the
 * day list, and a second press should say so rather than silently succeed.
 */
function terminate(request: DemoRequest, status: 'completed' | 'no_show'): AdminBookingOut {
  const booking = bookingOr404(request);
  if (!isActiveStatus(booking.status)) throw fail('invalid_transition');
  const previous = booking.status;
  booking.status = status;
  booking.updated_at = nowIso();
  writeAudit(
    request,
    status === 'completed' ? 'booking.complete' : 'booking.no_show',
    'booking',
    booking.id,
    { status: { old: previous, new: status } },
  );
  return serializeAdminBooking(booking);
}

register('POST', '/admin/bookings/:id/complete/', (request) => terminate(request, 'completed'), {
  auth: ['admin'],
});

register('POST', '/admin/bookings/:id/no-show/', (request) => terminate(request, 'no_show'), {
  auth: ['admin'],
});

// --------------------------------------------------------------------------- //
//  §4 — `/admin/customers/`
// --------------------------------------------------------------------------- //

interface CustomerStats {
  booking_count: number;
  last_visit_at: IsoDateTime | null;
  total_spent: Money | null;
}

interface AdminCustomerOut extends CustomerStats {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  notes: string;
  is_active: boolean;
  date_joined: IsoDateTime;
}

/**
 * The three `annotate()` columns, recomputed per row.
 *
 * `booking_count` counts **every** status — the console prints it beside a
 * no-show total and the two must not be the same number — while `last_visit_at`
 * and `total_spent` are `completed` only, and are `null` rather than `0` when
 * there are none. A customer who has booked twice and never turned up is a
 * different story from one who has spent nothing because they are new, and the
 * console renders the two differently.
 *
 * The sum goes through tetri: adding 2-dp strings as floats drifts, and this
 * number is money on a screen a manager reads.
 */
function customerStats(userId: number): CustomerStats {
  let count = 0;
  let completed = 0;
  let spentMinor = 0;
  let lastVisit = '';
  for (const row of store.bookings) {
    if (row.customer_id !== userId) continue;
    count += 1;
    if (row.status !== 'completed') continue;
    completed += 1;
    spentMinor += toMinor(row.price_at_booking);
    if (!lastVisit || parseIso(row.start_at) > parseIso(lastVisit)) lastVisit = row.start_at;
  }
  return {
    booking_count: count,
    last_visit_at: completed > 0 ? lastVisit : null,
    total_spent: completed > 0 ? fromMinor(spentMinor) : null,
  };
}

function serializeAdminCustomer(row: UserRow): AdminCustomerOut {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    // Staff-only free text: present here, forbidden on `/auth/me/`.
    notes: row.notes,
    is_active: row.is_active,
    date_joined: row.date_joined,
    ...customerStats(row.id),
  };
}

/**
 * `active` and `has_bookings` accept **exact strings only**, which is narrower
 * than `asBoolean()`: `?active=1` is a filter the real API ignores, and
 * `?has_bookings=false` means "no filter", not "customers with none".
 */
function customerQueryset(request: DemoRequest): UserRow[] {
  let rows = store.users.filter((row) => row.role === 'customer');
  rows = applySearch(rows, request.params, [
    (row) => row.phone,
    (row) => row.first_name,
    (row) => row.last_name,
    (row) => row.email,
  ]);
  const active = request.params.active;
  if (active === 'true' || active === 'false') {
    rows = rows.filter((row) => row.is_active === (active === 'true'));
  }
  if (request.params.has_bookings === 'true') {
    rows = rows.filter((row) => store.bookings.some((booking) => booking.customer_id === row.id));
  }
  return newestFirst(rows, (row) => row.date_joined);
}

register(
  'GET',
  '/admin/customers/',
  (request) =>
    paginate(customerQueryset(request), request, serializeAdminCustomer, { clientPageSize: true }),
  { auth: ['admin'] },
);

/** A staff id here is a plain 404, not a 403: the customer queryset simply misses it. */
function customerOr404(request: DemoRequest): UserRow {
  const row = userById(Number(request.path.id));
  if (!row || row.role !== 'customer') throw fail('not_found');
  return row;
}

register('GET', '/admin/customers/:id/', (request) => serializeAdminCustomer(customerOr404(request)), {
  auth: ['admin'],
});

register(
  'PATCH',
  '/admin/customers/:id/',
  (request) => {
    const customer = customerOr404(request);
    const body = bodyOf(request);

    // A whitelist, not a merge: `phone` and `role` are immutable, and sending
    // either is silently ignored rather than rejected.
    const firstName = readText(body, 'first_name');
    const lastName = readText(body, 'last_name');
    const email = readEmail(body, 'email');
    const notes = readText(body, 'notes');
    const isActive = optionalBoolean(body, 'is_active');

    if (email) {
      // Staff accounts count: the unique index does not know about roles.
      const clash = store.users.some(
        (row) => row.id !== customer.id && (row.email ?? '').toLowerCase() === email.toLowerCase(),
      );
      if (clash) throw fail('email_taken');
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const move = <K extends keyof UserRow>(key: K, value: UserRow[K] | undefined): void => {
      // Only fields that actually moved, snapshotted before the assignment.
      if (value === undefined || customer[key] === value) return;
      changes[key] = { old: customer[key], new: value };
      customer[key] = value;
    };
    move('first_name', firstName);
    move('last_name', lastName);
    move('email', email);
    move('notes', notes);
    move('is_active', isActive);

    writeAudit(request, 'customer.update', 'customer', customer.id, { changes });
    // Re-serialised with the annotations, which is what upstream's re-fetch does.
    return serializeAdminCustomer(customer);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  §2 — `/admin/users/`, the staff accounts
//
//  The surface that hands out roles, and there are only two to hand out:
//  `admin`, the one console login, and `barber`, a data tag on the user row
//  behind a `barbers` row that signs in nowhere.
// --------------------------------------------------------------------------- //

interface AdminStaffUserOut {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  date_joined: IsoDateTime;
  barber_id: number | null;
}

function serializeStaffUser(row: UserRow): AdminStaffUserOut {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role,
    is_active: row.is_active,
    date_joined: row.date_joined,
    // Non-null exactly when the role is `barber`: both write paths create the
    // profile, and the console navigates to the barber page by this id.
    barber_id: barberForUser(row.id)?.id ?? null,
  };
}

function isStaffRole(value: string): value is Role {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/** `role, first_name, last_name, id` — and `admin` sorts before `barber`. */
function byStaffOrder(left: UserRow, right: UserRow): number {
  return (
    Number(left.role > right.role) - Number(left.role < right.role) ||
    Number(left.first_name > right.first_name) - Number(left.first_name < right.first_name) ||
    Number(left.last_name > right.last_name) - Number(left.last_name < right.last_name) ||
    left.id - right.id
  );
}

register(
  'GET',
  '/admin/users/',
  (request) => {
    let rows = store.users.filter((row) => isStaffRole(row.role));
    // An unrecognised role — `customer` included — is no filter at all rather
    // than an error, which is also what keeps a customer off this list: they are
    // already outside the queryset.
    const role = request.params.role;
    if (role && isStaffRole(role)) rows = rows.filter((row) => row.role === role);
    rows = applySearch(rows, request.params, [
      (row) => row.phone,
      (row) => row.first_name,
      (row) => row.last_name,
      (row) => row.email,
    ]);
    const active = request.params.active;
    if (active === 'true' || active === 'false') {
      rows = rows.filter((row) => row.is_active === (active === 'true'));
    }
    // The global paginator: no `page_size` here, unlike bookings and customers.
    return paginate(rows.sort(byStaffOrder), request, serializeStaffUser);
  },
  { auth: ['admin'] },
);

/** The `Barber` row a barber account cannot work without. Both write paths need it. */
function ensureBarberProfile(user: UserRow): void {
  if (barberForUser(user.id)) return;
  store.barbers.push({
    id: nextId('barbers'),
    user_id: user.id,
    bio: '',
    photo: null,
    specialty_ids: [],
    display_order: 0,
    is_active: true,
  });
}

register(
  'POST',
  '/admin/users/',
  (request) => {
    const body = bodyOf(request);
    // Declaration order — phone, first_name, last_name, email, role, password —
    // decides which of several bad fields is the one reported.
    requireKeys(body, ['phone', 'first_name', 'last_name', 'role', 'password']);

    const phone = normalizePhone(readText(body, 'phone') as string);
    if (!phone) throw fail('phone_invalid');
    const firstName = readText(body, 'first_name') as string;
    const lastName = readText(body, 'last_name') as string;
    const email = readEmail(body, 'email') ?? null;
    const role = readText(body, 'role') as string;
    // `customer` is not creatable here: customers self-register.
    if (!isStaffRole(role)) throw validationError('role');
    const password = readText(body, 'password') as string;
    assertStrongPassword(password, 'password');

    // Upstream these two are an IntegrityError caught and string-matched, so they
    // are reported after every field-level failure — phone first, as the insert
    // hits that index first.
    if (store.users.some((row) => row.phone === phone)) throw fail('phone_taken');
    if (email && store.users.some((row) => (row.email ?? '').toLowerCase() === email.toLowerCase())) {
      throw fail('email_taken');
    }

    const user: UserRow = {
      id: nextId('users'),
      password,
      last_login: null,
      is_superuser: false,
      phone,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      notes: '',
      is_active: true,
      // Derived, never taken from input: the model recomputes it on every save.
      is_staff: role === 'admin',
      date_joined: nowIso(),
    };
    store.users.push(user);
    if (role === 'barber') ensureBarberProfile(user);

    // Identifying fields only. The password never reaches the trail — and
    // `writeAudit` drops the key as a backstop, not as a licence to pass it.
    writeAudit(request, 'user.create', 'user', user.id, {
      phone: user.phone,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    });
    return serializeStaffUser(user);
  },
  { auth: ['admin'] },
);

/** A customer id on any detail route is a 404: the filters only apply to `list`. */
function staffUserOr404(request: DemoRequest): UserRow {
  const row = userById(Number(request.path.id));
  if (!row || !isStaffRole(row.role)) throw fail('not_found');
  return row;
}

register(
  'PATCH',
  '/admin/users/:id/',
  (request) => {
    const user = staffUserOr404(request);
    const body = bodyOf(request);

    // `phone` is immutable here, and `is_active` belongs to activate/deactivate;
    // both are silently ignored rather than rejected.
    const firstName = readText(body, 'first_name');
    const lastName = readText(body, 'last_name');
    const email = readEmail(body, 'email');
    const roleText = readText(body, 'role');
    if (roleText !== undefined && !isStaffRole(roleText)) throw validationError('role');
    const role = roleText as Role | undefined;

    // The shop must keep one admin who can still hand the role back out.
    // Inactive admins do not count: an account nobody can sign into is not a way
    // back in.
    if (
      role !== undefined &&
      user.role === 'admin' &&
      role !== 'admin' &&
      !store.users.some((row) => row.id !== user.id && row.role === 'admin' && row.is_active)
    ) {
      throw fail('last_admin');
    }

    if (email) {
      const clash = store.users.some(
        (row) => row.id !== user.id && (row.email ?? '').toLowerCase() === email.toLowerCase(),
      );
      if (clash) throw fail('email_taken');
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const move = <K extends keyof UserRow>(key: K, value: UserRow[K] | undefined): void => {
      if (value === undefined || user[key] === value) return;
      changes[key] = { old: user[key], new: value };
      user[key] = value;
    };
    move('first_name', firstName);
    move('last_name', lastName);
    move('email', email);
    const roleMoved = role !== undefined && role !== user.role;
    move('role', role);
    if (roleMoved) {
      user.is_staff = user.role === 'admin';
      // A promotion to barber needs the profile row, or the new barber has no
      // schedule, no services and no way to be booked.
      if (user.role === 'barber') ensureBarberProfile(user);
    }

    writeAudit(request, roleMoved ? 'user.role_change' : 'user.update', 'user', user.id, { changes });
    return serializeStaffUser(user);
  },
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/users/:id/reset-password/',
  (request) => {
    const user = staffUserOr404(request);
    const body = bodyOf(request);
    requireKeys(body, ['new_password']);
    const password = readText(body, 'new_password') as string;
    // The same validator stack as create, reported on this endpoint's own field.
    assertStrongPassword(password, 'new_password');

    user.password = password;
    // Upstream blacklists every outstanding refresh token — a forced logout on
    // all devices. There is one session here, so the reachable half of that is
    // signing it out when an admin has just reset their own password.
    if (session.userId === user.id) signOut();

    // An empty payload, deliberately: a new password must never reach a log.
    writeAudit(request, 'user.reset_password', 'user', user.id, {});
    return undefined;
  },
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/users/:id/activate/',
  (request) => {
    const user = staffUserOr404(request);
    const previous = user.is_active;
    user.is_active = true;
    // The row is written even when nothing moved: on an account action "somebody
    // tried" is the whole point of the trail.
    writeAudit(request, 'user.activate', 'user', user.id, {
      is_active: { old: previous, new: true },
    });
    return serializeStaffUser(user);
  },
  { auth: ['admin'] },
);

register(
  'POST',
  '/admin/users/:id/deactivate/',
  (request) => {
    const user = staffUserOr404(request);
    // This is also the only path to deactivating the last admin, which is why the
    // self-check lives here rather than in the role guard.
    if (user.id === request.user?.id) throw fail('cannot_deactivate_self');
    const previous = user.is_active;
    user.is_active = false;
    // No `signOut()`: the actor can never be the target, and `currentUser()`
    // already resolves an inactive row as signed out in anyone else's tab.
    writeAudit(request, 'user.deactivate', 'user', user.id, {
      is_active: { old: previous, new: false },
    });
    return serializeStaffUser(user);
  },
  { auth: ['admin'] },
);

// --------------------------------------------------------------------------- //
//  The two XLSX exports
//
//  The preconditions differ on purpose: bookings demands an explicit date range
//  (an unbounded appointment export is the whole database), customers does not
//  (the shop's customer list is exactly what a manager wants).
// --------------------------------------------------------------------------- //

const EXPORT_MAX_ROWS = 10_000;

const BOOKING_EXPORT_HEADERS = [
  'ID',
  'Date',
  'Time',
  'Customer',
  'Phone',
  'Walk-in',
  'Barber',
  'Service',
  'Price (GEL)',
  'Status',
  'Notes',
  'Created',
];

const CUSTOMER_EXPORT_HEADERS = [
  'ID',
  'First name',
  'Last name',
  'Phone',
  'Email',
  'Bookings',
  'Total spent (GEL)',
  'Last visit',
  'Active',
  'Joined',
];

register(
  'GET',
  '/admin/bookings/export-xlsx/',
  (request) => {
    // `downloadBookingsXlsx` sends whatever filters the page happens to hold, so
    // an export with no range is reachable from the UI and must answer 400 rather
    // than stream every booking the shop has ever taken.
    if (!request.params.date_from || !request.params.date_to) throw fail('export_range_required');
    const rows = bookingQueryset(request);
    if (rows.length > EXPORT_MAX_ROWS) throw fail('export_too_large');

    // Audited before the file is built: the intent is what is being recorded, and
    // an export that failed halfway still happened.
    writeAudit(request, 'bookings.export', 'booking', '', {
      filters: { ...request.params },
      row_count: rows.length,
    });

    const sheet: Array<Array<string | number>> = rows.map((row) => {
      // Tbilisi wall clock, not the stored UTC instant. Upstream splits this
      // column off `start_at.date()` and `%H:%M` of a value Django hands back in
      // UTC, which prints a 10:00 appointment as 06:00; the demo's rule is that
      // every day boundary and every printed time is Tbilisi's.
      const start = toApiDateTime(parseIso(row.start_at));
      return [
        row.id,
        start.slice(0, 10),
        start.slice(11, 16),
        customerName(row),
        customerPhone(row) ?? row.walk_in_phone,
        row.customer_id === null ? 'yes' : 'no',
        barberName(barberById(row.barber_id)),
        serviceById(row.service_id)?.name ?? '',
        Number(row.price_at_booking),
        row.status,
        row.notes,
        toApiDateTime(parseIso(row.created_at)),
      ];
    });

    // `demo/xlsx.ts` + `demo/zip.ts` — the kernel writer `routes.md` names, and
    // the one all three exports share. Columns become row 1, styled; a `number`
    // becomes a real number cell and a `string` stays text, which is why
    // `Price (GEL)` is `Number(...)` above and `Status` is not; and a text cell
    // that opens `=`, `+`, `-` or `@` — `notes` and `walk_in_name` are typed by
    // visitors — is written with Excel's `quotePrefix` mark so no reader can be
    // talked into evaluating it.
    return file(
      workbook({ sheet: 'Bookings', columns: BOOKING_EXPORT_HEADERS, rows: sheet }),
      `bookings_${todayKey()}.xlsx`,
    );
  },
  { auth: ['admin'] },
);

register(
  'GET',
  '/admin/customers/export-xlsx/',
  (request) => {
    const rows = customerQueryset(request);
    // The row cap is reported on `search` here: this export has no date field to
    // hang the error on, and `<Input error>` keys on the field name.
    if (rows.length > EXPORT_MAX_ROWS) throw fail('export_too_large', 'search');

    writeAudit(request, 'customers.export', 'customer', '', {
      filters: { ...request.params },
      row_count: rows.length,
    });

    const sheet: Array<Array<string | number>> = rows.map((row) => {
      const stats = customerStats(row.id);
      return [
        row.id,
        row.first_name,
        row.last_name,
        row.phone,
        row.email ?? '',
        stats.booking_count,
        Number(stats.total_spent ?? 0),
        stats.last_visit_at ? toApiDateTime(parseIso(stats.last_visit_at)) : '',
        row.is_active ? 'yes' : 'no',
        toApiDateTime(parseIso(row.date_joined)).slice(0, 10),
      ];
    });

    return file(
      workbook({ sheet: 'Customers', columns: CUSTOMER_EXPORT_HEADERS, rows: sheet }),
      `customers_${todayKey()}.xlsx`,
    );
  },
  { auth: ['admin'] },
);
