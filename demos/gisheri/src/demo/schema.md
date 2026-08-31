# `src/demo/schema.md` — the schema

The shape of the demo's database: every table, every column, the id bands, the
fifty-five invariants the seed must satisfy, the four files that hold it, and the
rebasing pass that puts the whole thing on today's date.

[`routes.md`](./routes.md) is the route table. It uses this file's vocabulary and
does not repeat it: read this one first if you are writing a **seed file** or a
**serializer**, and that one if you are writing a **handler**.

```
src/demo/
  types.ts       the stored shape of every table — the schema itself
  base.ts        DemoApiError + the 25-code registry, the clock, latency, money
  base-path.ts   BASE / MEDIA_BASE / API_PREFIX, all derived from BASE_URL
  accounts.ts    the three demo logins, so seed and chrome cannot drift
  auth-tokens.ts JWT minting and reading — 30-minute access, 7-day refresh
  pricing.ts     the discount arithmetic and the one order-create path
  store.ts       the tables, id bands, ordering, the write-path side effects,
                 validateSeed() and the date rebase
  query.ts       filters, scalars, the two envelopes
  serialize.ts   row → payload, media URLs, the computed fields
  router.ts      the route table, dispatch, the auth and role gates
  schema.md      this file
  routes.md      every route: method, pattern, owner, auth, envelope, params
  handlers/      auth · public · orders · discounts · admin-catalog ·
                 admin-orders · admin-users · admin-discounts · admin-ops
                 (+ index.ts, the side-effect barrel)
  seed/          people.json · catalog.json · commerce.json · activity.json
                 (+ index.ts, which narrows them once)
  index.ts       boot: builds the store, installs the handlers, logs one line
```

**Where the original is.** Every "a port of `<app>/models.py`" note in these files
points at the Django project this demo replaces — a Django 5 + Ninja backend with
the apps `accounts`, `catalog`, `orders`, `discounts`, `site_settings`, `quiz` and
`audit`. When this document and that tree disagree, the tree wins. When this
document and the **code beside it** disagree, the code wins: say so and fix this
file.

---

## 1. The four rules

1. **No network.** Nothing here fetches, opens a socket or loads a font from a
   third party. Images are files under `public/media/` addressed through
   `import.meta.env.BASE_URL`.
2. **No storage.** No `localStorage`, `sessionStorage` or IndexedDB for demo
   data — the session included. The two tokens live in `lib/api.ts`'s module
   scope, so a reload signs you out and restores the pristine shop, which is the
   honest reading of "the server restarted". The only Web Storage this demo
   writes at all is the i18n language key and next-themes' own key, and neither
   is data.
3. **One clock.** `Date.now()` appears exactly once, in `CLOCK.now()`
   (`base.ts`). Never call it anywhere else and never call `new Date()` for
   "now" — every filter, every `auto_now`, every expiry test and the rebase all
   read that one function, which is what lets them agree to the millisecond.
4. **No `Math.random()`.** Ids come from counters; reset tokens and upload
   filenames come from a counter walked through xorshift32; latency is a
   deterministic walk by the golden ratio. A demo does not need entropy nobody
   can check — it needs a run that reproduces, so a console screenshot still
   matches the session it came from.

Files under `src/demo/` use **relative imports only**. `@/` resolves against the
app tree and means nothing here.

---

## 2. The tables

`store` is a live binding exported from `store.ts`. It holds one property per
table, plus the two singletons.

> **Read `store.x` at call time.** `resetStore()` empties and refills each array
> and `Object.assign`s each singleton rather than replacing them, so a module
> that hoisted `const orders = store.orders` into a local still sees the right
> rows afterwards. The corollary is worth stating anyway: never cache the array.

| Table | Row type | Rows | Notes |
|---|---|---|---|
| `users` | `UserRow` | 32 | `Meta.ordering = ["email"]`; `email` unique **case-insensitively** |
| `password_reset_tokens` | `PasswordResetTokenRow` | 3 | `token` unique; live iff unused **and** under one hour |
| `collections` | `CollectionRow` | 6 | `Meta.ordering = ["name"]` (the **English** name); `slug` unique and always a `Purpose` |
| `products` | `ProductRow` | 30 | `Meta.ordering = ["id"]` — the quiz's tie-break depends on it |
| `zodiac_info` | `ZodiacInfoRow` | 12 | `Meta.ordering = ["sign"]`, i.e. **alphabetical**; `sign` unique; twelve for ever |
| `orders` | `OrderRow` | 64 | `Meta.ordering = ["-created_at"]` |
| `order_items` | `OrderItemRow` | 138 | `Meta.ordering = ["id"]`, i.e. insertion order |
| `discounts` | `DiscountRow` | 14 | `Meta.ordering = ["-created_at"]`; every lookup is `code__iexact` |
| `page_seo` | `PageSeoRow` | 7 | `Meta.ordering = ["path"]`; `path` unique, matched with `===` |
| `admin_actions` | `AdminActionRow` | 152 | `Meta.ordering = ["-created_at"]`; append-only, read per target |
| `site_settings` | `SiteSettingsRow` | **singleton** | An object, not an array. `pk = 1`, hard-assigned in `save()` |
| `quiz_config` | `QuizConfigRow` | **singleton** | Likewise |

458 rows and two singleton objects. Ten tables allocate ids (§3); the two
singletons allocate nothing.

Three deliberate divergences from the real schema, each for a stated reason:

- **No `catalog_product_collections` join table**, and no `collections` field on
  `ProductRow`. The M2M appears in no Ninja schema, is read and written by no
  endpoint and is rendered by no screen — `CollectionsPage` computes membership
  client-side from `product.purposes`. A join table nothing reads would be a
  fifth seed file to keep consistent for nothing.
- **`site_settings` and `quiz_config` are objects, not one-row arrays.** Both
  models hard-assign `self.pk = 1`, so "the row" *is* the table. An array of one
  invites `[0]` guards at twenty call sites.
- **`QuizConfigRow`'s nested elements are camelCase.** Everything else in the
  store is snake_case because Postgres is; the quiz JSONB columns are the one
  place where the *stored* keys are already camelCase, because the seed command
  wrote `labelEn` / `hintKa` verbatim and `CamelSchema` round-trips a JSON value
  untouched. Renaming them here would mean translating in both directions for no
  gain.

### 2.1 `users`

`accounts_user` — the custom user, email-as-username.

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 1000–1999 |
| `password` | `string` | **Plaintext.** There is nothing to protect: the banner signs you in on request |
| `email` | `string` | Unique case-insensitively; ≤ 254 chars |
| `first_name` · `last_name` | `string` | `""` when unset, never `null`; ≤ 150 each |
| `role` | `'customer' \| 'staff' \| 'admin'` | The whole permission model |
| `is_active` | `boolean` | An inactive user's token resolves to "signed out" on the next request |
| `is_staff` | `boolean` | **Derived** from `role`. Only `syncRoleFlags()` may assign it |
| `is_superuser` | `boolean` | **Derived** from `role`. Likewise |
| `date_joined` | `IsoOffset` | `default=timezone.now`, **not** `auto_now_add` — the seed sets it freely |
| `last_login` | `IsoOffset \| null` | Never written by this API: the views mint tokens rather than calling Django's `login()` |

`is_staff` / `is_superuser` never reach the wire. `UserOut` carries
`isStaffRole` / `isAdminRole`, computed from `role` in `serialize.ts`.

### 2.2 `password_reset_tokens`

`accounts_passwordresettoken`. Live **iff** `used_at === null` **and** under the
one-hour TTL; both are evaluated at read time, because there is no sweep here and
there is none upstream either — no Celery beat, no management command, just a
subtraction inside the confirm route.

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 2000–2999 |
| `user_id` | `number` | FK to `users`, `on_delete=CASCADE` |
| `token` | `string` | `secrets.token_urlsafe(48)` upstream — 64 base64url characters. Stored in the clear; the demo prints it to the console |
| `created_at` | `IsoDateTime` | The TTL is measured from here |
| `used_at` | `IsoDateTime \| null` | Non-null ⇒ spent, and a spent token reads as *invalid*, not expired |

### 2.3 `collections`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 3000–3999 |
| `slug` | `string` | Unique, ≤ 64, and always one of the six `Purpose` values |
| `name` · `name_ka` | `string` | `name` ≤ 128 and is the sort key |
| `description` · `description_ka` | `string` | `""` when unset |
| `image` | `MediaKey` | A bare key under `public/media/`, ≤ 255 |

The slug rule is not decoration: `CollectionsPage` resolves membership with
`products.filter(p => p.purposes.includes(slug))`, so a slug outside the purpose
vocabulary can only ever render an empty page.

### 2.4 `products`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 4000–4999 |
| `name` · `name_ka` | `string` | `name` ≤ 128 |
| `price` | `Money` | 2-dp string, never a number |
| `original_price` | `Money \| null` | The struck-through "was" price; `null` when not on offer |
| `image` | `MediaKey` | ≤ 255 |
| `purposes` | `Purpose[]` | |
| `zodiac_signs` | `ZodiacSign[]` | |
| `stones` | `string[]` | English display names. There is no stones table — and every name must be translatable (§5.4, 16) |
| `stones_meaning` · `stones_meaning_ka` | `string` | |
| `description` · `description_ka` | `string` | |
| `gender` | `'men' \| 'women' \| 'unisex'` | |
| `is_bestseller` · `is_new` | `boolean` | Drive two storefront sections and two admin bulk actions |

### 2.5 `zodiac_info`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 5000–5011 — exactly twelve, and the only band with no headroom |
| `sign` | `ZodiacSign` | **The public key.** `ZodiacInfoOut` carries no `id` at all |
| `name` · `name_ka` | `string` | `name` ≤ 64 |
| `symbol` | `string` | The astrological glyph, e.g. `♈`. ≤ 8 |
| `dates` · `dates_ka` | `string` | Free text (`Mar 21 - Apr 19`), not a range anything parses. ≤ 64 |
| `element` · `element_ka` | `string` | `Fire`/`Earth`/`Air`/`Water` by convention, not by constraint. ≤ 32 |
| `stones` | `string[]` | Translatable names, as on `products` |
| `description` · `description_ka` | `string` | |

`sign`, `symbol` and `stones` are **read-only through the API**: `ZodiacInfoIn`
omits them as "effectively constants", so `PATCH /admin/zodiac/{sign}` writes the
other eight fields and silently ignores a body that carries a new glyph.

### 2.6 `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 6000–7999, double-wide because the visitor writes into it |
| `user_id` | `number` | FK to `users` |
| `status` | `OrderStatus` | `pending \| paid \| shipped \| delivered \| cancelled` |
| `full_name` | `string` | ≤ 200 — a **snapshot**, not a join to the user |
| `email` | `string` | Snapshot |
| `phone` | `string` | ≤ 50 |
| `city` | `string` | ≤ 100 |
| `address` | `string` | ≤ 255 |
| `notes` | `string` | The customer's own note |
| `admin_notes` | `string` | Internal. Blanked to `''` for any non-admin serialisation — never leak it |
| `subtotal` | `Money` | `= Σ items.line_total` |
| `discount_code` | `string` | The code's **canonical casing**, or `''`. ≤ 64. **Not** a foreign key |
| `discount_amount` | `Money` | Frozen at checkout and never re-derived |
| `total` | `Money` | `= subtotal − discount_amount` |
| `created_at` | `IsoDateTime` | `auto_now_add` |
| `updated_at` | `IsoDateTime` | `auto_now` — and `ActivityFeed`'s `reloadKey` |

The shipping block is a snapshot taken at checkout, so editing an account never
rewrites history. So is `discount_code`, which is why a discount row can be
renamed or deleted and the order still reads correctly.

**Money identity, enforced on every write:** `subtotal = Σ items.line_total` and
`total = subtotal − discount_amount`. There is no shipping and no tax; the two
"Shipping — calculated at checkout" rows in the UI are decoration. The identity
holds even when the result is negative — see §5.5 (20) and `recomputeTotals`.

### 2.7 `order_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 8000–9999, double-wide |
| `order_id` | `number` | FK to `orders` |
| `product_id` | `number` | FK to `products`, **`on_delete=PROTECT`** |
| `product_name` | `string` | Snapshot, ≤ 128 |
| `product_image` | `MediaKey` | Snapshot, ≤ 255 |
| `size` | `string` | `''`, `S`, `M`, `L` or `XL` — `CharField(max_length=8, blank=True)` |
| `quantity` | `number` | 1–99 |
| `unit_price` | `Money` | Snapshot. **Never** re-read from the catalogue |
| `line_total` | `Money` | `unit_price × quantity`, **stored** rather than computed, because it is a snapshot too |

The three snapshot columns are the whole reason this table is not a join: an
order must still read correctly after the product is renamed, re-photographed,
repriced or deleted. The seed carries **two deliberately drifted `product_name`
snapshots** (items 8003 and 8010) so the behaviour is visible on screen rather
than merely asserted.

`PROTECT` is why deleting a seeded product is refused: all thirty products are
referenced by at least one line, so the Delete button on a seeded product can
never succeed and only a product the visitor has just created is deletable.

### 2.8 `discounts`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 10000–10999 |
| `code` | `string` | Unique case-insensitively, ≤ 64. Stored and returned with its authored casing |
| `kind` | `'percent' \| 'fixed'` | |
| `value` | `Money` | Percent: 0–100 by convention. **Nothing validates the upper bound** |
| `min_order_total` | `Money` | `"0.00"` means no minimum |
| `max_uses` | `number \| null` | `null` = unlimited |
| `uses_count` | `number` | Moves **only** on order creation. Never on validate, never back on cancel |
| `expires_at` | `IsoDateTime \| null` | `null` = never expires |
| `is_active` | `boolean` | The dashboard tile counts this alone and ignores expiry |
| `created_at` · `updated_at` | `IsoDateTime` | |

### 2.9 `page_seo`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 11000–11999 |
| `path` | `string` | Unique, starts with `/`, ≤ 255 |
| `title_en` · `title_ka` | `string` | ≤ 200 |
| `description_en` · `description_ka` | `string` | |
| `og_image` | `MediaKey` | `''` falls back to `site_settings.default_og_image` |
| `robots` | `string` | `''` falls back to `site_settings.default_robots`. ≤ 64 |
| `created_at` · `updated_at` | `IsoDateTime` | |

`path` is compared by `Seo.tsx` with a literal `===` against react-router's
`location.pathname`, which is **basename-relative** — so the stored value stays
`/shop` and never becomes `/demos/gisheri/shop`. It must also be the concrete
pathname (`/zodiac/scorpio`), never the route pattern (`/zodiac/:sign`). The
seven seeded paths are `/`, `/shop`, `/zodiac`, `/collections`, `/quiz`,
`/about` and `/zodiac/scorpio`, the last one demonstrating exactly that rule.

### 2.10 `site_settings` — the first singleton

Nineteen columns: `id`, seventeen editable fields and `updated_at`. The seventeen
are what `PATCH /admin/site-settings` writes and what the form always sends.

| Column | Type | Notes |
|---|---|---|
| `id` | `1` | Pinned |
| `hero_title_en` · `hero_title_ka` | `string` | ≤ 200 |
| `hero_subtitle_en` · `hero_subtitle_ka` | `string` | |
| `hero_image` | `MediaKey` | ≤ 255 |
| `hero_cta_label_en` · `hero_cta_label_ka` | `string` | ≤ 100 |
| `hero_cta_link` | `string` | Model default `/shop`; `HeroSection` substitutes `/zodiac` only when it is empty |
| `banner_text_en` · `banner_text_ka` | `string` | ≤ 255 |
| `banner_link` | `string` | |
| `banner_active` | `boolean` | The banner renders only when this is true **and** the localised text is non-empty |
| `featured_collection_slugs` | `string[]` | Written by the settings form and read by nothing — `CollectionsSection` maps every collection in `Meta.ordering` order. Seeded with four real slugs so the form is not empty; do not build ordering on it |
| `site_name` | `string` | ≤ 100 |
| `default_og_image` | `MediaKey` | ≤ 255 |
| `twitter_handle` | `string` | Stored **without** the leading `@`; `Seo.tsx` adds it. ≤ 64 |
| `default_robots` | `string` | ≤ 64 |
| `updated_at` | `IsoDateTime` | `auto_now` |

Every localised pair is resolved client-side by
`pickLang(en, ka, lang) = (lang === 'ka' ? ka : en) || ka || en || ''`. **The mock
never picks a language**: it sends both columns and lets the app choose.

### 2.11 `quiz_config` — the second singleton

| Column | Type | Notes |
|---|---|---|
| `id` | `1` | Pinned |
| `moods` | `QuizMoodRow[]` | 6 seeded |
| `occasions` | `QuizOccasionRow[]` | 3 seeded |
| `intentions` | `QuizIntentionRow[]` | 6 seeded |
| `budgets` | `QuizBudgetRow[]` | 4 seeded |
| `updated_at` | `IsoDateTime` | Dropped from the wire, along with `id` |

The four nested shapes, all camelCase, all JSONB with no database validation:

| Element | Fields |
|---|---|
| `QuizMoodRow` | `id`, `icon`, `labelEn`, `labelKa`, `purposes: Purpose[]` — scoring adds +2 per shared purpose |
| `QuizOccasionRow` | `id`, `icon`, `labelEn`, `labelKa`, `hintEn`, `hintKa` — **no purposes**; the occasion step does not affect scoring |
| `QuizIntentionRow` | the occasion's six plus `purposes: Purpose[]` — scores like a mood *and* shows a hint |
| `QuizBudgetRow` | `id`, `icon`, `labelEn`, `labelKa`, `min: string`, `max: string \| null` |

`budgets[].min` and `.max` are Decimal **text** that never meets a
`DecimalField`, so they round-trip **as authored**: a seeded `"0"` comes back
`"0"`, not `"0.00"`. That is why they are `string` and not `Money`;
`budgetRange()` runs `Number()` over them anyway, and `max: null` means no upper
bound. An element whose `id` is literally `'any'` is special-cased by `QuizPage`,
which drops the price filter entirely for it — hence invariant 17's "exactly
one".

Ids are `min_length=1`: the admin editor's "Add item" button produces a blank
row, and saving it is a 422. That is reproduced, message and all.

### 2.12 `admin_actions`

| Column | Type | Notes |
|---|---|---|
| `id` | `number` | Band 12000–13999, double-wide — a bulk click writes several rows |
| `actor_id` | `number \| null` | FK `SET_NULL`. `null` renders as **"system"** in `ActivityFeed` |
| `target_type` | `'order' \| 'user'` | ≤ 32 |
| `target_id` | `number` | A plain integer, **not** a foreign key, so a deleted target leaves its trail behind |
| `verb` | `AuditVerb` | One of eight, ≤ 64 |
| `summary` | `string` | English, never translated. Truncated to 255 by `writeAudit` |
| `created_at` | `IsoDateTime` | |

The eight verbs — `create`, `status_change`, `notes_update`, `item_add`,
`item_update`, `item_remove`, `role_change`, `activation_change` — are the ones
the audit service is ever called with, and the ones with an
`admin.activity.verb.*` i18n key. An unknown verb falls back to
`verb.replace(/_/g, ' ')`: readable, and untranslated.

`audit-api.ts` types `targetType` as four values (`order`, `user`, `product`,
`discount`), but nothing writes a `product` or `discount` row and no screen would
render one, so the union here is two. Querying the other two is a legal request
that answers `[]`.

Summaries are built by four helpers in `store.ts` so that no call site types the
wrong glyph:

| Helper | Produces | Used by |
|---|---|---|
| `transitionSummary(from, to)` | `paid → shipped` | `status_change`, `role_change` |
| `bulkStatusSummary(status)` | `Bulk → paid` | the bulk status route |
| `itemLineSummary(kind, qty, name, size)` | `+ 2× Jade (size M)` / `− 2× Jade` | `item_add`, `item_remove` |
| `itemChangeSummary(name, changes)` | `Jade: qty 1 → 3; size '' → 'M'`, or `''` | `item_update` |

The glyphs are exact and are the only thing separating two summaries in the feed:
`→` is **U+2192**, `×` is **U+00D7**, and `item_remove` opens on **U+2212 MINUS
SIGN** against `item_add`'s ASCII `+`. A hyphen-minus there would read as a typo
in a feed full of real ones. `itemChangeSummary` returning `''` is upstream's
`if parts:` guard — a PATCH that moves nothing writes no row at all, so call it
as `if (summary) writeAudit(...)`.

### 2.13 Column conventions

- **Foreign keys are `<field>_id: number`.** `order.user_id`, not `order.user`.
  The payload often uses the bare name; that is `serialize.ts`'s business.
- **Money is a 2-dp string**: `"84.00"`, never `84`. Build it with
  `decimalString()` / `fromMinor()`; do arithmetic in **integer tetri** with
  `toMinor()`.
- **Media is a bare relative key**: `products/jade-prosperity.jpg`. Never a URL,
  never a leading slash — the seed has no idea what base the bundle will be
  served from, and `serialize.ts::mediaUrl()` mints the URL at read time (§6).
- **`""` vs `null`.** Every text column declared `blank=True, default=""` is
  `""` when empty, never `null`, because the app calls `.trim()` on most of them
  and `catalog-i18n.ts` tests them for emptiness. The genuinely nullable columns
  are the only ones typed `| null`: `products.original_price`,
  `users.last_login`, `password_reset_tokens.used_at`, `discounts.max_uses`,
  `discounts.expires_at`, `admin_actions.actor_id`, `quiz_config.budgets[].max`.
- **Derived columns are never trusted from input.** `users.is_staff` and
  `is_superuser` are recomputed from `role` by `syncRoleFlags()` on every write,
  which is `User.save()`'s own mirror.
- **The store holds columns, not payloads.** Everything Django computed in a
  property, an annotation or a serializer — `is_staff_role`,
  `customer_order_count`, `item_count`, the absolute media URL — lives in
  `serialize.ts` and appears in no row above. That separation is what keeps the
  seed hand-writable.

### 2.14 The two timestamp shapes

Both are stored, both are real, and they appear **in the same response**.

| Alias | Example | Where |
|---|---|---|
| `IsoDateTime` | `2026-08-30T13:40:00.123Z` | Everywhere a typed `datetime` schema field reaches the wire. Ninja's encoder truncates microseconds to milliseconds and rewrites `+00:00` as `Z` |
| `IsoOffset` | `2026-03-01T08:00:00.123456+00:00` | **Only** `users.date_joined` and `users.last_login`. `AdminUserOut` declares them as `str`, and the admin serializer fills them by calling `.isoformat()` itself — so they skip the encoder entirely |

`GET /admin/users/{id}` therefore carries `dateJoined` in the second shape and
`lastOrderAt` in the first, in one payload. That is a true quirk of the wire and
a mock that normalised it would hide it. `restamp()` in the rebase re-emits each
column in the shape it found (§7.1).

`parseIso()` parses both. `nowIso()` mints the first; `nowIsoOffset()` mints the
second, with three trailing zeros because JavaScript has no sub-millisecond
clock.

### 2.15 The enumerations

Declared in `types.ts` with a `readonly` array beside each union, because
declaration order is load-bearing in three places.

| Union | Members | Order matters because |
|---|---|---|
| `Role` | `customer`, `staff`, `admin` | The admin role filter renders it in this order |
| `OrderStatus` | `pending`, `paid`, `shipped`, `delivered`, `cancelled` | `ordersByStatus` is zero-filled in exactly this sequence and the chart renders one bar per element |
| `DiscountKind` | `percent`, `fixed` | |
| `Gender` | `men`, `women`, `unisex` | |
| `Purpose` | `luck`, `protection`, `love`, `safety`, `energy`, `balance` | Doubles as the collection vocabulary — one collection per purpose |
| `ZodiacSign` | aries … pisces, **zodiacal** | Only for the seed's id assignment (aries = 5000 … pisces = 5011). Display order is alphabetical — see `orderedZodiac()` |
| `AuditVerb` | the eight above | Each has an i18n key |
| `AuditTargetType` | `order`, `user` | |

`REVENUE_STATUSES` is a fourth constant: `paid`, `shipped`, `delivered` — the
three the dashboard's `totalRevenue` sums. Pending money has not arrived and
cancelled money never will.

---

## 3. Id bands

Every table allocates from a band of its own; `validateSeed` rejects a seed id
outside its band and `nextId()` throws rather than leave one.

Postgres gives every table a sequence starting at 1, so id 3 exists in a dozen
tables at once. In a hand-written seed that is a trap: a stray `"product_id": 3`
would resolve silently against a collection and render as a bracelet that is
really a landing page. Disjoint bands turn the same typo into an empty lookup at
the exact row that is wrong — and they make an id readable on sight: 6xxx is an
order, 4xxx a product, 12xxx an audit row.

| Table | Band | Seeded | Next id | Headroom |
|---|---|---|---|---|
| `users` | **1000–1999** | 1001–1032 | 1033 | 967 |
| `password_reset_tokens` | **2000–2999** | 2001–2003 | 2004 | 996 |
| `collections` | **3000–3999** | 3001–3006 | 3007 | 993 |
| `products` | **4000–4999** | 4001–4030 | 4031 | 969 |
| `zodiac_info` | **5000–5011** | 5000–5011 | — | **none, by design** |
| `orders` | **6000–7999** | 6001–6064 | 6065 | 1935 |
| `order_items` | **8000–9999** | 8001–8138 | 8139 | 1861 |
| `discounts` | **10000–10999** | 10001–10014 | 10015 | 985 |
| `page_seo` | **11000–11999** | 11001–11007 | 11008 | 992 |
| `admin_actions` | **12000–13999** | 12001–12152 | 12153 | 1847 |

**Ten bands, not eleven.** The two singletons are pinned to `id: 1` — the models
hard-assign the pk in `save()` — and allocate nothing, so they have no band and
appear in no counter.

`zodiac_info`'s band is exactly twelve wide because the enum has twelve members,
`sign` is unique, and the admin can edit a row but never create or delete one.
`nextId('zodiac_info')` therefore throws on its first call, which is the correct
answer to code that should not exist.

The three double-wide bands are the tables the **visitor** writes into: every
checkout appends an order and its lines, and every admin mutation — several per
bulk click — appends an audit row.

### 3.1 `nextId()` and the counters

Counters are built once at construction from the seed's highest id in each band
and never reuse a number, like a real sequence — so a deleted product's id does
not come back on the next create and an `OrderItem` snapshot cannot be
reconnected to a different product by accident.

Two failures, both loud:

- A seed row **above** its ceiling throws at construction, from `highestIds()`,
  naming the table and the id. Left to `nextId()` it would surface three screens
  into the demo on a line that looks unrelated. (A **below**-floor id is
  `validateSeed`'s to report — the `reduce` seed clamps it away silently.)
- Running out of band throws rather than colliding with the next table. A demo
  that quietly starts writing orders into the order-item id space is worse than
  one that stops and says so.

`resetStore()` rebuilds the whole world and rewinds the counters, so a session
that created twenty products is genuinely back to 4031 afterwards.

### 3.2 Which seed file owns which table

Four files, split along the authorship seam so the cross-file references only
ever point one way:

| File | Tables | Depends on |
|---|---|---|
| `seed/people.json` | `users`, `password_reset_tokens` | nothing |
| `seed/catalog.json` | `collections`, `products`, `zodiac_info`, `page_seo`, `site_settings`, `quiz_config` | nothing |
| `seed/commerce.json` | `discounts`, `orders`, `order_items` | people, catalog |
| `seed/activity.json` | `admin_actions` | all three |

Load order is enforced by nothing — a dangling id is simply a lookup that returns
`undefined`, which is why §5 exists.

`seed/index.ts` narrows the four documents into `Tables` exactly once, with a
plain `as` per table: JSON widens every enum column to `string`, and the row
interfaces are subtypes of what `resolveJsonModule` infers, so this is a downcast
the compiler accepts — and would reject if a column went missing. Adding a table
means adding a line there and a key to `Tables`.

---

## 4. The seed

### 4.1 What each row count is for

A screen with nothing in it reads as broken, so the counts are demanded by
screens rather than chosen for roundness.

| Table | Rows | The screen that demands it |
|---|---|---|
| `users` | 32 | The list paginates at 25 → a real page 2. All three roles for the role filter, four inactive for the active filter, `date_joined` spread over a year for the date filter. The manual-order autocomplete asks for `role=customer, pageSize=8` on two characters |
| `password_reset_tokens` | 3 | Never listed in any UI. One live, one spent, one expired — so the confirm route can be walked to all three answers |
| `collections` | 6 | One per `Purpose`, so **no collection page is empty** |
| `products` | 30 | The list paginates at 25 → page 2 with five. 9 bestsellers, 6 new, 7 on offer, prices ₾29–₾96 so the slider and all three quiz budget bands bite |
| `zodiac_info` | 12 | Fewer leaves holes in the home grid and 404s a sign page; more is impossible |
| `discounts` | 14 | Both kinds, five inactive, three exhausted, five with no usage cap, two **expired but still active** so the dashboard tile is visibly generous, and several live so checkout works |
| `orders` | 64 | The list paginates at 25 → three pages. `pending 9 / paid 13 / shipped 11 / delivered 27 / cancelled 4`, so every status filter option and every dashboard bucket is non-empty |
| `order_items` | 138 | 1–4 lines per order, so `itemCount` varies in the list column. 97 carry a size, exercising the `(size …)` branch of the audit summaries |
| `page_seo` | 7 | The override table is empty otherwise, and `/zodiac/scorpio` demonstrates the exact-pathname rule |
| `site_settings` | 1 | All seventeen editable fields non-empty or `form.reset` loses fidelity |
| `quiz_config` | 1 | 6 moods / 3 occasions / 6 intentions / 4 budgets, upstream's own document |
| `admin_actions` | 152 | 138 order rows and 14 user rows. Every non-pending order carries a real status chain; the demoable pending orders carry item rows; several rows have `actor_id: null` so the "system" label is on screen |

Seven pending orders carry more than one line (6057, 6058, 6059, 6060, 6061,
6062, 6064), which is what makes the item editor, its 409 and its last-item 400
all reachable. Twenty-five orders carry a discount snapshot.

### 4.2 The clock the seed is written against

Every timestamp in the four files is a fixed offset from one anchor — the newest
`orders.created_at`, **`2026-08-30T13:40:00.000Z`** — and `store.ts` slides the
whole set onto today's date at construction (§7).

Do not anchor on anything else. Not the newest audit row: those are derived from
orders and would drag the orders into the past. Not `updated_at`: it is the same
instant or later. Not a discount expiry: that is a future position by design.

The practical consequence is §7.3's rule, and it is the single most important
thing to know before opening a seed file: **write relative arrangements, not
absolute dates.**

### 4.3 The three demo accounts

Nobody can guess credentials that live in a JSON file, so `accounts.ts` names
them, the banner signs you in with one click and the login page pre-fills the
address. Every other user in the seed exists as **data** — they own orders, they
appear in the admin list, they are the customers the autocomplete offers — but
none of them is reachable, which is the arrangement the real shop has.

| Persona | Email | Password | Role | Advertised |
|---|---|---|---|---|
| Ana Gogoladze | `demo@gisheri.ge` | `gisheri-demo` | `customer` | **yes** — banner button |
| Levan Beridze | `staff@gisheri.ge` | `gisheri-demo` | `staff` | **no** — README only |
| Nino Abashidze | `admin@gisheri.ge` | `gisheri-demo` | `admin` | **yes** — banner button |

Passwords are plaintext and compared directly: there is nothing to protect,
because the server is a function call in the same tab and the banner hands out an
administrator session on request.

The staff row is seeded and fully functional but **not offered by the banner**.
Its entire payoff is the two places where the front-end gate and the API gate
disagree (`routes.md` §7 and §8), and a button whose reward is two error states
is a poor invitation — so the disagreement is written up in the README and anyone
who wants it signs in through the login form by hand. `ADVERTISED_ACCOUNTS` is
the customer and the administrator; `DEMO_ACCOUNTS` is all three, and invariant
55 walks the latter.

Ana owns six orders (6011, 6020, 6033, 6045, 6059, 6064), two of them
discounted and two still pending — enough for the account page's pager and for a
purchase history that looks like one. Nino is deliberately **not** the only
admin, so the two self-guards on `PATCH /admin/users/{id}` are demonstrable
against somebody else.

---

## 5. `validateSeed()` — the fifty-five invariants

Called from `hydrate()` under `import.meta.env.DEV` only, so a shipped demo does
not pay for a check whose only audience is whoever is editing the seed.

**It runs *after* the rebase, not before.** Nine of its invariants are temporal —
"no order is dated in the future", "every audit row sits inside its order's
lifetime" — and those are properties of the data the demo will actually *serve*,
not of the data as authored. The structural invariants are indifferent to the
rebase, so one pass at the end catches all fifty-five at once.

**Every violation is reported together.** A validator that threw on the first
would turn a seed edit into fifty-five build-and-run cycles. This one collects
`problems[]` and throws once:

```
Demo seed violates §F.11:
  - orders#6021: subtotal 84.00 != sum of line totals (invariant 19)
  - products#4007: stone "Sodalite" has no translation key (invariant 16)
```

The numbers in those messages are the numbers below; `§F.11` is the section of
the build plan this list was written from, and length failures report the range
`(invariants 41-45)` rather than a single number.

It exists because **every one of these is silent when broken.** A dangling
`product_id` renders as an empty cell. A media key naming a file that is not
there is a broken `<img>` three screens in. An empty `name_ka` shows English
inside a Georgian sentence. A `uses_count` that disagrees with the orders makes
the admin's usage column a lie nobody can see. Every one of those reads as "the
demo is broken" rather than "the seed is wrong".

### 5.1 Identity, bands and uniqueness (1–7)

1. Ids are **unique within a table** and **inside that table's band**.
2. `users.email` is unique **case-insensitively** — every backend lookup on an
   address is `__iexact`, so two rows differing only in case are one account to
   half the API and two to the other half.
3. `collections.slug` is unique **and every slug is one of the six `Purpose`
   values**. A slug outside the set can only render an empty page.
4. `zodiac_info.sign` is unique and **all twelve signs are present exactly once**.
5. `discounts.code` is unique case-insensitively; `password_reset_tokens.token`
   is unique.
6. `page_seo.path` is unique and **starts with `/`** — it is compared with `===`
   against a pathname.
7. `site_settings` and `quiz_config` are objects with `id === 1`.

### 5.2 Referential integrity (8–13)

8. `orders.user_id` and `password_reset_tokens.user_id` resolve.
9. `order_items.order_id` and `.product_id` resolve.
10. `admin_actions.actor_id` is `null` or resolves — **and that user's role is
    `staff` or `admin`**. A customer cannot have taken an admin action; a feed
    attributing one to a shopper is the kind of detail that makes a demo
    unbelievable.
11. `target_type ∈ {order, user}` and `target_id` resolves **in the matching
    table**.
12. `verb` is one of the eight with an i18n key.
13. `site_settings.featured_collection_slugs ⊆ collections.slug`.

### 5.3 Enum domains (14–17)

14. Every `users.role`, `orders.status`, `discounts.kind` and `products.gender`
    is in range.
15. Every element of `products.purposes`, `products.zodiac_signs` and every
    `zodiac_info.sign` is in range.
16. Every element of `products.stones` and `zodiac_info.stones` is one of the
    **twenty-five translatable stone names**. A stone outside that list is not an
    error the app reports: the helper falls back to the English name and a
    Georgian page silently shows one English word in a Georgian sentence.
    Catching it here is the only way anyone finds out. Note the **ASCII
    apostrophe** in `Tiger's Eye` — a typographic U+2019 misses the key.
17. Every `quiz_config` `purposes` element is a `Purpose`; every `budgets[].max`
    is `null` or ≥ its `min`; and **exactly one budget has `id === "any"`**,
    because `QuizPage` special-cases that id to skip the price filter. Without
    exactly one the quiz has either no "surprise me" option or two that behave
    identically.

### 5.4 Derived role flags (18)

18. `role === 'admin'` ⇒ `is_staff && is_superuser`; `'staff'` ⇒ `is_staff &&
    !is_superuser`; `'customer'` ⇒ neither.

### 5.5 Money (19–27)

19. `subtotal === Σ items.line_total`, to the tetri.
20. `total === subtotal − discount_amount`, and `total >= 0` **in the seed**. The
    running demo may go negative — an admin stripping items off a discounted
    order does exactly that, on purpose — but a seed that shipped a negative
    total would be describing a shop that had already been edited.
21. `line_total === unit_price × quantity`. It is stored rather than computed, so
    it can and must be checked.
22. `discount_amount > 0` ⟺ `discount_code !== ""`.
23. `discount_amount <= subtotal`.
24. Every non-empty `discount_code` matches a code case-insensitively, the amount
    equals **`computeDiscount()` at that code's seeded terms** — the same
    function the checkout runs — and the subtotal clears that code's
    `min_order_total`. A hand-written amount the shop would not have charged is
    caught here rather than by a customer.
25. `discounts.uses_count === count(orders whose code matches)`. This is the
    counter the backend increments on every create and the admin's usage column
    renders verbatim; a mismatch is a lie on screen.
26. `max_uses === null || uses_count <= max_uses`.
27. Every money string parses as a 2-dp decimal within `numeric(10,2)`.

### 5.6 Order items (28–31)

28. Every order has **at least one item** — `OrderCreateIn.items` is
    `min_length=1`, so an empty order cannot exist.
29. `size ∈ {"", "S", "M", "L", "XL"}` and ≤ 8 characters.
30. `quantity ∈ [1, 99]`.
31. `product_name` matches the referenced product's name for **≥ 90 %** of rows.
    A snapshot is *allowed* to drift — that is the point of storing it — but a
    seed where most rows have drifted is a seed whose product ids are wrong. The
    two deliberate drifts sit comfortably inside the margin.

### 5.7 Temporal — asserted after the rebase (32–40)

32. `orders.updated_at >= created_at`, and neither is in the future.
33. `admin_actions.created_at` is not in the future and, for an order target,
    sits **inside `[order.created_at, order.updated_at]`** — the only window in
    which the action could have been taken, and one `ActivityFeed` renders side
    by side with the order.
34. Per order, the `status_change` rows form a **truthful chain**: each row's
    destination is the next row's source, and the last destination is where the
    order actually is. A feed whose final entry says `shipped → delivered` on a
    cancelled order is worse than no feed at all. (`Bulk → status` summaries have
    no source half and are skipped.)
35. `admin_actions.created_at >= actor.date_joined`.
36. `users.last_login` is `null` or inside `[date_joined, now]`.
37. `orders.created_at >=` its user's `date_joined`.
38. `password_reset_tokens.used_at` is `null` or `>= created_at`.
39. **At least one discount is redeemable right now.** Without one the checkout's
    discount field can only ever produce an error, and the flow the seed exists
    to demonstrate is dead.
40. At least two discounts expire in the future and at least two in the past — so
    the admin list has an "Expired" badge to show and the tile has something to
    be generous about.

### 5.8 Field lengths (41–45)

Real column widths, checked because a mock that ignores them accepts strings the
real backend would reject with a 500 — and the seed is exactly where an over-long
Georgian description would first appear.

41. `users.{first_name, last_name} ≤ 150`, `email ≤ 254`.
42. `products.{name ≤ 128, image ≤ 255}`; `collections.{name ≤ 128, slug ≤ 64,
    image ≤ 255}`; `zodiac_info.{name ≤ 64, symbol ≤ 8, dates ≤ 64, element ≤ 32}`.
43. `orders.{full_name ≤ 200, phone ≤ 50, city ≤ 100, address ≤ 255,
    discount_code ≤ 64}`.
44. `order_items.{product_name ≤ 128, product_image ≤ 255}`.
45. `discounts.code ≤ 64`; `admin_actions.{target_type ≤ 32, verb ≤ 64,
    summary ≤ 255}`; `site_settings.{hero_title_* ≤ 200, hero_cta_label_* ≤ 100,
    banner_text_* ≤ 255, site_name ≤ 100, twitter_handle ≤ 64,
    default_robots ≤ 64, hero_image ≤ 255, default_og_image ≤ 255}`;
    `page_seo.{path ≤ 255, title_* ≤ 200, og_image ≤ 255, robots ≤ 64}`; every
    quiz element's `id` non-empty and ≤ 64, `icon ≤ 8`, labels ≤ 128, hints ≤ 255.

### 5.9 Coverage (46–55)

What makes the demo look alive rather than merely valid. A zero-count facet
renders as a dead 40 %-opacity chip; an empty status filter option looks like a
bug in the filter.

46. Every `OrderStatus` has ≥ 1 order.
47. Every `Purpose` has ≥ 4 products; every `ZodiacSign` ≥ 3.
48. Every `Gender` has ≥ 1 product; ≥ 6 bestsellers; ≥ 4 new.
49. ≥ 1 discount of each kind; ≥ 1 inactive; ≥ 1 exhausted; ≥ 1 with
    `max_uses: null`; **≥ 1 expired but still active**, which is what makes the
    dashboard's `activeDiscountCount` visibly generous — upstream behaviour the
    README names.
50. Every `Role` has ≥ 2 users; ≥ 3 inactive.
51. Every product has ≥ 1 stone, ≥ 1 purpose and ≥ 1 sign.
52. Every product has a non-empty `name_ka`, `description_ka` and
    `stones_meaning_ka`; every collection a non-empty `name_ka` and
    `description_ka`; every zodiac row a non-empty `name_ka`, `dates_ka`,
    `element_ka` and `description_ka`. **Georgian is a first-class language
    here**, not a fallback: an empty `*_ka` shows English inside a Georgian
    sentence and nothing reports it.
53. Every product and collection has a non-empty `image`. Upstream ships `""`;
    do not copy that.
54. Every `image`, `product_image`, `og_image` and `hero_image` key is in
    `MEDIA_INVENTORY` (§6), unless it is an `http(s):`, `data:` or `blob:` URL,
    which pass through.
55. `accounts.ts`'s three addresses exist in `users` with the shared demo
    password, the right role and `is_active`. The banner signs you in with one
    click and the login page pre-fills the address; a seed that renamed one of
    these rows would leave a button that always fails.

---

## 6. The media inventory

A browser cannot stat a filesystem, so the list of files that exist under
`public/` is **written down** in `store.MEDIA_INVENTORY` and must be extended
whenever a file is added. Invariant 54 checks every stored key against it.

Thirty-seven keys ship today:

```
brand/       og-cover.svg

collections/ balance.jpg  energy.jpg  love.jpg  luck.jpg  protection.jpg
             safety.svg

products/    agate-steadiness.svg      amazonite-calm.svg
             amethyst-night.svg        amethyst-serenity.jpg
             aquamarine-clarity.svg    black-obsidian-shield.jpg
             bloodstone-grounding.svg  carnelian-courage.svg
             citrine-abundance.svg     diamond-clarity.svg
             emerald-fortune.svg       garnet-devotion.svg
             jade-prosperity.jpg       labradorite-aura.svg
             lapis-lazuli-wisdom.jpg   malachite-heart.svg
             moonstone-intuition.svg   obsidian-jade-balance.svg
             opal-dreamer.svg          pearl-grace.svg
             peridot-renewal.svg       rose-quartz-love.jpg
             rose-quartz-moonstone-duo.svg
             sapphire-focus.svg        sunstone-vitality.svg
             tigers-eye-bloodstone-cuff.svg
             tigers-eye-power.jpg      topaz-confidence.svg
             turquoise-carnelian-journey.svg
             turquoise-traveller.svg
```

Two files sit in `public/brand/` and are deliberately **not** in the inventory:
`favicon.svg` and `logo.svg`. Neither is ever a column value — `index.html` and a
component reference them directly — and the inventory is the list of keys a
**row** may hold.

### 6.1 `mediaUrl()`

`serialize.ts::mediaUrl(key)` turns a stored key into a URL at read time, and
never in the seed. The rules, in order:

| Input | Output |
|---|---|
| `''` / `null` / `undefined` | `''` — never `null`, because the app renders `<img src>` unguarded |
| `http:` / `https:` / `data:` / `blob:` | passed through untouched |
| a key whose first segment is `brand/` | resolved against **`BASE`** |
| anything else | leading `/` and an optional `media/` prefix stripped, then resolved against **`MEDIA_BASE`** = `${BASE}media/` |

The result is a **fully qualified** URL. A root-absolute
`/demos/gisheri/media/x.svg` renders correctly in an `<img>` but not in
`og:image`, which a scraper reads with no document to resolve against.

The three passthroughs each earn their place: `http(s):` because an admin who
edits the field by hand may paste one and upstream stores what it is given;
`data:` because that is what the fake image upload returns, and it is what makes
a picked photo appear in the form a moment later; `blob:` for the same reason on
a browser that hands one back instead.

The `brand/` case is not a wart. `brand/og-cover.svg` lives at `public/brand/`
rather than `public/media/brand/` because `index.html` already references its
siblings from outside the bundle, and the artwork must be one file rather than
two copies drifting apart.

**One divergence, and it is forced.** `serializeSiteSettings` and
`serializePageSeo` run `hero_image`, `default_og_image` and `og_image` through
`mediaUrl()`, which the upstream `_serialize` does **not** do. Upstream stores an
already-absolute URL in those columns, because the admin's `ImageUpload` writes
back whatever the upload endpoint returned; the seed here stores a bare key.
Passing a bare key through raw would render `<img src="brand/og-cover.svg">`
against whatever route the visitor is on and 404 the hero and every page's
`og:image`. The round trip stays honest: the settings form reads what the API
sends and PATCHes it straight back, so an edited row then holds an absolute URL —
exactly the state the real admin leaves behind after an upload.

---

## 7. Date rebasing

A seed with absolute dates is stale the day after it is written: nothing sold
today, an empty "last 7 days", every live discount expired. That is the classic
dead-demo tell and it is entirely avoidable, so `store.ts` runs four phases at
construction. You do not call any of it; you only need to know what it will do to
the rows you write.

**Two zones, two jobs, and mixing them up is the subtle bug here.**

- The **shift** is measured in **Asia/Tbilisi** days, because it decides how many
  days to move and a shop that trades in Tbilisi should keep its mornings as
  mornings.
- The **compression** and the **realignment** are measured against the **UTC**
  day, because upstream runs `TIME_ZONE = "UTC"` and every `?date_from=` filter
  compares `created_at__date` in that zone. Squeezing an order into the elapsed
  part of the *Tbilisi* day can push it across the UTC midnight behind it — and
  the dashboard's "today" filter would then read yesterday, which is precisely
  the emptiness this whole pass exists to prevent.

### 7.1 The four phases

Before anything moves, two things are **classified**, because the shift is what
destroys the evidence: which reset tokens were live relative to the anchor, and
how many Tbilisi days each discount's expiry sat from it.

**1. Shift.** `offset = dayKeyDistance(tbilisiDateKey(anchor), todayKeyTbilisi())`
— a whole number of days, so every row keeps its time of day and the seed's
nine-o'clock orders are still nine-o'clock orders. Two field maps move:

| Map | Fields |
|---|---|
| `PAST_FIELDS` | `users.{date_joined,last_login}` · `password_reset_tokens.{created_at,used_at}` · `orders.{created_at,updated_at}` · `discounts.{created_at,updated_at}` · `page_seo.{created_at,updated_at}` · `admin_actions.created_at` · `site_settings.updated_at` · `quiz_config.updated_at` |
| `WINDOW_FIELDS` | `discounts.expires_at` — **the shift and nothing else** |

`products`, `collections`, `zodiac_info` and `order_items` carry no timestamps at
all and are untouched by every phase.

`restamp()` re-emits each field in **the shape it found** (§2.14). The `+00:00`
columns keep the moved instant's real milliseconds and borrow only the **last
three** of the seed's authored microsecond digits — borrowing all six would
truncate the computed instant to a whole second, which could move two timestamps
a second apart onto the same second and let the authored tails decide their
order, inverting `last_login` and `date_joined` on any row where the seed wrote a
smaller tail on the later field.

**2. Compress today.** The shift moves whole days, so the anchor day's afternoon
rows land ahead of `now` for anyone opening the demo before then — which is all
of European and American business hours. Django could not produce that:
`created_at` is `auto_now_add`.

Nor is a flat clamp to `now` good enough: it collapses a morning's worth of rows
onto one instant and the list stops looking like a day's trading. So the whole of
today is **scaled** into `[UTC midnight, now]`, using the real maximum as the
divisor rather than a nominal 24 hours. That preserves order and spread, needs no
clamp, and cannot push a row across the date boundary the filters compare
against. `min(…, 1)` means a seed already entirely in the past is left alone
rather than stretched forward into a day it never claimed, and rows before today
never move.

Then **four orderings are re-imposed**, because a demo opened at exactly UTC
midnight has a zero-width window, every row today collapses onto the same
millisecond, and the sub-millisecond digits then decide an order that was never
theirs: `orders.updated_at >= created_at`, `users.last_login >= date_joined`,
`password_reset_tokens.used_at >= created_at`, and every order-targeted
`admin_actions.created_at` clamped back inside its order's lifetime.

**3. Re-arm the short-lived rows.** A whole-day shift preserves a window's length
but not its position.

- **Reset tokens.** Their whole point is a one-hour window, which lands at
  whatever hour the seed was written for and is therefore expired for most of the
  day. So the live one is re-issued as if the email had gone out **ten minutes**
  ago and the expired one as if it had gone out **three hours** ago. The spent
  one needs nothing: `used_at` is what makes it spent, not time.
- **Discount expiries.** `rearmExpiries()` is a **guard, not a mechanism**. With
  a well-formed seed nothing fires, because `expires_at` is exempt from the
  compression and the day shift already keeps every code on the side of `now` its
  author put it on. It exists because an expiry that drifted across the clock
  would take the checkout's discount field down with it (invariant 39) or leave
  the admin list with no "Expired" badge (invariant 40), and neither failure
  announces itself.

**4. Realign the mix.** A uniform shift preserves the spread but not the
*arrangement* the first two admin screens depend on: the dashboard opens on
recent activity and the orders list opens with Today / Last 7 days / Last 30 days
presets, and a rebase that leaves those reading zero is indistinguishable from a
broken filter.

Targets, filled by moving the fewest rows the smallest distance: **≥ 1 order
created today**, **≥ 6 in the last 7 days**, **≥ 14 in the last 30**, measured
with `utcDateKey`.

Candidates are ranked `pending < paid < cancelled < shipped < delivered`, then by
distance to the window, then by descending id. A `pending` order is a better
candidate than a `delivered` one: an order delivered forty minutes ago reads as a
mistake, while an order placed forty minutes ago and still pending is exactly
what a shop's morning looks like. Moves are spread across the window from its
newest day backwards, so filling "last 7 days" does not stack six orders on one
afternoon.

`moveOrderToDay()` **refuses rather than corrupts**: an order may not land in the
future and may not predate the account that placed it, the `created_at` →
`updated_at` gap is preserved when the pair has to be pulled back below `now`,
and the order's audit trail moves with it. **Statuses are never rewritten** —
every line, discount and audit row hanging off an order would contradict a new
one.

Then, in DEV, `validateSeed()` runs over the result.

### 7.2 Where this differs from the build plan

The plan's §F.10 is the design; the code is the thing that runs. Four differences,
all deliberate:

1. **`discounts.expires_at` is not in `PAST_FIELDS`.** It lives in a shift-only
   `WINDOW_FIELDS` map, so the compression can never expire a live code. The
   plan's step-3 list of specific discount ids is consequently **not used** —
   nothing asserts that any particular code is redeemable, only that at least one
   is (invariant 39).
2. **The shift is Tbilisi; the compression and realignment are UTC.** The plan
   named one zone. Using the Tbilisi day for the compression pushes a morning
   order across the UTC midnight behind it and the "today" filter then reads
   yesterday.
3. **The compression scales rather than clamps**, into `[UTC midnight, now]`,
   with the real maximum as the divisor.
4. **Two extra orderings are re-imposed** after the compression —
   `users.last_login >= date_joined` and
   `password_reset_tokens.used_at >= created_at` — alongside the two the plan
   lists. A demo opened at exactly UTC midnight needs all four.

And `validateSeed()` is called **after** `rebase()`, not before, for the reason
in §5.

### 7.3 The rule for whoever writes the JSON

**Write relative arrangements, not absolute dates.**

> "Three weeks before the anchor, at 11:00" survives the rebase.
> "The Tuesday after the long weekend" does not.

Worked example. To seed an order that was placed in the morning, paid an hour
later and shipped the next day, with an audit trail that agrees:

```jsonc
// anchor = 2026-08-30T13:40:00.000Z
{
  "id": 6042,
  "created_at": "2026-08-25T06:20:00.000Z",   // anchor − 5 days, 09:20 in Tbilisi
  "updated_at": "2026-08-26T07:05:00.000Z",   // anchor − 4 days: the shipping edit
  "status": "shipped"
}
// and in activity.json, inside [created_at, updated_at] and in chain order:
{ "id": 12088, "target_id": 6042, "verb": "status_change",
  "summary": "pending → paid",    "created_at": "2026-08-25T07:30:00.000Z" }
{ "id": 12089, "target_id": 6042, "verb": "status_change",
  "summary": "paid → shipped",    "created_at": "2026-08-26T07:05:00.000Z" }
```

Everything above survives the rebase, because everything is a distance: five days
becomes five days from *today*, the 09:20 stays 09:20 in the shop's own morning,
the audit rows keep their place inside the order's lifetime, and the chain still
ends where the order's `status` says it does.

Two further habits the seed follows and you should too:

- **Keep an order's time of day between 05:00 and 15:00 UTC** — 09:00 to 19:00 in
  Tbilisi. Inside that band the two zones agree on the date, so a visitor in
  Auckland and a visitor in Vancouver both see a coherent "today".
- **Avoid money values that land on half a tetri.** `roundHalfEven` and Python's
  `quantize` agree, so nothing would break — but the seed keeps clear of the tie
  so that a discount can never be the thing under discussion.

---

## 8. What the store hands a handler

`store.ts` re-implements the four things Django did around these models that
nothing else in this mock can: `User.save()`'s flag mirror, `auto_now` on
`Order`, the audit service, and each model's `Meta.ordering`.

### 8.1 Lookups

Deliberately linear. Sixty-four orders and thirty products do not need an index,
and a `Map` would be a second thing to keep in step with every push, splice and
reset — the exact class of bug the store exists to avoid.

All of them return `Row | undefined`, never `null`, so `?? null` at the call site
is safe and `if (!x)` works:

```ts
userById · userByEmail            // email is code__iexact + trim
productById · collectionById · collectionBySlug · zodiacBySign
orderById · orderItemById · orderItemsFor(orderId)
discountById · discountByCode     // code__iexact + trim
pageSeoById
```

The two `__iexact` lookups are marked because every backend query on an email or
a discount code is case-insensitive: a shopper who types `welcome10` gets
`WELCOME10`, and an admin who types `Demo@Gisheri.ge` finds the account.

`orderItemsFor()` returns a **fresh array** in `Meta.ordering` order, so removing
a line must splice `store.order_items`, not that result.

### 8.2 Ordering

One walker per `Meta.ordering`, re-imposed at the walk rather than kept as a sort
order on the array itself — a push would break the latter and nothing would say
so. Each returns a **copy**, because handing out the store's own array would let
a caller's `.sort()` reorder the database.

| Walker | Order |
|---|---|
| `orderedProducts()` | `id` ascending |
| `orderedCollections()` | English `name` ascending |
| `orderedZodiac()` | **`sign` alphabetically** — aquarius, aries, cancer, capricorn, gemini, leo, libra, pisces, sagittarius, scorpio, taurus, virgo. Not zodiacal order, and not a bug to repair: it is what every screen shows |
| `orderedOrders()` | `-created_at`, `-id` breaking ties |
| `orderedUsers()` | `email` ascending |
| `orderedDiscounts()` | `-created_at`, `-id` |
| `orderedPageSeo()` | `path` ascending |
| `orderedAuditFor(type, id)` | `-created_at`, `-id`, filtered to one target |

Build every list route as `orderedX().filter(…)` and then paginate: filtering
preserves order, so the two compose and no route ever names a sort. **There is no
ordering parameter anywhere in this API** — a handler that wants a different
order is describing a route that does not exist.

The `-id` tiebreaks are this mock's own. Upstream leaves ties to Postgres, which
may return them in any order; here a bulk click writes several rows inside one
millisecond, and an unstable feed would reshuffle itself on every refetch.

### 8.3 The write path

```ts
writeAudit(actor, verb, targetType, targetId, summary)   // synchronous
syncRoleFlags(user)                                      // User.save()'s mirror
touchOrder(order)                                        // auto_now on Order
```

`writeAudit` is synchronous exactly as it is upstream — the view calls it inline
rather than through `on_commit`, so the row is readable the instant the mutation
returns and a failed request leaves no trace. It owns `nextId`, the `actor_id`
(pass `request.user`; `null` renders as "system") and the 255-character
truncation.

`touchOrder` has **one place it must not be called**: the bulk status route.
Upstream that is a `QuerySet.update()`, which writes the column list it was given
and bypasses `auto_now` entirely. Calling it there would be a one-word change
that quietly makes the bulk path differ from the product.

`syncRoleFlags` is the only function in the mock allowed to assign `is_staff` or
`is_superuser`.

### 8.4 Money, in one module

`pricing.ts` is where money is decided, and it is one implementation on purpose:
`POST /discounts/validate` quotes a cart and `POST /orders` charges it, and the
two must agree to the tetri or the shop lies to its customers.

```ts
isExpired(discount, now) · isRedeemable(discount, now)
computeDiscount(discount, subtotalMinor)      // percent or fixed, then clamp
discountProblem(discount, subtotalMinor, now) // 'not_redeemable' | 'below_minimum' | null
priceLines(items)                             // → {lines, subtotalMinor, missing}
orderTotals(subtotalMinor, discountMinor)
recomputeTotals(order)                        // after an admin edits a line
createOrderForUser(user, input)               // the one create path
```

Three behaviours here must **not** be repaired:

- All three redeemability failures — inactive, expired, exhausted — collapse into
  one message, and so does a code that never existed. Telling a visitor that a
  code exists but is spent is an information leak the shop does not make. Only
  the minimum-order failure has its own wording, and it is checked **after**
  redeemability.
- `computeDiscount` clamps to the subtotal at creation time; `recomputeTotals`
  does **not** re-clamp and does **not** re-apply the percentage. Stripping items
  off a discounted order can therefore drive its total negative — which the admin
  copy advertises ("the discount on this order is preserved"), so it is a
  documented product decision rather than a bug.
- `uses_count` moves **only** on order creation.

Arithmetic runs in integer tetri and rounds exactly once, at the end, with
`roundHalfEven` — Python's `quantize` default, which breaks an exact tie towards
the **even** neighbour where `Math.round` breaks it away from zero. A percentage
landing on half a tetri would otherwise make the cart's quote disagree with the
order by one tetri, which is the single most annoying class of bug a shop can
ship.

---

## 9. Numbers and instants

The helpers in `base.ts` that a seed author or a serializer needs. Nothing here
reads the store, so every other module can import it without a cycle — including
`store.ts`, which needs the clock while it is still rebasing a table set the
`store` binding does not point at yet.

```ts
CLOCK.now()                     // the only reading of the wall clock
nowIso()                        // '2026-08-30T13:40:00.123Z'  — what auto_now stamps
nowIsoOffset()                  // '…000+00:00' — only users.date_joined / last_login
toApiDateTime(x) · toApiOffset(x)
parseIso(iso)                   // epoch ms, or NaN; both stored shapes parse
utcDateKey(x) · todayKeyUtc()          // what every ?date_from= compares
tbilisiDateKey(x) · todayKeyTbilisi()  // the rebase's day boundary, and nothing else
dayKeyDistance(from, to) · shiftDayKey(key, days) · dayStartMsTbilisi(key)
MINUTE · HOUR · DAY · TZ_OFFSET_MS · TIME_ZONE

decimalString(84)      // '84.00'
decimalStringOrNull(x) // null in, null out
toMinor('45.50')       // 4550
fromMinor(4095)        // '40.95'
roundHalfEven(x)       // Python's quantize tie-break, in tetri
```

Georgia has no daylight saving, so `TZ_OFFSET_MS` is a constant `+04:00` and the
day arithmetic is exact. Currency is GEL; 1 lari = 100 tetri; display formatting
belongs to the app's own `money.ts` and not to this layer.
