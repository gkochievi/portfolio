/**
 * The demo's database.
 *
 * A deep copy of the JSON seed, rebased so it always reads as if the shop had
 * been selling right up to this morning, held in memory for the life of the tab.
 * Nothing here touches `localStorage`, `sessionStorage` or IndexedDB — every
 * visitor gets the same pristine shop and a reload puts it back. That includes
 * the session: the tokens live in `lib/api.ts`'s module scope, so a reload signs
 * you out, which is the honest reading of "the server restarted" and is also
 * what a real JWT would do if the tab had never written one down.
 *
 * A port of the `models.py` files under `backend/`, plus the four behaviours
 * Django performed around them that nothing else in this mock can:
 * `User.save()`'s `is_staff` / `is_superuser` mirror (`syncRoleFlags`),
 * `auto_now` on `Order` (`touchOrder`), `audit/services.py::record`
 * (`writeAudit`), and each model's `Meta.ordering` (the `ordered*` walkers).
 *
 * **Live binding.** `resetStore()` refills the arrays in place rather than
 * replacing them, so a module that hoisted `store.orders` into a local still
 * sees the right rows afterwards. The corollary is worth stating anyway: read
 * through `store.<table>` at call time and never cache the array.
 *
 * **No router import.** `writeAudit` takes the acting `UserRow` directly, so a
 * handler passes `request.user` and this module never has to know what a request
 * is. `store.ts` is imported by almost everything; a dependency on `router.ts`
 * would make almost everything cyclical with the dispatcher.
 */

import {
  CLOCK,
  DAY,
  HOUR,
  MINUTE,
  dayKeyDistance,
  nowIso,
  parseIso,
  shiftDayKey,
  tbilisiDateKey,
  toApiDateTime,
  todayKeyTbilisi,
  todayKeyUtc,
  utcDateKey,
} from './base';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './accounts';
// A cycle, and a safe one: `auth-tokens.ts` imports `store` but touches it only
// inside function bodies, and nothing here calls back into it until a request
// arrives. Neither module reads the other at module scope, so either evaluation
// order works.
import { userForAccessToken } from './auth-tokens';
import { computeDiscount, isRedeemable } from './pricing';
import { seed } from './seed';
import type {
  AdminActionRow,
  AuditTargetType,
  AuditVerb,
  CollectionRow,
  DateKey,
  DiscountRow,
  OrderItemRow,
  OrderRow,
  OrderStatus,
  PageSeoRow,
  ProductRow,
  TableName,
  Tables,
  UserRow,
  ZodiacInfoRow,
} from './types';
import {
  AUDIT_VERBS,
  DISCOUNT_KINDS,
  GENDERS,
  ORDER_STATUSES,
  PURPOSES,
  ROLES,
  ZODIAC_SIGNS,
} from './types';

// --------------------------------------------------------------------------- //
//  Id bands
//
//  Postgres gives every table its own sequence starting at 1, so id 3 exists in
//  a dozen tables at once. In a hand-written seed that is a trap: a stray
//  `"product_id": 3` resolves silently against a collection and renders as a
//  bracelet that is really a landing page. Disjoint bands turn the same typo
//  into an empty lookup at the exact row that is wrong, and they make an id
//  readable on sight — 6xxx is an order, 4xxx a product, 12xxx an audit row.
//
//  `validateSeed` rejects any seed id outside its band and `nextId` throws
//  rather than leave one. The three double-wide bands are the tables the demo
//  itself writes into: every checkout appends an order and its lines, and every
//  admin mutation — several per bulk click — appends an audit row.
// --------------------------------------------------------------------------- //

export interface Band {
  start: number;
  end: number;
}

const BANDS: Record<TableName, Band> = {
  users: { start: 1000, end: 1999 },
  password_reset_tokens: { start: 2000, end: 2999 },
  collections: { start: 3000, end: 3999 },
  products: { start: 4000, end: 4999 },
  // Fixed twelve. The enum has twelve members, `sign` is unique, and the admin
  // can edit a row but never create or delete one.
  zodiac_info: { start: 5000, end: 5011 },
  orders: { start: 6000, end: 7999 },
  order_items: { start: 8000, end: 9999 },
  discounts: { start: 10_000, end: 10_999 },
  page_seo: { start: 11_000, end: 11_999 },
  admin_actions: { start: 12_000, end: 13_999 },
};

const TABLE_NAMES = Object.keys(BANDS) as TableName[];

/** Named for the seed authors: the band each table allocates from. */
export const ID_BANDS: Readonly<Record<TableName, Band>> = BANDS;

// --------------------------------------------------------------------------- //
//  Construction
// --------------------------------------------------------------------------- //

/**
 * Deep copy, rebase, then check.
 *
 * `validateSeed` runs **after** the rebase rather than before, because eight of
 * its invariants are temporal — "no order is dated in the future", "every audit
 * row sits inside its order's lifetime" — and those are properties of the data
 * the demo will actually serve, not of the data as authored. The structural
 * invariants are indifferent to the rebase, so one pass at the end catches
 * everything at once.
 */
function hydrate(): Tables {
  const data = structuredClone(seed) as Tables;
  rebase(data);
  if (import.meta.env.DEV) validateSeed(data);
  return data;
}

let counters: Record<TableName, number>;

function highestIds(data: Tables): Record<TableName, number> {
  const next = {} as Record<TableName, number>;
  for (const table of TABLE_NAMES) {
    const rows = data[table] as Array<{ id: number }>;
    const highest = rows.reduce((max, row) => Math.max(max, row.id), BANDS[table].start - 1);
    // A seed row above its ceiling would make the *first* `nextId()` throw,
    // three screens into the demo, on a line that looks unrelated. Say so at
    // construction instead. (A below-floor id is `validateSeed`'s to report —
    // the `reduce` seed above silently clamps it away.)
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
 * sequence — so a deleted product's id does not come back on the next create and
 * an `OrderItem` snapshot cannot be reconnected to a different product by
 * accident. Running out of band throws rather than colliding with the next
 * table: a demo that quietly starts writing orders into the order-item id space
 * is worse than one that stops and says so.
 */
export function nextId(table: TableName): number {
  const id = counters[table];
  if (id > BANDS[table].end) {
    throw new Error(
      `Demo id band exhausted for "${table}" (${BANDS[table].start}-${BANDS[table].end}).`,
    );
  }
  counters[table] = id + 1;
  return id;
}

/**
 * Back to a pristine shop without a reload.
 *
 * Each array is **emptied and refilled**, never reassigned — see the note at the
 * top of the file. The two singletons are likewise assigned into rather than
 * replaced, so a handler holding `store.site_settings` keeps a live object.
 */
export function resetStore(): void {
  const fresh = hydrate();
  for (const table of TABLE_NAMES) {
    const rows = store[table] as unknown[];
    rows.length = 0;
    rows.push(...(fresh[table] as unknown[]));
  }
  Object.assign(store.site_settings, fresh.site_settings);
  Object.assign(store.quiz_config, fresh.quiz_config);
  counters = highestIds(store);
}

// --------------------------------------------------------------------------- //
//  The session
//
//  There is no session row: a JWT names its user, so all the store owes the
//  router is a resolver. `auth-tokens.ts` already resolves through `store.users`
//  and filters on `is_active`, which is what makes deactivating a signed-in
//  colleague take effect on their very next request rather than at token expiry.
// --------------------------------------------------------------------------- //

/**
 * A thin delegate, and deliberately so.
 *
 * `auth-tokens.ts` imports `store` and this imports back — a cycle that is safe
 * only because neither module touches the other at module scope: `auth-tokens`
 * reads `store` inside function bodies alone, and nothing here calls into it
 * until a request arrives. `router.ts` should prefer `userForAccessToken()`
 * directly; this exists so a handler that already depends on the store does not
 * need a second import for one lookup.
 */
export function currentUserForToken(token: string | null): UserRow | null {
  return userForAccessToken(token);
}

// --------------------------------------------------------------------------- //
//  Lookups
//
//  Deliberately linear. Sixty-four orders and thirty products do not need an
//  index, and a `Map` would be a second thing to keep in step with every push,
//  splice and reset — the exact class of bug the store exists to avoid.
//
//  The two `__iexact` lookups are marked: every backend query on an email or a
//  discount code is case-insensitive, so a shopper who types `welcome10` gets
//  `WELCOME10` and an admin who types `Demo@Gisheri.ge` finds the account.
// --------------------------------------------------------------------------- //

export function userById(id: number | null | undefined): UserRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.users.find((row) => row.id === id);
}

/** `User.objects.filter(email__iexact=…)`. */
export function userByEmail(email: string): UserRow | undefined {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return undefined;
  return store.users.find((row) => row.email.toLowerCase() === wanted);
}

export function productById(id: number | null | undefined): ProductRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.products.find((row) => row.id === id);
}

export function collectionById(id: number | null | undefined): CollectionRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.collections.find((row) => row.id === id);
}

export function collectionBySlug(slug: string): CollectionRow | undefined {
  return store.collections.find((row) => row.slug === slug);
}

/** `sign` is the public key — there is no `id` on `ZodiacInfoOut` at all. */
export function zodiacBySign(sign: string): ZodiacInfoRow | undefined {
  return store.zodiac_info.find((row) => row.sign === sign);
}

export function orderById(id: number | null | undefined): OrderRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.orders.find((row) => row.id === id);
}

export function orderItemById(id: number | null | undefined): OrderItemRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.order_items.find((row) => row.id === id);
}

/** `order.items.all()` — `OrderItem.Meta.ordering = ["id"]`, i.e. insertion order. */
export function orderItemsFor(orderId: number): OrderItemRow[] {
  return store.order_items.filter((row) => row.order_id === orderId).sort((a, b) => a.id - b.id);
}

export function discountById(id: number | null | undefined): DiscountRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.discounts.find((row) => row.id === id);
}

/** `DiscountCode.objects.filter(code__iexact=…)`. Trims, because the checkout field does not. */
export function discountByCode(code: string): DiscountRow | undefined {
  const wanted = code.trim().toLowerCase();
  if (!wanted) return undefined;
  return store.discounts.find((row) => row.code.toLowerCase() === wanted);
}

export function pageSeoById(id: number | null | undefined): PageSeoRow | undefined {
  if (id === null || id === undefined) return undefined;
  return store.page_seo.find((row) => row.id === id);
}

// --------------------------------------------------------------------------- //
//  Ordering
//
//  One walker per `Meta.ordering`, re-imposed at the walk rather than kept as a
//  sort order on the array itself, because a push would break the latter and
//  nothing would say so. Every list route builds its rows as
//  `ordered<Thing>().filter(…)` — filtering preserves order, so the two compose.
//
//  Each returns a **copy**. Handing out the store's own array would let a
//  caller's `.sort()` reorder the database.
// --------------------------------------------------------------------------- //

/** `Product.Meta.ordering = ["id"]`. The quiz's scoring tie-break depends on it. */
export function orderedProducts(): ProductRow[] {
  return [...store.products].sort((a, b) => a.id - b.id);
}

/** `Collection.Meta.ordering = ["name"]` — by the **English** name, not the Georgian one. */
export function orderedCollections(): CollectionRow[] {
  return [...store.collections].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/**
 * `ZodiacInfo.Meta.ordering = ["sign"]` — **alphabetical by the string**, so the
 * grid reads aquarius, aries, cancer, capricorn, gemini, leo, libra, pisces,
 * sagittarius, scorpio, taurus, virgo. That is not zodiacal order, and it is not
 * a bug to repair: it is what every screen shows. `ZODIAC_SIGNS` in `types.ts`
 * holds the zodiacal order, and exists only for the seed's id assignment.
 */
export function orderedZodiac(): ZodiacInfoRow[] {
  return [...store.zodiac_info].sort((a, b) => a.sign.localeCompare(b.sign, 'en'));
}

/** `Order.Meta.ordering = ["-created_at"]`. `-id` breaks ties so the page is stable. */
export function orderedOrders(): OrderRow[] {
  return [...store.orders].sort(
    (a, b) => parseIso(b.created_at) - parseIso(a.created_at) || b.id - a.id,
  );
}

/** `User.Meta.ordering = ["email"]` — and the admin list re-states it as `.order_by("email")`. */
export function orderedUsers(): UserRow[] {
  return [...store.users].sort((a, b) => a.email.localeCompare(b.email, 'en'));
}

/** `DiscountCode.Meta.ordering = ["-created_at"]`. */
export function orderedDiscounts(): DiscountRow[] {
  return [...store.discounts].sort(
    (a, b) => parseIso(b.created_at) - parseIso(a.created_at) || b.id - a.id,
  );
}

/** `PageSeo.Meta.ordering = ["path"]`. */
export function orderedPageSeo(): PageSeoRow[] {
  return [...store.page_seo].sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

/**
 * `AdminAction.Meta.ordering = ["-created_at"]`, filtered to one target — there
 * is no global activity endpoint, only `GET /admin/audit?target_type=&target_id=`.
 *
 * `-id` breaks ties. Upstream leaves those to Postgres, which is free to return
 * them in any order; here a bulk click writes several rows inside the same
 * millisecond and an unstable feed would reshuffle itself on every refetch.
 */
export function orderedAuditFor(targetType: AuditTargetType, targetId: number): AdminActionRow[] {
  return store.admin_actions
    .filter((row) => row.target_type === targetType && row.target_id === targetId)
    .sort((a, b) => parseIso(b.created_at) - parseIso(a.created_at) || b.id - a.id);
}

// --------------------------------------------------------------------------- //
//  Write-path side effects
//
//  Three helpers, each replacing something Django did on its own. They live here
//  because more than one handler module calls each of them, and three private
//  conventions would make the console's activity feed unreadable.
// --------------------------------------------------------------------------- //

/**
 * `audit/services.py::record`, and **synchronous** exactly as it is upstream:
 * the view calls it inline rather than through `on_commit`, so the row is
 * readable the instant the mutation returns and a failed request leaves no
 * trace behind.
 *
 * `actor_id` is nullable and `null` renders as "system" in `ActivityFeed` —
 * which is what a `SET_NULL` row looks like after its actor is deleted, and what
 * the seed uses to put that label on screen.
 *
 * The summary is truncated to 255 characters here rather than at the call site,
 * because `record()` does `summary[:255]` and a caller that forgot would produce
 * a row the real column could not hold.
 */
export function writeAudit(
  actor: UserRow | null,
  verb: AuditVerb,
  targetType: AuditTargetType,
  targetId: number,
  summary: string,
): AdminActionRow {
  const row: AdminActionRow = {
    id: nextId('admin_actions'),
    actor_id: actor === null ? null : actor.id,
    target_type: targetType,
    target_id: targetId,
    verb,
    summary: summary.slice(0, 255),
    created_at: nowIso(),
  };
  store.admin_actions.push(row);
  return row;
}

/**
 * The three glyphs upstream's f-strings carry, spelled out so no call site
 * types the wrong one.
 *
 * They matter because they are the only thing distinguishing two summaries in
 * the feed: `item_add` opens on an ASCII `+` while `item_remove` opens on
 * U+2212 MINUS SIGN, which is visibly longer and is what the seed carries. A
 * hyphen-minus there would read as a typo in a feed full of real ones.
 */
export const AUDIT_GLYPHS = {
  /** U+2192 RIGHTWARDS ARROW — every transition summary. */
  arrow: '→',
  /** U+00D7 MULTIPLICATION SIGN — the quantity in an item summary. */
  times: '×',
  /** U+2212 MINUS SIGN — `item_remove` only. `item_add` uses ASCII `+`. */
  minus: '−',
} as const;

/** `f"{prev} → {next}"` — `status_change` on an order, `role_change` on a user. */
export function transitionSummary(from: string, to: string): string {
  return `${from} ${AUDIT_GLYPHS.arrow} ${to}`;
}

/**
 * `f"Bulk → {status}"` — written once per **requested** id, including ids that
 * matched no row, because upstream loops over `payload.ids` and not over the
 * rows it updated.
 */
export function bulkStatusSummary(status: OrderStatus): string {
  return `Bulk ${AUDIT_GLYPHS.arrow} ${status}`;
}

/**
 * `f"+ {qty}× {name}"` / `f"− {qty}× {name}"`, with ` (size M)` appended only
 * when the size is non-empty — an order line with no size must not read
 * `(size )`.
 */
export function itemLineSummary(
  kind: 'add' | 'remove',
  quantity: number,
  productName: string,
  size: string,
): string {
  const sign = kind === 'add' ? '+' : AUDIT_GLYPHS.minus;
  const suffix = size ? ` (size ${size})` : '';
  return `${sign} ${quantity}${AUDIT_GLYPHS.times} ${productName}${suffix}`;
}

/**
 * `f"{name}: " + "; ".join(parts)` — quantity first, then size, and only the
 * fields that actually moved. Returns `''` when neither did, which is upstream's
 * `if parts:` guard: a PATCH that changes nothing writes no audit row at all.
 */
export function itemChangeSummary(
  productName: string,
  changes: { quantity?: { from: number; to: number }; size?: { from: string; to: string } },
): string {
  const parts: string[] = [];
  if (changes.quantity && changes.quantity.from !== changes.quantity.to) {
    parts.push(`qty ${changes.quantity.from} ${AUDIT_GLYPHS.arrow} ${changes.quantity.to}`);
  }
  if (changes.size && changes.size.from !== changes.size.to) {
    parts.push(`size '${changes.size.from}' ${AUDIT_GLYPHS.arrow} '${changes.size.to}'`);
  }
  return parts.length === 0 ? '' : `${productName}: ${parts.join('; ')}`;
}

/**
 * `User.save()`'s mirror. `is_staff` and `is_superuser` are **derived** columns
 * kept in step with `role` on every write so Django's own `/admin` and its
 * permission checks stay correct, and nothing may set them independently — which
 * is why this is the only function in the mock that assigns either.
 *
 * The wire never sees these two. `UserOut` carries `isStaffRole` / `isAdminRole`
 * instead, computed from `role` in `serialize.ts`.
 */
export function syncRoleFlags(user: UserRow): void {
  user.is_staff = user.role === 'admin' || user.role === 'staff';
  user.is_superuser = user.role === 'admin';
}

/**
 * `Order.updated_at` is `auto_now`, so every `save()` moves it — and
 * `ActivityFeed`'s `reloadKey` is `order.updatedAt`, which means an admin
 * mutation that forgets this leaves the feed showing yesterday's rows with no
 * error anywhere.
 *
 * The one place upstream skips it is the bulk status update, which goes through
 * `QuerySet.update()` and bypasses `auto_now` entirely. That omission is
 * faithful, so `admin-orders.ts` must **not** call this from the bulk route.
 */
export function touchOrder(order: OrderRow): void {
  order.updated_at = nowIso();
}

/** `accounts/api.py::PASSWORD_RESET_TTL`. Evaluated at read time — there is no sweep here. */
export const PASSWORD_RESET_TTL_MS = HOUR;

// --------------------------------------------------------------------------- //
//  Seed validation
// --------------------------------------------------------------------------- //

/**
 * What actually exists under `public/`. A browser cannot stat a filesystem, so
 * the inventory is written down — and must be extended when a file is added.
 *
 * `brand/og-cover.svg` is the one key that does not live under `media/`: the
 * brand artwork sits at `public/brand/` because `index.html` already references
 * its siblings from outside the bundle. `serialize.ts::mediaUrl()` knows.
 */
export const MEDIA_INVENTORY: readonly string[] = [
  'brand/og-cover.svg',
  'collections/balance.jpg',
  'collections/energy.jpg',
  'collections/love.jpg',
  'collections/luck.jpg',
  'collections/protection.jpg',
  'collections/safety.svg',
  'products/agate-steadiness.svg',
  'products/amazonite-calm.svg',
  'products/amethyst-night.svg',
  'products/amethyst-serenity.jpg',
  'products/aquamarine-clarity.svg',
  'products/black-obsidian-shield.jpg',
  'products/bloodstone-grounding.svg',
  'products/carnelian-courage.svg',
  'products/citrine-abundance.svg',
  'products/diamond-clarity.svg',
  'products/emerald-fortune.svg',
  'products/garnet-devotion.svg',
  'products/jade-prosperity.jpg',
  'products/labradorite-aura.svg',
  'products/lapis-lazuli-wisdom.jpg',
  'products/malachite-heart.svg',
  'products/moonstone-intuition.svg',
  'products/obsidian-jade-balance.svg',
  'products/opal-dreamer.svg',
  'products/pearl-grace.svg',
  'products/peridot-renewal.svg',
  'products/rose-quartz-love.jpg',
  'products/rose-quartz-moonstone-duo.svg',
  'products/sapphire-focus.svg',
  'products/sunstone-vitality.svg',
  'products/tigers-eye-bloodstone-cuff.svg',
  'products/tigers-eye-power.jpg',
  'products/topaz-confidence.svg',
  'products/turquoise-carnelian-journey.svg',
  'products/turquoise-traveller.svg',
];

/**
 * The twenty-five stone names `lib/catalog-i18n.ts::STONE_KEY_BY_NAME` can
 * translate. That map is module-private on the app side and the file is ported
 * byte-identical, so the list is mirrored here rather than imported.
 *
 * A stone outside it is not an error the app reports: `tStone()` falls back to
 * the English name and the Georgian page silently shows one English word in a
 * Georgian sentence. Catching it at construction is the only way anyone finds
 * out. Note the ASCII apostrophe in `Tiger's Eye` — a typographic U+2019 would
 * miss the key.
 */
const TRANSLATABLE_STONES: readonly string[] = [
  'Agate',
  'Amazonite',
  'Amethyst',
  'Aquamarine',
  'Black Obsidian',
  'Bloodstone',
  'Carnelian',
  'Citrine',
  'Diamond',
  'Emerald',
  'Garnet',
  'Jade',
  'Labradorite',
  'Lapis Lazuli',
  'Malachite',
  'Moonstone',
  'Opal',
  'Pearl',
  'Peridot',
  'Rose Quartz',
  'Sapphire',
  'Sunstone',
  "Tiger's Eye",
  'Topaz',
  'Turquoise',
];

const MONEY_PATTERN = /^-?\d{1,8}\.\d{2}$/;
const VALID_SIZES = new Set(['', 'S', 'M', 'L', 'XL']);

/**
 * §F.11's fifty-five invariants, checked at construction under
 * `import.meta.env.DEV` and stripped from the production bundle — a shipped demo
 * should not pay for a check whose only audience is whoever is editing the seed.
 *
 * **Every violation is reported at once.** A validator that threw on the first
 * one would turn a seed edit into fifty-five build-and-run cycles; this one
 * hands back the whole list, each message naming the invariant number in §F.11
 * so a reader can look up what it is protecting.
 *
 * It exists because these invariants are all silent when broken. A dangling
 * `product_id` renders as an empty cell. A media key naming a file that is not
 * there is a broken `<img>` three screens in. An empty `name_ka` shows English
 * inside a Georgian sentence. A `uses_count` that disagrees with the orders
 * makes the admin's usage column a lie nobody can see. Every one of those reads
 * as "the demo is broken" rather than "the seed is wrong".
 */
export function validateSeed(data: Tables): void {
  const problems: string[] = [];
  const complain = (table: string, id: number | string, message: string): void => {
    problems.push(`${table}#${id}: ${message}`);
  };
  const now = CLOCK.now();

  // ------------------------------------------------------------------- //
  //  1-7. Identity, bands and uniqueness
  // ------------------------------------------------------------------- //

  const ids: Partial<Record<TableName, Set<number>>> = {};
  for (const table of TABLE_NAMES) {
    const set = new Set<number>();
    for (const row of data[table] as Array<{ id: number }>) {
      if (set.has(row.id)) complain(table, row.id, 'duplicate id (invariant 1)');
      set.add(row.id);
      const band = BANDS[table];
      if (row.id < band.start || row.id > band.end) {
        complain(table, row.id, `id outside band ${band.start}-${band.end} (invariant 1)`);
      }
    }
    ids[table] = set;
  }
  const resolves = (table: TableName, value: number | null | undefined): boolean =>
    value !== null && value !== undefined && (ids[table]?.has(value) ?? false);

  const uniqueBy = <T>(
    table: string,
    rows: T[],
    id: (row: T) => number,
    key: (row: T) => string,
    label: string,
    invariant: number,
  ): void => {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = key(row);
      if (seen.has(value)) complain(table, id(row), `${label} "${value}" is not unique (invariant ${invariant})`);
      seen.add(value);
    }
  };

  uniqueBy('users', data.users, (u) => u.id, (u) => u.email.toLowerCase(), 'email', 2);
  uniqueBy('collections', data.collections, (c) => c.id, (c) => c.slug, 'slug', 3);
  uniqueBy('zodiac_info', data.zodiac_info, (z) => z.id, (z) => z.sign, 'sign', 4);
  uniqueBy('discounts', data.discounts, (d) => d.id, (d) => d.code.toLowerCase(), 'code', 5);
  uniqueBy('page_seo', data.page_seo, (p) => p.id, (p) => p.path, 'path', 6);
  uniqueBy(
    'password_reset_tokens',
    data.password_reset_tokens,
    (t) => t.id,
    (t) => t.token,
    'token',
    5,
  );

  // 3. Every collection slug is one of the six purposes — `CollectionsPage`
  //    resolves membership with `products.filter(p => p.purposes.includes(slug))`,
  //    so a slug outside the set can only ever render an empty page.
  for (const collection of data.collections) {
    if (!(PURPOSES as readonly string[]).includes(collection.slug)) {
      complain('collections', collection.id, `slug "${collection.slug}" is not a Purpose (invariant 3)`);
    }
  }

  // 4. All twelve signs, exactly once each.
  const signs = new Set(data.zodiac_info.map((row) => row.sign));
  for (const sign of ZODIAC_SIGNS) {
    if (!signs.has(sign)) problems.push(`zodiac_info: sign "${sign}" is missing (invariant 4)`);
  }

  // 6. A path `Seo.tsx` compares with `===` against `location.pathname`.
  for (const page of data.page_seo) {
    if (!page.path.startsWith('/')) {
      complain('page_seo', page.id, `path "${page.path}" does not start with "/" (invariant 6)`);
    }
  }

  // 7. Both singletons really are the row the model pins to pk 1.
  if (data.site_settings?.id !== 1) problems.push('site_settings: id is not 1 (invariant 7)');
  if (data.quiz_config?.id !== 1) problems.push('quiz_config: id is not 1 (invariant 7)');

  // ------------------------------------------------------------------- //
  //  8-13. Referential integrity
  // ------------------------------------------------------------------- //

  for (const order of data.orders) {
    if (!resolves('users', order.user_id)) {
      complain('orders', order.id, `user_id ${order.user_id} does not resolve (invariant 8)`);
    }
  }
  for (const token of data.password_reset_tokens) {
    if (!resolves('users', token.user_id)) {
      complain('password_reset_tokens', token.id, `user_id ${token.user_id} does not resolve (invariant 8)`);
    }
  }
  for (const item of data.order_items) {
    if (!resolves('orders', item.order_id)) {
      complain('order_items', item.id, `order_id ${item.order_id} does not resolve (invariant 9)`);
    }
    if (!resolves('products', item.product_id)) {
      complain('order_items', item.id, `product_id ${item.product_id} does not resolve (invariant 9)`);
    }
  }
  for (const action of data.admin_actions) {
    if (action.actor_id !== null) {
      const actor = data.users.find((user) => user.id === action.actor_id);
      if (!actor) {
        complain('admin_actions', action.id, `actor_id ${action.actor_id} does not resolve (invariant 10)`);
      } else if (actor.role !== 'staff' && actor.role !== 'admin') {
        // A customer cannot have taken an admin action; a feed attributing one
        // to a shopper is the kind of detail that makes a demo unbelievable.
        complain('admin_actions', action.id, `actor ${actor.email} is a ${actor.role} (invariant 10)`);
      }
    }
    if (action.target_type !== 'order' && action.target_type !== 'user') {
      complain('admin_actions', action.id, `target_type "${action.target_type}" is not order|user (invariant 11)`);
    } else if (!resolves(action.target_type === 'order' ? 'orders' : 'users', action.target_id)) {
      complain('admin_actions', action.id, `target ${action.target_type}#${action.target_id} does not resolve (invariant 11)`);
    }
    if (!(AUDIT_VERBS as readonly string[]).includes(action.verb)) {
      // An unknown verb has no `admin.activity.verb.*` key and falls back to
      // `verb.replace(/_/g, " ")` — readable, but untranslated.
      complain('admin_actions', action.id, `verb "${action.verb}" has no i18n key (invariant 12)`);
    }
  }
  const slugs = new Set(data.collections.map((row) => row.slug));
  for (const slug of data.site_settings.featured_collection_slugs) {
    if (!slugs.has(slug)) {
      complain('site_settings', 1, `featured_collection_slugs holds unknown "${slug}" (invariant 13)`);
    }
  }

  // ------------------------------------------------------------------- //
  //  14-17. Enum domains
  // ------------------------------------------------------------------- //

  const inSet = <T extends string>(allowed: readonly T[], value: string): boolean =>
    (allowed as readonly string[]).includes(value);

  for (const user of data.users) {
    if (!inSet(ROLES, user.role)) complain('users', user.id, `role "${user.role}" (invariant 14)`);
  }
  for (const order of data.orders) {
    if (!inSet(ORDER_STATUSES, order.status)) {
      complain('orders', order.id, `status "${order.status}" (invariant 14)`);
    }
  }
  for (const discount of data.discounts) {
    if (!inSet(DISCOUNT_KINDS, discount.kind)) {
      complain('discounts', discount.id, `kind "${discount.kind}" (invariant 14)`);
    }
  }
  for (const product of data.products) {
    if (!inSet(GENDERS, product.gender)) {
      complain('products', product.id, `gender "${product.gender}" (invariant 14)`);
    }
    for (const purpose of product.purposes) {
      if (!inSet(PURPOSES, purpose)) complain('products', product.id, `purpose "${purpose}" (invariant 15)`);
    }
    for (const sign of product.zodiac_signs) {
      if (!inSet(ZODIAC_SIGNS, sign)) complain('products', product.id, `zodiac sign "${sign}" (invariant 15)`);
    }
    for (const stone of product.stones) {
      if (!TRANSLATABLE_STONES.includes(stone)) {
        complain('products', product.id, `stone "${stone}" has no translation key (invariant 16)`);
      }
    }
  }
  for (const zodiac of data.zodiac_info) {
    if (!inSet(ZODIAC_SIGNS, zodiac.sign)) {
      complain('zodiac_info', zodiac.id, `sign "${zodiac.sign}" (invariant 15)`);
    }
    for (const stone of zodiac.stones) {
      if (!TRANSLATABLE_STONES.includes(stone)) {
        complain('zodiac_info', zodiac.id, `stone "${stone}" has no translation key (invariant 16)`);
      }
    }
  }

  const quiz = data.quiz_config;
  for (const mood of quiz.moods) {
    for (const purpose of mood.purposes) {
      if (!inSet(PURPOSES, purpose)) complain('quiz_config.moods', mood.id, `purpose "${purpose}" (invariant 17)`);
    }
  }
  for (const intention of quiz.intentions) {
    for (const purpose of intention.purposes) {
      if (!inSet(PURPOSES, purpose)) {
        complain('quiz_config.intentions', intention.id, `purpose "${purpose}" (invariant 17)`);
      }
    }
  }
  for (const budget of quiz.budgets) {
    if (budget.max !== null && Number(budget.max) < Number(budget.min)) {
      complain('quiz_config.budgets', budget.id, `max ${budget.max} < min ${budget.min} (invariant 17)`);
    }
  }
  // `QuizPage` special-cases the literal id `any` and drops the price filter for
  // it. Without exactly one, the quiz either has no "surprise me" option or has
  // two that behave identically.
  const anyBudgets = quiz.budgets.filter((budget) => budget.id === 'any').length;
  if (anyBudgets !== 1) {
    problems.push(`quiz_config: ${anyBudgets} budgets with id "any", expected exactly 1 (invariant 17)`);
  }

  // ------------------------------------------------------------------- //
  //  18. Derived role flags
  // ------------------------------------------------------------------- //

  for (const user of data.users) {
    const staff = user.role === 'admin' || user.role === 'staff';
    const superuser = user.role === 'admin';
    if (user.is_staff !== staff || user.is_superuser !== superuser) {
      complain(
        'users',
        user.id,
        `role "${user.role}" implies is_staff=${staff}, is_superuser=${superuser} (invariant 18)`,
      );
    }
  }

  // ------------------------------------------------------------------- //
  //  19-27. Money
  // ------------------------------------------------------------------- //

  const money = (table: string, id: number, field: string, value: string | null): void => {
    if (value === null) return;
    if (!MONEY_PATTERN.test(value) || Math.abs(Number(value)) > 99_999_999.99) {
      complain(table, id, `${field} "${value}" is not a 2-dp decimal (invariant 27)`);
    }
  };
  for (const product of data.products) {
    money('products', product.id, 'price', product.price);
    money('products', product.id, 'original_price', product.original_price);
  }
  for (const discount of data.discounts) {
    money('discounts', discount.id, 'value', discount.value);
    money('discounts', discount.id, 'min_order_total', discount.min_order_total);
  }
  for (const item of data.order_items) {
    money('order_items', item.id, 'unit_price', item.unit_price);
    money('order_items', item.id, 'line_total', item.line_total);
    // 21. `line_total` is stored, not computed — so it can and must be checked.
    if (Math.round(Number(item.unit_price) * 100) * item.quantity !== Math.round(Number(item.line_total) * 100)) {
      complain('order_items', item.id, `line_total ${item.line_total} != unit_price × quantity (invariant 21)`);
    }
  }

  const codes = new Map<string, DiscountRow>();
  for (const discount of data.discounts) codes.set(discount.code.toLowerCase(), discount);
  const usesByCode = new Map<string, number>();

  for (const order of data.orders) {
    money('orders', order.id, 'subtotal', order.subtotal);
    money('orders', order.id, 'discount_amount', order.discount_amount);
    money('orders', order.id, 'total', order.total);

    const items = data.order_items.filter((item) => item.order_id === order.id);
    const lineSum = items.reduce((sum, item) => sum + Math.round(Number(item.line_total) * 100), 0);
    const subtotal = Math.round(Number(order.subtotal) * 100);
    const discountAmount = Math.round(Number(order.discount_amount) * 100);
    const total = Math.round(Number(order.total) * 100);

    if (subtotal !== lineSum) {
      complain('orders', order.id, `subtotal ${order.subtotal} != sum of line totals (invariant 19)`);
    }
    if (total !== subtotal - discountAmount) {
      complain('orders', order.id, `total ${order.total} != subtotal - discount (invariant 20)`);
    }
    if (total < 0) complain('orders', order.id, `total ${order.total} is negative (invariant 20)`);
    if (discountAmount > 0 !== (order.discount_code !== '')) {
      complain('orders', order.id, 'discount_amount and discount_code disagree (invariant 22)');
    }
    if (discountAmount > subtotal) {
      complain('orders', order.id, `discount_amount ${order.discount_amount} exceeds subtotal (invariant 23)`);
    }
    if (order.discount_code !== '') {
      const key = order.discount_code.toLowerCase();
      usesByCode.set(key, (usesByCode.get(key) ?? 0) + 1);
      const discount = codes.get(key);
      if (!discount) {
        complain('orders', order.id, `discount_code "${order.discount_code}" matches no code (invariant 24)`);
      } else {
        // The same function the checkout runs, against the code's *seeded*
        // terms — so a seed that hand-wrote an amount the shop would not have
        // charged is caught here rather than by a customer.
        const expected = computeDiscount(discount, subtotal);
        if (expected !== discountAmount) {
          complain(
            'orders',
            order.id,
            `discount_amount ${order.discount_amount} != ${(expected / 100).toFixed(2)} for ${discount.code} (invariant 24)`,
          );
        }
        if (subtotal < Math.round(Number(discount.min_order_total) * 100)) {
          complain('orders', order.id, `subtotal is under ${discount.code}'s minimum (invariant 24)`);
        }
      }
    }
    // 28. `OrderCreateIn.items` is `min_length=1`, so an empty order cannot exist.
    if (items.length === 0) complain('orders', order.id, 'has no items (invariant 28)');
  }

  for (const discount of data.discounts) {
    // 25. This is the counter the backend increments on every create, and the
    //     admin's usage column renders it verbatim. A mismatch is a lie on screen.
    const actual = usesByCode.get(discount.code.toLowerCase()) ?? 0;
    if (discount.uses_count !== actual) {
      complain('discounts', discount.id, `uses_count ${discount.uses_count} != ${actual} orders (invariant 25)`);
    }
    if (discount.max_uses !== null && discount.uses_count > discount.max_uses) {
      complain('discounts', discount.id, `uses_count exceeds max_uses (invariant 26)`);
    }
  }

  // ------------------------------------------------------------------- //
  //  29-31. Order items
  // ------------------------------------------------------------------- //

  let nameMatches = 0;
  for (const item of data.order_items) {
    if (!VALID_SIZES.has(item.size) || item.size.length > 8) {
      complain('order_items', item.id, `size "${item.size}" (invariant 29)`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      complain('order_items', item.id, `quantity ${item.quantity} outside 1..99 (invariant 30)`);
    }
    const product = data.products.find((row) => row.id === item.product_id);
    if (product && product.name === item.product_name) nameMatches += 1;
  }
  // 31. A snapshot is *allowed* to drift — that is the point of storing it — but
  //     a seed where most rows have drifted is a seed whose product ids are wrong.
  if (data.order_items.length > 0 && nameMatches / data.order_items.length < 0.9) {
    problems.push(
      `order_items: only ${nameMatches}/${data.order_items.length} product_name snapshots match (invariant 31)`,
    );
  }

  // ------------------------------------------------------------------- //
  //  32-40. Temporal — asserted after the rebase, which is why `hydrate()`
  //  calls this last.
  // ------------------------------------------------------------------- //

  const ordersById = new Map(data.orders.map((order) => [order.id, order]));
  const usersById = new Map(data.users.map((user) => [user.id, user]));

  for (const order of data.orders) {
    const created = parseIso(order.created_at);
    const updated = parseIso(order.updated_at);
    if (!(updated >= created)) complain('orders', order.id, 'updated_at < created_at (invariant 32)');
    if (created > now || updated > now) complain('orders', order.id, 'is dated in the future (invariant 32)');
    const owner = usersById.get(order.user_id);
    if (owner && created < parseIso(owner.date_joined)) {
      complain('orders', order.id, `predates ${owner.email}'s account (invariant 37)`);
    }
  }

  const statusChains = new Map<number, AdminActionRow[]>();
  for (const action of data.admin_actions) {
    const at = parseIso(action.created_at);
    if (at > now) complain('admin_actions', action.id, 'is dated in the future (invariant 33)');
    if (action.target_type === 'order') {
      const order = ordersById.get(action.target_id);
      if (order && (at < parseIso(order.created_at) || at > parseIso(order.updated_at))) {
        complain('admin_actions', action.id, `outside order ${order.id}'s lifetime (invariant 33)`);
      }
      if (action.verb === 'status_change') {
        const chain = statusChains.get(action.target_id) ?? [];
        chain.push(action);
        statusChains.set(action.target_id, chain);
      }
    }
    if (action.actor_id !== null) {
      const actor = usersById.get(action.actor_id);
      if (actor && at < parseIso(actor.date_joined)) {
        complain('admin_actions', action.id, `predates ${actor.email}'s account (invariant 35)`);
      }
    }
  }

  // 34. The chain has to *tell the truth*: each row's destination is the next
  //     row's source, and the last destination is where the order actually is.
  //     A feed whose final entry says "shipped → delivered" on a cancelled order
  //     is worse than no feed at all.
  const arrow = ` ${AUDIT_GLYPHS.arrow} `;
  for (const [orderId, chain] of statusChains) {
    const order = ordersById.get(orderId);
    if (!order) continue;
    const sorted = [...chain].sort(
      (a, b) => parseIso(a.created_at) - parseIso(b.created_at) || a.id - b.id,
    );
    let previous: string | null = null;
    for (const action of sorted) {
      const parts = action.summary.split(arrow);
      if (parts.length !== 2) continue; // a `Bulk → status` summary has no source
      const [from, to] = parts;
      if (previous !== null && from !== previous) {
        complain('admin_actions', action.id, `chain says "${from}" but the previous row left it "${previous}" (invariant 34)`);
      }
      previous = to;
    }
    if (previous !== null && previous !== order.status) {
      complain('orders', orderId, `status "${order.status}" but its last audit row says "${previous}" (invariant 34)`);
    }
  }

  for (const user of data.users) {
    if (user.last_login === null) continue;
    const lastLogin = parseIso(user.last_login);
    if (lastLogin < parseIso(user.date_joined) || lastLogin > now) {
      complain('users', user.id, 'last_login outside [date_joined, now] (invariant 36)');
    }
  }
  for (const token of data.password_reset_tokens) {
    if (token.used_at !== null && parseIso(token.used_at) < parseIso(token.created_at)) {
      complain('password_reset_tokens', token.id, 'used_at < created_at (invariant 38)');
    }
  }

  // 39. Without one live code the checkout's discount field can only ever
  //     produce an error, and the flow the seed exists to demonstrate is dead.
  if (!data.discounts.some((discount) => isRedeemable(discount, now))) {
    problems.push('discounts: none is redeemable right now (invariant 39)');
  }
  const futureExpiry = data.discounts.filter(
    (discount) => discount.expires_at !== null && parseIso(discount.expires_at) > now,
  ).length;
  const pastExpiry = data.discounts.filter(
    (discount) => discount.expires_at !== null && parseIso(discount.expires_at) <= now,
  ).length;
  if (futureExpiry < 2 || pastExpiry < 2) {
    problems.push(
      `discounts: ${futureExpiry} future and ${pastExpiry} past expiries, need >=2 of each (invariant 40)`,
    );
  }

  // ------------------------------------------------------------------- //
  //  41-45. Field lengths
  //
  //  Real column widths. A mock that ignores them accepts strings the real
  //  backend would reject with a 500 — and the seed is exactly where an
  //  over-long Georgian description would first appear.
  // ------------------------------------------------------------------- //

  const fits = (table: string, id: number | string, field: string, value: string, max: number): void => {
    if (value.length > max) {
      complain(table, id, `${field} is ${value.length} chars, max ${max} (invariants 41-45)`);
    }
  };
  for (const user of data.users) {
    fits('users', user.id, 'first_name', user.first_name, 150);
    fits('users', user.id, 'last_name', user.last_name, 150);
    fits('users', user.id, 'email', user.email, 254);
  }
  for (const product of data.products) {
    fits('products', product.id, 'name', product.name, 128);
    fits('products', product.id, 'image', product.image, 255);
  }
  for (const collection of data.collections) {
    fits('collections', collection.id, 'name', collection.name, 128);
    fits('collections', collection.id, 'slug', collection.slug, 64);
    fits('collections', collection.id, 'image', collection.image, 255);
  }
  for (const zodiac of data.zodiac_info) {
    fits('zodiac_info', zodiac.id, 'name', zodiac.name, 64);
    fits('zodiac_info', zodiac.id, 'symbol', zodiac.symbol, 8);
    fits('zodiac_info', zodiac.id, 'dates', zodiac.dates, 64);
    fits('zodiac_info', zodiac.id, 'element', zodiac.element, 32);
  }
  for (const order of data.orders) {
    fits('orders', order.id, 'full_name', order.full_name, 200);
    fits('orders', order.id, 'phone', order.phone, 50);
    fits('orders', order.id, 'city', order.city, 100);
    fits('orders', order.id, 'address', order.address, 255);
    fits('orders', order.id, 'discount_code', order.discount_code, 64);
  }
  for (const item of data.order_items) {
    fits('order_items', item.id, 'product_name', item.product_name, 128);
    fits('order_items', item.id, 'product_image', item.product_image, 255);
  }
  for (const discount of data.discounts) fits('discounts', discount.id, 'code', discount.code, 64);
  for (const action of data.admin_actions) {
    fits('admin_actions', action.id, 'target_type', action.target_type, 32);
    fits('admin_actions', action.id, 'verb', action.verb, 64);
    fits('admin_actions', action.id, 'summary', action.summary, 255);
  }
  const settings = data.site_settings;
  fits('site_settings', 1, 'hero_title_en', settings.hero_title_en, 200);
  fits('site_settings', 1, 'hero_title_ka', settings.hero_title_ka, 200);
  fits('site_settings', 1, 'hero_cta_label_en', settings.hero_cta_label_en, 100);
  fits('site_settings', 1, 'hero_cta_label_ka', settings.hero_cta_label_ka, 100);
  fits('site_settings', 1, 'banner_text_en', settings.banner_text_en, 255);
  fits('site_settings', 1, 'banner_text_ka', settings.banner_text_ka, 255);
  fits('site_settings', 1, 'site_name', settings.site_name, 100);
  fits('site_settings', 1, 'twitter_handle', settings.twitter_handle, 64);
  fits('site_settings', 1, 'default_robots', settings.default_robots, 64);
  fits('site_settings', 1, 'hero_image', settings.hero_image, 255);
  fits('site_settings', 1, 'default_og_image', settings.default_og_image, 255);
  for (const page of data.page_seo) {
    fits('page_seo', page.id, 'path', page.path, 255);
    fits('page_seo', page.id, 'title_en', page.title_en, 200);
    fits('page_seo', page.id, 'title_ka', page.title_ka, 200);
    fits('page_seo', page.id, 'og_image', page.og_image, 255);
    fits('page_seo', page.id, 'robots', page.robots, 64);
  }
  const quizElements: Array<{ id: string; icon: string; labelEn: string; labelKa: string }> = [
    ...quiz.moods,
    ...quiz.occasions,
    ...quiz.intentions,
    ...quiz.budgets,
  ];
  for (const element of quizElements) {
    // `min_length=1` on the id: the admin editor can produce an empty one, and
    // upstream answers 422 for it.
    if (!element.id) problems.push('quiz_config: an element has an empty id (invariant 45)');
    fits('quiz_config', element.id, 'id', element.id, 64);
    fits('quiz_config', element.id, 'icon', element.icon, 8);
    fits('quiz_config', element.id, 'labelEn', element.labelEn, 128);
    fits('quiz_config', element.id, 'labelKa', element.labelKa, 128);
  }
  for (const element of [...quiz.occasions, ...quiz.intentions]) {
    fits('quiz_config', element.id, 'hintEn', element.hintEn, 255);
    fits('quiz_config', element.id, 'hintKa', element.hintKa, 255);
  }

  // ------------------------------------------------------------------- //
  //  46-55. Coverage — what makes the demo look alive rather than merely
  //  valid. A zero-count facet renders as a dead 40%-opacity chip; an empty
  //  status filter option looks like a bug in the filter.
  // ------------------------------------------------------------------- //

  const atLeast = (label: string, actual: number, wanted: number, invariant: number): void => {
    if (actual < wanted) problems.push(`${label}: ${actual}, need >=${wanted} (invariant ${invariant})`);
  };

  for (const status of ORDER_STATUSES) {
    atLeast(`orders with status "${status}"`, data.orders.filter((o) => o.status === status).length, 1, 46);
  }
  for (const purpose of PURPOSES) {
    atLeast(
      `products for purpose "${purpose}"`,
      data.products.filter((p) => p.purposes.includes(purpose)).length,
      4,
      47,
    );
  }
  for (const sign of ZODIAC_SIGNS) {
    atLeast(
      `products for sign "${sign}"`,
      data.products.filter((p) => p.zodiac_signs.includes(sign)).length,
      3,
      47,
    );
  }
  for (const gender of GENDERS) {
    atLeast(`products for gender "${gender}"`, data.products.filter((p) => p.gender === gender).length, 1, 48);
  }
  atLeast('bestsellers', data.products.filter((p) => p.is_bestseller).length, 6, 48);
  atLeast('new products', data.products.filter((p) => p.is_new).length, 4, 48);

  for (const kind of DISCOUNT_KINDS) {
    atLeast(`discounts of kind "${kind}"`, data.discounts.filter((d) => d.kind === kind).length, 1, 49);
  }
  atLeast('inactive discounts', data.discounts.filter((d) => !d.is_active).length, 1, 49);
  atLeast(
    'exhausted discounts',
    data.discounts.filter((d) => d.max_uses !== null && d.uses_count >= d.max_uses).length,
    1,
    49,
  );
  atLeast('discounts with no usage cap', data.discounts.filter((d) => d.max_uses === null).length, 1, 49);
  // The tile counts `is_active` alone and ignores expiry, so these two rows are
  // what makes `activeDiscountCount` visibly generous — upstream behaviour the
  // README names.
  atLeast(
    'expired-but-active discounts',
    data.discounts.filter(
      (d) => d.is_active && d.expires_at !== null && parseIso(d.expires_at) <= now,
    ).length,
    1,
    49,
  );

  for (const role of ROLES) {
    atLeast(`users with role "${role}"`, data.users.filter((u) => u.role === role).length, 2, 50);
  }
  atLeast('inactive users', data.users.filter((u) => !u.is_active).length, 3, 50);

  for (const product of data.products) {
    if (product.stones.length === 0) complain('products', product.id, 'has no stones (invariant 51)');
    if (product.purposes.length === 0) complain('products', product.id, 'has no purposes (invariant 51)');
    if (product.zodiac_signs.length === 0) complain('products', product.id, 'has no zodiac signs (invariant 51)');
    // 52. Georgian is a first-class language here, not a fallback: an empty
    //     `*_ka` shows English inside a Georgian sentence and nothing reports it.
    if (!product.name_ka) complain('products', product.id, 'name_ka is empty (invariant 52)');
    if (!product.description_ka) complain('products', product.id, 'description_ka is empty (invariant 52)');
    if (!product.stones_meaning_ka) complain('products', product.id, 'stones_meaning_ka is empty (invariant 52)');
    if (!product.image) complain('products', product.id, 'image is empty (invariant 53)');
  }
  for (const collection of data.collections) {
    if (!collection.name_ka) complain('collections', collection.id, 'name_ka is empty (invariant 52)');
    if (!collection.description_ka) complain('collections', collection.id, 'description_ka is empty (invariant 52)');
    if (!collection.image) complain('collections', collection.id, 'image is empty (invariant 53)');
  }
  for (const zodiac of data.zodiac_info) {
    if (!zodiac.name_ka) complain('zodiac_info', zodiac.id, 'name_ka is empty (invariant 52)');
    if (!zodiac.dates_ka) complain('zodiac_info', zodiac.id, 'dates_ka is empty (invariant 52)');
    if (!zodiac.element_ka) complain('zodiac_info', zodiac.id, 'element_ka is empty (invariant 52)');
    if (!zodiac.description_ka) complain('zodiac_info', zodiac.id, 'description_ka is empty (invariant 52)');
  }

  // 54. There is no filesystem to stat from a browser.
  const inventory = new Set(MEDIA_INVENTORY);
  const checkMedia = (table: string, id: number | string, field: string, key: string): void => {
    if (!key) return;
    if (/^(?:https?:|data:|blob:)/i.test(key)) return;
    if (!inventory.has(key)) complain(table, id, `${field} "${key}" is not in MEDIA_INVENTORY (invariant 54)`);
  };
  for (const product of data.products) checkMedia('products', product.id, 'image', product.image);
  for (const collection of data.collections) checkMedia('collections', collection.id, 'image', collection.image);
  for (const item of data.order_items) checkMedia('order_items', item.id, 'product_image', item.product_image);
  for (const page of data.page_seo) checkMedia('page_seo', page.id, 'og_image', page.og_image);
  checkMedia('site_settings', 1, 'hero_image', settings.hero_image);
  checkMedia('site_settings', 1, 'default_og_image', settings.default_og_image);

  // 55. The banner signs you in with one click and the login page pre-fills the
  //     address; both read `accounts.ts`. A seed that renamed one of these rows
  //     would leave a button that always fails.
  for (const account of DEMO_ACCOUNTS) {
    const user = data.users.find((row) => row.email.toLowerCase() === account.email.toLowerCase());
    if (!user) {
      problems.push(`users: demo account ${account.email} is missing (invariant 55)`);
      continue;
    }
    if (user.password !== DEMO_PASSWORD) {
      complain('users', user.id, `${account.email} does not carry DEMO_PASSWORD (invariant 55)`);
    }
    if (user.role !== account.role) {
      complain('users', user.id, `${account.email} is ${user.role}, expected ${account.role} (invariant 55)`);
    }
    if (!user.is_active) complain('users', user.id, `${account.email} is inactive (invariant 55)`);
  }

  if (problems.length > 0) {
    throw new Error(`Demo seed violates §F.11:\n  - ${problems.join('\n  - ')}`);
  }
}

// --------------------------------------------------------------------------- //
//  DATE REBASING
//
//  A seed with absolute dates is stale the day after it is written: nothing sold
//  today, an empty "last 7 days", every live discount expired. That is the
//  classic dead-demo tell, and it is entirely avoidable — so the whole world
//  slides by the whole-day distance from the newest order to today, anything
//  that would then sit in the future is folded back into the part of today that
//  has actually elapsed, the short-lived rows are re-armed against the real
//  clock, and finally the *arrangement* the first two screens depend on is
//  restored by moving the fewest rows the smallest distance.
//
//  Phase order matters: shift, compress, re-arm, realign.
//
//  Two zones, two jobs, and mixing them up is the subtle bug here:
//
//  - The **shift** is measured in **Asia/Tbilisi** days, because that decides
//    how many days to move and a shop that trades in Tbilisi should keep its
//    mornings as mornings.
//  - The **compression** and the **realignment** are measured in **UTC** days,
//    because upstream runs `TIME_ZONE = "UTC"` and every `?date_from=` filter
//    compares `created_at__date` in that zone. Squeezing an order into the
//    elapsed part of the *Tbilisi* day can push it across the UTC midnight
//    behind it — so an order placed this morning would answer the dashboard's
//    "today" filter with yesterday's date, which is precisely the emptiness this
//    whole pass exists to prevent.
// --------------------------------------------------------------------------- //

/**
 * Columns recording something that has already happened. Shifted by whole days,
 * then folded into the part of today that has actually elapsed — so nothing an
 * `auto_now_add` column produced can end up dated in the future.
 *
 * `users.date_joined` and `.last_login` are `IsoOffset` and every other field
 * here is `IsoDateTime`; `restamp()` re-emits each in the shape it found, because
 * `AdminUserOut` declares those two as `str` and the app renders them raw.
 */
const PAST_FIELDS: Partial<Record<keyof Tables, string[]>> = {
  users: ['date_joined', 'last_login'],
  password_reset_tokens: ['created_at', 'used_at'],
  orders: ['created_at', 'updated_at'],
  discounts: ['created_at', 'updated_at'],
  page_seo: ['created_at', 'updated_at'],
  admin_actions: ['created_at'],
  site_settings: ['updated_at'],
  quiz_config: ['updated_at'],
};

/**
 * The one column in this domain that names a position rather than a past event.
 *
 * It gets the day shift and **nothing else**: a discount whose expiry was
 * clamped to `now` would be expired, and clamping all of them would leave the
 * checkout with no working code at all — §F.11's invariant 39. `rearmExpiries()`
 * is the guard that says so out loud.
 */
const WINDOW_FIELDS: Partial<Record<keyof Tables, string[]>> = {
  discounts: ['expires_at'],
};

type Row = Record<string, unknown>;

/** Walks a table whether it is an array of rows or one of the two singletons. */
function eachRow(data: Tables, table: string, apply: (row: Row) => void): void {
  const rows = (data as unknown as Record<string, unknown>)[table];
  if (Array.isArray(rows)) rows.forEach((row) => apply(row as Row));
  else if (rows) apply(rows as Row);
}

/** `2026-03-01T08:00:00.123456+00:00` — Python's raw isoformat, six digits and an offset. */
const OFFSET_SHAPE = /\+00:00$/;
const OFFSET_FRACTION = /\.(\d{1,6})\+00:00$/;

/**
 * Re-emit an instant in the shape the original string wore.
 *
 * The `+00:00` columns keep the moved instant's real milliseconds and borrow
 * only the **last three** of the seed's authored microsecond digits, because
 * JavaScript has no sub-millisecond clock and would otherwise write three zeros
 * where the seed had real ones — turning a faithful-looking Python timestamp
 * into an obviously synthetic one on the admin's user page.
 *
 * Borrowing the *whole* six digits would be the trap: it truncates the computed
 * instant to a whole second, so a shift of one day could move two timestamps a
 * second apart onto the same second and let the authored tails decide their
 * order. That inverts `last_login` and `date_joined` on a row where the seed
 * happened to write a smaller tail on the later field.
 */
function restamp(original: string, instant: number): string {
  if (!OFFSET_SHAPE.test(original)) return toApiDateTime(instant);
  const micros = (OFFSET_FRACTION.exec(original)?.[1] ?? '').padEnd(6, '0').slice(3);
  return `${new Date(instant).toISOString().slice(0, -1)}${micros}+00:00`;
}

function mapFields(
  data: Tables,
  map: Partial<Record<keyof Tables, string[]>>,
  move: (instant: number) => number,
): void {
  for (const [table, fields] of Object.entries(map)) {
    if (!fields) continue;
    eachRow(data, table, (row) => {
      for (const field of fields) {
        const value = row[field];
        if (typeof value !== 'string' || !value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) row[field] = restamp(value, move(parsed));
      }
    });
  }
}

/** How many orders each window should hold once the realignment is done (§F.10 step 4). */
const TODAY_TARGET = 1;
const WEEK_TARGET = 6;
const MONTH_TARGET = 14;

function rebase(data: Tables): void {
  const now = CLOCK.now();

  // The anchor is the newest order **creation**. Not the newest audit row —
  // those are derived from orders and would drag the orders into the past. Not
  // `updated_at`, which is the same instant or later. Not a discount expiry,
  // which is a future position by design.
  let anchor = Number.NEGATIVE_INFINITY;
  for (const order of data.orders) {
    const created = Date.parse(order.created_at);
    if (Number.isFinite(created) && created > anchor) anchor = created;
  }
  if (!Number.isFinite(anchor)) return;

  // Classified *before* anything moves, because the shift is what destroys the
  // evidence: after it, a token authored ten minutes before the anchor and one
  // authored three hours before are indistinguishable from each other's
  // position relative to the real clock.
  const liveTokens = new Set(
    data.password_reset_tokens
      .filter(
        (token) =>
          token.used_at === null && anchor - Date.parse(token.created_at) <= PASSWORD_RESET_TTL_MS,
      )
      .map((token) => token.id),
  );
  const expiryDays = new Map<number, number>();
  for (const discount of data.discounts) {
    if (discount.expires_at === null) continue;
    expiryDays.set(
      discount.id,
      dayKeyDistance(tbilisiDateKey(anchor), tbilisiDateKey(discount.expires_at)) / DAY,
    );
  }

  // 1. Shift. A whole number of days, so every row keeps its time of day: the
  //    seed's nine-o'clock orders are still nine-o'clock orders.
  const offset = dayKeyDistance(tbilisiDateKey(anchor), todayKeyTbilisi());
  if (offset !== 0) {
    mapFields(data, PAST_FIELDS, (instant) => instant + offset);
    mapFields(data, WINDOW_FIELDS, (instant) => instant + offset);
  }

  compressToday(data, now);
  rearmTokens(data, now, liveTokens);
  rearmExpiries(data, now, expiryDays);
  realignOrders(data, now);
}

/**
 * Fold everything that would sit in the future back into the part of today that
 * has actually elapsed.
 *
 * The shift moves whole days, so the anchor day's afternoon rows land ahead of
 * `now` for anyone opening the demo before then — which is all of European and
 * American business hours. Django could not produce that: `created_at` is
 * `auto_now_add`. Nor is a flat clamp to `now` good enough, because it collapses
 * a morning's worth of rows onto one instant and the list stops looking like a
 * day's trading.
 *
 * So the whole of today is **scaled** into `[UTC midnight, now]`, using the real
 * maximum rather than a nominal 24 hours as the divisor. That preserves order
 * and spread, needs no clamp at all, and — because the window starts at UTC
 * midnight — cannot push a row across the date boundary the API's own filters
 * compare against. Rows before today are left exactly where they are.
 */
function compressToday(data: Tables, now: number): void {
  const [year, month, day] = todayKeyUtc().split('-').map(Number);
  const dayStart = Date.UTC(year, month - 1, day);

  let newest = dayStart;
  for (const [table, fields] of Object.entries(PAST_FIELDS)) {
    if (!fields) continue;
    eachRow(data, table, (row) => {
      for (const field of fields) {
        const value = row[field];
        if (typeof value !== 'string' || !value) continue;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed) && parsed > newest) newest = parsed;
      }
    });
  }

  // `min(…, 1)` so a seed that is already entirely in the past is left alone
  // rather than being stretched forward into a day it never claimed.
  const span = newest - dayStart;
  const scale = span > 0 ? Math.min((now - dayStart) / span, 1) : 1;
  if (scale >= 1) return;

  mapFields(data, PAST_FIELDS, (instant) =>
    instant < dayStart ? instant : Math.round(dayStart + (instant - dayStart) * scale),
  );

  // Re-impose the three orderings the compression can break. It is monotonic in
  // the instant, so in the ordinary case it cannot invert anything — but a demo
  // opened at exactly UTC midnight has a zero-width window, every row today
  // collapses onto the same millisecond, and the sub-millisecond digits then
  // decide an order that was never theirs to decide.
  for (const order of data.orders) {
    if (parseIso(order.updated_at) < parseIso(order.created_at)) order.updated_at = order.created_at;
  }
  for (const user of data.users) {
    if (user.last_login !== null && parseIso(user.last_login) < parseIso(user.date_joined)) {
      user.last_login = user.date_joined;
    }
  }
  for (const token of data.password_reset_tokens) {
    if (token.used_at !== null && parseIso(token.used_at) < parseIso(token.created_at)) {
      token.used_at = token.created_at;
    }
  }
  clampAuditToOrders(data);
}

/**
 * Every `admin_actions` row targeting an order has to sit inside that order's
 * lifetime, because that is the only window in which the action could have been
 * taken — and `ActivityFeed` renders the two side by side, so a row dated after
 * its order was last touched is visible on screen.
 */
function clampAuditToOrders(data: Tables): void {
  const orders = new Map(data.orders.map((order) => [order.id, order]));
  for (const action of data.admin_actions) {
    if (action.target_type !== 'order') continue;
    const order = orders.get(action.target_id);
    if (!order) continue;
    const at = parseIso(action.created_at);
    const from = parseIso(order.created_at);
    const to = parseIso(order.updated_at);
    if (at < from) action.created_at = order.created_at;
    else if (at > to) action.created_at = order.updated_at;
  }
}

/**
 * Re-arm the password-reset tokens against the real clock.
 *
 * These three rows exist so `/auth/password/reset/confirm` can be walked end to
 * end — one live, one spent, one expired — and their whole point is a
 * **one-hour** window. A whole-day shift preserves the window's length but not
 * its position: it lands at whatever hour the seed was written for, which is
 * expired for most of the day. So the live one is re-issued as if the email had
 * gone out ten minutes ago and the expired one as if it had gone out three hours
 * ago. The spent one needs nothing — `used_at` is what makes it spent, not time.
 */
function rearmTokens(data: Tables, now: number, live: Set<number>): void {
  for (const token of data.password_reset_tokens) {
    if (token.used_at !== null) continue;
    token.created_at = toApiDateTime(now - (live.has(token.id) ? 10 * MINUTE : 3 * HOUR));
  }
}

/**
 * Keep every discount on the side of `now` its author put it on.
 *
 * A whole-day shift already does this, because `expires_at` is exempt from the
 * compression above — so with a well-formed seed nothing here fires. It is the
 * guard rather than the mechanism: an expiry that drifted onto the wrong side of
 * the clock would take the checkout's discount field down with it (invariant 39)
 * or leave the admin list with no "Expired" badge to show (invariant 40), and
 * neither failure announces itself.
 */
function rearmExpiries(data: Tables, now: number, days: Map<number, number>): void {
  for (const discount of data.discounts) {
    const authored = days.get(discount.id);
    if (authored === undefined || discount.expires_at === null) continue;
    const at = parseIso(discount.expires_at);
    const wasFuture = authored > 0;
    if (wasFuture === at > now) continue;
    discount.expires_at = toApiDateTime(now + authored * DAY);
  }
}

/**
 * Restore the *arrangement*, not just the spread.
 *
 * A uniform shift preserves the distance between orders but not what the first
 * two admin screens depend on. The dashboard opens on recent activity and the
 * orders list opens with Today / Last 7 days / Last 30 days presets; a rebase
 * that leaves those reading zero is the classic dead-demo tell, and it is
 * indistinguishable from a broken filter.
 *
 * Statuses are never rewritten — every line, discount and audit row hanging off
 * an order would contradict a new one. Only dates move, only as far as they must,
 * and an order's audit trail moves with it.
 *
 * The windows are measured with `utcDateKey`, because that is the key
 * `?date_from=` compares against. The admin UI builds its presets from the
 * *browser's* calendar instead, and for a visitor far enough east or west the
 * two disagree by a day — upstream's own behaviour, reproduced rather than
 * repaired.
 */
function realignOrders(data: Tables, now: number): void {
  const today = todayKeyUtc();
  fillWindow(data, now, TODAY_TARGET, today, today);
  fillWindow(data, now, WEEK_TARGET, shiftDayKey(today, -6), today);
  fillWindow(data, now, MONTH_TARGET, shiftDayKey(today, -29), today);
}

/**
 * Move as many orders as it takes into `[fromKey, toKey]`, nearest first.
 *
 * The nearest order is the least visible nudge, and a `pending` one is a better
 * candidate than a `delivered` one: an order delivered forty minutes ago reads
 * as a mistake, while an order placed forty minutes ago and still pending is
 * exactly what a shop's morning looks like. Moves are spread across the window
 * from its newest day backwards, so filling "last 7 days" does not stack six
 * orders on one afternoon.
 */
function fillWindow(
  data: Tables,
  now: number,
  target: number,
  fromKey: DateKey,
  toKey: DateKey,
): void {
  const inWindow = (order: OrderRow): boolean => {
    const key = utcDateKey(order.created_at);
    return key >= fromKey && key <= toKey;
  };
  let held = data.orders.filter(inWindow).length;
  if (held >= target) return;

  const width = Math.round(dayKeyDistance(fromKey, toKey) / DAY) + 1;
  const rank: Record<OrderStatus, number> = {
    pending: 0,
    paid: 1,
    cancelled: 2,
    shipped: 3,
    delivered: 4,
  };
  const candidates = data.orders
    .filter((order) => !inWindow(order))
    .map((order) => ({
      order,
      distance: Math.abs(dayKeyDistance(utcDateKey(order.created_at), toKey)),
    }))
    .sort(
      (left, right) =>
        rank[left.order.status] - rank[right.order.status] ||
        left.distance - right.distance ||
        right.order.id - left.order.id,
    );

  let placed = 0;
  for (const candidate of candidates) {
    if (held >= target) break;
    // Newest day of the window first, then one day back per move.
    if (moveOrderToDay(data, candidate.order, shiftDayKey(toKey, -(placed % width)), now)) {
      placed += 1;
      held += 1;
    }
  }
}

/**
 * Re-date one order onto `targetKey`, taking its audit trail with it.
 *
 * Refuses rather than corrupts: an order may not land in the future, and it may
 * not predate the account that placed it. The `created_at` → `updated_at` gap is
 * preserved when the whole pair has to be pulled back below `now`, so an order
 * that was edited an hour after it was placed still reads that way.
 */
function moveOrderToDay(data: Tables, order: OrderRow, targetKey: DateKey, now: number): boolean {
  const created = parseIso(order.created_at);
  const updated = parseIso(order.updated_at);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false;

  const shift = dayKeyDistance(utcDateKey(order.created_at), targetKey);
  if (shift === 0) return true;

  let nextCreated = created + shift;
  let nextUpdated = updated + shift;
  if (nextUpdated > now) {
    const back = nextUpdated - now;
    nextCreated -= back;
    nextUpdated -= back;
  }
  if (utcDateKey(nextCreated) !== targetKey) return false;

  const owner = data.users.find((user) => user.id === order.user_id);
  if (owner && nextCreated < parseIso(owner.date_joined)) return false;

  const delta = nextCreated - created;
  order.created_at = toApiDateTime(nextCreated);
  order.updated_at = toApiDateTime(Math.max(nextUpdated, nextCreated));
  for (const action of data.admin_actions) {
    if (action.target_type !== 'order' || action.target_id !== order.id) continue;
    action.created_at = toApiDateTime(parseIso(action.created_at) + delta);
  }
  clampAuditToOrders(data);
  return true;
}

// --------------------------------------------------------------------------- //
//  Construction happens last
//
//  `hydrate()` reaches forward into the rebasing pass and its field tables, and
//  a `const` is in its temporal dead zone until the line declaring it runs.
//  Building the store at the foot of the module rather than beside its type is
//  what keeps that legal, and it costs nothing: every importer sees a fully
//  evaluated module.
// --------------------------------------------------------------------------- //

export const store: Tables = hydrate();

counters = highestIds(store);
