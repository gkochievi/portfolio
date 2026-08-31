/**
 * The mock's primitives: the error it fails with, the clock it reads, the
 * latency it spends, and the number formats DRF put on the wire.
 *
 * A port of `apps/users/exceptions.py` + `error_codes.py` (the envelope and the
 * 40-code registry), of `TIME_ZONE = "Asia/Tbilisi"` / `USE_TZ = True`, and of
 * DRF's `COERCE_DECIMAL_TO_STRING`. Nothing here reads the store, so every
 * other module in `src/demo/` can import it without a cycle.
 *
 * Two rules this file exists to enforce:
 *
 * - **One clock.** `Date.now()` appears exactly once in the whole mock, in
 *   `CLOCK.now()`. Every filter, every `auto_now`, every rebase decision and
 *   every "is this slot in the past" test reads that one function, so they can
 *   never disagree — and a future "advance time" control has one knob to turn.
 * - **One failure.** `DemoApiError` is the only way a handler fails, and its
 *   body is the three-key envelope both front ends destructure. There is no
 *   second error shape to reconcile.
 */

import type { DateKey, IsoDateTime, Money, TimeString, Weekday } from './types';

// --------------------------------------------------------------------------- //
//  Error codes — `apps/users/error_codes.py`, all 40, verbatim
//
//  The message is the exact English string the backend sends. Both front ends
//  render `t(error.code, {defaultValue: error.message})`, so a wrong message
//  only shows up in a locale that has not translated the code — which is
//  exactly the case a demo hits first.
// --------------------------------------------------------------------------- //

const MESSAGE_TABLE = {
  phone_invalid: 'Phone number is not valid.',
  phone_taken: 'An account with this phone already exists.',
  email_taken: 'An account with this email already exists.',
  password_weak: 'Password does not meet the strength requirements.',
  credentials_invalid: 'Phone or password is incorrect.',
  not_authenticated: 'Authentication required.',
  permission_denied: 'You do not have permission to perform this action.',
  otp_invalid: 'The reset code is invalid.',
  otp_expired: 'The reset code has expired.',
  slot_taken: 'That time slot is no longer available.',
  duplicate_active_booking:
    'You already have an upcoming booking for this service. Cancel it first to book a new time.',
  outside_working_hours: "The selected time is outside the barber's working hours.",
  time_off_overlap: 'The barber is unavailable at the selected time.',
  lead_time_too_short: 'Bookings must be made at least the minimum lead time in advance.',
  too_far_in_advance: 'Bookings cannot be made that far in advance.',
  cancellation_window_passed: 'The cancellation window has passed for this booking.',
  booking_not_found: 'Booking not found.',
  invalid_transition: "This status change is not allowed from the booking's current status.",
  barber_not_active: 'This barber is not accepting bookings right now.',
  service_not_active: 'This service is not currently offered.',
  barber_does_not_offer_service: 'This barber does not offer the selected service.',
  booking_not_completed: 'You can only review a completed booking.',
  review_already_exists: 'This booking has already been reviewed.',
  last_admin: 'The last remaining admin cannot be demoted or deactivated.',
  cannot_deactivate_self: 'You cannot deactivate your own account.',
  barber_service_exists: 'This barber already offers that service.',
  test_send_failed: 'The test message could not be delivered. Check the provider and retry.',
  sms_disabled: 'SMS notifications are currently disabled. Enable them in Settings first.',
  time_off_in_past: 'Time off in the past cannot be created or deleted.',
  promo_invalid: 'That promo code is not recognized.',
  promo_inactive: 'That promo code is not active.',
  promo_not_started: 'That promo code is not yet valid.',
  promo_expired: 'That promo code has expired.',
  promo_exhausted: 'That promo code has reached its usage limit.',
  export_range_required: 'Exports require an explicit date_from and date_to range.',
  export_too_large: 'Too many rows for one export. Narrow the filters and try again.',
  validation_error: 'Validation failed.',
  not_found: 'Resource not found.',
  throttled: 'Too many requests. Please try again later.',
  server_error: 'An unexpected error occurred.',
} as const;

export type ErrorCode = keyof typeof MESSAGE_TABLE;

export const MESSAGES: Readonly<Record<ErrorCode, string>> = MESSAGE_TABLE;

/**
 * The status DRF would have produced for each code before the override table
 * runs. Anything absent is a serializer `ValidationError`, i.e. 400.
 */
const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  not_authenticated: 401,
  credentials_invalid: 401,
  permission_denied: 403,
  not_found: 404,
  throttled: 429,
  server_error: 500,
  // Hand-built in the view rather than raised, so no override ever applies.
  test_send_failed: 502,
};

/**
 * `exceptions._STATUS_OVERRIDES` — applied **last**, replacing whatever status
 * DRF chose. This is load-bearing rather than cosmetic: `POST /api/reviews/`
 * raises `booking_not_found` as a field error on a serializer, which is
 * naturally a 400, and the client must nonetheless see a 404.
 */
const STATUS_OVERRIDES: Partial<Record<ErrorCode, number>> = {
  slot_taken: 409,
  duplicate_active_booking: 409,
  invalid_transition: 409,
  sms_disabled: 409,
  booking_not_found: 404,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS_OVERRIDES[code] ?? STATUS_BY_CODE[code] ?? 400;
}

/**
 * The `field` each code is raised with — `apps/users/error_codes.py` read
 * through every call site (`spec/errors-i18n.md §A7`, transcribed here so a
 * handler author never has to leave the repo to find it).
 *
 * This is load-bearing, not decoration. `customer/features/booking/errors.ts`
 * sniffs `field + message` to tell a duplicate booking from a slot race, and
 * `<Input error>` keys on it to put the message under the right box. Seven
 * handler modules guessing seven field names would break both.
 *
 * `fail(code)` reads it, so the common case is right by default and the
 * exceptions are the ones you write out: `fail('slot_taken', 'status')` on an
 * un-cancel PATCH, `fail('duplicate_active_booking', 'start_at')` when the
 * duplicate surfaces as a race rather than the pre-check, `fail('phone_invalid',
 * 'recipient')` on a notification test-send.
 */
const FIELD_TABLE: Readonly<Record<ErrorCode, string | null>> = {
  phone_invalid: 'phone',
  phone_taken: 'phone',
  email_taken: 'email',
  password_weak: 'password',
  credentials_invalid: null,
  not_authenticated: null,
  permission_denied: null,
  otp_invalid: 'code',
  otp_expired: 'code',
  slot_taken: 'start_at',
  duplicate_active_booking: 'service_id',
  outside_working_hours: 'start_at',
  time_off_overlap: 'start_at',
  lead_time_too_short: 'start_at',
  too_far_in_advance: 'start_at',
  cancellation_window_passed: 'start_at',
  booking_not_found: null,
  invalid_transition: 'status',
  barber_not_active: 'barber_id',
  service_not_active: 'service_id',
  barber_does_not_offer_service: 'service_id',
  booking_not_completed: 'booking_id',
  review_already_exists: 'booking_id',
  last_admin: 'role',
  cannot_deactivate_self: null,
  barber_service_exists: 'service_id',
  test_send_failed: null,
  sms_disabled: null,
  time_off_in_past: 'start_datetime',
  promo_invalid: 'promo_code',
  promo_inactive: 'promo_code',
  promo_not_started: 'promo_code',
  promo_expired: 'promo_code',
  promo_exhausted: 'promo_code',
  export_range_required: 'date_from',
  export_too_large: 'date_from',
  validation_error: null,
  not_found: null,
  throttled: null,
  server_error: null,
};

export function fieldForCode(code: ErrorCode): string | null {
  return FIELD_TABLE[code];
}

/** The literal response body. Exactly three keys, in this order, always. */
export interface ErrorBody {
  code: string;
  message: string;
  field: string | null;
}

/**
 * The only way a handler fails.
 *
 * `body` is what the seam hands to `ApiError`, and both front ends read
 * `code`, `message` and `field` off it — `field` included, because
 * `isDuplicateActiveBooking()` sniffs it and several `<Input error>` props key
 * on it. There is no `detail`, no `errors` array and no per-field DRF dict:
 * the real exception handler replaces `response.data` wholesale, so only the
 * first discoverable problem is ever reported.
 */
export class DemoApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | null;
  readonly body: ErrorBody;

  constructor(status: number, code: ErrorCode | 'unknown', field: string | null = null) {
    const message = code === 'unknown' ? `HTTP ${status}` : MESSAGES[code];
    super(message);
    this.name = 'DemoApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.body = { code, message, field };
  }
}

/**
 * The idiomatic failure: name the code and let the two registries settle the
 * status and the field. `fail('slot_taken')` is a 409 with `field: "start_at"`
 * because `STATUS_OVERRIDES` and `FIELD_TABLE` say so — a handler never writes
 * a status number and only names a field when this code is being raised
 * somewhere other than its usual place.
 *
 * Passing `null` explicitly suppresses the default field; omitting the argument
 * takes it.
 */
export function fail(code: ErrorCode, field?: string | null): DemoApiError {
  return new DemoApiError(statusForCode(code), code, field === undefined ? FIELD_TABLE[code] : field);
}

export function notFound(): DemoApiError {
  return fail('not_found');
}

export function notAuthenticated(): DemoApiError {
  return fail('not_authenticated');
}

/**
 * Every failing permission class collapses to this. The role check is the only
 * one left — `auth: ['admin']` on a route — and it deliberately says nothing
 * about which role was wanted: DRF's exception handler throws the class's own
 * `message` away, so the client never learns more than "not you".
 */
export function permissionDenied(): DemoApiError {
  return fail('permission_denied');
}

/**
 * DRF's own field errors — "This field is required.", "A valid integer is
 * required." — are not registry keys, so they degrade to `validation_error`
 * with the field name preserved. That degradation is the common case for
 * anything the backend did not raise deliberately.
 */
export function validationError(field: string | null = null): DemoApiError {
  return fail('validation_error', field);
}

// --------------------------------------------------------------------------- //
//  Reading a request body
//
//  DRF hands a serializer a dict and lets each field pull its own key out, so
//  these are per-field rather than per-body. Only the readers every handler
//  module agreed on live here; the per-field coercions that differ by serializer
//  (`readText` reads a `CharField` three different ways across three modules,
//  because the three serializers declare it three different ways) stay beside
//  the routes that need them.
// --------------------------------------------------------------------------- //

/**
 * The request body as a JSON object. A list, a scalar, `null` and a `FormData`
 * all read as `{}` — the same thing DRF's `request.data` gives a serializer that
 * was handed something it cannot map.
 *
 * Takes the request structurally rather than as a `DemoRequest`, so `base.ts`
 * stays free of any import from `router.ts` and the module graph keeps its one
 * direction.
 */
export function bodyOf(request: { body: unknown }): Record<string, unknown> {
  const { body } = request;
  if (body === null || typeof body !== 'object') return {};
  if (Array.isArray(body) || body instanceof FormData) return {};
  return body as Record<string, unknown>;
}

/**
 * `key in validated_data`.
 *
 * An explicit `undefined` counts as **absent**: JSON has no such value, and the
 * console reaches this code as a live object, where `{price_override: undefined}`
 * is a key the caller did not mean to send while `{price_override: null}` is the
 * one that clears an override. `JSON.stringify` drops the first and keeps the
 * second, and so does this.
 */
export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

/** Django's `EmailValidator` reduced to the shape every real address has. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * DRF `BooleanField`: the JSON boolean, `0`/`1`, or one of the strings it
 * accepts, case-insensitively and after trimming. A real one, so the string
 * `"false"` is coerced rather than stored truthy — a past bug upstream stored
 * exactly that string and turned every deactivation into an activation.
 */
export function readBoolean(raw: unknown, field: string): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number' && (raw === 0 || raw === 1)) return raw === 1;
  if (typeof raw === 'string') {
    const text = raw.trim().toLowerCase();
    if (text === 'true' || text === '1') return true;
    if (text === 'false' || text === '0') return false;
  }
  throw validationError(field);
}

/** The same field off a body, where an absent key means "leave it alone". */
export function optionalBoolean(
  body: Record<string, unknown>,
  key: string,
): boolean | undefined {
  return has(body, key) ? readBoolean(body[key], key) : undefined;
}

// --------------------------------------------------------------------------- //
//  Phone normalisation (`apps/users/validators.py::normalize_phone`)
//
//  Upstream this is Google's libphonenumber through the `phonenumbers` package,
//  which validates the national number against Georgia's real numbering plan.
//  Shipping that metadata to a browser to check four seeded numbers is not a
//  trade this demo makes, so what follows is the documented pragmatic stand-in
//  (`spec/api-auth.md` §6.4): everything that starts with `+` is taken as
//  international and kept verbatim, everything else is read in the Georgian
//  plan, and a `+995` number must carry a 9-digit NSN opening 3, 4 or 5.
//
//  The divergence is one-directional: this accepts a handful of NSNs real
//  libphonenumber rejects. It never rejects one libphonenumber accepts, so no
//  number that works against the backend stops working here.
//
//  **One copy, on purpose.** Upstream has exactly one `normalize_phone`, and
//  every serializer that takes a phone calls it — register, login, forgot,
//  reset, staff-user create and the notification test-send
//  (`spec/api-admin-c.md` §8.5: "the same validator as login/register"). Every
//  lookup normalises before it goes to the table, so any create path that
//  normalises differently writes a row nothing will ever find again — and lets
//  a second account be minted for the same person without tripping
//  `phone_taken`. That is exactly the bug `POST /admin/barbers/` shipped with;
//  see the note there.
// --------------------------------------------------------------------------- //

/** Whitespace, dashes, dots and brackets are ignored by `phonenumbers.parse`. */
const PHONE_PUNCTUATION = /[\s\-().]/g;

/** Mobile `5…`, fixed-line `3…`/`4…`, nine digits, no national prefix. */
const GEORGIAN_NSN = /^[345]\d{8}$/;

/** E.164 as `format_number` emits it: `+`, then 8–15 digits, nothing else. */
const E164 = /^\+\d{8,15}$/;

/** Canonical E.164, or `null` where `normalize_phone` would have raised. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.replace(PHONE_PUNCTUATION, '');
  if (!compact) return null;

  if (compact.startsWith('+')) {
    if (!E164.test(compact)) return null;
    // A leading `+` means `parse()` ignores DEFAULT_REGION entirely, so a US
    // number is accepted and stored verbatim — this is not a Georgia-only field.
    if (!compact.startsWith('+995')) return compact;
    return GEORGIAN_NSN.test(compact.slice(4)) ? compact : null;
  }

  // No `+`: the Georgian plan, where a single leading `0` is the national prefix.
  const nsn = compact.replace(/^0/, '');
  return GEORGIAN_NSN.test(nsn) ? `+995${nsn}` : null;
}

// --------------------------------------------------------------------------- //
//  Password strength (`AUTH_PASSWORD_VALIDATORS`)
//
//  Four stock Django validators, of which only three can ever fire: every call
//  site passes no `user`, and `UserAttributeSimilarityValidator.validate()`
//  returns immediately without one. The client never learns which rule it broke
//  — each serializer catches the whole stack and re-raises the single code
//  `password_weak` — so the mock only has to agree on the verdict.
//
//  `CommonPasswordValidator` reads a 20 000-entry gzipped list; what ships here
//  is the head of it. A demo visitor typing an obscure entry from the long tail
//  gets an account the real backend would have refused, which is the cheapest
//  possible failure mode for 200 KB not spent.
//
//  **One list, on purpose.** `/auth/register/`, `/auth/change-password/`,
//  `/auth/reset-password/`, `POST /admin/users/` and
//  `POST /admin/users/{id}/reset-password/` all run the same Django stack
//  upstream, so they must all reach the same verdict. Two heads of the list used
//  to be in the tree and they disagreed on sixteen words; this is their union,
//  which is the only merge that keeps every password either of them refused
//  refused.
// --------------------------------------------------------------------------- //

const MIN_PASSWORD_LENGTH = 8;

const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyui', 'admin123', 'admin1234', 'abc12345', 'iloveyou',
  'letmein1', 'football', 'baseball', 'sunshine', 'princess', '1qaz2wsx',
  'trustno1', 'superman', 'starwars', 'whatever', 'computer', 'welcome1',
  'monkey12', 'dragon12', 'michael1', 'shadow12', 'jennifer', 'passw0rd',
  'zaq12wsx',
]);

/** `django_validate_password(value)`, collapsed to its one boolean. */
export function isWeakPassword(value: string): boolean {
  return (
    value.length < MIN_PASSWORD_LENGTH ||
    COMMON_PASSWORDS.has(value.toLowerCase().trim()) ||
    /^\d+$/.test(value)
  );
}

/** The same, raising the one wire code every caller re-raises anyway. */
export function assertStrongPassword(value: string, field: string): void {
  if (isWeakPassword(value)) throw fail('password_weak', field);
}

// --------------------------------------------------------------------------- //
//  File replies
// --------------------------------------------------------------------------- //

const FILE = Symbol('demo.file');

export interface FileResponse {
  [FILE]: true;
  blob: Blob;
  filename: string;
  contentType: string;
}

/**
 * What an export handler returns in place of a JSON body. The seam unwraps it
 * into the Blob plus the `content-disposition` that `apiDownload()` parses a
 * filename out of, so the three XLSX endpoints reach the browser as real
 * downloads rather than as a payload nobody can open.
 */
export function file(
  blob: Blob,
  filename: string,
  contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
): FileResponse {
  return { [FILE]: true, blob, filename, contentType };
}

export function isFileResponse(value: unknown): value is FileResponse {
  return typeof value === 'object' && value !== null && FILE in value;
}

// --------------------------------------------------------------------------- //
//  Latency
// --------------------------------------------------------------------------- //

export const READ_LATENCY: readonly [number, number] = [90, 260];
export const WRITE_LATENCY: readonly [number, number] = [140, 340];

/**
 * The delay is the whole point of the mock feeling real: it is what makes
 * spinners, optimistic writes and stale-while-revalidate visible.
 *
 * It is a counter walked by the golden ratio rather than `Math.random()`. The
 * walk never repeats a short cycle, so a list and the detail fetch behind it
 * still land far apart — but the sequence is identical on every run, which
 * means a slow frame is reproducible instead of being blamed on the machine.
 */
let latencyTick = 0;

const GOLDEN = 0.618033988749895;

export function nextLatency(isRead: boolean): number {
  const [min, max] = isRead ? READ_LATENCY : WRITE_LATENCY;
  latencyTick += 1;
  const position = (latencyTick * GOLDEN) % 1;
  return Math.round(min + position * (max - min));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((done) => {
    window.setTimeout(done, ms);
  });
}

// --------------------------------------------------------------------------- //
//  The clock
//
//  Every day boundary in the demo is drawn in Asia/Tbilisi, never in the
//  visitor's own zone — the same thing Django did with `USE_TZ = True` and
//  `TIME_ZONE = "Asia/Tbilisi"`: the server bucketed by `__date` in that zone
//  and the page printed it in that zone. Bucketing locally instead would make a
//  console opened in Auckland report an empty "today" over a list whose newest
//  rows all read today's date.
//
//  Georgia has no DST, so the offset is a constant +04:00 and the arithmetic
//  below is exact. A zone with transitions would need the `Intl` round-trip the
//  other two demos use; this one would only be pretending to.
// --------------------------------------------------------------------------- //

export const TIME_ZONE = 'Asia/Tbilisi';

/** Milliseconds to add to a UTC instant to reach Tbilisi wall-clock time. */
export const TZ_OFFSET_MS = 4 * 60 * 60 * 1000;

export const TZ_SUFFIX = '+04:00';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * The mock's only reading of the wall clock.
 *
 * Everything else — filters, `auto_now`, the rebase, the stale-booking sweep —
 * goes through here, which is what lets them agree with each other to the
 * millisecond and what would let a "jump forward three hours" control exist
 * without hunting down a second time source.
 */
export const CLOCK = {
  now(): number {
    return Date.now();
  },
};

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Epoch ms from whatever a caller happens to be holding. */
function instantOf(value: Date | string | number): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

/** The Tbilisi wall-clock fields of an instant, as if it were UTC. */
function wall(at: number): Date {
  return new Date(at + TZ_OFFSET_MS);
}

/** `YYYY-MM-DD` in Tbilisi — the key every date filter and bucket compares on. */
export function dateKey(value: Date | string | number): DateKey {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  const local = wall(at);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

export function todayKey(): DateKey {
  return dateKey(CLOCK.now());
}

/** `YYYY-MM-DD` for the wire, from an instant. */
export function toApiDate(value: Date | string | number): DateKey {
  return dateKey(value);
}

/**
 * ISO-8601 in Tbilisi, e.g. `"2026-08-29T14:30:00+04:00"`.
 *
 * DRF renders microseconds when they are non-zero; nothing in the demo ever
 * carries them, and every reader parses with `new Date(iso)` before
 * re-formatting through `Intl`, so seconds precision is the faithful shape.
 */
export function toApiDateTime(value: Date | string | number): IsoDateTime {
  const at = instantOf(value);
  if (!Number.isFinite(at)) return '';
  const local = wall(at);
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  return `${date}T${time}${TZ_SUFFIX}`;
}

/** `toApiDateTime(CLOCK.now())` — what `auto_now` / `auto_now_add` stamp. */
export function nowIso(): IsoDateTime {
  return toApiDateTime(CLOCK.now());
}

/** Epoch ms from a stored ISO string, or `NaN`. */
export function parseIso(value: IsoDateTime | null | undefined): number {
  return value ? Date.parse(value) : Number.NaN;
}

/**
 * Day arithmetic on the key itself, through UTC, so stepping a series never has
 * to care what a zone is doing about daylight saving.
 */
export function shiftDayKey(key: DateKey, days: number): DateKey {
  const [year, month, day] = key.split('-').map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));
  at.setUTCDate(at.getUTCDate() + days);
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** Whole days between two keys, in milliseconds. */
export function dayKeyDistance(from: DateKey, to: DateKey): number {
  const utc = (key: DateKey): number => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return utc(to) - utc(from);
}

/** The instant Tbilisi midnight opens on `key`. */
export function dayStartMs(key: DateKey): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) - TZ_OFFSET_MS;
}

/**
 * A Tbilisi wall-clock time on a given day, as an instant.
 *
 * This is the join between the two kinds of column the schema keeps: a
 * `TimeField` like `WorkingHours.start_time` is naive shop-local text, and a
 * `DateTimeField` like `Booking.start_at` is an instant. Every slot computation
 * crosses that seam, and doing it by hand is where a mock silently lands an
 * appointment four hours off.
 */
export function instantAt(key: DateKey, time: TimeString): number {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
  return dayStartMs(key) + hours * HOUR + minutes * MINUTE + seconds * 1000;
}

/** Minutes elapsed since Tbilisi midnight — for comparing against a `TimeField`. */
export function minutesOfDay(at: number): number {
  return (at - dayStartMs(dateKey(at))) / MINUTE;
}

/** `"HH:MM:SS"` from minutes since midnight. */
export function timeString(minutes: number): TimeString {
  const whole = Math.floor(minutes);
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}:00`;
}

/** `TimeField` text to minutes since midnight. */
export function timeToMinutes(time: TimeString): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Python's `datetime.weekday()`: 0 = Monday.
 *
 * `WorkingHours.weekday` and `ShopHours.weekday` both use it, and JavaScript's
 * `getDay()` is 0 = Sunday — the single easiest way to serve Tuesday's hours on
 * a Monday.
 */
export function weekdayOf(value: DateKey | number): Weekday {
  const key = typeof value === 'number' ? dateKey(value) : value;
  const [year, month, day] = key.split('-').map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return ((jsDay + 6) % 7) as Weekday;
}

// --------------------------------------------------------------------------- //
//  Intervals
//
//  The two primitives the slot algorithm is built out of
//  (`apps/bookings/services/availability.py::_subtract_intervals` and
//  `_align_up`). They live here, beside the clock and away from the store,
//  because `store.ts` needs them for the working-day test while it is still
//  rebasing a table set the `store` binding does not point at yet — and
//  `availability.ts` needs the same arithmetic on the live store. One copy,
//  two callers, no cycle.
// --------------------------------------------------------------------------- //

/** A half-open `[start, end)` span of epoch milliseconds. */
export type Interval = readonly [start: number, end: number];

/**
 * `_subtract_intervals`: punch every block out of every interval, in order.
 *
 * Half-open on both sides, so a block ending exactly where an interval starts
 * removes nothing — which is the same convention the booking EXCLUDE constraint
 * uses, and why back-to-back appointments are legal. Ascending order survives
 * and zero-length intervals are never emitted.
 */
export function subtractIntervals(intervals: Interval[], blocks: Interval[]): Interval[] {
  let result = intervals;
  for (const [blockStart, blockEnd] of blocks) {
    const next: Interval[] = [];
    for (const [start, end] of result) {
      if (blockEnd <= start || blockStart >= end) next.push([start, end]);
      else if (blockStart <= start && blockEnd < end) next.push([blockEnd, end]);
      else if (blockStart > start && blockEnd >= end) next.push([start, blockStart]);
      else if (blockStart > start && blockEnd < end) next.push([start, blockStart], [blockEnd, end]);
      // else: the block swallows the interval whole — emit nothing.
    }
    result = next;
  }
  return result;
}

/**
 * `_align_up`: the next instant on the slot grid.
 *
 * Reproduced literally, arithmetic and all, because the obvious rewrite —
 * "round up to the next multiple of N minutes since the epoch" — disagrees with
 * it for any granularity that does not divide 60. Python works on
 * `t.minute` alone, so a granularity of 25 restarts the grid every hour.
 *
 * Seconds force a whole step forward even when the minute is already on the
 * grid: `10:00:30` aligns to `10:15`, not `10:00`. That is what keeps a free
 * interval that opens mid-minute from producing a slot start in the past.
 *
 * Asia/Tbilisi is a whole-hour, DST-free offset, so the minutes and seconds of
 * the UTC instant are the minutes and seconds of the wall clock and no zone
 * round-trip is needed.
 */
export function alignUp(at: number, granularityMinutes: number): number {
  const minute = Math.floor(at / MINUTE) % 60;
  const withinMinute = ((at % MINUTE) + MINUTE) % MINUTE;
  const remainder = minute % granularityMinutes;
  if (remainder === 0 && withinMinute === 0) return at;
  const delta = remainder === 0 ? 0 : granularityMinutes - remainder;
  const aligned = at - withinMinute + delta * MINUTE;
  return withinMinute !== 0 && remainder === 0 ? aligned + granularityMinutes * MINUTE : aligned;
}

// --------------------------------------------------------------------------- //
//  Money
//
//  `numeric(10,2)` is exact decimal in Postgres and a 2-dp string on the wire.
//  JS `number` is neither, so every price crossing this boundary goes through
//  one of these three functions and arithmetic that has to be exact — the promo
//  discount — happens in integer tetri.
// --------------------------------------------------------------------------- //

/**
 * A `DecimalField(10, 2)` as DRF serialises it: a fixed-point string, two
 * decimals, always.
 *
 * `Math.round` is half-up (towards +∞), which disagrees with Postgres on a
 * negative half; rounding the magnitude instead gives the half-away-from-zero
 * the column actually stores. Prices are never negative, but a discount
 * calculation that briefly is would otherwise round the wrong way.
 */
export function decimalString(value: number | string): Money {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '0.00';
  const magnitude = Math.round(Math.abs(numeric) * 100) / 100;
  return (numeric < 0 ? -magnitude : magnitude).toFixed(2);
}

/** The same, for a nullable column. `null` in, `null` out. */
export function decimalStringOrNull(value: number | string | null | undefined): Money | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? decimalString(numeric) : null;
}

/** GEL to tetri. Integer arithmetic is the only exact arithmetic available. */
export function toMinor(value: Money | number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

/** Tetri back to the wire's 2-dp string. */
export function fromMinor(minor: number): Money {
  return (Math.round(minor) / 100).toFixed(2);
}

/**
 * Python's `round()` and `Decimal.quantize(ROUND_HALF_EVEN)`, both of which
 * break an exact tie towards the **even** neighbour. `Math.round` and `toFixed`
 * break it away from zero, so `round(0.00125, 4)` is `0.0012` in Django and
 * would be `0.0013` here.
 *
 * The two disagree only at an exact tie — a rate landing on `…5` in the fifth
 * decimal, or a revenue that splits into a half-tetri average — but
 * `avg_ticket_size` is printed verbatim on the dashboard, and the same window
 * read on the analytics page and in the XLSX export must not show a rate
 * moving. That is why this lives beside the money helpers rather than in
 * whichever analytics module got written first: `summaryPayload()` is its only
 * caller and `summaryPayload()` answers three endpoints.
 */
export function roundHalfEven(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const fraction = scaled - floor;
  if (fraction > 0.5) return (floor + 1) / factor;
  if (fraction < 0.5) return floor / factor;
  return (floor % 2 === 0 ? floor : floor + 1) / factor;
}
