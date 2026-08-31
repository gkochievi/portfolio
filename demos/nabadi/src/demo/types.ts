/**
 * The stored shape of every table in the demo's database — a port of the
 * `models.py` files under `backend/apps/`, not of the API payloads.
 *
 * A row here is what Postgres holds: foreign keys as `<field>_id` numbers,
 * money as a fixed-point string, media as a relative key, timestamps as ISO
 * strings. Everything Django computed in a property, an annotation or a
 * serializer — the absolute media URL, `effective_price`, `can_cancel`, the
 * customer's display name — is `serialize.ts`'s job and appears nowhere below.
 * That separation is what lets the seed be hand-written and stay small.
 *
 * Two deliberate divergences from the schema, both for the seed's sake:
 *
 * - The `barbers_barber_specialties` join table is an inline `specialty_ids`
 *   array on `BarberRow`, and `cms_landingcontent_featured_reviews` is
 *   `featured_reviews` on the singleton. A join table with no columns of its
 *   own buys nothing here and costs the seed author a third file to keep in
 *   sync. `services_barberservice` stays a real table because it carries the
 *   two override columns.
 * - `null` vs `""` follows models.md §5 exactly. Every text column declared
 *   `blank=True, default=""` is `string` here and its empty value is `""`,
 *   never `null` — both front ends call `.trim()` on them. Only the columns in
 *   the nullable register get `| null`.
 */

// --------------------------------------------------------------------------- //
//  Enumerations (models.md §1) — the DB value, never the human label
// --------------------------------------------------------------------------- //

export type Role = 'admin' | 'barber' | 'customer';

/**
 * `admin` is the only role that signs into the staff console. `barber` is a
 * data tag on the user row behind a `barbers` row — it keeps a barber out of
 * the customers list without handing anyone a console login, and nobody signs
 * in as one. `customer` is the default for a new user.
 */
export const ROLES: readonly Role[] = ['admin', 'barber', 'customer'];

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

/**
 * `bookings.models.ACTIVE_STATUSES` — the two statuses that reserve a slot.
 * Both DB constraints (the EXCLUDE guard and the partial unique index) filter
 * on exactly this tuple, so cancelling a booking frees its slot instantly.
 */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['pending', 'confirmed'];

/** 0 = Monday, matching Python's `datetime.weekday()` — NOT `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TemplateKey =
  | 'booking_confirmation'
  | 'booking_reminder_24h'
  | 'booking_reminder_1h'
  | 'booking_cancellation';

export const TEMPLATE_KEYS: readonly TemplateKey[] = [
  'booking_confirmation',
  'booking_reminder_24h',
  'booking_reminder_1h',
  'booking_cancellation',
];

export type Channel = 'sms' | 'email';
export type Language = 'ka' | 'en';

/**
 * An ISO-8601 instant with the `+04:00` Asia/Tbilisi offset, e.g.
 * `"2026-08-29T14:30:00+04:00"`. Alias only — TypeScript cannot police it, but
 * it names which columns are instants and which are wall-clock.
 */
export type IsoDateTime = string;

/** `"HH:MM:SS"`, naive shop-local wall clock. `TimeField` carries no offset. */
export type TimeString = string;

/** `"YYYY-MM-DD"` in Asia/Tbilisi — the key every date filter compares on. */
export type DateKey = string;

/** `DecimalField(10, 2)` on the wire and in the store: always 2 dp. */
export type Money = string;

/** A path under `public/media/`, e.g. `"services/classic-cut.svg"`. Never a URL. */
export type MediaKey = string;

// --------------------------------------------------------------------------- //
//  Rows
// --------------------------------------------------------------------------- //

/** `users_user`. `phone` is the USERNAME_FIELD and is unique. */
export interface UserRow {
  id: number;
  /** Plaintext. There is nothing to protect: the banner signs you in on request. */
  password: string;
  last_login: IsoDateTime | null;
  is_superuser: boolean;
  /** Canonical E.164, e.g. `"+995555100001"`. */
  phone: string;
  /** `null` when unset — never `""`, which would collide in the unique index. */
  email: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  /** Staff-only free text about a customer. NEVER serialise to a customer. */
  notes: string;
  /** Soft-delete flag. An inactive user cannot sign in. */
  is_active: boolean;
  /** Derived on every write: `role === "admin"`. Never trusted from input. */
  is_staff: boolean;
  date_joined: IsoDateTime;
}

/** `users_passwordresetotp`. Live iff unconsumed, unexpired and under 5 attempts. */
export interface PasswordResetOtpRow {
  id: number;
  user_id: number;
  /** The plaintext code. Django stores a SHA-256 digest; a demo that hides it helps nobody. */
  code: string;
  expires_at: IsoDateTime;
  consumed_at: IsoDateTime | null;
  attempts: number;
  created_at: IsoDateTime;
}

/** `barbers_specialty`. `name` is unique; ordering is `["name"]`. */
export interface SpecialtyRow {
  id: number;
  name: string;
}

/**
 * `barbers_barber`. 1:1 with a `users_user` row whose role is always `barber` —
 * that role exists only as this row's data tag; no barber signs in anywhere.
 */
export interface BarberRow {
  id: number;
  user_id: number;
  bio: string;
  photo: MediaKey | null;
  /** The `barbers_barber_specialties` M2M, inlined. */
  specialty_ids: number[];
  display_order: number;
  is_active: boolean;
}

/**
 * `barbers_workinghours`. A missing `(barber, weekday)` row falls back to the
 * shop's hours for that weekday; the barber is closed only when neither row
 * exists. This is a **pure fallback, never an intersection** — a barber with a
 * row may legitimately work outside shop hours. See `store.hoursFor()` and
 * `schema.md` §2 / §6.1, all three of which must say the same thing.
 */
export interface WorkingHoursRow {
  id: number;
  barber_id: number;
  weekday: Weekday;
  start_time: TimeString;
  end_time: TimeString;
}

/** `barbers_shophours`. At most 7 rows; a missing weekday means the shop is closed. */
export interface ShopHoursRow {
  id: number;
  weekday: Weekday;
  start_time: TimeString;
  end_time: TimeString;
}

/** `barbers_timeoff`. `barber_id: null` is a shop-wide closure affecting everyone. */
export interface TimeOffRow {
  id: number;
  barber_id: number | null;
  start_datetime: IsoDateTime;
  end_datetime: IsoDateTime;
  reason: string;
}

/** `services_servicecategory`. Unsuffixed column is KA, `_en` is English. */
export interface ServiceCategoryRow {
  id: number;
  name: string;
  name_en: string;
  display_order: number;
}

/** `services_service`. Unique on (category_id, name). */
export interface ServiceRow {
  id: number;
  category_id: number;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  duration_minutes: number;
  price: Money;
  image: MediaKey | null;
  icon_key: string;
  is_active: boolean;
  display_order: number;
}

/**
 * `services_barberservice` — the through table, with its own id because it
 * carries the two overrides. `null` means "inherit"; `0` is a real override.
 */
export interface BarberServiceRow {
  id: number;
  barber_id: number;
  service_id: number;
  price_override: Money | null;
  duration_override: number | null;
}

/** `bookings_booking`. `customer_id: null` is a walk-in. */
export interface BookingRow {
  id: number;
  customer_id: number | null;
  walk_in_name: string;
  walk_in_phone: string;
  walk_in_email: string;
  barber_id: number;
  service_id: number;
  start_at: IsoDateTime;
  end_at: IsoDateTime;
  /** Frozen at creation — a later price edit never rewrites history. */
  price_at_booking: Money;
  status: BookingStatus;
  notes: string;
  promotion_id: number | null;
  cancellation_reason: string;
  reminder_24h_sent_at: IsoDateTime | null;
  reminder_1h_sent_at: IsoDateTime | null;
  cancelled_by_id: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `reviews_review`. One per booking; starts unpublished, an admin moderates. */
export interface ReviewRow {
  id: number;
  booking_id: number;
  rating: number;
  text: string;
  is_published: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `promotions_promotion`. Exactly one of percent_off / amount_off is set. */
export interface PromotionRow {
  id: number;
  code: string;
  description: string;
  percent_off: number | null;
  amount_off: Money | null;
  valid_from: IsoDateTime | null;
  valid_until: IsoDateTime | null;
  max_uses: number | null;
  /** Incremented at booking creation, never decremented on cancellation. */
  uses_count: number;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `notifications_notificationtemplate`. Unique on (key, channel, language). */
export interface NotificationTemplateRow {
  id: number;
  key: TemplateKey;
  channel: Channel;
  language: Language;
  /** `""` on SMS rows, a real subject on email rows. */
  subject: string;
  body: string;
  is_active: boolean;
  /** This model has no `created_at`. */
  updated_at: IsoDateTime;
}

/**
 * `notifications_notificationlog` — append-only. The enum columns are
 * denormalised free text upstream so historical values survive an enum change;
 * they are typed here because nothing in the demo writes an unknown one.
 */
export interface NotificationLogRow {
  id: number;
  booking_id: number | null;
  /**
   * The four template keys **plus `password_reset`**, which is not one.
   *
   * `NotificationLog.template_key` is a free-text `CharField` upstream, and the
   * reset-code SMS is an f-string in `ForgotPasswordView` rather than a
   * `NotificationTemplate` row — so it writes a log row under a key that has no
   * template behind it. The union is widened here rather than by adding the key
   * to `TemplateKey`/`TEMPLATE_KEYS`, and that is the whole point: those two
   * drive `validateSeed`'s "16 rows = 4 keys x 2 channels x 2 languages"
   * invariant, and a fifth key would make a correct seed look four rows short.
   */
  template_key: TemplateKey | 'password_reset';
  channel: Channel;
  language: Language;
  /** The phone number or email address actually dialled. */
  recipient: string;
  subject: string;
  body: string;
  success: boolean;
  error: string;
  created_at: IsoDateTime;
}

/** `cms_sitesetting`. `value` is any JSON document — object, string, boolean. */
export interface SiteSettingRow {
  id: number;
  key: string;
  value: unknown;
  description: string;
  updated_at: IsoDateTime;
}

/** `cms_landingcontent` — the singleton, pk pinned to 1 by Django's `save()`. */
export interface LandingContentRow {
  id: 1;
  hero_heading_ka: string;
  hero_heading_en: string;
  hero_subheading_ka: string;
  hero_subheading_en: string;
  /** A media key like the ImageFields, though upstream this is a plain CharField. */
  hero_image_url: MediaKey | string;
  about_text_ka: string;
  about_text_en: string;
  gallery_image_urls: Array<MediaKey | string>;
  /** The `featured_reviews` M2M, inlined as review ids. */
  featured_reviews: number[];
  updated_at: IsoDateTime;
}

/** `audit_auditlog` — append-only record of admin-side mutations. */
export interface AuditLogRow {
  id: number;
  actor_id: number | null;
  /** Denormalised snapshot: survives a later role change on the actor. */
  actor_role: string;
  /** Dotted verb, e.g. `"booking.cancel"`. */
  action: string;
  entity: string;
  /** A string, not an integer — it accommodates composite and absent ids. */
  entity_id: string;
  payload: unknown;
  ip: string | null;
  user_agent: string;
  created_at: IsoDateTime;
}

// --------------------------------------------------------------------------- //
//  The database
// --------------------------------------------------------------------------- //

/**
 * Every table, keyed the way `store.ts` exposes it. `landing_content` is a
 * single object rather than an array because Django pinned it to pk=1 and
 * `load()` could never 404 — so `nextId()` refuses it.
 */
export interface Tables {
  users: UserRow[];
  password_reset_otps: PasswordResetOtpRow[];
  specialties: SpecialtyRow[];
  barbers: BarberRow[];
  working_hours: WorkingHoursRow[];
  shop_hours: ShopHoursRow[];
  time_off: TimeOffRow[];
  service_categories: ServiceCategoryRow[];
  services: ServiceRow[];
  barber_services: BarberServiceRow[];
  bookings: BookingRow[];
  promotions: PromotionRow[];
  reviews: ReviewRow[];
  notification_templates: NotificationTemplateRow[];
  notification_logs: NotificationLogRow[];
  site_settings: SiteSettingRow[];
  landing_content: LandingContentRow;
  audit_logs: AuditLogRow[];
}

/**
 * What `seed/index.ts` assembles out of the three JSON files. It is the table
 * set exactly: the store adds no columns the seed lacks, and the session lives
 * outside the tables so a sign-in never has to be cloned or rebased.
 */
export type Seed = Tables;

/** The tables that hold rows, i.e. everything `nextId()` will allocate into. */
export type TableName = {
  [K in keyof Tables]: Tables[K] extends unknown[] ? K : never;
}[keyof Tables];
