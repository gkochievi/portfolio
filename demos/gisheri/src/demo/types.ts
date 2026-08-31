/**
 * The stored shape of every table in the demo's database — a port of the
 * `models.py` files under `backend/`, not of the Ninja schemas.
 *
 * A row here is what Postgres holds: foreign keys as `<field>_id` numbers, money
 * as a fixed-point string, media as a bare relative key, timestamps as ISO
 * strings. Everything Django computed in a property, an annotation or a
 * serializer — `is_staff_role`, `customer_order_count`, `item_count`, the
 * absolute media URL — is `serialize.ts`'s job and appears nowhere below. That
 * separation is what lets the seed be hand-written and stay small.
 *
 * Three deliberate divergences from the schema, each for a stated reason:
 *
 * - **No `catalog_product_collections` join table, and no `collections` field on
 *   `ProductRow`.** The M2M appears in no Ninja schema, is read and written by no
 *   endpoint, and is consumed by no screen; `CollectionsPage` computes membership
 *   client-side from `product.purposes`. A join table nothing reads costs the
 *   seed author a fourth file to keep consistent and buys nothing.
 * - **`site_settings` and `quiz_config` are singleton objects, not arrays.** Both
 *   models hard-assign `self.pk = 1` in `save()`, so "the row" is the table. An
 *   array of one invites `[0]` guards at twenty call sites.
 * - **`QuizConfigRow`'s nested elements are camelCase.** Everything else in this
 *   file is snake_case because Postgres is; the quiz JSONB columns are the one
 *   place where the *stored* keys are already camelCase, because `seed_quiz`
 *   writes `labelEn` / `hintKa` verbatim and `CamelSchema` round-trips them
 *   unchanged. Renaming them here would mean translating in both directions for
 *   no gain.
 *
 * `null` vs `""` follows the models exactly. Every text column declared
 * `blank=True, default=""` is `string` here and its empty value is `""`, never
 * `null` — the app calls `.trim()` on most of them and `catalog-i18n.ts` tests
 * them for emptiness. Only the genuinely nullable columns carry `| null`.
 */

// --------------------------------------------------------------------------- //
//  Scalar aliases — names for the wire formats TypeScript cannot police
// --------------------------------------------------------------------------- //

/**
 * `'2026-08-30T13:40:00.123Z'` — Ninja's `NinjaJSONEncoder` truncates Python's
 * microseconds to milliseconds and rewrites `+00:00` as `Z`. Every
 * `DateTimeField` that reaches the wire through a typed `datetime` schema field
 * looks like this.
 */
export type IsoDateTime = string;

/**
 * `'2026-03-01T08:00:00.123456+00:00'` — raw Python `datetime.isoformat()`:
 * `+00:00` rather than `Z`, six digits of microseconds rather than three.
 *
 * This is not a mistake to tidy away. `AdminUserOut.date_joined` and
 * `.last_login` are declared as **`str`**, not `datetime`, and are filled by
 * `accounts/admin_api.py::_serialize` calling `.isoformat()` — so they skip the
 * encoder entirely, and one `/admin/users/{id}` response carries both formats at
 * once (`dateJoined` in this shape, `lastOrderAt` in the one above).
 */
export type IsoOffset = string;

/** `'YYYY-MM-DD'`. Which zone drew the day boundary is the caller's problem — see `base.ts`. */
export type DateKey = string;

/** `DecimalField(10, 2)` in the store and on the wire: always a 2-dp string, never a number. */
export type Money = string;

/**
 * A path under `public/media/`, e.g. `'products/jade-prosperity.jpg'`. Never a
 * URL: the seed has no idea what base path the bundle will be served from, so
 * `serialize.ts::mediaUrl()` mints the URL at read time from
 * `import.meta.env.BASE_URL`. `''` means "no image", which is what
 * `CharField(blank=True)` stores.
 */
export type MediaKey = string;

// --------------------------------------------------------------------------- //
//  Enumerations — the DB value, never the human label
// --------------------------------------------------------------------------- //

export type Role = 'customer' | 'staff' | 'admin';

/** `accounts.Role` declaration order — what the admin role filter offers. */
export const ROLES: readonly Role[] = ['customer', 'staff', 'admin'];

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

/**
 * `orders.OrderStatus` declaration order, and load-bearing: the dashboard's
 * `ordersByStatus` is zero-filled in exactly this sequence, and the admin status
 * filter renders it in this sequence too.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
];

/** The three statuses `dashboardStats().totalRevenue` sums. Cancelled and pending do not count. */
export const REVENUE_STATUSES: readonly OrderStatus[] = ['paid', 'shipped', 'delivered'];

export type DiscountKind = 'percent' | 'fixed';

export const DISCOUNT_KINDS: readonly DiscountKind[] = ['percent', 'fixed'];

export type Gender = 'men' | 'women' | 'unisex';

export const GENDERS: readonly Gender[] = ['men', 'women', 'unisex'];

/**
 * `catalog.Purpose`. Doubles as the collection vocabulary: there is exactly one
 * seeded collection per purpose, because `CollectionsPage` resolves membership
 * with `products.filter(p => p.purposes.includes(slug))` and a slug outside this
 * set can only ever render an empty page.
 */
export type Purpose = 'luck' | 'protection' | 'love' | 'safety' | 'energy' | 'balance';

export const PURPOSES: readonly Purpose[] = [
  'luck',
  'protection',
  'love',
  'safety',
  'energy',
  'balance',
];

export type ZodiacSign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

/**
 * **Zodiacal order, which is not render order.** `ZodiacInfo.Meta.ordering` is
 * `["sign"]` — alphabetical by the string — so every screen shows aquarius,
 * aries, cancer, capricorn, … This constant exists for the seed's id assignment
 * (aries = 5000 … pisces = 5011) and for validation; `store.ts::orderedZodiac()`
 * is the one that sorts for display.
 */
export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

/**
 * The eight verbs `audit/services.py::record` is ever called with, grepped from
 * every call site. `frontend/src/lib/audit-api.ts` types `targetType` as four
 * values, but nothing upstream writes a `product` or `discount` row and no screen
 * would render one — so the union below is two, not four, and the seed writes
 * neither.
 *
 * There are i18n labels for exactly these eight (`admin.activity.verb.*`); an
 * unknown verb falls back to `verb.replace(/_/g, ' ')` in `ActivityFeed`.
 */
export type AuditVerb =
  | 'create'
  | 'status_change'
  | 'notes_update'
  | 'item_add'
  | 'item_update'
  | 'item_remove'
  | 'role_change'
  | 'activation_change';

export const AUDIT_VERBS: readonly AuditVerb[] = [
  'create',
  'status_change',
  'notes_update',
  'item_add',
  'item_update',
  'item_remove',
  'role_change',
  'activation_change',
];

export type AuditTargetType = 'order' | 'user';

// --------------------------------------------------------------------------- //
//  Rows
// --------------------------------------------------------------------------- //

/**
 * `accounts_user` — the custom user, email-as-username, `Meta.ordering = ["email"]`.
 *
 * `is_staff` and `is_superuser` are **derived** columns: `User.save()` mirrors
 * them off `role` on every write, and nothing may set them independently. The
 * mock reproduces that in `store.ts::syncRoleFlags()`, which is the only place
 * allowed to assign them.
 */
export interface UserRow {
  id: number;
  /** Plaintext. There is nothing to protect — the banner signs you in on request. */
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  /** Login gate. An inactive user's token resolves to "signed out", as `JWTAuth.get_user` does. */
  is_active: boolean;
  /** Derived from `role`; never trusted from input. */
  is_staff: boolean;
  /** Derived from `role`; never trusted from input. */
  is_superuser: boolean;
  /** `default=timezone.now`, **not** `auto_now_add` — so the seed may set it freely. */
  date_joined: IsoOffset;
  last_login: IsoOffset | null;
}

/**
 * `accounts_passwordresettoken`. Live iff unused and under the one-hour
 * `PASSWORD_RESET_TTL`; both conditions are evaluated at read time rather than
 * swept, because there is no Celery here to sweep with.
 */
export interface PasswordResetTokenRow {
  id: number;
  user_id: number;
  /** `secrets.token_urlsafe(48)` upstream, unique. Stored in the clear: the demo prints it to the console. */
  token: string;
  created_at: IsoDateTime;
  /** Non-null ⇒ spent. */
  used_at: IsoDateTime | null;
}

/** `catalog_collection`. `Meta.ordering = ["name"]` — alphabetical by the **English** name. */
export interface CollectionRow {
  id: number;
  /** Unique, and always one of the six `Purpose` values — see the note on `Purpose`. */
  slug: string;
  name: string;
  name_ka: string;
  description: string;
  description_ka: string;
  image: MediaKey;
}

/** `catalog_product`. `Meta.ordering = ["id"]`; the public list is unfiltered and unpaginated. */
export interface ProductRow {
  id: number;
  name: string;
  name_ka: string;
  price: Money;
  /** The struck-through "was" price. `null` when the product is not on offer. */
  original_price: Money | null;
  image: MediaKey;
  purposes: Purpose[];
  zodiac_signs: ZodiacSign[];
  /** English display names, e.g. `['Amethyst', 'Clear Quartz']`. There is no stones table. */
  stones: string[];
  stones_meaning: string;
  stones_meaning_ka: string;
  description: string;
  description_ka: string;
  gender: Gender;
  is_bestseller: boolean;
  is_new: boolean;
}

/**
 * `catalog_zodiacinfo`. `sign` is the public key — `ZodiacInfoOut` carries no
 * `id` at all — and `sign`, `symbol` and `stones` are read-only in the admin form
 * because `ZodiacInfoIn` deliberately omits them as "effectively constants".
 */
export interface ZodiacInfoRow {
  id: number;
  sign: ZodiacSign;
  name: string;
  name_ka: string;
  /** The astrological glyph, e.g. `'♈'`. */
  symbol: string;
  /** Free text, e.g. `'Mar 21 - Apr 19'`. Not a date range the code parses. */
  dates: string;
  dates_ka: string;
  /** Free text: `'Fire' | 'Earth' | 'Air' | 'Water'` by convention, not by constraint. */
  element: string;
  element_ka: string;
  stones: string[];
  description: string;
  description_ka: string;
}

/**
 * `orders_order`. `Meta.ordering = ["-created_at"]` — newest first everywhere.
 *
 * The shipping block (`full_name` … `address`) is a **snapshot** taken at
 * checkout, not a join to the user: editing an account never rewrites history.
 * So is `discount_code`, which is a plain string and not a foreign key — the
 * discount row can be renamed or deleted and the order still reads correctly.
 *
 * Money identity, enforced on every write: `subtotal = Σ items.line_total` and
 * `total = subtotal − discount_amount`. There is no shipping and no tax; the two
 * "Shipping — calculated at checkout" rows in the UI are decoration.
 */
export interface OrderRow {
  id: number;
  user_id: number;
  status: OrderStatus;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  /** The customer's own note. */
  notes: string;
  /** Internal. Blanked to `''` for any non-admin serialisation — never leak it. */
  admin_notes: string;
  subtotal: Money;
  /** Snapshot of the code's canonical casing, or `''`. Not an FK. */
  discount_code: string;
  discount_amount: Money;
  total: Money;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * `orders_orderitem`. `Meta.ordering = ["id"]` — insertion order.
 *
 * `product_name`, `product_image` and `unit_price` are snapshots taken at order
 * time and must never be refreshed from the product row: a price rise after the
 * fact would silently rewrite what a customer was charged.
 */
export interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_image: MediaKey;
  /** `''`, `'S'`, `'M'`, `'L'` or `'XL'` — `CharField(max_length=8, blank=True)`. */
  size: string;
  quantity: number;
  unit_price: Money;
  /** `unit_price × quantity`, stored rather than computed, because it is a snapshot too. */
  line_total: Money;
}

/** `discounts_discountcode`. `Meta.ordering = ["-created_at"]`; every lookup is `code__iexact`. */
export interface DiscountRow {
  id: number;
  /** Unique. Matched case-insensitively, stored and returned with its authored casing. */
  code: string;
  kind: DiscountKind;
  /** Percent: 0–100. Fixed: a GEL amount. Nothing validates the upper bound. */
  value: Money;
  min_order_total: Money;
  /** `null` = unlimited. */
  max_uses: number | null;
  /** Moves **only** on order creation — never on validate, never back on cancel. */
  uses_count: number;
  /** `null` = never expires. */
  expires_at: IsoDateTime | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * `site_settings_pageseo`. `Meta.ordering = ["path"]`.
 *
 * `path` is matched by `Seo.tsx` with a literal `===` against react-router's
 * `location.pathname`, which is **basename-relative** — so the stored value stays
 * `/shop`, never `/demos/gisheri/shop`. It must also be the concrete pathname
 * (`/zodiac/scorpio`), never the route pattern (`/zodiac/:sign`).
 */
export interface PageSeoRow {
  id: number;
  path: string;
  title_en: string;
  title_ka: string;
  description_en: string;
  description_ka: string;
  /** `''` when unset — the page then falls back to `site_settings.default_og_image`. */
  og_image: MediaKey;
  /** `''` when unset — the page then falls back to `site_settings.default_robots`. */
  robots: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/**
 * `site_settings_sitesettings` — the singleton, `pk = 1`.
 *
 * Every localised pair is resolved client-side by
 * `use-site-settings.ts::pickLang(en, ka, lang)`, which is `(lang === 'ka' ? ka : en) || ka || en || ''`.
 * The mock never picks a language; it sends both columns and lets the app choose.
 */
export interface SiteSettingsRow {
  id: 1;
  hero_title_en: string;
  hero_title_ka: string;
  hero_subtitle_en: string;
  hero_subtitle_ka: string;
  hero_image: MediaKey;
  hero_cta_label_en: string;
  hero_cta_label_ka: string;
  /** Model default is `/shop`; `HeroSection` substitutes `/zodiac` only when the string is empty. */
  hero_cta_link: string;
  banner_text_en: string;
  banner_text_ka: string;
  banner_link: string;
  /** The banner renders only when this is true **and** the localised text is non-empty. */
  banner_active: boolean;
  /**
   * Written by the admin settings form and read by nothing else — `CollectionsSection`
   * maps over every collection in `Meta.ordering` order. Seeded with real slugs so
   * the form is not empty; do not build ordering on it.
   */
  featured_collection_slugs: string[];
  site_name: string;
  default_og_image: MediaKey;
  /** Stored without the leading `@`; `Seo.tsx` adds it. */
  twitter_handle: string;
  default_robots: string;
  updated_at: IsoDateTime;
}

/** One `moods[]` element. Scoring adds +2 per purpose the product shares with the chosen mood. */
export interface QuizMoodRow {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  purposes: Purpose[];
}

/** One `occasions[]` element. Carries no purposes: the occasion step does not affect scoring. */
export interface QuizOccasionRow {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  hintEn: string;
  hintKa: string;
}

/** One `intentions[]` element. Scores like a mood, and additionally shows a hint. */
export interface QuizIntentionRow {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  hintEn: string;
  hintKa: string;
  purposes: Purpose[];
}

/**
 * One `budgets[]` element.
 *
 * `min` and `max` are Decimal strings that round-trip **as authored** — seeded
 * `"0"` comes back `"0"`, not `"0.00"`, because they are JSONB text and never
 * touch a `DecimalField`. That is why they are `string` and not `Money`;
 * `budgetRange()` runs `Number()` over them anyway. `max: null` = no upper bound.
 *
 * An element whose `id` is literally `'any'` is special-cased by `QuizPage`: it
 * skips the price filter entirely rather than applying `[min, max]`.
 */
export interface QuizBudgetRow {
  id: string;
  icon: string;
  labelEn: string;
  labelKa: string;
  min: string;
  max: string | null;
}

/** `quiz_quizconfig` — the second singleton, `pk = 1`. Four JSONB columns, no validation in the DB. */
export interface QuizConfigRow {
  id: 1;
  moods: QuizMoodRow[];
  occasions: QuizOccasionRow[];
  intentions: QuizIntentionRow[];
  budgets: QuizBudgetRow[];
  updated_at: IsoDateTime;
}

/**
 * `audit_adminaction`. `Meta.ordering = ["-created_at"]`, read only as a
 * per-target feed — there is no global activity endpoint.
 *
 * `target_id` is a plain integer, **not** a foreign key, so a deleted target
 * leaves its trail behind. `actor_id` is `SET_NULL`, and `null` renders as
 * "system" in `ActivityFeed`.
 *
 * Summaries are generated in English and never translated, which is upstream
 * behaviour. The glyphs are exact: `→` U+2192, `×` U+00D7, and `item_remove`
 * opens on `−` U+2212 MINUS SIGN against `item_add`'s ASCII `+`.
 */
export interface AdminActionRow {
  id: number;
  actor_id: number | null;
  target_type: AuditTargetType;
  target_id: number;
  verb: AuditVerb;
  /** Truncated to 255 characters by `audit/services.py::record`. */
  summary: string;
  created_at: IsoDateTime;
}

// --------------------------------------------------------------------------- //
//  The database
// --------------------------------------------------------------------------- //

/**
 * Twelve tables, of which ten hold rows and two are singleton objects.
 *
 * `store.ts` adds no column the seed lacks, and the session lives outside this
 * shape entirely — a JWT names its user, so there is no session row to clone or
 * rebase.
 */
export interface Tables {
  users: UserRow[];
  password_reset_tokens: PasswordResetTokenRow[];
  collections: CollectionRow[];
  products: ProductRow[];
  zodiac_info: ZodiacInfoRow[];
  orders: OrderRow[];
  order_items: OrderItemRow[];
  discounts: DiscountRow[];
  page_seo: PageSeoRow[];
  admin_actions: AdminActionRow[];
  /** Singleton object, not an array — the model hard-assigns `pk = 1`. */
  site_settings: SiteSettingsRow;
  /** Singleton object, not an array — likewise. */
  quiz_config: QuizConfigRow;
}

/** What `seed/index.ts` assembles out of the four JSON files: the table set, exactly. */
export type Seed = Tables;

/** The tables that hold rows — i.e. everything `nextId()` will ever allocate into. */
export type TableName = {
  [K in keyof Tables]: Tables[K] extends unknown[] ? K : never;
}[keyof Tables];
