/**
 * Row → payload. Everything the store deliberately does not hold: the derived
 * booleans, the aggregate rollups, the nested item list, and the media URL.
 *
 * A port of the `_serialize` helpers scattered across `<app>/api.py` and
 * `<app>/admin_api.py`, plus the two `@property` fields on `User` and the
 * `Count("items")` annotation on the admin order list. Every payload interface
 * is declared directly above the function that builds it, named `<Thing>Out`,
 * with its keys in the wire's own order — so a reader comparing this file to
 * `schemas.py` can go line by line.
 *
 * **camelCase, everywhere, with no conversion layer.** The backend is snake_case
 * Python and Ninja renames on the way out through `alias_generator=to_camel`;
 * the app consumes camelCase and converts nothing. So the rename happens here,
 * by hand, once per field. A `toCamel()` helper would be shorter and would also
 * quietly rename a key the real API does not — `is_staff_role` is `isStaffRole`,
 * but `title_en` is `titleEn` and not `titleEN`, and only a written-out key can
 * be checked against the schema.
 *
 * Two upstream helpers are deliberately **not** reproduced:
 * `_absolute_image_url` and `_absolute_image`, which rewrite a stored `/media/…`
 * into `http://localhost:8000/media/…` using the request's host. There is no
 * host here, and reproducing them would bake a dead origin into every `<img
 * src>`. `mediaUrl()` replaces both.
 *
 * And one rule that outranks tidiness: **the mock sends both language columns
 * and never picks between them.** Georgian resolution belongs to
 * `catalog-i18n.ts` and `use-site-settings.ts::pickLang` on the app side. Every
 * `*Ka` key is a present, possibly-empty string — never `undefined`, never
 * absent, never pre-resolved.
 */

import { fromMinor, toMinor } from './base';
import { BASE, MEDIA_BASE } from './base-path';
import {
  orderItemsFor,
  orderedOrders,
  store,
  userById,
} from './store';
import type {
  AdminActionRow,
  CollectionRow,
  DiscountKind,
  DiscountRow,
  Gender,
  IsoDateTime,
  IsoOffset,
  MediaKey,
  Money,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PageSeoRow,
  ProductRow,
  Purpose,
  QuizBudgetRow,
  QuizConfigRow,
  QuizIntentionRow,
  QuizMoodRow,
  QuizOccasionRow,
  Role,
  SiteSettingsRow,
  UserRow,
  ZodiacInfoRow,
  ZodiacSign,
} from './types';
import { ORDER_STATUSES, REVENUE_STATUSES } from './types';

// --------------------------------------------------------------------------- //
//  Media
// --------------------------------------------------------------------------- //

/**
 * A stored media key becomes a URL here, at read time, and never in the seed.
 *
 * The seed has no idea what base path the bundle will be served from — `/` in a
 * root-served dev build, `/demos/gisheri/` inside the portfolio — so it holds a
 * bare relative key (`products/jade-prosperity.jpg`) and this function mints the
 * URL from `import.meta.env.BASE_URL`. Move the demo to a different path and
 * every image still resolves without touching a single row.
 *
 * The URL is **fully qualified**. A root-absolute `/demos/gisheri/media/x.svg`
 * would render correctly in an `<img>` but not in `og:image`, which a scraper
 * reads without a document to resolve against.
 *
 * Three passthroughs, each earning its place: `http(s):` because an admin who
 * edits the field by hand may paste one and upstream stores exactly what it is
 * given; `data:` because that is what the fake image upload returns, and it is
 * what makes a picked photo appear in the form a moment later; `blob:` for the
 * same reason on a browser that hands one back instead.
 *
 * The `brand/` special case is not a wart. `brand/og-cover.svg` lives at
 * `public/brand/`, not `public/media/brand/`, because `index.html` already
 * references its siblings (`brand/favicon.svg`) from outside the bundle and the
 * artwork must be one file rather than two copies drifting apart. So a key whose
 * first segment is `brand/` resolves against the deploy base directly; every
 * other key resolves under `media/`.
 */
export function mediaUrl(key: MediaKey | null | undefined): string {
  if (!key) return '';
  if (/^(?:https?:|data:|blob:)/i.test(key)) return key;
  // A hand-written key may carry a leading slash, or the `media/` prefix the
  // real `MEDIA_URL` put in front of it. Both are tolerated and re-based.
  const relative = key.replace(/^\/+/, '').replace(/^media\//, '');
  const base = relative.startsWith('brand/') ? BASE : MEDIA_BASE;
  return new URL(`${base}${relative}`, window.location.origin).href;
}

// --------------------------------------------------------------------------- //
//  Users
// --------------------------------------------------------------------------- //

/** `accounts/schemas.py::UserOut` — what `/auth/me` and both auth responses carry. */
export interface UserOut {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** `User.is_staff_role` — staff **or** admin. `ProtectedRoute` gates the console on it. */
  isStaffRole: boolean;
  /** `User.is_admin_role` — admin only. */
  isAdminRole: boolean;
}

/**
 * The two booleans are model `@property`s computed from `role`, not columns —
 * which is why `UserRow` has no such fields and why they are derived here every
 * time rather than stored. `store.ts::syncRoleFlags` keeps the *other* pair
 * (`is_staff` / `is_superuser`) in step, and those two never reach the wire.
 */
export function serializeUser(user: UserRow): UserOut {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    isStaffRole: user.role === 'staff' || user.role === 'admin',
    isAdminRole: user.role === 'admin',
  };
}

/** `accounts/admin_api.py::_serialize`. Note the timestamp shape — see below. */
export interface AdminUserOut {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  /** **`IsoOffset`**, not `IsoDateTime`. See the note on `serializeAdminUser`. */
  dateJoined: IsoOffset;
  lastLogin: IsoOffset | null;
}

/**
 * `dateJoined` and `lastLogin` carry `+00:00` and six digits of microseconds
 * while every other timestamp in this API carries `Z` and three.
 *
 * That is not an inconsistency to tidy away. `AdminUserOut` declares both as
 * **`str`**, not `datetime`, and `_serialize` fills them by calling
 * `.isoformat()` itself — so they skip `NinjaJSONEncoder` entirely, while
 * `AdminUserDetailOut.last_order_at` *is* a `datetime` and does not. One
 * `/admin/users/{id}` response therefore carries both shapes at once, and a mock
 * that normalised them would hide a real quirk of the wire.
 */
export function serializeAdminUser(user: UserRow): AdminUserOut {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    isActive: user.is_active,
    dateJoined: user.date_joined,
    lastLogin: user.last_login,
  };
}

/** `AdminUserDetailOut` — the list row plus a three-field order rollup. */
export interface AdminUserDetailOut extends AdminUserOut {
  orderCount: number;
  totalSpent: Money;
  /** `IsoDateTime` here — a real `datetime` field, so the encoder does reach it. */
  lastOrderAt: IsoDateTime | null;
}

/**
 * The rollup **excludes cancelled orders**: the customer never paid for those,
 * so counting them as "spent" would be a lie the finance column tells.
 *
 * Read that against `serializeOrder`'s `customerOrderCount`, which counts
 * **every** order including cancelled — because it answers a different question
 * ("how many times has this person ordered from us?"). A customer with four
 * orders, one of them cancelled, therefore shows `4` on the order page and `3`
 * on their user page. The seed makes that visible on purpose; it is upstream
 * behaviour, and repairing it here would erase the demonstration.
 */
export function serializeAdminUserDetail(user: UserRow): AdminUserDetailOut {
  const orders = store.orders.filter(
    (order) => order.user_id === user.id && order.status !== 'cancelled',
  );
  const spentMinor = orders.reduce((sum, order) => sum + toMinor(order.total), 0);
  // `Max("created_at")` over the same filtered set — string comparison is safe
  // because every stored timestamp is UTC ISO-8601 with a fixed field width.
  const lastOrderAt = orders.reduce<IsoDateTime | null>(
    (latest, order) => (latest === null || order.created_at > latest ? order.created_at : latest),
    null,
  );

  return {
    ...serializeAdminUser(user),
    orderCount: orders.length,
    totalSpent: fromMinor(spentMinor),
    lastOrderAt,
  };
}

// --------------------------------------------------------------------------- //
//  Catalogue
// --------------------------------------------------------------------------- //

/** `catalog/schemas.py::ProductOut`. */
export interface ProductOut {
  id: number;
  name: string;
  nameKa: string;
  price: Money;
  originalPrice: Money | null;
  image: string;
  purposes: Purpose[];
  zodiacSigns: ZodiacSign[];
  stones: string[];
  stonesMeaning: string;
  stonesMeaningKa: string;
  description: string;
  descriptionKa: string;
  gender: Gender;
  isBestseller: boolean;
  isNew: boolean;
}

/**
 * The three array columns are copied rather than passed through. A payload that
 * shared the row's array would let a caller's `.sort()` or `.push()` reach into
 * the store, and the quiz does score products by walking `purposes`.
 */
export function serializeProduct(product: ProductRow): ProductOut {
  return {
    id: product.id,
    name: product.name,
    nameKa: product.name_ka,
    price: product.price,
    originalPrice: product.original_price,
    image: mediaUrl(product.image),
    purposes: [...product.purposes],
    zodiacSigns: [...product.zodiac_signs],
    stones: [...product.stones],
    stonesMeaning: product.stones_meaning,
    stonesMeaningKa: product.stones_meaning_ka,
    description: product.description,
    descriptionKa: product.description_ka,
    gender: product.gender,
    isBestseller: product.is_bestseller,
    isNew: product.is_new,
  };
}

/** `catalog/schemas.py::CollectionOut`. */
export interface CollectionOut {
  id: number;
  slug: string;
  name: string;
  nameKa: string;
  description: string;
  descriptionKa: string;
  image: string;
}

export function serializeCollection(collection: CollectionRow): CollectionOut {
  return {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    nameKa: collection.name_ka,
    description: collection.description,
    descriptionKa: collection.description_ka,
    image: mediaUrl(collection.image),
  };
}

/**
 * `catalog/schemas.py::ZodiacInfoOut` — **no `id` key**.
 *
 * `sign` is the public identifier: `/zodiac/{sign}` is keyed on it, the admin
 * edit route is `PATCH /admin/zodiac/{sign}`, and `useZodiacInfo()` looks rows
 * up by it. Emitting an `id` the schema does not declare would invite a caller
 * to route on the wrong key.
 */
export interface ZodiacInfoOut {
  sign: ZodiacSign;
  name: string;
  nameKa: string;
  symbol: string;
  dates: string;
  datesKa: string;
  element: string;
  elementKa: string;
  stones: string[];
  description: string;
  descriptionKa: string;
}

export function serializeZodiac(zodiac: ZodiacInfoRow): ZodiacInfoOut {
  return {
    sign: zodiac.sign,
    name: zodiac.name,
    nameKa: zodiac.name_ka,
    symbol: zodiac.symbol,
    dates: zodiac.dates,
    datesKa: zodiac.dates_ka,
    element: zodiac.element,
    elementKa: zodiac.element_ka,
    stones: [...zodiac.stones],
    description: zodiac.description,
    descriptionKa: zodiac.description_ka,
  };
}

// --------------------------------------------------------------------------- //
//  Orders
// --------------------------------------------------------------------------- //

/** `orders/schemas.py::OrderItemOut`. Every field but `id` is a snapshot. */
export interface OrderItemOut {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  size: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

/**
 * `product_name`, `product_image` and `unit_price` are read off the **item**,
 * never re-fetched from the product. A rename, a re-photograph or a price rise
 * after the fact must not rewrite what a customer was charged — and the seed
 * carries two deliberately drifted name snapshots so the behaviour is visible
 * rather than merely asserted.
 */
export function serializeOrderItem(item: OrderItemRow): OrderItemOut {
  return {
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    productImage: mediaUrl(item.product_image),
    size: item.size,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    lineTotal: item.line_total,
  };
}

/** `orders/schemas.py::OrderOut` — the full order, customer or admin view. */
export interface OrderOut {
  id: number;
  status: OrderStatus;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  /** Blanked to `''` for a non-admin reader. */
  adminNotes: string;
  /** `null` for a non-admin reader. */
  customerOrderCount: number | null;
  subtotal: Money;
  discountCode: string;
  discountAmount: Money;
  total: Money;
  items: OrderItemOut[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * One serializer, two audiences, exactly as `orders/api.py::serialize_order` is
 * shared by the customer routes and the admin ones.
 *
 * `adminNotes` is blanked rather than omitted, because `OrderOut` declares it as
 * a plain `str` with a default and the app renders it without a guard. Omitting
 * it would make the field `undefined` where the schema promises a string.
 *
 * `customerOrderCount` counts **all** of that user's orders, cancelled ones
 * included — deliberately unlike the rollup on the user detail page. See
 * `serializeAdminUserDetail`.
 */
export function serializeOrder(order: OrderRow, options: { isAdmin: boolean }): OrderOut {
  return {
    id: order.id,
    status: order.status,
    userId: order.user_id,
    fullName: order.full_name,
    email: order.email,
    phone: order.phone,
    city: order.city,
    address: order.address,
    notes: order.notes,
    adminNotes: options.isAdmin ? order.admin_notes : '',
    customerOrderCount: options.isAdmin
      ? store.orders.filter((row) => row.user_id === order.user_id).length
      : null,
    subtotal: order.subtotal,
    discountCode: order.discount_code,
    discountAmount: order.discount_amount,
    total: order.total,
    items: orderItemsFor(order.id).map(serializeOrderItem),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

/** `orders/schemas.py::AdminOrderListItem` — the trimmed row the admin table renders. */
export interface AdminOrderListItemOut {
  id: number;
  status: OrderStatus;
  fullName: string;
  email: string;
  total: Money;
  itemCount: number;
  createdAt: IsoDateTime;
}

/**
 * `itemCount` is `Count("items")` — the number of **line rows**, not the sum of
 * their quantities. An order for one product ×5 shows `1`. Summing quantities
 * would look more useful and would disagree with the number on the order page,
 * which is the line count too.
 *
 * The list carries no items, no notes and no discount: the table shows seven
 * columns and the detail fetch fills the rest. Sending the full order here would
 * multiply the payload by the average line count for nothing on screen.
 */
export function serializeAdminOrderRow(order: OrderRow): AdminOrderListItemOut {
  return {
    id: order.id,
    status: order.status,
    fullName: order.full_name,
    email: order.email,
    total: order.total,
    itemCount: orderItemsFor(order.id).length,
    createdAt: order.created_at,
  };
}

// --------------------------------------------------------------------------- //
//  Discounts
// --------------------------------------------------------------------------- //

/** `discounts/schemas.py::DiscountOut`. */
export interface DiscountOut {
  id: number;
  code: string;
  kind: DiscountKind;
  value: Money;
  minOrderTotal: Money;
  maxUses: number | null;
  usesCount: number;
  expiresAt: IsoDateTime | null;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Nothing derived. `is_redeemable` and `is_expired` are model methods the API
 * never serialises: the admin list renders its own "Expired" badge from
 * `expiresAt`, and the checkout learns redeemability from a 400 rather than from
 * a flag. Adding a computed `isRedeemable` here would be a field no screen
 * reads and a second place for the rule to live.
 */
export function serializeDiscount(discount: DiscountRow): DiscountOut {
  return {
    id: discount.id,
    code: discount.code,
    kind: discount.kind,
    value: discount.value,
    minOrderTotal: discount.min_order_total,
    maxUses: discount.max_uses,
    usesCount: discount.uses_count,
    expiresAt: discount.expires_at,
    isActive: discount.is_active,
    createdAt: discount.created_at,
    updatedAt: discount.updated_at,
  };
}

// --------------------------------------------------------------------------- //
//  Site settings, page SEO and the quiz
// --------------------------------------------------------------------------- //

/** `site_settings/schemas.py::SiteSettingsOut` — **no `id`**; the singleton's pk never ships. */
export interface SiteSettingsOut {
  heroTitleEn: string;
  heroTitleKa: string;
  heroSubtitleEn: string;
  heroSubtitleKa: string;
  heroImage: string;
  heroCtaLabelEn: string;
  heroCtaLabelKa: string;
  heroCtaLink: string;
  bannerTextEn: string;
  bannerTextKa: string;
  bannerLink: string;
  bannerActive: boolean;
  featuredCollectionSlugs: string[];
  siteName: string;
  defaultOgImage: string;
  twitterHandle: string;
  defaultRobots: string;
  updatedAt: IsoDateTime;
}

/**
 * The two image columns go through `mediaUrl()`, which upstream's `_serialize`
 * does not do — and the divergence is forced rather than chosen. Upstream stores
 * an already-absolute URL in these fields, because the admin's `ImageUpload`
 * writes back whatever `/admin/uploads/image` returned; the seed here stores a
 * bare key. Passing a bare key through would render `<img src="brand/og-cover.svg">`
 * against whatever route the visitor is on — `/admin/settings/brand/og-cover.svg`
 * — and 404 the hero and the `og:image` on every page.
 *
 * The round trip stays honest: the settings form reads what this sends and
 * PATCHes it straight back, so an edited row then holds an absolute URL, which
 * is exactly the state the real admin leaves behind after an upload.
 */
export function serializeSiteSettings(settings: SiteSettingsRow): SiteSettingsOut {
  return {
    heroTitleEn: settings.hero_title_en,
    heroTitleKa: settings.hero_title_ka,
    heroSubtitleEn: settings.hero_subtitle_en,
    heroSubtitleKa: settings.hero_subtitle_ka,
    heroImage: mediaUrl(settings.hero_image),
    heroCtaLabelEn: settings.hero_cta_label_en,
    heroCtaLabelKa: settings.hero_cta_label_ka,
    heroCtaLink: settings.hero_cta_link,
    bannerTextEn: settings.banner_text_en,
    bannerTextKa: settings.banner_text_ka,
    bannerLink: settings.banner_link,
    bannerActive: settings.banner_active,
    featuredCollectionSlugs: [...settings.featured_collection_slugs],
    siteName: settings.site_name,
    defaultOgImage: mediaUrl(settings.default_og_image),
    twitterHandle: settings.twitter_handle,
    defaultRobots: settings.default_robots,
    updatedAt: settings.updated_at,
  };
}

/** `site_settings/schemas.py::PageSeoOut`. */
export interface PageSeoOut {
  id: number;
  path: string;
  titleEn: string;
  titleKa: string;
  descriptionEn: string;
  descriptionKa: string;
  ogImage: string;
  robots: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * `path` ships **exactly as stored** — `/shop`, never `/demos/gisheri/shop`.
 * `Seo.tsx` compares it with `===` against react-router's `location.pathname`,
 * which is basename-relative, so prefixing it here would silently disable every
 * override the moment the demo moved under the portfolio.
 */
export function serializePageSeo(page: PageSeoRow): PageSeoOut {
  return {
    id: page.id,
    path: page.path,
    titleEn: page.title_en,
    titleKa: page.title_ka,
    descriptionEn: page.description_en,
    descriptionKa: page.description_ka,
    ogImage: mediaUrl(page.og_image),
    robots: page.robots,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
  };
}

/**
 * `quiz/schemas.py::QuizConfigOut` — the four arrays, and **not** `id` or
 * `updatedAt`. The quiz page reads nothing else, and the admin editor round-trips
 * exactly this document.
 */
export interface QuizConfigOut {
  moods: QuizMoodRow[];
  occasions: QuizOccasionRow[];
  intentions: QuizIntentionRow[];
  budgets: QuizBudgetRow[];
}

/**
 * The nested elements need no renaming: the JSONB columns already store
 * camelCase (`labelEn`, `hintKa`), because `seed_quiz` wrote them that way and
 * `CamelSchema` round-trips them unchanged. This is the one place in the whole
 * store where the *stored* keys are already the wire's keys.
 *
 * `budgets[].min` and `.max` round-trip **as authored** — a seeded `"0"` comes
 * back `"0"` and not `"0.00"` — because they are JSONB text that never meets a
 * `DecimalField`. `budgetRange()` on the app side runs `Number()` over them.
 */
export function serializeQuizConfig(config: QuizConfigRow): QuizConfigOut {
  return {
    moods: config.moods.map((mood) => ({ ...mood, purposes: [...mood.purposes] })),
    occasions: config.occasions.map((occasion) => ({ ...occasion })),
    intentions: config.intentions.map((intention) => ({
      ...intention,
      purposes: [...intention.purposes],
    })),
    budgets: config.budgets.map((budget) => ({ ...budget })),
  };
}

// --------------------------------------------------------------------------- //
//  Audit
// --------------------------------------------------------------------------- //

/** `audit/schemas.py::AdminActionOut`. Neither `targetType` nor `targetId` ships — the caller sent them. */
export interface AdminActionOut {
  id: number;
  actorEmail: string | null;
  actorName: string;
  verb: string;
  summary: string;
  createdAt: IsoDateTime;
}

/**
 * The actor is resolved at read time from a nullable FK, exactly as
 * `select_related("actor")` does — so a deleted or deactivated actor still
 * renders, and `actor_id: null` (a `SET_NULL` row, or a system write) gives
 * `actorEmail: null` and `actorName: ""`, which `ActivityFeed` labels "system".
 *
 * `actorName` is `f"{first} {last}".strip()` — stripped, unlike the customer
 * name on an order, because upstream wrote it that way and an actor with no
 * first name would otherwise render as a leading space.
 */
export function serializeAuditRow(action: AdminActionRow): AdminActionOut {
  const actor = action.actor_id === null ? undefined : userById(action.actor_id);
  return {
    id: action.id,
    actorEmail: actor ? actor.email : null,
    actorName: actor ? `${actor.first_name} ${actor.last_name}`.trim() : '',
    verb: action.verb,
    summary: action.summary,
    createdAt: action.created_at,
  };
}

// --------------------------------------------------------------------------- //
//  Dashboard
// --------------------------------------------------------------------------- //

export interface StatusCountOut {
  status: OrderStatus;
  count: number;
}

export interface RecentOrderOut {
  id: number;
  fullName: string;
  email: string;
  status: OrderStatus;
  total: Money;
  createdAt: IsoDateTime;
}

/** `accounts/dashboard_api.py::DashboardStats` — seven aggregates over four tables. */
export interface DashboardStatsOut {
  productCount: number;
  userCount: number;
  activeDiscountCount: number;
  orderCount: number;
  totalRevenue: Money;
  ordersByStatus: StatusCountOut[];
  recentOrders: RecentOrderOut[];
}

/**
 * The one implementation. `/admin/dashboard/stats` is the only caller, but the
 * temptation to recompute a tile inline somewhere else is what makes two numbers
 * on one screen disagree.
 *
 * Three counts are narrower than they look, and all three are upstream's:
 *
 * - `activeDiscountCount` is a plain `is_active` count. It **ignores expiry and
 *   exhaustion**, so the seed's two expired-but-active codes are counted and the
 *   tile reads more generously than the checkout behaves. That is the product's
 *   behaviour and the reason the seed carries those two rows.
 * - `totalRevenue` sums `paid + shipped + delivered` only. Pending money has not
 *   arrived and cancelled money never will.
 * - `ordersByStatus` always carries **all five** buckets, zero-filled, in
 *   `OrderStatus` declaration order. The chart renders one bar per element, so a
 *   bucket dropped for being empty would silently shorten the axis.
 */
export function dashboardStats(): DashboardStatsOut {
  const revenueMinor = store.orders
    .filter((order) => (REVENUE_STATUSES as readonly OrderStatus[]).includes(order.status))
    .reduce((sum, order) => sum + toMinor(order.total), 0);

  const counts = new Map<OrderStatus, number>();
  for (const order of store.orders) {
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }

  return {
    productCount: store.products.length,
    userCount: store.users.length,
    activeDiscountCount: store.discounts.filter((discount) => discount.is_active).length,
    orderCount: store.orders.length,
    totalRevenue: fromMinor(revenueMinor),
    ordersByStatus: ORDER_STATUSES.map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    })),
    // `Order.objects.order_by("-created_at")[:5]` — `orderedOrders()` already
    // imposes that ordering, so this is the slice and nothing else.
    recentOrders: orderedOrders()
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        fullName: order.full_name,
        email: order.email,
        status: order.status,
        total: order.total,
        createdAt: order.created_at,
      })),
  };
}
