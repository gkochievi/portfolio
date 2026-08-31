/**
 * When can this barber do this service.
 *
 * A port of `apps/bookings/services/availability.py` — `compute_available_slots`,
 * `compute_day_summaries` and `_day_flags` — and the single home for the
 * question, because three handler modules have to answer it identically:
 *
 * | asks | for |
 * |---|---|
 * | `handlers/barbers.ts` | `GET /barbers/:id/availability/` and `/availability-summary/` |
 * | `handlers/bookings.ts` | `POST /bookings/` — the slot the wizard just offered |
 * | `handlers/admin-bookings.ts` | walk-in create and `PATCH /admin/bookings/:id/` reschedule |
 *
 * If the wizard and the POST disagree by one minute, the demo offers a slot and
 * then refuses it, which is the worst thing a booking flow can do. So the
 * offering and the refusing are computed from the same intervals here, and no
 * handler re-derives either.
 *
 * The layering below the surface: `store.openIntervals()` gives the barber's
 * shift with their time off punched out (and is also what the rebase consults
 * before moving a booking onto a day); this module subtracts the barber's active
 * bookings and slices what is left onto the granularity grid.
 *
 * The two response shapes are `AvailabilityResponse` and
 * `AvailabilitySummaryResponse` as `customer/features/booking/hooks.ts:41-65`
 * declares them — the admin console declares the same four interfaces in
 * `admin/features/admin/hooks.ts`, and both must keep matching.
 */

import {
  CLOCK,
  DAY,
  MINUTE,
  alignUp,
  dateKey,
  instantAt,
  parseIso,
  shiftDayKey,
  subtractIntervals,
  toApiDateTime,
} from './base';
import type { Interval } from './base';
import { linkDuration } from './serialize';
import { barberServiceFor, bookingSetting, hoursFor, openIntervals, store } from './store';
import type { DateKey } from './types';
import { ACTIVE_BOOKING_STATUSES } from './types';

// --------------------------------------------------------------------------- //
//  The wire shapes
// --------------------------------------------------------------------------- //

export interface AvailabilitySlot {
  start_at: string;
  end_at: string;
}

export interface AvailabilityResponse {
  barber_id: number;
  service_id: number;
  date: DateKey;
  slots: AvailabilitySlot[];
}

export interface AvailabilityDaySummary {
  date: DateKey;
  has_service_slot: boolean;
  has_any_slot: boolean;
}

export interface AvailabilitySummaryResponse {
  barber_id: number;
  service_id: number;
  from: DateKey;
  to: DateKey;
  days: AvailabilityDaySummary[];
}

// --------------------------------------------------------------------------- //
//  Shared parts
// --------------------------------------------------------------------------- //

/**
 * A hard stop on `daySummary`'s day loop. `/availability-summary/` rejects a
 * range wider than 60 days *before* calling in, so this is never reached — it
 * exists so a handler that forgets the check returns a truncated list instead of
 * hanging the tab.
 */
const MAX_SUMMARY_DAYS = 400;

/** The four knobs, read once per call so a mid-call settings edit cannot split a run. */
interface Knobs {
  granularity: number;
  minLead: number;
  maxAdvance: number;
}

function knobs(now: number): Knobs {
  return {
    granularity: bookingSetting('slot_granularity_minutes'),
    minLead: now + bookingSetting('min_booking_lead_minutes') * MINUTE,
    maxAdvance: now + bookingSetting('max_booking_advance_days') * DAY,
  };
}

/**
 * The barber's own `pending`/`confirmed` bookings overlapping the window.
 *
 * Terminal rows do not block — cancelling frees the slot instantly, which is
 * the same partial predicate the EXCLUDE constraint uses. Other barbers are
 * irrelevant: one chair each.
 */
function bookedIntervals(barberId: number, from: number, to: number, exceptId?: number): Interval[] {
  const blocks: Interval[] = [];
  for (const row of store.bookings) {
    if (row.barber_id !== barberId) continue;
    if (row.id === exceptId) continue;
    if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(row.status)) continue;
    const start = parseIso(row.start_at);
    const end = parseIso(row.end_at);
    if (start < to && from < end) blocks.push([start, end]);
  }
  return blocks;
}

/**
 * The service's duration for this barber, or `null` when they do not offer it.
 *
 * `null` is the answer to every question this module asks: no slots, no
 * bookable day, no booking. The view 404s on it before the algorithm runs, but
 * the algorithm has to be safe on its own because the write paths call it
 * directly.
 */
function durationFor(barberId: number, serviceId: number): number | null {
  const link = barberServiceFor(barberId, serviceId);
  return link ? linkDuration(link) : null;
}

/** The free part of one day: the shift, minus time off, minus what is booked. */
function freeIntervals(barberId: number, key: DateKey, exceptId?: number): Interval[] {
  const open = openIntervals(barberId, key);
  if (open.length === 0) return [];
  const dayFrom = open[0][0];
  const dayTo = open[open.length - 1][1];
  return subtractIntervals(open, bookedIntervals(barberId, dayFrom, dayTo, exceptId));
}

// --------------------------------------------------------------------------- //
//  §6 — the slot list
// --------------------------------------------------------------------------- //

/**
 * `compute_available_slots(barber, service, date)`.
 *
 * Candidate starts every `slot_granularity_minutes`, each one `duration` long,
 * ascending. They **overlap each other** — this is a list of start times, not a
 * partition of the day — and the list is empty rather than an error when the
 * barber does not work, does not offer the service, or the whole day falls
 * before the lead-time cutoff.
 *
 * Three details the algorithm turns on, all of them easy to lose:
 *
 * - **The grid is re-anchored per free interval, not per day.** After a booking
 *   that ends at 11:20 the next interval opens at 11:20, aligns up to 11:30, and
 *   the afternoon's starts are 11:30 / 11:45 / 12:00 — visibly offset from the
 *   morning's. That is the shipped behaviour.
 * - **The whole service must fit inside one free interval**, so a 50-minute cut
 *   cannot straddle a lunch break.
 * - **`min_lead` and `max_advance` are compared to the start only**, inclusively.
 *   A slot may legitimately *end* after the advance horizon.
 */
export function slotsFor(
  barberId: number,
  serviceId: number,
  key: DateKey,
  now: number = CLOCK.now(),
): AvailabilitySlot[] {
  const duration = durationFor(barberId, serviceId);
  if (duration === null || duration <= 0) return [];

  const { granularity, minLead, maxAdvance } = knobs(now);
  const durationMs = duration * MINUTE;
  const step = granularity * MINUTE;

  const slots: AvailabilitySlot[] = [];
  for (const [intervalStart, intervalEnd] of freeIntervals(barberId, key)) {
    let start = alignUp(intervalStart, granularity);
    while (start + durationMs <= intervalEnd) {
      if (start >= minLead && start <= maxAdvance) {
        slots.push({ start_at: toApiDateTime(start), end_at: toApiDateTime(start + durationMs) });
      }
      start += step;
    }
  }
  return slots;
}

/** The `GET /barbers/:id/availability/` envelope, built once so it cannot drift. */
export function availabilityFor(
  barberId: number,
  serviceId: number,
  key: DateKey,
  now: number = CLOCK.now(),
): AvailabilityResponse {
  return {
    barber_id: barberId,
    service_id: serviceId,
    date: key,
    slots: slotsFor(barberId, serviceId, key, now),
  };
}

// --------------------------------------------------------------------------- //
//  §7 — the day summary
// --------------------------------------------------------------------------- //

/**
 * `compute_day_summaries(barber, service, from, to)` — one row per calendar day,
 * inclusive of both ends, **including days the shop is closed** (both flags
 * false). The calendars grey a day out on `has_any_slot === false` and mark it
 * partial on `has_any_slot && !has_service_slot`.
 *
 * This is a separate implementation upstream, not a loop over
 * `compute_available_slots`, and the difference is deliberate and visible:
 *
 * - **No grid alignment.** A free interval of exactly the service's length that
 *   opens off-grid — 11:50–12:40 for a 50-minute cut — reports
 *   `has_service_slot: true` while `/availability/` returns nothing for it,
 *   because `align_up(11:50)` is 12:00 and no longer fits. A shipped
 *   inconsistency, reproduced: it only ever over-promises, and a calendar that
 *   disagreed the other way would grey out days that are actually bookable.
 * - **`has_any_slot` needs one granularity unit, not the service duration**, and
 *   measures against the raw interval end; `has_service_slot` needs the whole
 *   duration and measures against the end clipped to
 *   `max_advance + duration`. The asymmetry is in the source.
 * - The loop breaks as soon as `has_service_slot` is true, so a service shorter
 *   than the granularity can report a service slot on a day with no "any" slot.
 *   Reproduced literally rather than assumed away.
 */
export function daySummary(
  barberId: number,
  serviceId: number,
  from: DateKey,
  to: DateKey,
  now: number = CLOCK.now(),
): AvailabilityDaySummary[] {
  const days: DateKey[] = [];
  // The view caps the window at 61 days before it gets here; the cap below is
  // only so a bad range can never spin the tab rather than return a short list.
  for (let key = from; key <= to && days.length < MAX_SUMMARY_DAYS; key = shiftDayKey(key, 1)) {
    days.push(key);
  }

  const duration = durationFor(barberId, serviceId);
  // No `BarberService` row means every day is dead, exactly as upstream returns.
  if (duration === null) {
    return days.map((date) => ({ date, has_service_slot: false, has_any_slot: false }));
  }

  const { granularity, minLead, maxAdvance } = knobs(now);
  const grain = granularity * MINUTE;
  const durationMs = duration * MINUTE;

  return days.map((date) => {
    let hasAny = false;
    let hasService = false;
    for (const [intervalStart, intervalEnd] of freeIntervals(barberId, date)) {
      const start = Math.max(intervalStart, minLead);
      const end = Math.min(intervalEnd, maxAdvance + durationMs);
      if (start + grain <= intervalEnd && start <= maxAdvance) hasAny = true;
      if (start + durationMs <= end && start <= maxAdvance) hasService = true;
      if (hasService) break;
    }
    return { date, has_service_slot: hasService, has_any_slot: hasAny };
  });
}

/** The `GET /barbers/:id/availability-summary/` envelope. */
export function availabilitySummaryFor(
  barberId: number,
  serviceId: number,
  from: DateKey,
  to: DateKey,
  now: number = CLOCK.now(),
): AvailabilitySummaryResponse {
  return {
    barber_id: barberId,
    service_id: serviceId,
    from,
    to,
    days: daySummary(barberId, serviceId, from, to, now),
  };
}

// --------------------------------------------------------------------------- //
//  The write side
// --------------------------------------------------------------------------- //

/**
 * Which of the four placement rules a proposed `start_at` breaks, or `null`.
 *
 * This is the other half of the same engine: `slotsFor` decides what to offer,
 * `slotProblem` decides what to accept, and they read the same hours and the
 * same time off. It deliberately does **not** ask "is this start in the list" —
 * upstream runs four independent checks and the client branches on which code
 * came back (`lead_time_too_short` gets a different message from
 * `outside_working_hours`), so collapsing them to one code would lose that.
 *
 * The order is `BookingCreateSerializer.validate`'s, first failure wins:
 * lead time, advance horizon, working-hours containment, time off. Overlap with
 * another booking is **not** here — upstream has no overlap query at all and
 * lets the EXCLUDE constraint raise, which is `overlapsExistingBooking()` and a
 * 409 `slot_taken` rather than a 400.
 *
 * `mode: 'staff'` replaces the two customer-facing time rules with upstream's
 * "not in the past", which is what admin walk-in create and reschedule use: a
 * receptionist booking the chair for ten minutes' time is the normal case.
 *
 * `options.duration` overrides the `BarberService` lookup, in minutes. It exists
 * for one caller: `PATCH /admin/bookings/{id}/` re-times a booking that already
 * exists, and a barber may have dropped that service from their menu since it
 * was taken. Upstream falls back to the catalogue row's `duration_minutes` and
 * moves the appointment; without a way to hand the duration in, the only honest
 * answer this function could give was `barber_does_not_offer_service`, and the
 * console refused a move it should have made. The placement rules are unchanged
 * — only where the length of the appointment comes from.
 */
export type SlotProblem =
  | 'barber_does_not_offer_service'
  | 'lead_time_too_short'
  | 'too_far_in_advance'
  | 'outside_working_hours'
  | 'time_off_overlap';

export function slotProblem(
  barberId: number,
  serviceId: number,
  startAt: number,
  options: { mode?: 'customer' | 'staff'; now?: number; duration?: number } = {},
): SlotProblem | null {
  const now = options.now ?? CLOCK.now();
  const mode = options.mode ?? 'customer';
  const duration = options.duration ?? durationFor(barberId, serviceId);
  // The caller normally raises this at step 4, before asking about placement.
  // Reporting it rather than passing silently is what keeps the answer honest
  // for a caller that did not — and a caller that supplied its own duration has
  // already decided the link is not the question.
  if (duration === null) return 'barber_does_not_offer_service';
  const endAt = startAt + duration * MINUTE;

  if (mode === 'customer') {
    if (startAt < now + bookingSetting('min_booking_lead_minutes') * MINUTE) {
      return 'lead_time_too_short';
    }
    if (startAt > now + bookingSetting('max_booking_advance_days') * DAY) {
      return 'too_far_in_advance';
    }
  } else if (startAt < now) {
    // Admin create/reschedule reuses the lead-time code for "start is in the past".
    return 'lead_time_too_short';
  }

  // Containment is tested against the **whole shift**, time off still in it, so
  // a closure inside opening hours reports `time_off_overlap` and a booking at
  // 21:00 reports `outside_working_hours` — two different messages, as upstream
  // sends. Reusing the already-punched intervals here would collapse them.
  const key = dateKey(startAt);
  const hours = hoursFor(barberId, key);
  if (!hours) return 'outside_working_hours';
  const opens = instantAt(key, hours.start);
  const closes = instantAt(key, hours.end);
  // An end past local midnight fails containment rather than wrapping, which is
  // what the `test_outside_working_hours_midnight_wrap` regression pins.
  if (startAt < opens || endAt > closes) return 'outside_working_hours';
  const shift = openIntervals(barberId, key);
  if (!shift.some(([start, end]) => startAt >= start && endAt <= end)) return 'time_off_overlap';
  return null;
}
