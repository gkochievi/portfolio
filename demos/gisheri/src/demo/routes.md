# `src/demo/routes.md` — the route table

Every route the mock serves, and nothing else. **64 routes across nine handler
modules.** Read [`schema.md`](./schema.md) first — this file uses its vocabulary
and does not repeat it.

The table is reconciled from both ends. The demand side is every `api.get` /
`api.post` / `api.patch` / `api.delete` call site in `src/lib/*.ts` and
`src/context/auth.tsx`, plus the one hand-built `FormData` dispatch in
`uploadImage`. The supply side is the Ninja URLconf: the public and admin routers
of `accounts`, `catalog`, `orders`, `discounts`, `site_settings`, `quiz` and
`audit`. §12 lists what the backend serves that nobody calls, with the reason;
§13 flags the near-misses.

---

## 0. How to read a row

**Path pattern** is the literal string passed to `register()`, after the API
prefix and with **no trailing slash**. This is Django-Ninja, not DRF: the URLconf
mounts `/api/products`, and `/api/products/` is a different URL that answers 404.
`register()` refuses a pattern ending in a slash at boot, so a pattern typed the
DRF way fails loudly on the first page load instead of 404-ing under a spinner.

```ts
register('GET', '/admin/orders/:orderId/items', handler, { auth: ['staff', 'admin'] });
```

- `:name` captures exactly one segment and arrives on `req.path` as a **string**.
- A capture named `id`, or ending in `Id` / `_id`, is Django's `<int:…>`
  converter and matches **digits only**. Every other capture is `<str:…>`, which
  is what lets `/admin/zodiac/:sign` take `scorpio`. `/admin/products/nonsense`
  is therefore a routing 404 and never reaches a handler.
- A **literal segment beats a capture**, so `/admin/products/bulk` and
  `/admin/products/:id` coexist whatever order they were registered in. Upstream
  the `<int:…>` converter does the same job; here both mechanisms apply.

**Owner** — one of `auth · public · orders · discounts · admin-catalog ·
admin-orders · admin-users · admin-discounts · admin-ops`. Exactly one module
owns each route and nobody else may register it: a second `register()` on the
same `(method, pattern)` silently **replaces** the first, which is why this file
is the authority on ownership.

**auth** — the gate in `router.ts`, which runs in Ninja's own order:
authenticate, *then* check the role.

| Value | Upstream | Failure |
|---|---|---|
| `public` | no `auth=` on the router | never refuses; `req.user` may still be a signed-in row |
| `any` | `jwt_auth` (the default) | 401 `Unauthorized` |
| `staff` | `staff_auth` = `['staff', 'admin']` | 401 signed out, else **403 `Staff or admin role required.`** |
| `admin` | `admin_auth` = `['admin']` | 401 signed out, else **403 `Admin role required.`** |

401-before-403 is load-bearing: `api.ts` retries exactly once, and only on a
**401** with a refresh token in hand, so a 403 where a 401 belongs kills the
silent refresh and every admin page would sign the visitor out the first time a
thirty-minute access token lapsed.

The two role lists are **not** interchangeable spellings of "privileged":
`roleFailure()` picks its sentence out of the list and the console renders that
sentence verbatim in a toast. See §7 and §8 for the disagreement that makes.

**Object-level scoping is never in this column.** "This customer's own order" is
`get_object_or_404(Order, pk=…, user=request.auth)` inside the view and answers
**404, not 403** — the gate says whether you may call the endpoint, the handler
says whether the row exists for you. Promoting that to a 403 would leak which
order ids are taken.

**Envelope** — the column that silently destroys a screen.

| Kind | Body |
|---|---|
| `obj` | a plain JSON object |
| `arr` | a bare JSON array, no envelope |
| `page` | `{items, total, page, pageSize}` |
| `count` | `{items, total}` — **`GET /admin/collections` alone** |
| `204` | nothing; the handler returns `undefined` and `dispatch` resolves `null` |

There is no `{count, next, previous, results}` anywhere in this API — that is
DRF's envelope and belongs to a different backend. `total` counts the **filtered**
rows and is taken before the slice; `page` and `pageSize` are echoed **after**
clamping, so `?page=0` answers `page: 1`. A page past the end is an empty page
with the true total, **not a 404**: Ninja slices a Python list and `rows[200:225]`
is `[]`. Copying DRF's `InvalidPage` here would 404 the admin list every time a
filter shrank the result set under the page the URL still remembered.

`page_size` defaults to **25** and clamps to **100** everywhere except
`GET /orders`, which is 20 and 50.

**Notes** — the query parameters honoured, the ordering imposed, the body shape,
and the errors the route raises deliberately. Error codes come from `base.ts`'s
25-code registry (§11); a handler names the code and the registry settles the
status and the wording.

Three rules that hold on **every** row and are therefore not repeated in the
cells:

- **`req.params` keys are snake_case** (`page`, `page_size`, `q`, `date_from`,
  `is_bestseller`, `target_type`) because those are Ninja *function* parameters,
  which the camelising alias generator never touched. **`req.body` keys are
  camelCase** (`firstName`, `discountCode`, `usesCount`) because `CamelSchema`
  sets `alias_generator=to_camel` on every request schema and every call site
  sends the alias.
- **Validation precedes every lookup.** Ninja builds and validates the request
  model before it enters the view, so a malformed body aimed at a row that does
  not exist is a **422, never a 404**. Every `PATCH` in this table reads its body
  first for that reason.
- **A malformed query value means "no filter"**, not a 422. That is a knowing
  divergence: Ninja's typed parameters would answer 422, nothing in the app can
  produce a malformed value, `buildQuery` drops empty strings and serialises the
  rest itself, and a hand-typed URL emptying a list is friendlier than one that
  errors. The one exception is `GET /admin/audit`, whose two required parameters
  really do 422.

**Latency.** `dispatch` spends it *before* resolving, so a 404 is as slow as a
200 and the spinner behaves the same either way: 90–260 ms for a `GET`,
140–340 ms for everything else, walked deterministically by the golden ratio.

---

## 1. `auth` — `/auth/*` (9 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| POST | `/auth/register` | auth | public | obj | 201 `{user, tokens}`. Body `{email, password, firstName?, lastName?}`; `password` 8–128. Always creates a **`customer`** — `RegisterIn` does not declare `role`, so a body that tries to promote itself gets a 201 and is a customer. Collision is `email__iexact` → 400 `email_taken`. `date_joined` is stamped in the `+00:00` shape, `last_login` is `null` |
| POST | `/auth/login` | auth | public | obj | 200 `{user, tokens}`. Plaintext compare. Unknown address, wrong password **and a deactivated account** are one answer — 401 `invalid_credentials` — because any distinction is an account-existence oracle. The match is **case-sensitive**: `ModelBackend` calls `get_by_natural_key`, a plain `=`. But `EmailStr` has already lower-cased the **domain**, so `demo@GISHERI.GE` signs in and `DEMO@gisheri.ge` does not |
| POST | `/auth/refresh` | auth | public | obj | `{refresh}` → **`{access}` alone**. No rotation and no second refresh token: the endpoint is hand-written upstream and the caller keeps what it arrived with. 401 `invalid_refresh` — `Token is invalid or expired`, django-ninja-jwt's own wording and deliberately not the other two 401 sentences. **Public on purpose**: the seam sends this one request with `token: null`, and a route that required a session would turn every silent refresh into a sign-out |
| GET | `/auth/me` | auth | any | obj | The boot probe; `AuthProvider.refresh()` mounts it on every page load and handles exactly two outcomes — a `UserOut`, or a 401 it reads as "signed out". **Anything else it rethrows**, into an unhandled rejection inside a `useEffect`, so this route must never become a 500 |
| PATCH | `/auth/me` | auth | any | obj | **Not a partial despite the verb.** `ProfileUpdateIn` defaults both names to `""` and the view assigns both unconditionally, so `{firstName: 'Ana'}` *blanks* the surname. `email`, `role` and `isActive` are dropped in silence — the schema does not declare them |
| POST | `/auth/me/password` | auth | any | obj | `{currentPassword, newPassword}` → `{detail: "Password changed."}`. `newPassword`'s 8–128 bounds are a Pydantic field constraint, so they are checked **before** the view has looked at the current password: a wrong current password *and* a six-character new one is a 422, not `current_password_wrong`. 400 `current_password_wrong` otherwise. **Existing tokens stay valid** — nothing is blacklisted |
| POST | `/auth/password/reset` | auth | public | obj | **Always 200 and always the same sentence**, known address or not, because any difference makes this an account-existence oracle. On a hit: append a `password_reset_tokens` row with a real 64-character URL-safe token and `console.info` the mail in Django `console.EmailBackend` style, link included — that is the demo's inbox and the only thing that makes the flow walkable in a tab. A malformed address is still a 422; `EmailStr` rejects it before the lookup, so answering it leaks nothing. Nothing invalidates a previously issued token |
| POST | `/auth/password/reset/confirm` | auth | public | obj | `{token, password}`. Two distinguishable failures in the view's own order: no matching **unused** row is 400 `reset_token_invalid`, and only a row that passed that test can be 400 `reset_token_expired`. So a **spent token reads as invalid, however old** — the queryset filters `used_at__isnull=True` before the clock is consulted. The one-hour TTL is evaluated here, at read time; there is no sweep. On success it stamps `used_at`, does **not** sign the user in, does **not** invalidate anything, and does **not** check `is_active` |
| POST | `/auth/logout` | auth | any | obj | `{detail: "Logged out."}` and nothing else. Purely symbolic — the view's own docstring says it "exists for symmetry" — so the token that called it still works. It is nevertheless authenticated, so a signed-out caller gets a 401 nobody reads: `context/auth.tsx` fires it with `.catch(() => undefined)` and clears its store regardless |

**The hard ones.** `GET /auth/me` — every screen waits on it and its `role` is
what `ProtectedRoute` gates the console on, so getting it wrong locks the admin
out. `/auth/refresh` — the only route in this table whose caller deliberately
sends no credential.

**One divergence, named at the route.** Upstream mints the new access token from
the refresh token's claims without touching the database, so a **deactivated**
user's refresh succeeds and the 401 lands on the next call instead. Here
`userForRefreshToken` resolves through the store, so the 401 lands one request
earlier. Both end signed out; only the console log differs.

**A footnote worth keeping.** The lifetimes here are 30 minutes and 7 days,
which is what upstream's `SIMPLE_JWT` dict says — but django-ninja-jwt reads the
`NINJA_JWT` settings key, not `SIMPLE_JWT`, so that dict is very likely inert and
the real deployment may be running the library's defaults. The dict is plainly
the author's intent, so it is what the mock implements.

---

## 2. `public` — the storefront's whole read API (7 routes)

Seven `GET`s, none authenticated, none paginated, none filtered. Upstream these
live in three routers mounted without an `auth=` kwarg, so a stale or missing
bearer token is *ignored* rather than answered with a 401.

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/products` | public | public | **arr** | All 30 rows, **id ascending**, no parameters at all — the view is `Product.objects.all()`. Every filter the shop offers (purpose, gender, price band, search) runs client-side over this one cached array. `catalogApi.listProducts` types the reply `ApiProduct[]` and calls `.map()` unguarded, so a page envelope here is a `TypeError` on the shop page rather than an empty grid |
| GET | `/products/:id` | public | public | obj | 404 when the id names nothing. The id arrives as the raw string `useParams()` gave the page; `/product/not-a-number` never reaches the handler, because the numeric capture 404s it at routing exactly as Django's URLconf would |
| GET | `/collections` | public | public | **arr** | Six rows, one per `Purpose`, **English `name` ascending** — so the Georgian UI shows them in English alphabetical order too |
| GET | `/zodiac` | public | public | **arr** | Twelve rows, **alphabetical by sign**: aquarius, aries, cancer, capricorn, gemini, leo, libra, pisces, sagittarius, scorpio, taurus, virgo. Not zodiacal order. `ZodiacInfoOut` carries **no `id`** — `sign` is the public key |
| GET | `/site-settings` | public | public | obj | The singleton, read fresh on every call because the admin edits it in the same tab. Eighteen keys and **no `id`** |
| GET | `/site-settings/page-seo` | public | public | **arr** | Every override, **path ascending**; the client caches the lot and looks up by `location.pathname` locally. Paths ship **unprefixed** (`/shop`, never `/demos/gisheri/shop`) — react-router strips the basename before publishing `useLocation().pathname`, so a prefixed value would match nothing and every override would silently do nothing |
| GET | `/quiz-config` | public | public | obj | `{moods, occasions, intentions, budgets}` — four arrays and nothing else. `id` and `updatedAt` are dropped, which matters because the admin editor round-trips this exact document back through `PATCH /admin/quiz-config`: a key that arrived and was not sent back would be lost on the first save |

**Three of these fire on every route in the app.** `<Seo>` is mounted by every
page and reads `useSiteSettings()` and `useAllPageSeo()`; the shop, the quiz, the
product page and the zodiac page all read `useProducts()`. A 4xx from any of them
is not a broken page, it is a broken *site* — react-query caches the rejection
and the title, the meta description and the whole catalogue go missing at once.
So none of the four list routes has a failure path at all, and the two singletons
cannot have one: both are `get_or_create(pk=1)` upstream and a non-nullable row
in the store here.

Two orderings are load-bearing. `/products` is `Meta.ordering = ["id"]`, which
the quiz's scoring pass relies on for its tie-break — two bracelets on the same
score come back in the order the shop created them, and shuffling that would make
the quiz's answer change between reloads. `/zodiac` is alphabetical, so the grid
opens on Aquarius rather than Aries.

---

## 3. `orders` — `/orders/*` (3 routes)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| POST | `/orders` | orders | any | obj | Checkout. 201 upstream, invisible as such — the seam hands the app a body rather than a status. Body is `OrderCreateIn` read in **declaration order** (`items` ≥ 1, then `fullName`, `email`, `phone`, `city`, `address`, `notes`, `discountCode`), because only the first failure is reported. Prices come from the catalogue, never from the client. Errors: 400 `unknown_products` (`Unknown product id(s): [4099, 4099]` — payload order kept, duplicates kept), 400 `discount_invalid`, 400 `discount_min_order`. The discount is **re-validated** here even though the cart already quoted it. **`uses_count` moves exactly here and nowhere else in the mock.** No stock anywhere in this domain, and **no audit row** — the customer's own checkout writes none |
| GET | `/orders` | orders | any | **page** | The caller's own orders, full `OrderOut` rows with items — `AccountPage` renders line thumbnails from them. `page`, `page_size`; **the one route with `{defaultPageSize: 20, maxPageSize: 50}`**, because `list_my_orders` clamps at 50 where every admin list clamps at 100. Forgetting that over-fetches by half a page and nothing complains. `-created_at`, imposed by the walker rather than by a parameter |
| GET | `/orders/:id` | orders | any | obj | **Another customer's order is a 404, not a 403.** The ownership test is part of the lookup, so a wrong id and someone else's id are indistinguishable — and the confirmation page renders one hardcoded `Order not found` card for every failure, with no branch for a 403 |

Both customer reads are the **customer view**: `adminNotes` blanked to `""` and
`customerOrderCount` nulled by `serialize_order`, not by these routes.

The interesting half of this module lives in `pricing.ts`. `create_order_for_user`
is one function upstream, imported by the admin router, so the phone-order form
and the customer checkout can never price a cart differently; `readOrderCreateIn`
is exported from `handlers/orders.ts` for the same reason and in the same
direction. It is **the only handler module that exports anything**.

---

## 4. `discounts` — `/discounts/validate` (1 route)

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| POST | `/discounts/validate` | discounts | any | obj | `{code, subtotal}` → `{valid: true, code, kind, value, discountAmount, finalTotal}`. `valid` is literally `true` on every 200 — a failure is a 400, never `{valid: false}`. `code` comes back in the row's **stored casing**, so `welcome10` quotes as `WELCOME10`. `subtotal` accepts a string or a JSON number. 400 `discount_invalid` / 400 `discount_min_order` |

Four upstream behaviours reproduced literally:

- **This route is authenticated.** The router is mounted `auth=jwt_auth`, so an
  anonymous cart applying a code gets a 401 rather than a discount. `CartPage`
  already renders `cartPage.signInRequired` above the button and the banner signs
  you in in one click, so the gate stays.
- **Nothing is reserved and nothing is incremented.** A code sitting at
  `max_uses − 1` validates happily for every shopper looking at it and lets
  exactly one of them check out; the rest meet `discount_invalid` at the till.
  That is the real product's behaviour and the reason the create path
  re-validates.
- **All four failures collapse into one sentence.** Inactive, expired, exhausted
  and never-existed are indistinguishable to the client. Telling a visitor that a
  code exists but is spent is an information leak the shop does not make.
  Redeemability is checked **before** the minimum, so a code that is both expired
  and under the minimum reports the former.
- **The subtotal is the client's.** Upstream never re-prices the basket here. A
  tampered subtotal buys a wrong *quote*, never a wrong charge, because the order
  is priced from the catalogue when it is written.

The 400 body is returned as a plain dict upstream rather than raised as an
`HttpError`. That is byte-identical on the wire, which is why `fail()` is the
right tool for it here — worth knowing so nobody "fixes" it later. `CartPage`
prints the `detail` verbatim under the input; there is no i18n key for either
message.

---

## 5. `admin-catalog` — products, uploads, collections, zodiac (15 routes)

All fifteen are `staff`. **No audit rows from any of them** — the audit service is
imported by exactly two modules upstream and this is not one, so products,
collections and zodiac are edited without a trace. That is itself worth seeing
next to the order and user screens, which record everything.

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/products` | admin-catalog | staff | **page** | `q` (`name__icontains` on the **English column only** — not `name_ka`, not the description, not the id), `gender` (exact, unvalidated), `is_bestseller`, `is_new` (each only the literal `true`/`false`), `page`, `page_size` (25/100). Id ascending. A Georgian-speaking operator searching for "იადეს" finds nothing, which is a real gap in the product and is reproduced rather than quietly widened |
| POST | `/admin/products` | admin-catalog | staff | obj | 201. `ProductIn` in declaration order; `price` takes a JSON number or a numeric string and comes back quantised to two decimals |
| POST | `/admin/products/bulk` | admin-catalog | staff | obj | `{ids, action}` → `{affected}`. `ids` is 1–200 (an empty selection is a 422, not a cheerful `{"affected": 0}`); actions `set_bestseller \| unset_bestseller \| set_new \| unset_new \| delete`. `affected` counts matched rows, so ids naming nothing are simply absent from it. **A batch containing any referenced product is refused whole** with 400 `product_protected` — see the note below |
| GET | `/admin/products/:id` | admin-catalog | staff | obj | 404 |
| PATCH | `/admin/products/:id` | admin-catalog | staff | obj | **Full replace, not a partial.** `ProductIn` supplies a default for thirteen of its fifteen fields and every one of those defaults is written: omitting `stones` blanks it to `[]`, omitting `nameKa` to `""`. The three admin forms are built on that and always send every field; a merge would make "clear this field" impossible from the console |
| DELETE | `/admin/products/:id` | admin-catalog | staff | **204** | 400 `product_protected` when any `OrderItem` references the product. **The one place this mock is deliberately kinder than upstream**, where `on_delete=PROTECT` raises `ProtectedError`, Ninja does not catch it, and the real server answers 500 with an HTML debug page |
| POST | `/admin/uploads/image` | admin-catalog | staff | obj | **Multipart** — `req.body` is a `FormData` with the field **`file`**, and this is the one endpoint `lib/api.ts` does not wrap. Returns `{url, path}` where `url` **is** the image: a `data:` URI built with `FileReader`, which `mediaUrl()` passes through and `<img src>` renders directly. `path` is `products/<16 base64url chars><ext>`. Extension is checked **before** size, as upstream orders it, so an 80 MB `.txt` is refused for its type: 400 `upload_type` (with Python's own `repr` of the allowed list) then 400 `upload_too_large` at 8 MiB. A missing or non-file part is a 422 |
| GET | `/admin/collections` | admin-catalog | staff | **count** | **`{items, total}` and nothing else** — no `page`, no `pageSize`, no filters, no query parameters. `CollectionsListPage` hands `DataTable` a fixed `page={1} pageSize={100}`, so its footer reads `1 / 1` for ever. Using `paginate()` here would add two keys the schema does not declare and silently cap the list at 25 the day a seventh collection exists |
| POST | `/admin/collections` | admin-catalog | staff | obj | 201; 400 `collection_slug_taken`. The uniqueness check is a plain `=`, **not** `__iexact`, unlike the email and discount-code lookups — so `Luck` and `luck` can coexist, and only the second is a dead page |
| GET | `/admin/collections/:id` | admin-catalog | staff | obj | 404 |
| PATCH | `/admin/collections/:id` | admin-catalog | staff | obj | Full replace. The duplicate check fires **only when the slug actually moves**, so re-saving a collection without touching its slug never collides with itself |
| DELETE | `/admin/collections/:id` | admin-catalog | staff | **204** | Nothing protects a collection: the `Product.collections` M2M is not modelled here and upstream would cascade its through-rows away anyway |
| GET | `/admin/zodiac` | admin-catalog | staff | **arr** | Twelve rows, sign ascending, no `id` |
| GET | `/admin/zodiac/:sign` | admin-catalog | staff | obj | Keyed by the **slug** — `get_object_or_404(ZodiacInfo, sign=sign)` — which is why the capture is `:sign` and not `:id`: the row's primary key is invisible to every caller, and the numeric guard would reject the only value anyone can send |
| PATCH | `/admin/zodiac/:sign` | admin-catalog | staff | obj | **Edit-only, eight fields**: `name`, `nameKa`, `dates`, `datesKa`, `element`, `elementKa`, `description`, `descriptionKa`, full replace over those eight alone. `sign`, `symbol` and `stones` are untouched because `ZodiacInfoIn` never declared them, so a body carrying a new `symbol` gets a 200 and the old glyph back. There is **no create and no delete** — a `POST` or `DELETE` here is a 405 |

**The hard ones.** The full-replace `PATCH` semantics, which look like a bug in
three separate routes and are not. The upload, which is the only non-JSON
endpoint in the API and reproduces CPython's `PurePath.suffix` rule exactly — `0
< i < len(name) - 1`, so `.png` as a whole filename and `photo.` have *no*
suffix and are refused rather than sneaking past on an empty extension.

**A divergence, added knowingly.** §0.8's kindness is applied to the **bulk
delete** as well as the single one: if any id in the batch is referenced, the
whole batch is refused and nothing is removed. That is the faithful shape of
`QuerySet.delete()` — one statement, all-or-nothing — and upstream the same case
is an uncaught `ProtectedError` and a 500.

**Worth knowing before demonstrating a delete.** All thirty seeded products are
referenced by at least one order line, so the Delete button on a seeded product
always answers `product_protected` and can never succeed. Only a product the
visitor has just created is deletable.

---

## 6. `admin-orders` — `/admin/orders/*` (8 routes)

All eight are `staff`.

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/orders` | admin-orders | staff | **page** | `q` (**`email__icontains` and nothing else** — not the customer name, not the order id; the console's placeholder says "Search by email…" and is accurate), `status` (a bare `str`, so an unrecognised value filters to an empty list rather than 422-ing), `user_id` (the "View all N orders" deep link), `date_from`, `date_to`, `page`, `page_size` (25/100). Rows are the **trimmed** `AdminOrderListItem` — seven columns, no items, no notes, no discount, with `itemCount` as the number of **line rows** rather than the sum of quantities |
| POST | `/admin/orders` | admin-orders | staff | obj | 201, admin view. The phone-order form, running the **same** `create_order_for_user` as the customer checkout — same pricing, same re-validation, same `uses_count` increment. The customer is resolved by `email__iexact` and **a missing one is created**: a `customer` account with an unusable password, its name split on the first space (`"Ana Maria Beridze"` → `Ana` / `Maria Beridze`). The account is written **before** the order and only the order's own body is atomic upstream, so a create that then fails on an unknown product or a dead discount **leaves the stub account behind**, visible in the admin user list. The only order route that writes a `create` audit row |
| POST | `/admin/orders/bulk-status` | admin-orders | staff | obj | `{ids, status}` → `{updated}`. Two faithful oddities in six lines: `updated` counts **rows**, so a repeated id counts once (`id__in` de-duplicates), while the audit loop walks the **payload's** ids, so that same repeat writes two rows and an id matching nothing writes one anyway. And **`updated_at` is not touched** — `QuerySet.update()` writes the columns it was handed and never fires `auto_now` |
| GET | `/admin/orders/:id` | admin-orders | staff | obj | Admin view: `adminNotes` populated and `customerOrderCount` counting **every** order of that user, cancelled ones included |
| PATCH | `/admin/orders/:id` | admin-orders | staff | obj | A **true partial**, unlike almost every other `PATCH` here: only non-null `status` / `adminNotes` are written and `{}` is a legal no-op that still answers 200. An explicit JSON `null` reads as "absent", not "clear the column". Auditing is asymmetric on purpose — `status_change` only when the value really moved, `notes_update` whenever `adminNotes` was present **even if unchanged**, and one request carrying both writes two rows. **Bumps `updated_at`**, which is what makes the activity feed refetch: its `reloadKey` is exactly that column |
| POST | `/admin/orders/:orderId/items` | admin-orders | staff | obj | 200 with the whole order. 409 `items_pending_only` unless the order is pending; 404 on an unknown product (this route's `get_object_or_404(Product)`, *not* create's 400). Snapshots name, image and price through the shared `priceLines()`. **A second add of the same product and size makes a second line** — nothing merges, and the console shows and edits both. Audit `item_add`: `+ 2× Jade Prosperity Bracelet (size M)`, suffix omitted on an empty size |
| PATCH | `/admin/orders/:orderId/items/:itemId` | admin-orders | staff | obj | 200 with the order. 409; 404 when the item belongs to a **different** order. A quantity change multiplies the **frozen** `unit_price` — it is never re-read from the catalogue, so editing a line on an old order cannot silently reprice it at today's rates. A payload with neither key returns the order unchanged: no save, no `updated_at`, no audit — and that check sits *after* the item 404. The audit row is skipped when nothing actually moved |
| DELETE | `/admin/orders/:orderId/items/:itemId` | admin-orders | staff | **obj** | **200 with the whole order, not 204** — the Ninja route declares `response=OrderOut` and `removeItem` reads the order straight back into the page's state. This is the one `DELETE` in the API that is not a 204. 409; 400 `last_item` when the order has one line — **checked before the item is looked up**, so removing a nonexistent line from a one-line order answers `last_item`, not `Not Found` |

**The one thing to understand before editing this module.** *The server enforces
no status transitions whatsoever.* `PATCH` accepts any status from any status and
the bulk route accepts any status for any selection: `delivered → pending` is a
200. Every bit of that discipline lives in the console, whose stepper enables
only the next step, hides "Cancel order" once an order is delivered, and puts a
confirmation dialog in front of each click — while the bulk toolbar on the list
page has no guard at all and never did.

That asymmetry is worth showing rather than fixing. It is what a real admin API
looks like when the workflow rules were written in the console, and adding a
server-side transition table would make the mock *stricter* than the product it
demonstrates — breaking, first of all, the cancelled-order revert path the UI
deliberately allows.

All three item routes end the same way: recompute `subtotal = Σ line_total` and
`total = subtotal − discount_amount`, **preserving the discount snapshot
verbatim**. The code is not re-looked-up, the percentage is not re-applied and
the amount is not re-clamped, so stripping items off a discounted order can drive
its total negative. The console's own copy advertises it: "the discount on this
order is preserved". Order **6059** carries a discount snapshot and is the one to
use for demonstrating it.

`add_order_item` builds its audit summary from the **live** `product.name` while
`delete_order_item` uses the **snapshot** `item.product_name`. They are the same
string at add time; the distinction shows only if a product is renamed between
the two.

---

## 7. `admin-users` — `/admin/users/*` (4 routes)

All four are **`admin`**, not `staff`, and the front end does not know it.

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/users` | admin-users | **admin** | **page** | `q` is a three-way **OR** over `email`, `first_name` and `last_name` — unlike `/admin/orders`, whose `q` is `email__icontains` alone; the two search boxes look identical and behave differently. `role` is matched exactly and **not validated** (`?role=owner` is a legal request that returns nobody). `is_active`, `date_from`, `date_to` (on `date_joined`), `page`, `page_size` (25/100). `.order_by("email")`. Rows are `AdminUserOut` with **no order rollup** — thirty-two aggregate queries to render totals nobody reads is why upstream split the detail schema out |
| POST | `/admin/users/bulk` | admin-users | **admin** | obj | `{ids, action}` where action is `activate \| deactivate` → `{affected, skippedSelf}`. **The caller's own id is stripped from the list**, and `skippedSelf` is computed *before* the strip, so it reports only that the id was there: tick yourself plus five colleagues and the answer is `{affected: 5, skippedSelf: true}`. Tick only yourself and it is `{affected: 0, skippedSelf: true}` **with no audit rows at all** — upstream returns before it reaches the loop. One audit row per **remaining id**, including ids matching no row, while `affected` counts rows, so the two numbers can legitimately differ. `qs.update()` bypasses `User.save()`, and `syncRoleFlags` is deliberately not called: no role moves here, and calling it would suggest `.update()` does |
| GET | `/admin/users/:id` | admin-users | **admin** | obj | `AdminUserDetailOut` — the list row plus `orderCount`, `totalSpent` and `lastOrderAt`, **excluding cancelled orders**. One response carrying **both timestamp shapes at once**: `dateJoined` / `lastLogin` in `+00:00` with six digits, `lastOrderAt` in `…Z` with three |
| PATCH | `/admin/users/:id` | admin-users | **admin** | obj | Four fields, **all of them written**; `role` and `isActive` carry no default, so an incomplete body is a 422 rather than a partial update. The order of the three failures is exact and observable: **422 beats 404** (Pydantic validates before the view runs a query), then `get_object_or_404`, then — only when editing yourself — the role guard **before** the activation guard, so an administrator who both demotes and deactivates themselves in one request is told about the demotion. 400 `self_role_change` · 400 `self_deactivate`. Audits `role_change` and/or `activation_change`, role first, and mirrors `role` onto `is_staff` / `is_superuser` |

**§E.9's disagreement, half of it here.** This router is `admin_auth` while
`OrderCreatePage` — a **staff** route — calls `adminUsers.list` for its customer
autocomplete and swallows the failure with `.catch(() => setSuggestions([]))`. So
a signed-in staff member typing a customer's email into a manual order sees an
empty dropdown and **no error at all**. That silence is the reason the role split
is spelled out on every `register()` call rather than defaulted.

**Two self-guards and a silent strip** — three defences against one hazard, which
is what gets built after somebody locks themselves out once. `UserEditPage`
disables the role `<Select>` and the isActive `<Switch>` when `isSelf`, so the
console cannot normally produce either 400; they are reachable from the seam, and
reproducing them is what makes the guard real rather than decorative.

**The rollup that disagrees with the order page.** `AdminUserDetailOut` excludes
cancelled orders from all three of its aggregates, while `OrderOut.customerOrderCount`
counts **every** order including cancelled — because they answer different
questions. A customer with four orders, one cancelled, reads `4` on the order
screen and `3` here. Both numbers are upstream's, and the seed puts a customer on
screen who shows the difference.

---

## 8. `admin-discounts` — `/admin/discounts/*` (6 routes)

All six are **`admin`**. **No audit rows anywhere in this module** — adding a
discount feed would put rows on a screen with no `ActivityFeed` mounted.

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/discounts` | admin-discounts | **admin** | **page** | `q` (`code__icontains`, so `stone` matches `LASTONE` too), `is_active` (a real tri-state — only the literal strings), **`kind` applied only when it is exactly `percent` or `fixed`**, with no `else`, so `?kind=Percent` lists everything and reports nothing, `date_from`, `date_to`, `page`, `page_size` (25/100). `-created_at`. `DiscountOut` carries nothing derived: no `isRedeemable`, no `isExpired` — the list renders its own "Expired" badge from `expiresAt` and the checkout learns redeemability from a 400 |
| POST | `/admin/discounts` | admin-discounts | **admin** | obj | 201. `usesCount` starts at 0 because `DiscountIn` cannot carry it. `value` is `ge=0` and **has no upper bound**, so a percent code worth `500` is accepted and takes five times the cart off — clamped back to the subtotal at redemption, so the order lands at zero rather than negative. `maxUses` is likewise unbounded, and a negative one simply makes the code permanently unredeemable. `minOrderTotal` defaults to `"0.00"`. 400 `discount_code_taken` on an `iexact` collision |
| POST | `/admin/discounts/bulk` | admin-discounts | **admin** | obj | `{ids, action}` where action is `activate \| deactivate \| delete` → `{affected}`, counting matched rows so a repeated id counts once. **Activate and deactivate do not bump `updated_at`** — `QuerySet.update()` again, the same quirk as the bulk order status route |
| GET | `/admin/discounts/:id` | admin-discounts | **admin** | obj | 404 |
| PATCH | `/admin/discounts/:id` | admin-discounts | **admin** | obj | A **full replace wearing a `PATCH` verb**: the view takes a complete `DiscountIn` and `setattr`s every field, so an omitted `maxUses` becomes `null` and an omitted `expiresAt` clears the expiry. The console always sends all seven. **`usesCount` survives only because `DiscountIn` never declares it** — the counter is preserved by an absence, not a guard, and adding the field to the reader would silently make it writable. The collision check is skipped when the code has not changed case-insensitively, and excludes its own row when it runs. Bumps `updated_at` |
| DELETE | `/admin/discounts/:id` | admin-discounts | **admin** | **204** | Deleting a code an order already used is harmless: `Order.discount_code` is a snapshot string and not a foreign key, so the historical order keeps reading correctly with no `PROTECT` to trip over |

**§E.9's disagreement, the visible half.** `App.tsx` gates `/admin/discounts` at
`staff`, so a signed-in staff persona sees **Discounts** in the sidebar, clicks
it, and gets a destructive toast reading `Failed to load discounts` /
`Admin role required.` That is reproduced exactly, sentence included, and it is
why `router.ts` treats `['admin']` and `['staff', 'admin']` as different things
rather than as two spellings of "privileged". Registering these six at `staff`
would make the demo work better than the product and delete the more interesting
thing it has to show.

---

## 9. `admin-ops` — dashboard, settings, page SEO, quiz, audit (11 routes)

Four upstream modules, one file, all `staff`. They are together because they are
one screen group and each is too small to be worth its own file — not because
they share a shape: two are singletons edited whole, one is a small CRUD table,
one is a read-only feed and one is seven aggregates. **No audit rows from any of
them.**

| Method | Path pattern | Owner | auth | Envelope | Notes |
|---|---|---|---|---|---|
| GET | `/admin/dashboard/stats` | admin-ops | staff | obj | No parameters. Seven aggregates: `productCount`, `userCount`, `activeDiscountCount`, `orderCount`, `totalRevenue`, `ordersByStatus`, `recentOrders`. Three are narrower than they read, all three upstream's — `activeDiscountCount` counts `is_active` alone and **ignores expiry and exhaustion** (the seed's expired-but-active codes make it visibly generous); `totalRevenue` sums **paid + shipped + delivered** only; `ordersByStatus` always carries all five buckets zero-filled in declaration order, because the panel renders one row per element. `AdminDashboardPage` has no react-query around it — a plain `useEffect` sets `data` or leaves it `null` — so a **missing key is not a blank tile, it is `NaN`** inside the money formatter |
| GET | `/admin/site-settings` | admin-ops | staff | obj | Byte-for-byte the public payload at a different auth level. Upstream that is literally the same `_serialize` called from two routers, and it has to stay that way: the admin form loads from here and the storefront reads from there, so a divergence would make the preview lie about the shop |
| PATCH | `/admin/site-settings` | admin-ops | staff | obj | **Full replace with defaults.** An omitted key does not keep its old value; it takes `SiteSettingsIn`'s default — and two of those defaults are not the empty string, so a partial body *changes* rather than blanks them: **`heroCtaLink` resets to `/shop`** and **`defaultRobots` to `index,follow`**. `SiteSettingsPage` always sends all seventeen, which is why nobody upstream has noticed; the lib types the input `Partial<SiteSettingsInput>`, which is a lie the port must not repeat. Bumps `updatedAt` |
| GET | `/admin/page-seo` | admin-ops | staff | **arr** | Path ascending, the same payload the public route sends. `PageSeoListPage` searches it client-side over `path`, `titleEn` and `titleKa`, so there is no `q` here to honour and adding one would be inventing a route |
| POST | `/admin/page-seo` | admin-ops | staff | obj | 201; 400 `page_seo_path_taken`. The uniqueness check is a plain `=`, not `__iexact`: `/Shop` and `/shop` are two different overrides and only one of them will ever match a pathname |
| GET | `/admin/page-seo/:id` | admin-ops | staff | obj | 404 |
| PATCH | `/admin/page-seo/:id` | admin-ops | staff | obj | Full replace; the duplicate check fires only when the path actually moves. `createdAt` is frozen, `updatedAt` moves |
| DELETE | `/admin/page-seo/:id` | admin-ops | staff | **204** | Nothing references a `PageSeo` row — the lookup is by path, at render time |
| GET | `/admin/quiz-config` | admin-ops | staff | obj | The same four arrays the public route sends |
| PATCH | `/admin/quiz-config` | admin-ops | staff | obj | Whole-document replace of all four arrays; **all four are required**, so a body carrying three of them is a 422 and not a wipe of the fourth. All four are assigned only after all four have validated, so a 422 on `budgets` cannot leave `moods` half-written. An item with an **empty `id` is a 422** (`min_length=1`) — and the editor's "Add item" button creates exactly that, so press Add, press Save, and the real backend refuses. It surfaces as the uninformative `Request failed (422)`, because a Pydantic error body is an array. `budgets[].min` / `.max` are canonicalised the way `str(Decimal(...))` does — `007` → `7`, `.5` → `0.5`, `40.` → `40`, `40.50` kept — and **not** quantised to two places, so a seeded `"0"` round-trips as `"0"` |
| GET | `/admin/audit` | admin-ops | staff | **arr** | `target_type` (**required**) and `target_id` (**required**, integer) — a missing or non-integer one is a 422 with `loc: ['query', …]`, before the query runs. `limit` has a default and so a malformed value falls back to it rather than erroring; clamped `1..200`, default 50, and the console sends 30. `-created_at` with `-id` breaking ties, because a bulk click writes several rows inside one millisecond and an unstable feed would reshuffle itself on every refetch. A `product` or `discount` target type is a legal request that answers `[]` |

**There is no global activity endpoint.** The feed is always about one record,
which is why `ActivityFeed` takes a target and why nothing renders a shop-wide
timeline. `ActivityFeed` also swallows every failure with
`.catch(() => setItems([]))`, so getting this route wrong shows up as a feed that
is permanently empty and never as an error.

**One upstream bug not reproduced.** `PATCH /admin/quiz-config` on the real
backend very likely **500s**: `model_dump()` yields `Decimal` objects for
`budgets[].min` / `.max`, and `QuizConfig.budgets` is a plain `JSONField` with no
`encoder=`, so `json.dumps` raises `TypeError: Object of type Decimal is not JSON
serializable`. A demo whose only quiz Save button always 500s would be worse than
one that works, so the mock saves successfully — and keeps camelCase in the
column, where that same upstream call would write snake_case back.

---

## 10. Module totals

| Module | Routes | `arr` | `page` | `count` | `204` | Multipart |
|---|---|---|---|---|---|---|
| `auth` | 9 | — | — | — | — | — |
| `public` | 7 | 4 | — | — | — | — |
| `orders` | 3 | — | 1 | — | — | — |
| `discounts` | 1 | — | — | — | — | — |
| `admin-catalog` | 15 | 1 | 1 | 1 | 2 | 1 |
| `admin-orders` | 8 | — | 1 | — | — | — |
| `admin-users` | 4 | — | 1 | — | — | — |
| `admin-discounts` | 6 | — | 1 | — | 1 | — |
| `admin-ops` | 11 | 2 | — | — | 1 | — |
| **Total** | **64** | **7** | **5** | **1** | **4** | **1** |

The remaining 47 are plain objects.

By gate: **12 public** (five `/auth/*` plus all seven storefront reads), **8
any** (four `/auth/*`, three `/orders`, one `/discounts/validate`), **34 staff**
(admin-catalog 15, admin-orders 8, admin-ops 11) and **10 admin**
(admin-users 4, admin-discounts 6).

The seven bare arrays are `GET /products`, `/collections`, `/zodiac`,
`/site-settings/page-seo`, `/admin/zodiac`, `/admin/page-seo` and `/admin/audit`.
The five paged lists are `GET /orders` and the four admin lists —
`/admin/products`, `/admin/orders`, `/admin/users`, `/admin/discounts`. The one
`count` envelope is `GET /admin/collections`. The four `204`s are the deletes on
products, collections, discounts and page SEO; the fifth delete —
`/admin/orders/{id}/items/{itemId}` — answers **200 with the whole order**.

`registeredRoutes()` returns all 64, prefixed and sorted, and `demo/index.ts`
prints the count in its boot line:

```
[demo] Gisheri — in-browser API. 30 products, 64 orders, 32 users, 64 routes. No network.
```

---

## 11. The statuses this API can produce

Django-Ninja's `HttpError(status, msg)` renders `{"detail": msg}` and nothing
else. There is no `code`, no `field` and no per-field dict — DRF's three-key
envelope belongs to a different backend and must not creep in, because the app
reads `detail` and only `detail`. The message is the exact English string the
backend sends, because the app renders it verbatim: **there are no i18n keys for
API errors anywhere in this front end.**

| Code | Status | `detail` |
|---|---|---|
| `unauthorized` | 401 | `Unauthorized` |
| `invalid_credentials` | 401 | `Invalid email or password.` |
| `invalid_refresh` | 401 | `Token is invalid or expired` |
| `staff_required` | 403 | `Staff or admin role required.` |
| `admin_required` | 403 | `Admin role required.` |
| `not_found` | 404 | `Not Found` |
| `method_not_allowed` | 405 | `Method Not Allowed` |
| `email_taken` | 400 | `An account with this email already exists.` |
| `current_password_wrong` | 400 | `Current password is incorrect.` |
| `reset_token_invalid` | 400 | `Invalid or already-used token.` |
| `reset_token_expired` | 400 | `Token has expired. Request a new reset email.` |
| `self_role_change` | 400 | `You cannot change your own role from admin.` |
| `self_deactivate` | 400 | `You cannot deactivate your own account.` |
| `collection_slug_taken` | 400 | `A collection with this slug already exists.` |
| `discount_code_taken` | 400 | `A discount with this code already exists.` |
| `page_seo_path_taken` | 400 | `An override for this path already exists.` |
| `unknown_products` | 400 | `Unknown product id(s): [4099, 4100]` — a Python list repr, payload order kept, duplicates kept |
| `discount_invalid` | 400 | `Invalid or expired discount code.` |
| `discount_min_order` | 400 | `This code requires a minimum order of 100.00.` — a raw `Decimal` in an f-string: two decimals, no currency symbol |
| `last_item` | 400 | `Can't remove the last item — cancel the order instead.` — the em-dash and the ASCII apostrophe are both upstream's |
| `upload_type` | 400 | `Unsupported file type. Allowed: ['.gif', '.jpeg', '.jpg', '.png', '.webp']` |
| `upload_too_large` | 400 | `File too large (max 8MB).` |
| `product_protected` | 400 | `Cannot delete a product that appears on an order.` — **the one divergence** |
| `items_pending_only` | **409** | `Items can only be edited on pending orders.` — the only 409 in the API |
| `server_error` | 500 | `Internal Server Error` |

Plus **422 `validation_error`**, whose body is `{detail: [{type, loc, msg}]}` — an
**array**. `api.ts` extracts `detail` only when it is a *string*, so every 422 in
this app surfaces as `Request failed (422)` with no field named. That degradation
is deliberate and is upstream's real behaviour on a bad payload.

Four statuses the **router** produces on its own, before any handler runs:

| Status | When |
|---|---|
| 401 | No token, a garbage token, an expired token, or a token naming a deactivated user — on any `any` / `staff` / `admin` route, and always *before* the role check |
| 403 | Signed in with the wrong role, with the sentence chosen from the route's role list |
| 404 | An unmatched path — logged `[demo] no route for …` first — including a path whose numeric capture failed its guard, and **any path with a trailing slash** |
| 405 | A matched path with an unregistered verb. The verbs this API does not implement are simply not registered and land here |

And a 500 for anything that is not a `DemoApiError` escaping a handler, logged
`[demo] handler failed` — this demo's Sentry.

---

## 12. Served upstream, deliberately **not** registered

Nothing in the ported front end calls these. Registering them costs handler
authors time and invites drift; the router answering 404 or 405 is the correct
outcome if one ever appears. **Registering a dead route would put a lie in this
file.**

| Route(s) | Why not |
|---|---|
| `GET /collections/{slug}` | No caller. `useCollections()` fetches the whole list and `CollectionDetailPage` finds its row locally |
| `GET /zodiac/{sign}` | Same — `useZodiacInfo()` fetches all twelve and the sign page reads from the cache |
| `POST /admin/users` | `adminUsers.create` exists in `lib/admin-api.ts` with **no UI call site**: `UsersListPage` has no "New user" button. The wrapper is dead code in the ported tree, and the route it would call answers **405**, not 404, because `/admin/users` exists for `GET` |
| `POST` / `DELETE` on `/admin/zodiac` and `/admin/zodiac/{sign}` | The twelve signs are a fixed vocabulary — no create, no delete, upstream or here. Both are **405** for the same reason |
| `adminOrdersApi.updateStatus` | Not a route at all: a second wrapper around `PATCH /admin/orders/{id}` that posts `{status}`. The route is registered once and both wrappers reach it |
| `GET /health` | An infrastructure probe. Nothing in the browser calls it |
| `GET /api/docs`, `GET /api/openapi.json` | Ninja's own documentation surface. The SPA never touches them |
| Anything under `/media/` | Served from the bundle. `serialize.ts::mediaUrl()` builds the URL; no route is involved |

---

## 13. Reconciliation flags

**No call site is missing a route.** Every path either surface can construct
resolves to a row above, and the 64 patterns registered are 64 distinct
`(method, pattern)` pairs — a duplicate would silently replace its twin.

Five near-misses, each of which looks like a bug and is not:

1. **`/admin/products/bulk` beside `/admin/products/:id`.** Two routes on one
   Ninja router, kept apart upstream by the `<int:…>` converter and here by both
   the numeric capture guard and the literal-beats-capture tie-break. Same for
   `/admin/users/bulk`, `/admin/discounts/bulk` and
   `/admin/orders/bulk-status`.
2. **`/admin/zodiac/:sign` takes a word.** It is the only capture in the table
   that is not an integer, which is exactly why it is named `sign` rather than
   `id`: an `:id` capture matches digits only, and `ZodiacInfoOut` carries no
   `id` for anyone to send.
3. **`GET /orders` clamps at 50, every admin list at 100.** One route, one set of
   options, no error if you forget — the page simply over-fetches by half a page.
4. **`GET /admin/collections` is `{items, total}`.** A page envelope there would
   add two keys the schema does not declare; `paginate()` there would cap the
   picker at 25 the day a seventh collection exists.
5. **`DELETE /admin/orders/{id}/items/{itemId}` answers a body.** Every other
   `DELETE` in the table is a 204. A 204 here would leave the page holding `null`
   where it expects the refreshed order and blank the item list.

Two things belong to the seam rather than to a handler author, and are recorded
here so they are not lost:

- **`POST /auth/refresh` must be dispatched with `token: null`.** It is the one
  request the app deliberately sends without a credential, and it is registered
  `public` to match. Route it through `dispatch` like everything else — a raw
  `fetch` there would violate the no-network rule and fail.
- **`POST /admin/uploads/image` is the one non-JSON request.** `uploadImage`
  builds its own `FormData` and dispatches it directly, so `req.body` is a
  `FormData` and `bodyOf()` would read it as `{}`. The handler is `async`, which
  `dispatch` awaits.

Finally, one thing that is **not** in this table and is easy to expect: there is
**no ordering parameter anywhere in this API**. Every list sorts by its model's
`Meta.ordering`, which `store.ts`'s walkers reproduce. A handler that wants a
different order is describing a route that does not exist.
