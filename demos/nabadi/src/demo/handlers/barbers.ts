/**
 * `/barbers/*` and the two availability reads — `routes.md` §3, three routes.
 *
 * A port of `apps/barbers/views.py`, with the serializers from
 * `serializers.py`. All three are public: the customer site's booking wizard is
 * the only caller, and it asks before anyone signs in.
 *
 * The slot algorithm is **not** here. `availability.ts` owns it, because three
 * modules have to answer "when can this barber do this service" identically or
 * the wizard offers a time the POST refuses; this module only validates the
 * query string, resolves the three objects and hands the question over.
 *
 * One thing worth knowing before reading a handler below: **both availability
 * endpoints report every parameter error as `field: "date"`** — a missing
 * `service_id`, an unparseable `from`, a bad `to`, all of them.
 * `BarberAvailabilityView` raises one `ValidationError({"date": [...]})` for
 * the whole parse block, and the wizard's error branch is written against that.
 */

import { DAY, dayKeyDistance, notFound, validationError } from '../base';
import { availabilityFor, availabilitySummaryFor } from '../availability';
import { mustDate } from '../query';
import type { DemoRequest } from '../router';
import { register } from '../router';
import { serializeBarber } from '../serialize';
import {
  barberById,
  barberServiceFor,
  orderedBarbers,
  serviceById,
  store,
} from '../store';
import type { DateKey } from '../types';

// --------------------------------------------------------------------------- //
//  Shared parsing
// --------------------------------------------------------------------------- //

/**
 * Python's `int(str)`, deliberately not `query.ts::asId`.
 *
 * The difference is which failure the client sees. `asId` rejects anything that
 * is not a run of digits, which would turn `?service_id=-3` into a 400; upstream
 * `int("-3")` succeeds and the miss surfaces one line later as the 404 from
 * `Service.objects.get(pk=-3)`. Two codes for one request is the drift the
 * field table exists to stop, so this parses what `int()` parses — surrounding
 * whitespace and a leading sign included — and lets the lookup decide.
 */
function intParam(raw: string | undefined): number | null {
  const value = (raw ?? '').trim();
  return /^[+-]?\d+$/.test(value) ? Number(value) : null;
}

/**
 * The three lookups both availability views run, in order: the barber must
 * exist and be active, the service must exist and be active, and a
 * `BarberService` row must link them.
 *
 * All three raise the identical `NotFound`, so a client cannot tell an inactive
 * barber from a service the barber does not offer. That is deliberate, and it
 * is why this is one helper rather than three inline checks that could drift
 * into distinguishing them.
 */
function requireOffering(request: DemoRequest, serviceId: number): number {
  const barber = barberById(Number(request.path.id));
  if (!barber?.is_active) throw notFound();
  const service = serviceById(serviceId);
  if (!service?.is_active) throw notFound();
  if (!barberServiceFor(barber.id, service.id)) throw notFound();
  return barber.id;
}

/** `if date_from > date_to: swap` — the windowed view normalises rather than rejects. */
function ordered(from: DateKey, to: DateKey): [DateKey, DateKey] {
  return from > to ? [to, from] : [from, to];
}

// --------------------------------------------------------------------------- //
//  1. GET /barbers/  —  the public roster
// --------------------------------------------------------------------------- //

/**
 * `{barbers: [...]}`, **not** a bare array: `useBarbers()` types the reply
 * `{barbers: BarberItem[]}`, and an array there renders an empty barber picker
 * with no error anywhere.
 *
 * `store.barbers` is read inside the handler rather than closed over, because
 * `resetStore()` replaces the arrays and a hoisted reference would serve the
 * pre-reset roster for the life of the tab.
 */
register(
  'GET',
  '/barbers/',
  () => ({
    barbers: orderedBarbers(store.barbers.filter((row) => row.is_active)).map(serializeBarber),
  }),
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  2. GET /barbers/:id/availability/
// --------------------------------------------------------------------------- //

/**
 * The wizard's slot list: one barber, one service, one day.
 *
 * There is no bound on how far `date` may be from today. A past date is
 * accepted and simply comes back with `slots: []`, because every candidate
 * start falls before the lead-time cutoff — the view has no "not in the past"
 * rule of its own and does not need one.
 */
register(
  'GET',
  '/barbers/:id/availability/',
  (request) => {
    const date = mustDate(request.params, 'date');
    const serviceId = intParam(request.params.service_id);
    if (serviceId === null) throw validationError('date');
    return availabilityFor(requireOffering(request, serviceId), serviceId, date);
  },
  { auth: 'public' },
);

// --------------------------------------------------------------------------- //
//  3. GET /barbers/:id/availability-summary/
// --------------------------------------------------------------------------- //

/** `(date_to - date_from).days > 60` is a 400, so 61 entries is the widest window served. */
const MAX_SUMMARY_SPAN_DAYS = 60;

/**
 * The calendar's day flags — used by the customer wizard and by the console's
 * manual-booking calendar to grey out dead days before anyone clicks one.
 *
 * The order of the two range rules is the shipped one and is visible from
 * outside: a reversed range is **swapped first** and the width cap is applied
 * to the swapped range. So a reversed ten-day range succeeds and echoes
 * `from`/`to` the right way round, while `?from=2026-09-01&to=2026-07-01` is a
 * legal request read backwards that still fails the cap at 62 days.
 */
register(
  'GET',
  '/barbers/:id/availability-summary/',
  (request) => {
    // Every parse failure in this block reports `field: "date"` — the two range
    // params and `service_id` included. One `ValidationError` upstream, one
    // field here.
    const [from, to] = ordered(
      mustDate(request.params, 'from', 'date'),
      mustDate(request.params, 'to', 'date'),
    );
    const serviceId = intParam(request.params.service_id);
    if (serviceId === null) throw validationError('date');
    // Measured on the calendar keys, which is what `(date_to - date_from).days`
    // counts: whole days, never the elapsed time between two instants.
    if (dayKeyDistance(from, to) / DAY > MAX_SUMMARY_SPAN_DAYS) throw validationError('date');

    return availabilitySummaryFor(requireOffering(request, serviceId), serviceId, from, to);
  },
  { auth: 'public' },
);
