/**
 * Row → payload: the computed fields, the media URLs and the nested shapes
 * more than one endpoint needs. A port of the `SerializerMethodField`s, model
 * properties and `to_representation` overrides across `apps/<app>/serializers.py`.
 *
 * The rule for what lives here rather than beside a handler: **shared, or
 * structurally tricky.** A booking is serialised three different ways
 * (customer, staff, admin) and each of those shapes belongs in the module that
 * owns its endpoint — a serializer read apart from its view is a serializer
 * that drifts. What every one of them needs is here: the media URL, the
 * effective price, the display name, the cancellation window, the bilingual
 * column pair.
 */

import {
  HOUR,
  decimalString,
  fromMinor,
  parseIso,
  roundHalfEven,
  toApiDateTime,
  toMinor,
} from './base';
import {
  barberById,
  barberServiceFor,
  bookingSetting,
  orderedByDisplay,
  serviceById,
  store,
  userById,
} from './store';
import type {
  BarberRow,
  BarberServiceRow,
  BookingRow,
  DateKey,
  IsoDateTime,
  Money,
  PromotionRow,
  ReviewRow,
  ServiceCategoryRow,
  ServiceRow,
  TimeOffRow,
  UserRow,
} from './types';
import { ACTIVE_BOOKING_STATUSES } from './types';

/**
 * `MEDIA_URL = "/media/"` upstream. Here the files ship inside the bundle, so
 * the prefix is the deploy base — which is why seed rows hold a bare relative
 * key and never a URL: the same seed then works at `/`, at `/demos/nabadi/`
 * and at any other base without being rewritten.
 */
const MEDIA_BASE = `${import.meta.env.BASE_URL}media/`;

/**
 * The URL is **fully qualified** — `https://host/demos/nabadi/media/x.svg`,
 * not `/demos/nabadi/media/x.svg` — and that is a ruling, not a style choice.
 *
 * Thirteen call sites render `barber.photo` / `service.image` straight into an
 * `<img src>`, where either form works. The fourteenth is
 * `admin/pages/admin/BarberDetail.tsx`:
 *
 * ```ts
 * if (photo.startsWith('http')) return photo;
 * const host = API_BASE.replace(/\/api\/?$/, '');
 * return `${host}${photo}`;
 * ```
 *
 * With `API_BASE = ${BASE_URL}api` that helper derives `host = /demos/nabadi`
 * and prefixes the base a second time, so a root-absolute value becomes
 * `/demos/nabadi/demos/nabadi/media/...` and every photo on the console's
 * barber page 404s. An absolute URL takes the helper's own passthrough branch
 * and is right for all fourteen.
 *
 * An uploaded image is already an object URL and passes through untouched,
 * which is what makes a photo appear in the list a moment after it is picked
 * rather than resolving to a path the demo could never serve. A stray
 * `/media/...` from a hand-written seed is tolerated and re-based.
 */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^(https?:|blob:|data:)/.test(key)) return key;
  return new URL(`${MEDIA_BASE}${key.replace(/^\/*(media\/)?/, '')}`, window.location.origin).href;
}

/**
 * The KA/EN column pair, emitted as the two sibling keys the API sends. Both
 * front ends do the picking themselves through `pickLocalized`, falling back to
 * the unsuffixed (Georgian) column when the `_en` twin is `""` — so the mock's
 * job is to send both columns, never to choose between them.
 */
export function bilingual<F extends string>(
  row: Record<string, unknown>,
  field: F,
): Record<F | `${F}_en`, string> {
  return {
    [field]: String(row[field] ?? ''),
    [`${field}_en`]: String(row[`${field}_en`] ?? ''),
  } as Record<F | `${F}_en`, string>;
}

/** `f"{first_name} {last_name}"` — the staff serializers do not strip. */
export function fullName(user: UserRow | undefined | null): string {
  return user ? `${user.first_name} ${user.last_name}` : '';
}

/** `barber.__str__` — the barber's user's name, or `""` for a dangling FK. */
export function barberName(barber: BarberRow | undefined | null): string {
  return barber ? fullName(userById(barber.user_id)) : '';
}

/**
 * The customer's display name: the account holder, else the walk-in name, else
 * `""`. The account branch strips, the walk-in branch does not — reproduced
 * because the console renders it verbatim.
 */
export function customerName(booking: BookingRow): string {
  const customer = userById(booking.customer_id);
  if (customer) return `${customer.first_name} ${customer.last_name}`.trim();
  return booking.walk_in_name || '';
}

/**
 * `BookingAdminOutSerializer.customer_phone` is
 * `CharField(source="customer.phone", default=None)` — **null** for a walk-in,
 * whose number travels in its own `walk_in_phone` key. The console branches on
 * `booking.customer` to choose between them (`BookingsTable.tsx:46`,
 * `BookingDetailSheet.tsx:146`), so collapsing the two here would put a walk-in
 * number in the account column and leave the walk-in column empty.
 */
export function customerPhone(booking: BookingRow): string | null {
  return userById(booking.customer_id)?.phone ?? null;
}

/**
 * Both numbers, for `applySearch`. The admin filter is
 * `Q(customer__phone__icontains) | Q(walk_in_phone__icontains)`, which is the
 * one place the two columns are deliberately treated as one.
 */
export function searchablePhones(booking: BookingRow): string {
  return [userById(booking.customer_id)?.phone ?? '', booking.walk_in_phone].join(' ');
}

export function isWalkIn(booking: BookingRow): boolean {
  return booking.customer_id === null;
}

// --------------------------------------------------------------------------- //
//  Effective price and duration (`BarberService`)
// --------------------------------------------------------------------------- //

/**
 * `BarberService.effective_price()` — a method on a row that **exists**.
 *
 * Both return `null` when the barber does not offer the service, because
 * upstream has no value to return there and every caller treats the missing row
 * as "not offered": `ServiceCategoryOutSerializer.get_services` skips it,
 * `compute_available_slots` returns `[]`, and the booking serializer raises
 * `barber_does_not_offer_service`. A silent fall back to the catalogue row would
 * list services a barber does not do, at a price they never quoted.
 *
 * The override check is `!= null`, not truthiness: a `price_override` of
 * `"0.00"` is a real override — a free service — and a `duration_override` of
 * `0` likewise.
 */
export function effectivePrice(barberId: number, serviceId: number): Money | null {
  const link = barberServiceFor(barberId, serviceId);
  return link ? linkPrice(link) : null;
}

export function effectiveDuration(barberId: number, serviceId: number): number | null {
  const link = barberServiceFor(barberId, serviceId);
  return link ? linkDuration(link) : null;
}

/** The same two, from a link already in hand — no second lookup, never null. */
export function linkPrice(link: BarberServiceRow): Money {
  if (link.price_override != null) return decimalString(link.price_override);
  return decimalString(serviceById(link.service_id)?.price ?? 0);
}

export function linkDuration(link: BarberServiceRow): number {
  if (link.duration_override != null) return link.duration_override;
  return serviceById(link.service_id)?.duration_minutes ?? 0;
}

// --------------------------------------------------------------------------- //
//  Cancellation window
// --------------------------------------------------------------------------- //

/**
 * The instant after which a customer can no longer cancel:
 * `start_at - cancellation_window_hours` (default 2).
 *
 * The backend does not emit these two fields today; the customer front end
 * declares them optional and reads them when present, hiding the Cancel button
 * for good once `can_cancel` is false. Emitting them is the difference between
 * a demo where the button disappears at the right moment and one where the
 * visitor learns the rule by being refused.
 */
export function cancellableUntil(booking: BookingRow): IsoDateTime {
  const window = bookingSetting('cancellation_window_hours');
  return toApiDateTime(parseIso(booking.start_at) - window * HOUR);
}

export function canCancel(booking: BookingRow, now: number): boolean {
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(booking.status)) return false;
  return now <= parseIso(cancellableUntil(booking));
}

// --------------------------------------------------------------------------- //
//  Shared nested shapes
// --------------------------------------------------------------------------- //

export interface UserOut {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: string;
  date_joined: IsoDateTime;
}

/**
 * `UserOutSerializer` — what `/register/`, `/login/` and `/me/` all return.
 * Never carries `password`, `notes`, `is_active`, `is_staff`, `is_superuser`,
 * `last_login` or a token; `notes` in particular is staff-only free text about
 * a customer and the source file says in capitals not to expose it here.
 */
export function serializeUser(user: UserRow): UserOut {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    date_joined: user.date_joined,
  };
}

export interface PublicServiceOut {
  id: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  duration_minutes: number;
  price: Money;
  image: string | null;
  icon_key: string;
}

export interface AdminServiceOut extends PublicServiceOut {
  category: number;
  is_active: boolean;
  display_order: number;
}

/**
 * The catalogue row as the **public** list sends it: exactly the nine keys of
 * `ServiceOutSerializer`, matching `ServiceItem` in
 * `customer/features/booking/hooks.ts:4-14`.
 *
 * No `is_active` and no `display_order` — the moderation flag and the sort key
 * are staff data — and no `category`, because the public grouping *is* the
 * category nesting `serializeCatalog()` builds.
 *
 * `/services/?barber_id=` substitutes the barber's own price and duration; pass
 * the link and this returns the overridden pair. A barber who does not offer the
 * service has no link, and the caller drops the row rather than quoting the
 * catalogue price at them.
 */
export function serializePublicService(row: ServiceRow, link?: BarberServiceRow): PublicServiceOut {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    description: row.description,
    description_en: row.description_en,
    duration_minutes: link ? linkDuration(link) : row.duration_minutes,
    price: link ? linkPrice(link) : decimalString(row.price),
    image: mediaUrl(row.image),
    icon_key: row.icon_key,
  };
}

/**
 * `ServiceAdminSerializer` — the same nine keys plus the three the console
 * edits. `AdminService` (`admin/features/admin/crud-hooks.ts`) and
 * `AdminServiceSummary` (`.../hooks.ts`) are both this shape.
 */
export function serializeAdminService(row: ServiceRow): AdminServiceOut {
  return {
    ...serializePublicService(row),
    category: row.category_id,
    is_active: row.is_active,
    display_order: row.display_order,
  };
}

export interface CategoryOut {
  id: number;
  name: string;
  name_en: string;
  display_order: number;
}

export function serializeCategory(row: ServiceCategoryRow): CategoryOut {
  return {
    id: row.id,
    name: row.name,
    name_en: row.name_en,
    display_order: row.display_order,
  };
}

export interface CatalogCategoryOut extends CategoryOut {
  services: PublicServiceOut[];
}

/**
 * `GET /services/` — the wrapped, nested shape both the wizard and the services
 * page consume (`useServices` types it `{categories: ServiceCategory[]}` and
 * reads `category.services`). Neither a bare array nor a DRF envelope; see
 * `schema.md` §7.1.
 *
 * Only active services appear, ordered by `display_order` then name inside each
 * category, and categories in the same order. With a `barberId` the list
 * narrows to what that barber actually offers — `get_services` does
 * `if bs is None: continue` — at their own price and duration, **and a category
 * left with no services is dropped entirely** (`ServicesListView`:
 * `data = [c for c in data if c["services"]]`, "cleaner UI"). Without a
 * `barberId` every category ships, empty or not.
 *
 * `GET /services/` is its only caller — `PublicLandingSerializer` has no
 * `categories` key, and `LandingContent` in the customer app does not declare
 * one. It lives here rather than in the handler because the two-level nesting
 * plus the drop-empty rule is the structurally tricky kind of thing §8 says
 * belongs to serialize.ts.
 */
export function serializeCatalog(barberId?: number): { categories: CatalogCategoryOut[] } {
  const categories = orderedByDisplay(store.service_categories).map((category) => {
    const services = orderedByDisplay(
      store.services.filter((row) => row.category_id === category.id && row.is_active),
    );
    const projected: PublicServiceOut[] = [];
    for (const service of services) {
      if (barberId === undefined) {
        projected.push(serializePublicService(service));
        continue;
      }
      const link = barberServiceFor(barberId, service.id);
      if (!link) continue;
      projected.push(serializePublicService(service, link));
    }
    return { ...serializeCategory(category), services: projected };
  });
  return {
    categories: barberId === undefined ? categories : categories.filter((c) => c.services.length > 0),
  };
}

export interface SpecialtyOut {
  id: number;
  name: string;
}

/**
 * `SpecialtyOutSerializer`, resolved from `barber.specialty_ids` and ordered by
 * `Specialty.name` the way the M2M was. Objects, never names: every consumer
 * renders `s.name` with `key={s.id}` (`Home.tsx:357`, `Barbers.tsx:79`,
 * `BarberCard.tsx:46`, `BarberDetail.tsx:100` in both trees), so a `string[]`
 * gives blank badges and duplicate React keys.
 */
export function specialtiesOf(barber: BarberRow): SpecialtyOut[] {
  return store.specialties
    .filter((row) => barber.specialty_ids.includes(row.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'ka'))
    .map((row) => ({ id: row.id, name: row.name }));
}

export interface BarberServiceOut {
  id: number;
  name: string;
  duration_minutes: number;
  price: Money;
}

/**
 * `BarberOutSerializer.get_services` — the barber's own menu.
 *
 * Exactly four keys: no `name_en`, no description, no image. The front end's
 * type marks `name_en` optional and the API simply never sends it. Inactive
 * services are excluded; the order is `service.display_order` then
 * `service.name`; the price and duration are the barber's effective pair.
 */
export function barberServices(barberId: number): BarberServiceOut[] {
  const links = store.barber_services.filter((link) => link.barber_id === barberId);
  const rows: Array<{ link: BarberServiceRow; service: ServiceRow }> = [];
  for (const link of links) {
    const service = serviceById(link.service_id);
    if (service?.is_active) rows.push({ link, service });
  }
  rows.sort(
    (left, right) =>
      left.service.display_order - right.service.display_order ||
      left.service.name.localeCompare(right.service.name, 'ka'),
  );
  return rows.map(({ link, service }) => ({
    id: service.id,
    name: service.name,
    duration_minutes: linkDuration(link),
    price: linkPrice(link),
  }));
}

export interface BarberOut {
  id: number;
  first_name: string;
  last_name: string;
  bio: string;
  photo: string | null;
  specialties: SpecialtyOut[];
  services: BarberServiceOut[];
  display_order: number;
}

/**
 * The public barber card — `BarberOutSerializer`'s eight fields exactly, which
 * is what `BarberItem` (`customer/features/booking/hooks.ts:24-39`) declares.
 *
 * No `is_active`: the public list is already filtered to active barbers and the
 * serializer never sends the flag. `services` is not optional —
 * `BarberDetail.tsx:115` reads `barber.services.length` unguarded.
 */
export function serializeBarber(row: BarberRow): BarberOut {
  const user = userById(row.user_id);
  return {
    id: row.id,
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    bio: row.bio,
    photo: mediaUrl(row.photo),
    specialties: specialtiesOf(row),
    services: barberServices(row.id),
    display_order: row.display_order,
  };
}

export interface ReviewOut {
  id: number;
  rating: number;
  text: string;
  customer_name: string;
  barber_name: string;
  service_name: string;
  service_name_en: string;
  created_at: IsoDateTime;
}

/**
 * `PublicReviewSerializer` — the published-review row, and the key set a backend
 * test pins exactly. Every consumer reads `customer_name`
 * (`admin/pages/admin/Reviews.tsx:198`, `Landing.tsx:299,324`); nothing anywhere
 * reads `customer_first_name`. The customer site stopped rendering reviews when
 * the landing band was dropped, so the console is now the only reader.
 *
 * The value is PII-reduced to `"First L."` — the public list is not a directory
 * of the shop's clientele — and is `""` when the booking has no account holder.
 * A walk-in's name is **never** substituted: `walk_in_name` is a full name the
 * receptionist typed, and publishing it would leak exactly what the reduction
 * exists to prevent.
 *
 * **The moderation queue's `customer_name` is a different field with the same
 * name.** `AdminReviewSerializer.get_customer_name` returns the *full* name and
 * *does* fall back to `walk_in_name`, because the console is staff-only and a
 * receptionist moderating a review needs to know who wrote it. That shape
 * belongs to `admin-ops`, along with `customer_phone`, `barber_id` and
 * `booking_start_at`; do not serve it from here and do not "fix" this one to
 * match it.
 */
export function serializeReview(row: ReviewRow, booking: BookingRow | undefined): ReviewOut {
  const service = serviceById(booking?.service_id);
  return {
    id: row.id,
    rating: row.rating,
    text: row.text,
    customer_name: publicCustomerName(booking),
    barber_name: barberName(barberById(booking?.barber_id)),
    service_name: service?.name ?? '',
    service_name_en: service?.name_en ?? '',
    created_at: row.created_at,
  };
}

/** `get_customer_name`: `"First L."`, or the bare first name, or `""`. */
function publicCustomerName(booking: BookingRow | undefined): string {
  const customer = userById(booking?.customer_id);
  if (!customer) return '';
  const first = customer.first_name.trim();
  const last = customer.last_name.trim();
  return last ? `${first} ${last[0]}.` : first;
}

// --------------------------------------------------------------------------- //
//  Time off
//
//  One shape, and `barber` is the key that matters: `null` is a shop-wide
//  closure, which is why the console's per-barber tab renders
//  `t.barber === barberId || t.barber === null` rather than an equality test.
// --------------------------------------------------------------------------- //

/** `AdminTimeOffSerializer`, in the wire's key order. */
export interface AdminTimeOffOut {
  id: number;
  /** `null` is a shop-wide closure. */
  barber: number | null;
  start_datetime: IsoDateTime;
  end_datetime: IsoDateTime;
  reason: string;
}

export function serializeAdminTimeOff(row: TimeOffRow): AdminTimeOffOut {
  return {
    id: row.id,
    barber: row.barber_id,
    start_datetime: row.start_datetime,
    end_datetime: row.end_datetime,
    reason: row.reason,
  };
}

// --------------------------------------------------------------------------- //
//  The analytics KPI block
// --------------------------------------------------------------------------- //

export interface AnalyticsSummary {
  date_from: DateKey;
  date_to: DateKey;
  total_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  no_show_bookings: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
  revenue_completed: Money;
  avg_ticket_size: Money;
  unique_customers: number;
}

/**
 * `apps/admin_api/views/analytics.py::summary_payload` — the KPI block behind
 * **three** surfaces: `GET /admin/analytics/summary/`, the `summary` key of
 * `GET /admin/analytics/barber/{id}/`, and both XLSX summary sheets.
 *
 * All three have to produce identical numbers for the same rows — `routes.md`
 * §7 says so in as many words — so there is one implementation and each caller
 * passes its own already-filtered rows. `admin-ops.ts` is now the only module
 * that calls it, so this could sit there; it stays in the kernel because the
 * fine print below is a contract every future caller inherits, not a detail of
 * one handler.
 *
 * The fine print, all of it load-bearing and all of it easy to "fix":
 *
 * - `pending` and `confirmed` rows inflate `total_bookings` while feeding no
 *   rate numerator and no revenue, so **the three rates do not sum to 1**.
 * - `avg_ticket_size` divides by `completed_bookings`, never by the total.
 * - The rates are fractions in `[0, 1]`, not percentages; only the XLSX renders
 *   them with a `%`. On an empty window Python short-circuits to an integer
 *   `0`, which JSON cannot tell from `0.0` anyway.
 * - `unique_customers` **adds two distinct counts**, so someone who books once
 *   with an account and once as a walk-in counts twice — and every walk-in row
 *   with a blank `walk_in_phone` collapses into a single "customer", because
 *   `""` is one distinct value.
 * - Money is summed in tetri. Adding 2-dp strings as floats drifts by a tetri
 *   over a few dozen rows, and `revenue_completed` is printed verbatim.
 */
export function summaryPayload(
  rows: BookingRow[],
  from: DateKey,
  to: DateKey,
): AnalyticsSummary {
  const total = rows.length;
  const completedRows = rows.filter((row) => row.status === 'completed');
  const completed = completedRows.length;
  const cancelled = rows.filter((row) => row.status === 'cancelled').length;
  const noShow = rows.filter((row) => row.status === 'no_show').length;

  // Summed in integer tetri: a float accumulation of 2-dp strings drifts, and
  // this number is printed to the cent on the dashboard.
  const revenueMinor = completedRows.reduce((sum, row) => sum + toMinor(row.price_at_booking), 0);

  const customerIds = new Set<number>();
  const walkInPhones = new Set<string>();
  for (const row of rows) {
    if (row.customer_id === null) walkInPhones.add(row.walk_in_phone);
    else customerIds.add(row.customer_id);
  }

  const rate = (part: number): number => (total ? roundHalfEven(part / total, 4) : 0);

  return {
    date_from: from,
    date_to: to,
    total_bookings: total,
    completed_bookings: completed,
    cancelled_bookings: cancelled,
    no_show_bookings: noShow,
    completion_rate: rate(completed),
    cancellation_rate: rate(cancelled),
    no_show_rate: rate(noShow),
    revenue_completed: fromMinor(revenueMinor),
    // Quantized to the tetri half-to-even, exactly as `Decimal.quantize` does,
    // and only ever divided by the completed count.
    avg_ticket_size: completed ? fromMinor(roundHalfEven(revenueMinor / completed, 0)) : '0.00',
    unique_customers: customerIds.size + walkInPhones.size,
  };
}

export interface PromotionOut {
  id: number;
  code: string;
  description: string;
  percent_off: number | null;
  amount_off: Money | null;
  valid_from: IsoDateTime | null;
  valid_until: IsoDateTime | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export function serializePromotion(row: PromotionRow): PromotionOut {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    percent_off: row.percent_off,
    amount_off: row.amount_off,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    max_uses: row.max_uses,
    uses_count: row.uses_count,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * `Promotion.is_redeemable_now()` → `[ok, code]`. Check order matters: an
 * inactive-and-expired promo reports `promo_inactive`, and the `valid_until`
 * comparison is strictly greater, so the boundary instant is still valid.
 */
export function promotionRedeemable(
  row: PromotionRow,
  now: number,
): [true, null] | [false, 'promo_inactive' | 'promo_not_started' | 'promo_expired' | 'promo_exhausted'] {
  if (!row.is_active) return [false, 'promo_inactive'];
  if (row.valid_from && now < parseIso(row.valid_from)) return [false, 'promo_not_started'];
  if (row.valid_until && now > parseIso(row.valid_until)) return [false, 'promo_expired'];
  if (row.max_uses !== null && row.uses_count >= row.max_uses) return [false, 'promo_exhausted'];
  return [true, null];
}

/**
 * `Promotion.apply_to(price)`.
 *
 * The arithmetic runs in integer tetri so a 10%-off 45.50 haircut is 40.95 and
 * not 40.949999999999996, and the **discount is left unrounded** until after the
 * subtraction — upstream subtracts an exact `Decimal` and rounds once, when the
 * `numeric(10,2)` column stores the result. Rounding the discount first differs
 * by a tetri on a half-tetri discount (45.55 at 10% off: 40.99 rounded early,
 * 41.00 rounded once), and `price_at_booking` is a frozen snapshot the UI prints
 * verbatim, so the wrong one is visible forever.
 *
 * Rounding is half-away-from-zero at 2 dp, via `decimalString`. Clamped at zero:
 * a discount larger than the price is free, never negative.
 */
export function applyPromotion(row: PromotionRow, price: Money | number): Money {
  const priceMinor = toMinor(price);
  const discountMinor =
    row.percent_off !== null
      ? (priceMinor * row.percent_off) / 100
      : toMinor(row.amount_off ?? 0);
  return decimalString(Math.max(priceMinor - discountMinor, 0) / 100);
}
