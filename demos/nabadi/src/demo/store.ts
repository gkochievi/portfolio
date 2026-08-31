/**
 * The demo's database.
 *
 * A deep copy of the JSON seed, rebased so it always reads as if the shop had
 * been cutting hair right up to this morning, held in memory for the life of
 * the tab. Nothing here touches localStorage, sessionStorage or IndexedDB —
 * every visitor gets the same pristine shop, and a reload (or the banner's
 * Reset) puts it back. That includes the session: upstream keeps it in an
 * HttpOnly cookie the mock cannot reproduce and does not need, so a reload
 * signs you out, which is also the honest reading of "the server restarted".
 *
 * A port of the schema in `models.py` plus the two Postgres constraints that
 * cannot cross over (`exclude_overlapping_bookings` and
 * `unique_active_booking_per_customer_service`), which live here as predicates
 * the write paths call before mutating.
 *
 * It also owns the two things every write path leaves behind — `writeAudit()`
 * and `logNotification()` — because three handler modules call each of them and
 * three private conventions would make the console's Audit and Notifications
 * pages unreadable; and `validateSeed()`, which checks §3.3's invariants at
 * construction under `import.meta.env.DEV` so a broken seed says so instead of
 * rendering as a broken app.
 *
 * **Live binding.** `resetStore()` refills this object rather than replacing
 * it, so every module that imported `store` keeps looking at the right data.
 * The corollary matters: a handler must read `store.bookings` at call time —
 * a module that hoists the array into a local goes stale on the next reset.
 */

import {
  CLOCK,
  DAY,
  HOUR,
  MINUTE,
  dateKey,
  dayKeyDistance,
  dayStartMs,
  instantAt,
  nowIso,
  parseIso,
  subtractIntervals,
  todayKey,
  toApiDateTime,
  weekdayOf,
} from './base';
import type { Interval } from './base';
import { seed } from './seed';
import type {
  AuditLogRow,
  BarberRow,
  BarberServiceRow,
  BookingRow,
  Channel,
  DateKey,
  Language,
  NotificationTemplateRow,
  PromotionRow,
  Role,
  ServiceCategoryRow,
  ServiceRow,
  Tables,
  TableName,
  TemplateKey,
  UserRow,
} from './types';
import { ACTIVE_BOOKING_STATUSES, ROLES, TEMPLATE_KEYS } from './types';

// --------------------------------------------------------------------------- //
//  Id bands
//
//  Every table allocates from a band of its own, and `nextId()` refuses to
//  leave it. Postgres gives each table its own sequence starting at 1, which
//  means id 3 exists in a dozen tables at once; here a stray `"service_id": 4001`
//  in a hand-written seed would resolve silently against the barber table and
//  produce a booking for a service that is really a person. Disjoint bands turn
//  that into an empty lookup at the exact row that is wrong, and they make an
//  id readable: 11xxx is a booking, 9xxx is a service.
//
//  Ids below 1000 are reserved. `landing_content` is pinned to id 1 because
//  Django's singleton `save()` stomps the pk to 1, and it allocates nothing.
// --------------------------------------------------------------------------- //

interface Band {
  start: number;
  end: number;
}

const BANDS: Record<TableName, Band> = {
  users: { start: 1000, end: 1999 },
  password_reset_otps: { start: 2000, end: 2999 },
  specialties: { start: 3000, end: 3999 },
  barbers: { start: 4000, end: 4999 },
  working_hours: { start: 5000, end: 5999 },
  shop_hours: { start: 6000, end: 6999 },
  time_off: { start: 7000, end: 7999 },
  service_categories: { start: 8000, end: 8999 },
  services: { start: 9000, end: 9999 },
  barber_services: { start: 10_000, end: 10_999 },
  // Double-wide: the seed fills it and so does every visitor who books a chair.
  bookings: { start: 11_000, end: 12_999 },
  promotions: { start: 13_000, end: 13_999 },
  reviews: { start: 14_000, end: 14_999 },
  notification_templates: { start: 15_000, end: 15_999 },
  // Double-wide: every booking write appends one or two.
  notification_logs: { start: 16_000, end: 17_999 },
  site_settings: { start: 18_000, end: 18_999 },
  // 19xxx is skipped: it held the retired feature-permission table, and the
  // seed's audit ids are already written at 20xxx. Double-wide besides, because
  // every admin mutation appends one.
  audit_logs: { start: 20_000, end: 21_999 },
};

const TABLE_NAMES = Object.keys(BANDS) as TableName[];

// --------------------------------------------------------------------------- //
//  Construction
// --------------------------------------------------------------------------- //

/** Deep copy so the seed modules stay pristine and a reset can start over. */
function hydrate(): Tables {
  const data = structuredClone(seed) as Tables;
  if (import.meta.env.DEV) validateSeed(data);
  rebase(data);
  autoCompleteStale(data);
  return data;
}

let counters: Record<TableName, number>;

function highestIds(data: Tables): Record<TableName, number> {
  const next = {} as Record<TableName, number>;
  for (const table of TABLE_NAMES) {
    const rows = data[table] as Array<{ id: number }>;
    const highest = rows.reduce((max, row) => Math.max(max, row.id), BANDS[table].start - 1);
    // A seed row above its band's ceiling would make the very first `nextId()`
    // throw, three screens into the demo, on a line that looks unrelated. Say so
    // at construction instead. (`validateSeed` catches a below-floor id, which
    // the `reduce` seed silently clamps away.)
    if (highest > BANDS[table].end) {
      throw new Error(
        `Demo seed: "${table}" holds id ${highest}, above its band ceiling ${BANDS[table].end}.`,
      );
    }
    next[table] = highest + 1;
  }
  return next;
}

/**
 * Ids continue from the seed's highest and are never reused, like a real
 * sequence. Running out of band is a thrown error rather than a silent
 * collision with the next table — a demo that quietly starts writing bookings
 * into the promotions id space is worse than one that stops.
 */
export function nextId(table: TableName): number {
  const id = counters[table];
  if (id > BANDS[table].end) {
    throw new Error(`Demo id band exhausted for "${table}" (${BANDS[table].start}-${BANDS[table].end}).`);
  }
  counters[table] = id + 1;
  return id;
}

/**
 * Object URLs minted for uploaded service images and barber photos. There is no
 * storage to write to, so the row holds the URL and `serialize.ts` passes it
 * through untouched — which is what makes a photo appear a moment after it is
 * picked. Registered here so a reset can revoke them all.
 */
const objectUrls = new Set<string>();

export function trackObjectUrl(url: string): string {
  objectUrls.add(url);
  return url;
}

/** Safe to call with a seed media key, an http URL or null. */
export function releaseObjectUrl(url: string | null | undefined): void {
  if (url && objectUrls.delete(url)) URL.revokeObjectURL(url);
}

export function resetStore(): void {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  Object.assign(store, hydrate());
  counters = highestIds(store);
  session.userId = null;
}

// --------------------------------------------------------------------------- //
//  The session
//
//  One signed-in user id, in memory, no storage. Upstream this is a pair of
//  HttpOnly JWT cookies the SPA cannot read; what the SPA actually observes is
//  "GET /auth/me/ works" or "it 401s", and that is all this reproduces. There
//  are no tokens to forge — the server is a function call in the same tab, and
//  the banner signs you in as an admin on request.
// --------------------------------------------------------------------------- //

export const session: { userId: number | null } = { userId: null };

/**
 * The signed-in user, or null. Resolving through the table rather than trusting
 * the id is what makes a session for a deactivated account read as signed out,
 * exactly as `CookieJWTAuthentication.get_user()` raises when the row is gone
 * or inactive.
 */
export function currentUser(): UserRow | null {
  if (session.userId === null) return null;
  return store.users.find((user) => user.id === session.userId && user.is_active) ?? null;
}

export function isSignedIn(): boolean {
  return currentUser() !== null;
}

export function signIn(user: UserRow): void {
  session.userId = user.id;
}

export function signOut(): void {
  session.userId = null;
}

// --------------------------------------------------------------------------- //
//  Lookups
//
//  Linear scans over four barbers, ten services and a few dozen bookings:
//  cheaper than the indexes that would have to be kept honest across every
//  mutation, and each one re-imposes the model's `Meta.ordering` at the walk so
//  a caller never has to remember it.
// --------------------------------------------------------------------------- //

export function userById(id: number | null | undefined): UserRow | undefined {
  return id == null ? undefined : store.users.find((row) => row.id === id);
}

/** `USERNAME_FIELD` lookups are exact; `email` is matched case-insensitively. */
export function userByPhone(phone: string): UserRow | undefined {
  return store.users.find((row) => row.phone === phone);
}

export function userByEmail(email: string): UserRow | undefined {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return undefined;
  return store.users.find((row) => (row.email ?? '').toLowerCase() === wanted);
}

export function barberById(id: number | null | undefined): BarberRow | undefined {
  return id == null ? undefined : store.barbers.find((row) => row.id === id);
}

/**
 * The `barber_profile` reverse accessor. Nobody signs in as a barber, so this
 * never gates a request; it answers "which barbers row belongs to this user
 * row", for `serializeStaffUser`'s `barber_id` and for `ensureBarberProfile`.
 */
export function barberForUser(userId: number | null | undefined): BarberRow | undefined {
  return userId == null ? undefined : store.barbers.find((row) => row.user_id === userId);
}

export function serviceById(id: number | null | undefined): ServiceRow | undefined {
  return id == null ? undefined : store.services.find((row) => row.id === id);
}

export function categoryById(id: number | null | undefined): ServiceCategoryRow | undefined {
  return id == null ? undefined : store.service_categories.find((row) => row.id === id);
}

export function bookingById(id: number | null | undefined): BookingRow | undefined {
  return id == null ? undefined : store.bookings.find((row) => row.id === id);
}

export function promotionById(id: number | null | undefined): PromotionRow | undefined {
  return id == null ? undefined : store.promotions.find((row) => row.id === id);
}

/** `code__iexact` — the promo field is case-sensitive in the DB, not in lookups. */
export function promotionByCode(code: string): PromotionRow | undefined {
  const wanted = code.trim().toLowerCase();
  if (!wanted) return undefined;
  return store.promotions.find((row) => row.code.toLowerCase() === wanted);
}

export function barberServiceFor(barberId: number, serviceId: number): BarberServiceRow | undefined {
  return store.barber_services.find(
    (row) => row.barber_id === barberId && row.service_id === serviceId,
  );
}

/** `Meta.ordering = ["display_order", "user__first_name"]` — a join ordering. */
export function orderedBarbers(rows: BarberRow[] = store.barbers): BarberRow[] {
  return [...rows].sort(
    (left, right) =>
      left.display_order - right.display_order ||
      (userById(left.user_id)?.first_name ?? '').localeCompare(
        userById(right.user_id)?.first_name ?? '',
        'ka',
      ),
  );
}

/** `Meta.ordering = ["display_order", "name"]`, shared by services and categories. */
export function orderedByDisplay<T extends { display_order: number; name: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      left.display_order - right.display_order || left.name.localeCompare(right.name, 'ka'),
  );
}

/** `booking.review` — the O2O reverse accessor. */
export function reviewForBooking(bookingId: number) {
  return store.reviews.find((row) => row.booking_id === bookingId);
}

/**
 * The three availability lookups take the table set explicitly, because the
 * date-rebasing pass below needs them while it is still working on a copy the
 * `store` binding does not point at yet. The exported wrappers under each one
 * are what handlers call.
 */
function hoursOn(data: Tables, barberId: number, key: DateKey): { start: string; end: string } | null {
  const weekday = weekdayOf(key);
  const own = data.working_hours.find(
    (row) => row.barber_id === barberId && row.weekday === weekday,
  );
  if (own) return { start: own.start_time, end: own.end_time };
  const shop = data.shop_hours.find((row) => row.weekday === weekday);
  return shop ? { start: shop.start_time, end: shop.end_time } : null;
}

function timeOffBlocksIn(data: Tables, barberId: number, startMs: number, endMs: number): Interval[] {
  const blocks: Interval[] = [];
  for (const row of data.time_off) {
    // A shop-wide closure has a null barber and stops everyone.
    if (row.barber_id !== null && row.barber_id !== barberId) continue;
    const from = parseIso(row.start_datetime);
    const to = parseIso(row.end_datetime);
    // Strict on both sides: a closure ending exactly at opening time has no
    // effect, which is the half-open convention the whole mock uses.
    if (from < endMs && startMs < to) blocks.push([from, to]);
  }
  return blocks;
}

function timeOffOverlapsIn(
  data: Tables,
  barberId: number,
  startMs: number,
  endMs: number,
): boolean {
  return timeOffBlocksIn(data, barberId, startMs, endMs).length > 0;
}

/**
 * The parts of a day the barber is actually free to be booked in: the working
 * window with every time-off block punched out of it.
 *
 * The blackout this replaced was wrong in a way that reached the screen. A
 * one-hour dentist appointment overlaps the opening interval, so a
 * "does any time off overlap the day?" test greys the whole day out — while
 * `compute_available_slots` subtracts the hour and keeps the other seven
 * (`apps/bookings/services/availability.py:56-63`). The customer's calendar
 * would refuse a day with seven bookable hours in it, and `slide()` would
 * refuse to rebase a booking onto it.
 *
 * Bookings are **not** subtracted here: this is the barber's shift, and it is
 * shared by the rebase (which needs to know a day exists before it moves a
 * booking onto it) and by `availability.ts` (which subtracts the bookings
 * itself, per service).
 */
function openIntervalsIn(data: Tables, barberId: number, key: DateKey): Interval[] {
  const hours = hoursOn(data, barberId, key);
  if (!hours) return [];
  const opens = instantAt(key, hours.start);
  const closes = instantAt(key, hours.end);
  if (!(opens < closes)) return [];
  return subtractIntervals([[opens, closes]], timeOffBlocksIn(data, barberId, opens, closes));
}

function worksOn(data: Tables, barberId: number, key: DateKey): boolean {
  const grain = bookingSettingIn(data, 'slot_granularity_minutes') * MINUTE;
  return openIntervalsIn(data, barberId, key).some(([start, end]) => end - start >= grain);
}

/**
 * The barber's own hours for that weekday, falling back to the shop's row. A
 * pure fallback, never an intersection: a barber with a row of their own may
 * work outside shop hours, and a barber with no row inherits the shop's. A
 * missing row on both sides means closed — which is how the seed says the shop
 * does not open on Sunday. (`types.ts::WorkingHoursRow`, `schema.md` §2 and
 * §6.1 all state this; change one and change all four.)
 */
export function hoursFor(barberId: number, key: DateKey): { start: string; end: string } | null {
  return hoursOn(store, barberId, key);
}

/** Time off covering an interval — the barber's own rows and shop-wide closures. */
export function timeOffOverlapping(barberId: number, startMs: number, endMs: number): boolean {
  return timeOffOverlapsIn(store, barberId, startMs, endMs);
}

/**
 * The day's free shift, time off removed. `availability.ts` starts here and
 * subtracts the barber's active bookings; nothing else should re-derive it.
 */
export function openIntervals(barberId: number, key: DateKey): Interval[] {
  return openIntervalsIn(store, barberId, key);
}

/**
 * True when the barber has hours that day and at least one granularity unit of
 * them survives their time off. Deliberately *not* "no closure touches the
 * day": a lunch break does not close a shop.
 */
export function barberWorksOn(barberId: number, key: DateKey): boolean {
  return worksOn(store, barberId, key);
}

// --------------------------------------------------------------------------- //
//  Runtime settings (`apps/cms/settings_helpers.py`)
// --------------------------------------------------------------------------- //

/** The static `django.conf.settings` fallbacks, used when no row coerces. */
export const BOOKING_DEFAULTS = {
  slot_granularity_minutes: 15,
  min_booking_lead_minutes: 30,
  max_booking_advance_days: 60,
  cancellation_window_hours: 2,
} as const;

export type BookingSettingKey = keyof typeof BOOKING_DEFAULTS;

/**
 * Both settings readers take the table set explicitly for the same reason the
 * availability lookups do: the rebase runs inside `hydrate()`, where the `store`
 * binding is still in its temporal dead zone, and it needs the slot granularity
 * to decide whether a barber works a day. The exported wrappers below are what
 * handlers call.
 */
function getSettingIn(data: Tables, key: string): unknown {
  const row = data.site_settings.find((entry) => entry.key === key);
  // A row holding JSON `null` reads as absent, exactly as `get_setting()` does:
  // it cannot tell the two apart and falls back either way.
  return row === undefined || row.value === null ? undefined : row.value;
}

function bookingSettingIn(data: Tables, key: BookingSettingKey): number {
  const raw = getSettingIn(data, key);
  const numeric = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : Number.NaN;
  return Number.isInteger(numeric) ? numeric : BOOKING_DEFAULTS[key];
}

/** The raw JSON document a settings row holds, or `undefined` when absent. */
export function getSetting(key: string): unknown {
  return getSettingIn(store, key);
}

/**
 * A booking knob: the row's value coerced with `int()`, or the static default
 * when the row is absent or the coercion would have raised.
 */
export function bookingSetting(key: BookingSettingKey): number {
  return bookingSettingIn(store, key);
}

const FALSY_STRINGS = new Set(['false', '0', 'off', 'no', '']);

/**
 * Runtime kill switch for outbound booking SMS. An absent row means enabled, and
 * so does any value outside the falsy-string set — `Settings.tsx` round-trips
 * the row as a boolean but a hand-edited seed may hold `"off"`.
 *
 * What "disabled" means on a booking write is settled in `logNotification`: the
 * SMS channel writes **no log row at all** (`NotificationLog` has no "skipped"
 * state, and a `success: false` row would read as a delivery failure), the email
 * channel is unaffected, and the write itself still succeeds. The 409
 * `sms_disabled` code belongs to `POST /admin/notification-templates/{id}/test-send/`
 * alone. See `schema.md` §6.3.
 */
export function smsNotificationsEnabled(): boolean {
  const value = getSetting('sms_notifications_enabled');
  if (value === undefined) return true;
  if (typeof value === 'string') return !FALSY_STRINGS.has(value.trim().toLowerCase());
  return Boolean(value);
}

// --------------------------------------------------------------------------- //
//  The two constraints Postgres enforced
//
//  Both are partial: they only see `pending` and `confirmed` rows, so
//  cancelling a booking frees its slot instantly and a completed one never
//  blocks a back-dated write. Call them before mutating, then mutate — JS is
//  single-threaded, so there is no race to lose and the `select_for_update`
//  they were paired with is a no-op.
// --------------------------------------------------------------------------- //

function isActive(row: BookingRow): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(row.status);
}

/**
 * `exclude_overlapping_bookings`: same barber, overlapping `[start, end)`.
 * Half-open, so back-to-back appointments at 10:30 are legal and only strict
 * interior overlap conflicts. Pass the candidate's own id so an update does not
 * collide with itself.
 */
export function overlapsExistingBooking(candidate: {
  id?: number;
  barber_id: number;
  start_at: string;
  end_at: string;
  status: string;
}): boolean {
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(candidate.status)) return false;
  const start = parseIso(candidate.start_at);
  const end = parseIso(candidate.end_at);
  return store.bookings.some(
    (row) =>
      row.id !== candidate.id &&
      isActive(row) &&
      row.barber_id === candidate.barber_id &&
      parseIso(row.start_at) < end &&
      start < parseIso(row.end_at),
  );
}

/**
 * `unique_active_booking_per_customer_service`: one active booking per
 * (customer, service), regardless of barber or date. Walk-ins are exempt —
 * `customer_id IS NULL` rows never collide.
 */
export function duplicatesActiveBooking(candidate: {
  id?: number;
  customer_id: number | null;
  service_id: number;
  status: string;
}): boolean {
  if (candidate.customer_id == null) return false;
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(candidate.status)) return false;
  return store.bookings.some(
    (row) =>
      row.id !== candidate.id &&
      row.customer_id === candidate.customer_id &&
      row.service_id === candidate.service_id &&
      isActive(row),
  );
}

// --------------------------------------------------------------------------- //
//  Write-path side effects
//
//  Every admin mutation leaves an audit row and every booking write leaves a
//  notification log. Both are here rather than beside a handler because three
//  modules write each of them, `nextId` and the actor snapshot live here, and
//  three private conventions would make the console's Audit and Notifications
//  pages unreadable. See `schema.md` §6.5 for the action vocabulary.
// --------------------------------------------------------------------------- //

/**
 * Anything carrying the acting user — a `DemoRequest` satisfies it structurally,
 * so a handler writes `writeAudit(request, …)` and store.ts never has to import
 * the router.
 */
export interface AuditSource {
  user: UserRow | null;
}

/**
 * `audit.helpers.audit_log`. Synchronous, exactly as upstream: the view calls it
 * inline, not through `on_commit`, so the row is readable the instant the
 * mutation returns and a failed request leaves no trace.
 *
 * `actor_role` is a denormalised snapshot — a later role change on the actor
 * must not rewrite history — and `actor_id` is null for an unauthenticated
 * write, which is why the column is nullable at all.
 *
 * `entity_id` is a string, because it also has to hold a composite key and the
 * empty string for an entity that has no id yet (an export, a bulk update).
 *
 * The payload conventions are a contract, not a preference:
 *
 * | verb | payload |
 * |---|---|
 * | `<entity>.create` | the validated body, flat, sensitive keys dropped |
 * | `<entity>.update` | `{changes: {field: {old, new}}}` — only fields that moved |
 * | `<entity>.delete` | `{snapshot: {…}}` — the row as it was, taken *before* the splice |
 * | a named transition | `{field: {old, new}}` at the top level, e.g. `{status: {old, new}}` |
 * | an export | `{filters: {…}, row_count: n}` |
 *
 * Never put a password, token, OTP or secret in a payload; `writeAudit` drops
 * those keys at the top level as a backstop, but the rule is the caller's.
 */
const SENSITIVE_PAYLOAD_KEYS = new Set([
  'password',
  'new_password',
  'old_password',
  'secret',
  'token',
  'otp',
  'api_key',
  'hash',
  'passcode',
]);

export function writeAudit(
  source: AuditSource,
  action: string,
  entity: string,
  entityId: number | string | null,
  payload: Record<string, unknown> = {},
): AuditLogRow {
  const actor = source.user;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SENSITIVE_PAYLOAD_KEYS.has(key)) safe[key] = value;
  }
  const row: AuditLogRow = {
    id: nextId('audit_logs'),
    actor_id: actor?.id ?? null,
    actor_role: actor?.role ?? '',
    action,
    entity,
    entity_id: entityId === null ? '' : String(entityId),
    payload: safe,
    // There is no proxy and no header to read: one loopback address, one agent.
    ip: '127.0.0.1',
    user_agent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    created_at: nowIso(),
  };
  store.audit_logs.push(row);
  return row;
}

/** `(key, channel, language)`, falling back to the English row as `_send` does. */
export function templateFor(
  key: TemplateKey,
  channel: Channel,
  language: Language,
): NotificationTemplateRow | undefined {
  const rows = store.notification_templates;
  return (
    rows.find(
      (row) => row.key === key && row.channel === channel && row.language === language && row.is_active,
    ) ?? rows.find((row) => row.key === key && row.channel === channel && row.language === 'en' && row.is_active)
  );
}

/** `render.context_for_booking` — the placeholder set every template may use. */
export function notificationContext(booking: BookingRow): Record<string, string> {
  const customer = userById(booking.customer_id);
  const barberUser = userById(barberById(booking.barber_id)?.user_id);
  return {
    customer_first_name: customer ? customer.first_name : booking.walk_in_name,
    customer_phone: customer ? customer.phone : booking.walk_in_phone,
    barber_first_name: barberUser?.first_name ?? '',
    barber_last_name: barberUser?.last_name ?? '',
    service_name: serviceById(booking.service_id)?.name ?? '',
    start_at: booking.start_at,
    // `timezone.localtime(...).strftime("%Y-%m-%d %H:%M")` — shop-local, always.
    start_at_local: toApiDateTime(booking.start_at).slice(0, 16).replace('T', ' '),
    price: booking.price_at_booking,
    booking_id: String(booking.id),
  };
}

/**
 * `render_template`. Django's engine reduced to the one feature the seeded
 * bodies use — `{{ name }}`, with optional inner spaces. An unknown placeholder
 * renders as `""`, which is what Django's default `string_if_invalid` does.
 */
export function renderTemplate(
  template: Pick<NotificationTemplateRow, 'subject' | 'body'>,
  context: Record<string, string>,
): { subject: string; body: string } {
  const fill = (text: string): string =>
    text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, name: string) => context[name] ?? '');
  return { subject: fill(template.subject ?? ''), body: fill(template.body) };
}

/**
 * `notifications.tasks.send_booking_notification`, minus the provider.
 *
 * Both channels, in upstream's order and with upstream's rules:
 *
 * - **SMS** goes to the account phone, else the walk-in phone. It is suppressed
 *   entirely when `smsNotificationsEnabled()` is false — **no log row at all**,
 *   because `NotificationLog` has no "skipped" state and a `success: false` row
 *   would read as a delivery failure in the console (`test_sms_toggle.py`
 *   asserts exactly this). The 409 `sms_disabled` code belongs to the
 *   test-send endpoint alone; a booking write never raises it.
 * - **Email** goes to the account email only — a walk-in has none — and is
 *   **not** gated by the SMS toggle.
 * - A channel with no recipient, no active template, or a success already
 *   logged for `(booking, key, channel)` is skipped.
 *
 * Deferred with `queueMicrotask` because upstream enqueues the Celery task from
 * `transaction.on_commit`: the notification is a consequence of a committed
 * write, so it must not run inside the mutation and must not be able to fail it.
 *
 * Language is KA for everyone — `_resolve_language` has no per-user preference
 * to read yet and returns the shop's own language.
 */
export function logNotification(
  booking: BookingRow,
  key: TemplateKey,
  language: Language = 'ka',
): void {
  queueMicrotask(() => {
    try {
      const context = notificationContext(booking);
      const customer = userById(booking.customer_id);
      const phone = customer ? customer.phone : booking.walk_in_phone;
      if (phone && smsNotificationsEnabled() && !alreadyDelivered(booking.id, key, 'sms')) {
        appendNotificationLog(booking, key, 'sms', language, phone, context);
      }
      const email = customer?.email ?? '';
      if (email && !alreadyDelivered(booking.id, key, 'email')) {
        appendNotificationLog(booking, key, 'email', language, email, context);
      }
    } catch (error) {
      // A microtask throw is unhandled and would take the tab with it. The
      // notification log is not worth that.
      console.error('[demo] notification log failed', error);
    }
  });
}

/** `_already_delivered` — a *successful* row for the triple, per channel. */
function alreadyDelivered(bookingId: number, key: TemplateKey, channel: Channel): boolean {
  return store.notification_logs.some(
    (row) =>
      row.booking_id === bookingId &&
      row.template_key === key &&
      row.channel === channel &&
      row.success,
  );
}

function appendNotificationLog(
  booking: BookingRow,
  key: TemplateKey,
  channel: Channel,
  language: Language,
  recipient: string,
  context: Record<string, string>,
): void {
  const template = templateFor(key, channel, language);
  // `_send` logs a warning and returns when no active template matches; it does
  // not invent one and it does not write a failure row.
  if (!template) {
    console.warn(`[demo] no active notification template for ${key}/${channel}/${language}`);
    return;
  }
  const { subject, body } = renderTemplate(template, context);
  store.notification_logs.push({
    id: nextId('notification_logs'),
    booking_id: booking.id,
    template_key: key,
    channel,
    language,
    recipient,
    subject,
    body,
    // The demo has no provider to fail, so every attempted send succeeds. The
    // seed carries the failure rows the console needs to render that column.
    success: true,
    error: '',
    created_at: nowIso(),
  });
}

// --------------------------------------------------------------------------- //
//  The stale-booking sweep (`bookings.tasks.auto_complete_stale_bookings`)
// --------------------------------------------------------------------------- //

/** `BOOKINGS_AUTO_COMPLETE_GRACE_HOURS`, env-overridable upstream. */
export const AUTO_COMPLETE_GRACE_HOURS = 24;

function autoCompleteStale(data: Tables): number {
  const cutoff = CLOCK.now() - AUTO_COMPLETE_GRACE_HOURS * HOUR;
  const stamp = toApiDateTime(CLOCK.now());
  let completed = 0;
  for (const booking of data.bookings) {
    if (!isActive(booking)) continue;
    if (parseIso(booking.end_at) >= cutoff) continue;
    booking.status = 'completed';
    // The real task is a bulk `.update()`, so no signal fires and `auto_now` is
    // bypassed — hence the explicit stamp, and no notification, and no audit row.
    booking.updated_at = stamp;
    completed += 1;
  }
  return completed;
}

/**
 * Hourly upstream; here it runs at construction and again on every dispatch,
 * because a demo has no worker and the alternative is worse than a redundant
 * scan of forty rows.
 *
 * Without it an elapsed `pending` booking sits invisible in every `/me/` tab
 * while still arming the `(customer, service)` partial unique, and the visitor
 * gets a permanent, unexplainable `duplicate_active_booking` 409 on the one
 * service they tried first. It is also the only thing that can move a booking
 * the visitor made into `completed`, which is what makes leaving a review
 * reachable at all.
 */
export function autoCompleteStaleBookings(): number {
  return autoCompleteStale(store);
}

// --------------------------------------------------------------------------- //
//  Seed validation
//
//  §3.3's eleven invariants, checked at construction under `import.meta.env.DEV`
//  and skipped in the production bundle — a shipped demo should not pay for a
//  check whose only audience is the person editing the seed.
//
//  It exists because the invariants are silent when broken. A media key naming a
//  file that is not there is a broken `<img>` three screens in; a missing
//  notification template is a 404 on one of four tabs; a dangling `service_id`
//  is an empty lookup that renders as `""`. Every one of those reads as "the
//  demo is broken" rather than "the seed is wrong", and the shipped seed had two
//  of them.
// --------------------------------------------------------------------------- //

/**
 * What actually exists under `public/media/`. There is no filesystem to stat
 * from a browser, so the inventory is written down — and must be extended when
 * a file is added. `schema.md` §3.3.11 carries the same list for seed authors.
 */
export const MEDIA_INVENTORY: readonly string[] = [
  'barbers/barber-1.svg',
  'barbers/barber-2.svg',
  'barbers/barber-3.svg',
  'barbers/barber-4.svg',
  'barbers/placeholder.svg',
  'landing/about.svg',
  'landing/gallery-1.svg',
  'landing/gallery-2.svg',
  'landing/gallery-3.svg',
  'landing/gallery-4.svg',
  'landing/gallery-5.svg',
  'landing/gallery-6.svg',
  'landing/hero.svg',
  'services/beard-sculpt.svg',
  'services/buzz-cut.svg',
  'services/classic-haircut.svg',
  'services/cut-and-beard.svg',
  'services/cut-and-shave.svg',
  'services/eyebrow-trim.svg',
  'services/hair-wash.svg',
  'services/hot-towel-shave.svg',
  'services/kids-cut.svg',
  'services/skin-fade.svg',
];

export function validateSeed(data: Tables): void {
  const problems: string[] = [];
  const complain = (table: string, id: number | string, message: string): void => {
    problems.push(`${table}#${id}: ${message}`);
  };

  // 1 + the band rule for a row's own id.
  const ids: Partial<Record<TableName, Set<number>>> = {};
  for (const table of TABLE_NAMES) {
    const set = new Set<number>();
    for (const row of data[table] as Array<{ id: number }>) {
      if (set.has(row.id)) complain(table, row.id, 'duplicate id');
      set.add(row.id);
      const band = BANDS[table];
      if (row.id < band.start || row.id > band.end) {
        complain(table, row.id, `id outside its band ${band.start}-${band.end}`);
      }
    }
    ids[table] = set;
  }
  const reference = (
    table: TableName,
    from: string,
    rowId: number,
    field: string,
    value: number | null,
  ): void => {
    if (value === null || value === undefined) return;
    if (!ids[table]?.has(value)) complain(from, rowId, `${field} ${value} does not resolve in "${table}"`);
  };

  for (const row of data.barbers) {
    reference('users', 'barbers', row.id, 'user_id', row.user_id);
    for (const specialtyId of row.specialty_ids) {
      reference('specialties', 'barbers', row.id, 'specialty_ids', specialtyId);
    }
  }
  for (const row of data.working_hours) reference('barbers', 'working_hours', row.id, 'barber_id', row.barber_id);
  for (const row of data.time_off) reference('barbers', 'time_off', row.id, 'barber_id', row.barber_id);
  for (const row of data.services) reference('service_categories', 'services', row.id, 'category_id', row.category_id);
  for (const row of data.barber_services) {
    reference('barbers', 'barber_services', row.id, 'barber_id', row.barber_id);
    reference('services', 'barber_services', row.id, 'service_id', row.service_id);
  }
  for (const row of data.password_reset_otps) reference('users', 'password_reset_otps', row.id, 'user_id', row.user_id);
  for (const row of data.notification_logs) reference('bookings', 'notification_logs', row.id, 'booking_id', row.booking_id);
  for (const row of data.audit_logs) reference('users', 'audit_logs', row.id, 'actor_id', row.actor_id);
  for (const id of data.landing_content.featured_reviews) {
    reference('reviews', 'landing_content', 1, 'featured_reviews', id);
  }
  for (const row of data.bookings) {
    reference('users', 'bookings', row.id, 'customer_id', row.customer_id);
    reference('barbers', 'bookings', row.id, 'barber_id', row.barber_id);
    reference('services', 'bookings', row.id, 'service_id', row.service_id);
    reference('promotions', 'bookings', row.id, 'promotion_id', row.promotion_id);
    reference('users', 'bookings', row.id, 'cancelled_by_id', row.cancelled_by_id);
  }

  // 2. Ordered spans.
  for (const row of data.bookings) {
    if (!(parseIso(row.start_at) < parseIso(row.end_at))) complain('bookings', row.id, 'start_at >= end_at');
  }
  for (const row of data.working_hours) {
    if (!(row.start_time < row.end_time)) complain('working_hours', row.id, 'start_time >= end_time');
  }
  for (const row of data.shop_hours) {
    if (!(row.start_time < row.end_time)) complain('shop_hours', row.id, 'start_time >= end_time');
  }
  for (const row of data.time_off) {
    if (!(parseIso(row.start_datetime) < parseIso(row.end_datetime))) {
      complain('time_off', row.id, 'start_datetime >= end_datetime');
    }
  }

  const active = (row: BookingRow): boolean =>
    (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(row.status);

  // 3 + 4. The two Postgres constraints, on the seed itself.
  const live = data.bookings.filter(active);
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const left = live[i];
      const right = live[j];
      if (
        left.barber_id === right.barber_id &&
        parseIso(left.start_at) < parseIso(right.end_at) &&
        parseIso(right.start_at) < parseIso(left.end_at)
      ) {
        complain('bookings', left.id, `overlaps booking ${right.id} on barber ${left.barber_id}`);
      }
      if (
        left.customer_id !== null &&
        left.customer_id === right.customer_id &&
        left.service_id === right.service_id
      ) {
        complain('bookings', left.id, `duplicates active booking ${right.id} for the same service`);
      }
    }
  }

  // 5. Nothing was created after the thing it records.
  for (const row of data.bookings) {
    if (parseIso(row.created_at) > parseIso(row.start_at)) complain('bookings', row.id, 'created_at > start_at');
  }
  const ordered = (table: string, rows: Array<{ id: number; created_at: string; updated_at: string }>): void => {
    for (const row of rows) {
      if (parseIso(row.updated_at) < parseIso(row.created_at)) complain(table, row.id, 'updated_at < created_at');
    }
  };
  ordered('bookings', data.bookings);
  ordered('reviews', data.reviews);
  ordered('promotions', data.promotions);

  // 6 + 7. Users.
  const emails = new Set<string>();
  for (const row of data.users) {
    const staff = row.role === 'admin';
    if (row.is_staff !== staff) complain('users', row.id, `is_staff should be ${staff} for role "${row.role}"`);
    if (!ROLES.includes(row.role)) complain('users', row.id, `unknown role "${row.role}"`);
    if (row.email === '') complain('users', row.id, 'email is "" — use null');
    if (row.email !== null) {
      const key = row.email.toLowerCase();
      if (emails.has(key)) complain('users', row.id, `email ${row.email} is not unique`);
      emails.add(key);
    }
  }

  // 8. Account booking or walk-in, never half of each.
  for (const row of data.bookings) {
    if (row.customer_id === null) {
      if (!row.walk_in_name) complain('bookings', row.id, 'walk-in with no walk_in_name');
    } else if (row.walk_in_name || row.walk_in_phone || row.walk_in_email) {
      complain('bookings', row.id, 'account booking carries walk_in_* values');
    }
  }

  // 9. Reviews hang off a completed booking, one each.
  const reviewed = new Set<number>();
  for (const row of data.reviews) {
    const booking = data.bookings.find((entry) => entry.id === row.booking_id);
    if (!booking) complain('reviews', row.id, `booking_id ${row.booking_id} does not resolve`);
    else if (booking.status !== 'completed') complain('reviews', row.id, `booking ${booking.id} is ${booking.status}, not completed`);
    if (reviewed.has(row.booking_id)) complain('reviews', row.id, `booking ${row.booking_id} already has a review`);
    reviewed.add(row.booking_id);
  }

  // 10. The one table whose row *count* is the invariant.
  const expectedTemplates = TEMPLATE_KEYS.length * 4;
  if (data.notification_templates.length !== expectedTemplates) {
    problems.push(`notification_templates: ${data.notification_templates.length} rows, expected ${expectedTemplates} (4 keys x 2 channels x 2 languages)`);
  }
  for (const row of data.notification_templates) {
    if (row.channel === 'sms' && row.subject !== '') complain('notification_templates', row.id, 'SMS row carries a subject');
    if (row.channel === 'email' && !row.subject) complain('notification_templates', row.id, 'email row has no subject');
  }

  // 11. Every media key names a file that is really there.
  const media = new Set(MEDIA_INVENTORY);
  const checkMedia = (table: string, id: number, field: string, key: string | null): void => {
    if (!key) return;
    if (/^(https?:|blob:|data:)/.test(key)) return;
    if (!media.has(key)) complain(table, id, `${field} "${key}" is not under public/media/`);
  };
  for (const row of data.barbers) checkMedia('barbers', row.id, 'photo', row.photo);
  for (const row of data.services) checkMedia('services', row.id, 'image', row.image);
  checkMedia('landing_content', 1, 'hero_image_url', data.landing_content.hero_image_url);
  data.landing_content.gallery_image_urls.forEach((key, index) => {
    checkMedia('landing_content', 1, `gallery_image_urls[${index}]`, key);
  });

  if (problems.length > 0) {
    throw new Error(`Demo seed violates schema.md §3.3:\n  - ${problems.join('\n  - ')}`);
  }
}

// --------------------------------------------------------------------------- //
//  DATE REBASING
//
//  A seed with absolute dates is stale the day after it is written: nothing
//  booked today, an empty week ahead, every promotion expired. So the whole
//  world slides by the whole-day distance from the newest booking to today,
//  anything that has already happened is squeezed into the elapsed part of
//  today, short-lived codes are re-armed against the real clock, and finally
//  the *mix* is restored — some appointments behind us, some later today, some
//  ahead — by moving the fewest rows the smallest distance.
//
//  Phase order matters: shift, then compress, then realign.
// --------------------------------------------------------------------------- //

/**
 * Columns recording something that has already happened. Shifted, squeezed into
 * the elapsed part of today, then clamped so nothing in the archive is newer
 * than the moment it is read.
 */
const PAST_FIELDS: Partial<Record<TableName, string[]>> = {
  users: ['date_joined', 'last_login'],
  password_reset_otps: ['created_at', 'consumed_at'],
  bookings: ['created_at', 'updated_at', 'reminder_24h_sent_at', 'reminder_1h_sent_at'],
  reviews: ['created_at', 'updated_at'],
  promotions: ['created_at', 'updated_at'],
  notification_templates: ['updated_at'],
  notification_logs: ['created_at'],
  site_settings: ['updated_at'],
  audit_logs: ['created_at'],
};

/**
 * Columns naming a position rather than a past event: an appointment, a
 * closure, a promotion window. These get the day shift and nothing else.
 * Squeezing an appointment booked for 15:00 into the part of the day that has
 * already elapsed would move a real booking, and clamping it to now would erase
 * the window entirely.
 */
const SPAN_FIELDS: Partial<Record<TableName, string[]>> = {
  bookings: ['start_at', 'end_at'],
  time_off: ['start_datetime', 'end_datetime'],
  promotions: ['valid_from', 'valid_until'],
};

/**
 * `WorkingHours.start_time` and friends are deliberately absent from both
 * tables: a `TimeField` is a fact about the shop's week, not a position
 * relative to now, and sliding it would move opening time every time the demo
 * is opened.
 */

type Row = Record<string, unknown>;

function eachRow(data: Tables, table: string, apply: (row: Row) => void): void {
  const rows = (data as unknown as Record<string, unknown>)[table];
  if (Array.isArray(rows)) rows.forEach((row) => apply(row as Row));
  else if (rows) apply(rows as Row);
}

function shiftFields(data: Tables, map: Partial<Record<TableName, string[]>>, offset: number): void {
  for (const [table, fields] of Object.entries(map)) {
    eachRow(data, table, (row) => {
      for (const field of fields) {
        const value = row[field];
        if (typeof value !== 'string' || !value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) row[field] = toApiDateTime(parsed + offset);
      }
    });
  }
}

function rebase(data: Tables): void {
  // The anchor is the newest booking *creation*, not the newest appointment.
  // Anchoring on `start_at` would drag the furthest-ahead booking back to today
  // and leave the demo with nothing in its future at all.
  let newest = Number.NEGATIVE_INFINITY;
  for (const booking of data.bookings) {
    const parsed = Date.parse(booking.created_at);
    if (Number.isFinite(parsed) && parsed > newest) newest = parsed;
  }

  if (Number.isFinite(newest)) {
    // A whole number of days, measured in Tbilisi, so every row keeps its time
    // of day: the seed's ten-o'clock appointments stay ten-o'clock appointments.
    const offset = dayKeyDistance(dateKey(newest), todayKey());
    if (offset !== 0) {
      shiftFields(data, PAST_FIELDS, offset);
      shiftFields(data, SPAN_FIELDS, offset);
      const landing = Date.parse(data.landing_content.updated_at);
      if (Number.isFinite(landing)) {
        data.landing_content.updated_at = toApiDateTime(landing + offset);
      }
    }
  }

  compressToday(data);
  rearmOtps(data);
  realignBookings(data);
}

/**
 * Pull today's past-tense rows back into the part of the day that has actually
 * happened.
 *
 * The shift moves whole days, so every row keeps its time of day — which means
 * the anchor day's afternoon rows land in the *future* for anyone opening the
 * demo before then, i.e. all of European and US business hours. Django could
 * not produce that: `created_at` is `auto_now_add` and `updated_at` follows it.
 * Squeezing the anchor day into the elapsed fraction of today keeps the
 * ordering and the spread while putting nothing after now.
 */
function compressToday(data: Tables): void {
  const today = todayKey();
  const start = dayStartMs(today);
  const now = CLOCK.now();
  const scale = Math.min(Math.max(now - start, 0) / DAY, 1);

  const squeeze = (value: string): string => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    const at = dateKey(parsed) === today ? start + (parsed - start) * scale : parsed;
    // Belt and braces: a row whose day survived the shift ahead of the anchor
    // still may not be newer than the moment it is read.
    return toApiDateTime(Math.min(at, now));
  };

  for (const [table, fields] of Object.entries(PAST_FIELDS)) {
    eachRow(data, table, (row) => {
      for (const field of fields) {
        const value = row[field];
        if (typeof value === 'string' && value) row[field] = squeeze(value);
      }
    });
  }
  data.landing_content.updated_at = squeeze(data.landing_content.updated_at);

  // The clamp can collapse two timestamps that used to be minutes apart onto
  // the same instant, and a row that was edited after it was created must still
  // read that way.
  const notBefore = (row: { created_at: string; updated_at: string }): void => {
    if (Date.parse(row.updated_at) < Date.parse(row.created_at)) row.updated_at = row.created_at;
  };
  data.bookings.forEach(notBefore);
  data.reviews.forEach(notBefore);
  data.promotions.forEach(notBefore);

  // A booking that has already happened cannot have been made after it happened.
  for (const booking of data.bookings) {
    const startAt = Date.parse(booking.start_at);
    if (startAt < now && Date.parse(booking.created_at) > startAt) {
      booking.created_at = booking.start_at;
      booking.updated_at = booking.start_at;
    }
  }
}

/**
 * Re-arm the password-reset codes against the real clock.
 *
 * These rows exist so the "check your phone" screen can be walked end to end in
 * a demo that sends no SMS, and their whole point is a short window — fifteen
 * minutes. A whole-day shift preserves the window's length but not its
 * position: it lands wherever the seed's authoring hour was, which is expired
 * for the rest of the day. An unconsumed code is therefore re-issued as if it
 * had been sent ninety seconds ago.
 */
function rearmOtps(data: Tables): void {
  const now = CLOCK.now();
  for (const otp of data.password_reset_otps) {
    if (otp.consumed_at) continue;
    otp.created_at = toApiDateTime(now - 90 * 1000);
    otp.expires_at = toApiDateTime(now + 15 * MINUTE);
  }
}

/** How many bookings each bucket should hold once the realignment is done. */
const TODAY_TARGET = 3;
const AHEAD_TARGET = 3;
const DONE_TODAY_TARGET = 1;

/** No booking is ever moved further than the shop's own advance limit. */
const MAX_SLIDE_DAYS = 60;

/**
 * Restore the mix of appointments, not just the spread.
 *
 * A uniform shift preserves the distance between bookings but not what the
 * screens need: a seed rebased onto a quiet week empties the console's Today
 * list and the customer's Upcoming tab at once, and a demo whose first two
 * screens are empty reads as broken. Rather than rewrite statuses — which every
 * price, review and notification row hanging off a booking would contradict —
 * only dates move, and only as far as they must.
 *
 * Two invariants come first, because they are correctness rather than
 * presentation: a finished appointment is never dated in the future, and an
 * active one is never dated in the past (where it would sit unreachable until
 * the sweep quietly completed it).
 *
 * Every move is a whole number of days, which preserves each booking's time of
 * day, is checked against the overlap constraint before it is committed, and
 * skips a day the barber does not work — so the realignment can never invent a
 * double-booking or an appointment on a closed Sunday.
 */
function realignBookings(data: Tables): void {
  const now = CLOCK.now();
  const today = todayKey();

  const active = (row: BookingRow): boolean =>
    (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(row.status);
  const finished = (row: BookingRow): boolean =>
    row.status === 'completed' || row.status === 'no_show';

  for (const booking of data.bookings) {
    if (finished(booking) && Date.parse(booking.end_at) > now) {
      // Backwards, far enough that the appointment is over.
      const days = Math.ceil((Date.parse(booking.end_at) - now) / DAY);
      slide(data, booking, -days, now);
    }
    if (active(booking) && Date.parse(booking.start_at) <= now) {
      const days = Math.ceil((now - Date.parse(booking.start_at)) / DAY);
      slide(data, booking, days, now);
    }
  }

  const claimed = new Set<number>();
  const liveRows = data.bookings.filter(active);

  // Today is filled first, because it is the emptier of the two buckets: the
  // console opens on today's list and the seed's active rows are, by the nature
  // of a rebase, nearly all in the future. It may never take the last row,
  // though — a demo whose Upcoming tab is empty is the same failure one screen
  // over — so it borrows only from the surplus.
  const onToday = liveRows.filter((row) => dateKey(row.start_at) === today);
  onToday.forEach((row) => claimed.add(row.id));
  const surplus = Math.max(0, liveRows.length - onToday.length - 1);
  fill(
    data,
    liveRows,
    claimed,
    Math.min(TODAY_TARGET - onToday.length, surplus),
    now,
    (row) => Math.round(dayKeyDistance(dateKey(row.start_at), today) / DAY),
  );

  const ahead = liveRows.filter((row) => dateKey(row.start_at) > today && !claimed.has(row.id));
  ahead.forEach((row) => claimed.add(row.id));
  fill(data, liveRows, claimed, AHEAD_TARGET - ahead.length, now, (row) =>
    // Tomorrow, or the first day after it this barber actually works.
    Math.round(dayKeyDistance(dateKey(row.start_at), today) / DAY) + 1,
  );

  // One finished appointment dated today, so the console's Today list opens on
  // a morning that already happened rather than on an empty half-day. Only a
  // booking whose hour has already elapsed can take the slot, so a demo opened
  // before the shop's first appointment simply skips this.
  const doneRows = data.bookings.filter(finished);
  const doneToday = doneRows.filter((row) => dateKey(row.start_at) === today);
  if (doneToday.length < DONE_TODAY_TARGET) {
    const claimedDone = new Set(doneToday.map((row) => row.id));
    fill(data, doneRows, claimedDone, DONE_TODAY_TARGET - doneToday.length, now, (row) =>
      Math.round(dayKeyDistance(dateKey(row.start_at), today) / DAY),
    );
  }
}

/**
 * Move the `need` unclaimed rows whose dates are closest to today — the nearest
 * one is the least visible nudge. A status the bucket already holds is a weaker
 * candidate than one it does not, so filling Today produces a mixed list rather
 * than three identical `pending` rows.
 */
function fill(
  data: Tables,
  rows: BookingRow[],
  claimed: Set<number>,
  need: number,
  now: number,
  daysFor: (row: BookingRow) => number,
): void {
  if (need <= 0) return;
  const covered = new Set(
    rows.filter((row) => claimed.has(row.id)).map((row) => row.status as string),
  );
  const candidates = rows
    .filter((row) => !claimed.has(row.id))
    .map((row) => ({
      row,
      duplicate: covered.has(row.status) ? 1 : 0,
      distance: Math.abs(daysFor(row)),
    }))
    .sort((left, right) => left.duplicate - right.duplicate || left.distance - right.distance);

  for (const candidate of candidates) {
    if (need <= 0) break;
    if (slide(data, candidate.row, daysFor(candidate.row), now)) {
      claimed.add(candidate.row.id);
      need -= 1;
    }
  }
}

/**
 * Move a booking by whole days, searching outward from `days` for the first
 * offset that lands on a day the barber works, keeps a finished booking behind
 * now and an active one ahead of it, and does not collide with another active
 * booking. Returns false when no such day exists inside the shop's advance
 * window, in which case the row is left exactly where it was.
 */
function slide(data: Tables, booking: BookingRow, days: number, now: number): boolean {
  if (days === 0) return true;
  const start = Date.parse(booking.start_at);
  const end = Date.parse(booking.end_at);
  const forward = days > 0;
  const isActiveRow = (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status);

  for (let step = 0; step <= MAX_SLIDE_DAYS; step += 1) {
    const offset = (Math.abs(days) + step) * (forward ? 1 : -1);
    const nextStart = start + offset * DAY;
    const nextEnd = end + offset * DAY;
    if (isActiveRow ? nextStart <= now : nextEnd > now) continue;
    const key = dateKey(nextStart);
    if (!worksOn(data, booking.barber_id, key)) continue;
    if (isActiveRow && collides(data, booking, nextStart, nextEnd)) continue;

    booking.start_at = toApiDateTime(nextStart);
    booking.end_at = toApiDateTime(nextEnd);
    // A booking cannot have been created after the appointment it books.
    if (Date.parse(booking.created_at) > nextStart) {
      booking.created_at = toApiDateTime(Math.min(nextStart, now));
      booking.updated_at = booking.created_at;
    }
    return true;
  }
  return false;
}

function collides(data: Tables, booking: BookingRow, start: number, end: number): boolean {
  return data.bookings.some(
    (row) =>
      row.id !== booking.id &&
      row.barber_id === booking.barber_id &&
      (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(row.status) &&
      Date.parse(row.start_at) < end &&
      start < Date.parse(row.end_at),
  );
}

// --------------------------------------------------------------------------- //
//  Construction happens last
//
//  `hydrate()` reaches forward into the rebasing pass and its field tables, and
//  a `const` is in its temporal dead zone until the line that declares it runs.
//  Building the store at the foot of the module rather than beside its type is
//  what keeps that legal — and it costs nothing, because every importer sees a
//  fully evaluated module.
// --------------------------------------------------------------------------- //

export const store: Tables = hydrate();

counters = highestIds(store);

/** Named for the seed authors: the id band each table allocates from. */
export const ID_BANDS: Readonly<Record<TableName, Band>> = BANDS;

/**
 * The two roles `/admin/users/` manages. `admin` is the only console login;
 * `barber` is a data tag on the user row behind a `barbers` row and signs in
 * nowhere — it is here so a barber is listed as staff rather than as a customer.
 */
export const STAFF_ROLES: readonly Role[] = ['admin', 'barber'];
