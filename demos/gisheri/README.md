# Gisheri — live demo

A natural-stone jewellery shop and its admin console, running with the backend cut off.

Upstream it is a Django 5 + django-ninja application on Postgres — seven apps, twelve models, a
JWT-authenticated API that speaks camelCase over the wire, bilingual product copy stored in the
database beside the English — with one React 19 + Vite SPA on top carrying both surfaces.

Here the same front end talks to an in-browser mock of that API — seed JSON compiled into the
build, an in-memory store, and a router that answers the same paths with the same payloads. No
server, no database, and no network request of any kind.

| | |
|---|---|
| **The shop** | `/demos/gisheri/` — home, catalogue, product pages, twelve zodiac pages, six collections, the stone quiz, cart and checkout, account and order history |
| **The console** | `/demos/gisheri/admin/` — dashboard, orders, products, collections, zodiac, discounts, users, the quiz editor, site settings, page SEO |

The demo opens **signed out**, on the shop's home page, because that is the product's real front
door. The banner in the corner signs you in as either of the two accounts it advertises — nobody
can guess credentials that live in a seed file:

| Role | Email | Password |
|---|---|---|
| **Customer** | `demo@gisheri.ge` | `gisheri-demo` |
| **Administrator** | `admin@gisheri.ge` | `gisheri-demo` |

Ana, the customer, owns six of the sixty-four orders — two discounted, two still pending — so the
account page has a history worth paging through. Twenty-nine other users exist as data, filling
the console's list and owning the rest of the orders; none of them is reachable, which is the
arrangement the real shop has.

It also **opens in English, where the real product opens in Georgian**. The shop is a Tbilisi one
and `ka` is its default; a portfolio visitor who cannot read the interface cannot judge it. That
is one line in `src/i18n.ts`, the header's toggle is on every page, and Georgian remains the
`fallbackLng`, so a key the English bundle is missing still resolves as it does in production.

**A third role exists and the banner does not offer it.** `staff@gisheri.ge` / `gisheri-demo` is
Levan Beridze — seeded, functional, reachable only by typing that address into the login form.
Upstream the front-end gate and the API gate disagree about him twice, and both are reproduced.
`App.tsx` gates `/admin/discounts` at `staff`, so a staff session sees **Discounts** in the
sidebar, clicks it, and is told `Failed to load discounts` / `Admin role required.`, because that
router is `admin_auth`. And `/admin/orders/new` hands the same session a customer autocomplete
backed by `GET /admin/users`, also admin-only, whose 403 the page swallows with
`.catch(() => setSuggestions([]))`: the dropdown is simply empty, with no error anywhere.
Registering those routes at `staff` would make the demo work better than the product and delete
the more interesting thing it has to show — but a button whose entire payoff is two error states
is a poor invitation, so it is written up here instead.

## The brand is fictional

The original is a real shop's platform. Everything that identifies it — name, wordmark, domain,
address, phone number, social handles, and every person in the seed — has been replaced.
**Gisheri is invented**: *gisheri* (გიშერი) is the Georgian word for jet, the black stone, and
the standard poetic word for raven-black in Georgian verse. It is also the amulet stone of
Georgian folk tradition — a strand of jet beads is the classic charm against the evil eye — which
is precisely what this shop sells.

What is kept is Tbilisi as the city, the Georgian/English interface, and the gold-on-cream
palette. The bilingual work is the engineering worth showing — the catalogue is translated in two
layers at once, static `catalog.*` keys in the locale bundles and `*Ka` columns on the product
rows, with `lib/catalog-i18n.ts` preferring the database field, then the key, then the canonical
English — and a city name identifies nobody.

## What changed, exactly

The front end is a port, not a rewrite. Of the 119 files under `src/` that come from upstream,
**88 are byte-identical** and 31 differ — and 18 of those 31 differ *only* because of the rename.
Thirteen files changed for real reasons:

| File | Change |
|---|---|
| `lib/api.ts` | Rewritten below the exports. Identical public surface — `tokenStore`'s four methods, `ApiError{status, detail, body}`, `FetchOptions`, the four verbs on `api` — with `dispatch()` where `fetch()` used to go, which is what keeps `context/auth.tsx` and eight `*-api.ts` wrappers byte-identical. Two behaviours survive literally because the UI depends on them: the single 401 retry, and `tryRefresh()`'s promise dedupe, without which the console's parallel first paint mints six refreshes and the last one signs you out. Tokens live in two module-level `let`s. |
| `lib/admin-api.ts` | One function, `uploadImage`. The `FormData` is handed to `dispatch` intact — the handler is the multipart parser here — and a rejected upload still throws the raw JSON body as its message, exactly as ugly as upstream, because a demo that quietly fixes the product's rough edges is showing something other than the product. |
| `App.tsx` | `<BrowserRouter>` becomes a six-line `DemoRouter` reading `__DEMO_ROUTER__`; `<DemoBanner />` mounts inside the providers and outside `<Routes>`, so it survives a path the router does not recognise; the two Georgian font families are imported from the bundle. The route table and both `/admin` blocks are untouched — what the basename buys. |
| `main.tsx` | Imports `./demo` first, so the store exists and all 64 routes are registered before React is pulled in, and removes the boot splash one frame after the first render. |
| `index.css` | Line 1 deleted: the Google Fonts `@import`. The remaining nine hundred-odd lines, `[lang="ka"]` rules included, now resolve against the bundled `@fontsource` faces. |
| `i18n.ts` | Two lines: the storage key becomes `gisheri:lang`, and the initial language becomes English. |
| `context/cart.tsx` | The `localStorage` key, its loader and its persisting effect are gone; `loadCartItems()` returns `[]`. The reducer and context shape are untouched, and the loader stays a function because that is where persistence goes back if it ever should. |
| `lib/search.ts` | `buildDocs()` and the `SYNONYMS` const it alone used, deleted — 119 lines of dead code referencing three identifiers that are not in scope. It ships today only because upstream's build never type-checks; this one does. |
| `pages/NotFound.tsx` | `<a href="/">` becomes `<Link to="/">`. A root-absolute anchor under `/demos/gisheri/` is a full page load onto the portfolio, not this shop's home. |
| `components/Seo.tsx` | One token: `description` becomes optional. `AdminLayout` already rendered `<Seo>` without one, so the runtime is unchanged — it is a TS2741 the moment anybody runs `tsc`, which upstream never did. |
| `components/theme-provider.tsx` | One import. Upstream pins `next-themes@0.3`, whose peer range stops at React 18 — it resolves here only because upstream's own install never enforced it. This workspace is React 19 inside a monorepo that runs `npm ci`, so the dependency moves to 0.4 and `ThemeProviderProps` comes from the package root instead of the `next-themes/dist/types` path 0.4 removed. |
| `hooks/use-theme-transition.ts` | The View Transitions guard. `'startViewTransition' in document` narrows `document` to `never` in the `else` branch once `strictNullChecks` is on, and the truthiness test that followed it reads to `tsc` as a forgotten call (TS2774). A `typeof` test on the value is the same guard with neither effect. |
| `pages/admin/QuizConfigPage.tsx` | Two casts widened through `unknown`. Patching a generic `T` with `{ hintEn }` is a cast `tsc` cannot verify; the compiler's own suggested form is used. |

The other eighteen are the rename: both locale bundles (the wordmark's two halves, twenty-four
`Gisheri` strings apiece, the collection keys rewritten to the six purpose slugs), one
`defaultValue` in each of eleven pages, the two wordmark spans `AdminLayout` hardcodes instead of
translating, two placeholders in the site-settings form — which a reviewer would otherwise open
and read the real shop's name out of — and the login page's demo hint. Two corrections rode
along: the JSON-LD `Organization.logo` is minted from `import.meta.env.BASE_URL` rather than a
root-absolute `/favicon.ico` that is a dead URL under a sub-path, and `quizPage.budgets.40to50`
reads `₾40 – ₾50` rather than `$40 – $50` in a shop that prices in lari.

Twenty-four upstream files were dropped: twenty `components/ui/*` with no importer anywhere,
`App.css` (Vite boilerplate imported by nothing, and a trap for any port that "helpfully" wires
it in), and three test files. Those twenty components were the only reason for nineteen runtime
dependencies, `recharts` and `react-day-picker` included; this workspace declares 38 where
upstream declares 56.

No page, no component and no query hook knows the backend is gone. That is the point: the front
end is the portfolio piece, so it stays the thing that actually shipped, and a fix made upstream
can still be brought over by copying the file.

Plus what is wholly new: `src/demo/` — 22 TypeScript modules, about 8 700 lines, four seed JSON
files and two reference documents — `src/components/demo/DemoBanner.tsx`, and `src/env.d.ts`.

## The seam

```
pages/ + components/          89 ported files. Eighteen touched, seventeen only for the rename.
        │   api.get('/admin/orders?status=pending&page=2')
        ▼
lib/api.ts                    Rewritten. The app's own ApiError, the mock's guts.
        │   dispatch('GET', '/demos/gisheri/api/admin/orders', {token})
        ▼
demo/router.ts                Route table, path captures, simulated latency, the auth gate,
        │                     the role gate, and DemoApiError as the only way to fail.
        ▼
demo/handlers/                auth · public · orders · discounts · admin-catalog ·
        │                     admin-orders · admin-users · admin-discounts · admin-ops
        │   query.ts filters, orders and pages · serialize.ts computes the derived fields
        │   pricing.ts prices a basket once, for both checkouts
        ▼
demo/store.ts                 Plain arrays in memory. The demo's database.
```

Failure crosses the seam unchanged. A handler throws `DemoApiError`; `lib/api.ts` re-dresses it
as the `ApiError` the app already understands; Ninja's `{detail: "…"}` lands under the input that
was already rendering it, because there are no i18n keys for API errors anywhere in this front
end — the English sentence *is* the contract, and inventing a `code` or a per-field dict would
import DRF's envelope into a backend that has none. An `items_pending_only` still arrives as a
409, a customer deep-linking into the console still gets a 403, and an expired access token still
spends one silent refresh before the app gives up.

## Running it

| Command | |
|---|---|
| `npm run dev:gisheri` | Vite dev server at <http://localhost:5177/demos/gisheri/> |
| `npm --workspace @demos/gisheri run build` | typecheck, then `vite build` into `demos/gisheri/dist/` |
| `npm --workspace @demos/gisheri run typecheck` | three `tsc` projects: the ported tree on upstream's loose flags, `src/demo/` on `strict`, then the config |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |
| `npm run preview` | Serves `dist/` the way a correct host would |

Run them from the repo root. `VITE_BASE` (default `/demos/gisheri/`) and `VITE_ROUTER=hash` are
the two build-time knobs — see the [root README](../../README.md). Splitting `tsc` in three is
why the ported tree compiles untouched: new code is held to `strict`, ported code to exactly the
flags it was written against. The console lives at `<base>admin/` inside the same `index.html`,
so the repo's `/demos/:demo/*` fallback rule covers its deep links with nothing added.

## What the mock reproduces

**64 routes**, matched after the `/api` prefix and — this is Django-Ninja, not DRF — with **no**
trailing slash: `/api/products/` is a different URL that answers 404, and `register()` refuses a
pattern ending in a slash at boot, so a DRF habit fails loudly on the first page load instead of
404-ing under a spinner. Reads answer in 90–260 ms and writes in 140–340 ms, which is what makes
the spinners, the optimistic updates and the stale-while-revalidate visible instead of
theoretical. The jitter is a counter walked by the golden ratio rather than `Math.random()`, so
two runs of the same clicks produce the same demo.

`src/demo/routes.md` is the contract: every route with its module, gate, envelope and honoured
params, reconciled from both ends — every call site in `src/lib/*.ts` and `src/context/auth.tsx`,
against the Ninja URLconf. A route the front end never calls is not registered, and §12 says
which those are and why.

| Module | Routes | Covers |
|---|---|---|
| `handlers/auth.ts` | 9 | Register, login, the bare `{access}` refresh, the boot probe, profile, password change, and the token-based forgot/reset pair with its real one-hour TTL. |
| `handlers/public.ts` | 7 | The storefront's whole read API: products, one product, collections, zodiac, site settings, page-SEO overrides, quiz config. None authenticated, none paginated, none filtered — every filter the shop offers runs client-side over one cached array. |
| `handlers/orders.ts` | 3 | Checkout, the customer's own paginated orders, and one order by id — where somebody else's order is a 404 rather than a 403, because the ownership test is part of the lookup. |
| `handlers/discounts.ts` | 1 | `POST /discounts/validate`. Inactive, expired, exhausted and never-existed collapse into one sentence: telling a shopper that a code exists but is spent is an information leak. |
| `handlers/admin-catalog.ts` | 15 | Products, collections, zodiac, image upload. Every `PATCH` here is a full replace wearing a `PATCH` verb, and none of it writes an audit row — upstream imports the audit service in two modules and this is not one, which is worth seeing beside the screens that do. |
| `handlers/admin-orders.ts` | 8 | The console's orders, the phone-order form running the *same* pricing function as the customer checkout, bulk status, and the line-item editor with its 409 and its last-item 400. |
| `handlers/admin-users.ts` | 4 | The user list, bulk activate/deactivate, and the edit form with its two self-guards — you cannot demote or deactivate yourself, and your own id is silently stripped from a bulk selection. |
| `handlers/admin-discounts.ts` | 6 | Percent and fixed codes, both bulk actions, and a `PATCH` that clears any field the body omits — the console always sends all seven, which is why nobody upstream has noticed. |
| `handlers/admin-ops.ts` | 11 | The dashboard's seven aggregates computed over the live store, both singletons, the page-SEO overrides, the quiz editor and the audit feed. |

Envelopes are Ninja's and they are not uniform: seven routes return a bare array, five a
`{items, total, page, pageSize}` page, one a `{items, total}`, four a 204, and the
remaining 47 a plain object. `routes.md` records which is which, because `catalogApi.listProducts`
calls `.map()` on the reply unguarded — a page envelope on `/products` is a `TypeError` on the
shop page, not an empty grid. A page past the last clamps and returns `items: []` with the real
`total`, Ninja's behaviour and not DRF's 404. Gates are spelled out on every registration rather
than defaulted — **12 public, 8 any signed-in user, 34 staff, 10 admin** — and the router treats
`['admin']` and `['staff', 'admin']` as different things rather than as two spellings of
"privileged", for the reason at the top of this file.

## The store

`demo/seed/*.json` holds raw rows — not API payloads. Computed fields belong to `serialize.ts`,
and media URLs are built there too, so the seed survives a change of base path.
**458 rows across ten tables plus two singletons, 168 KB.**

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| `admin_actions` | 152 — 138 order, 14 user | | `order_items` | 138 — 97 carry a size |
| `orders` | 64 — three pages of 25 | | `users` | 32 — a real page 2 |
| `products` | 30 — page 2 has five | | `discounts` | 14 — 8 percent, 6 fixed |
| `zodiac_info` | 12 — the whole enum | | `page_seo` | 7 overrides |
| `collections` | 6 — one per purpose | | `password_reset_tokens` | 3 — live, spent, expired |
| `site_settings` | 1, a singleton | | `quiz_config` | 1, a singleton |

Upstream's own `seed_catalog` plants six products, five collections and twelve zodiac entries and
no users, orders, discounts or audit rows at all — it bootstraps a developer's database rather
than filling a showcase, so against it the orders list, the activity feed and every dashboard
tile read zero, and an empty screen reads as broken. This seed is written from the screens
backwards: sixty-four orders spread `pending 9 / paid 13 / shipped 11 / delivered 27 /
cancelled 4`, so every status filter and dashboard bucket is non-empty; fourteen codes cover both
kinds with five inactive, three exhausted and two expired but still flagged active, which makes
the dashboard's active-discount tile visibly generous — it counts `is_active` and ignores expiry
and exhaustion, upstream's own arithmetic. Thirty products span ₾29 to ₾96, so the price slider
and all three quiz budget bands bite.

`demo/schema.md` is the full contract: every column, ten disjoint id bands, and the **55
cross-table invariants** `validateSeed()` checks at construction under `import.meta.env.DEV`.
Postgres starts every sequence at 1, so id 3 exists in a dozen tables at once and a stray
`"product_id": 3` would resolve silently against a collection. Disjoint bands turn that typo into
an empty lookup at the row that is wrong, and make an id readable on sight: 6xxx is an order,
4xxx a product, 12xxx an audit row.

### Date rebasing

A seed with absolute timestamps goes stale the day after it is written: nothing sold today, an
empty dashboard, every live discount expired. So at construction the store measures the whole-day
distance from the newest order to today and shifts every timestamp by it — whole days only, so
the seed's mornings stay mornings — then scales anything landing after "now" back into the
elapsed part of today, because nothing in an archive may be newer than the moment it is read. A
flat clamp would collapse a morning's trading onto one instant; scaling keeps order and spread.

Two zones, two jobs, and mixing them up is the subtle bug here. The **shift** is measured in
`Asia/Tbilisi` days, because a shop that trades in Tbilisi should keep its nine-o'clock orders at
nine o'clock. The **compression** is measured against the UTC day, because Django ran on
`TIME_ZONE = "UTC"` and every `?date_from=` compares `created_at__date` in that zone — squeeze an
order into the elapsed part of the *Tbilisi* day and it can cross the UTC midnight behind it, so
the dashboard's "today" reads yesterday, the exact emptiness the pass exists to prevent. Discount
expiries are exempt from the compression for a related reason: a live code dragged back over
`now` takes the checkout's discount field down with it.

Because a uniform shift preserves the spread but not the *arrangement*, a fourth pass moves the
fewest orders the smallest distance until at least one sits today, six in the last seven days and
fourteen in the last thirty — the three presets the orders list opens with. Candidates are ranked
`pending` first: an order delivered forty minutes ago reads as a mistake, while one placed forty
minutes ago and still pending is what a shop's morning looks like. Statuses are never rewritten,
and an order that cannot move without landing in the future or predating the account that placed
it is refused rather than corrupted.

## The artwork is drawn, not photographed

A demo of an invented shop cannot ship photographs of jewellery that does not exist, and a grid
of grey placeholder boxes reads as broken rather than as unfinished. So 28 of the 40 files under
`public/` are hand-authored SVG: the bead wordmark, its favicon and the OG card; one collection
scene; and 24 product tiles — single- and double-strand bracelets with a gold rondelle at six
o'clock, pendants knotted on a cord, two flat cuffs with bezel-set cabochons, and a diamond drawn
as outline alone, girdle and facets ruled in gold with no body fill. They obey the same rules the
product does — no gradients, no filters, no `<text>`, flat fills and thin lines — the brand gold
never covers more than a tenth of any drawing, and every tile is 800×800 so the grid never jumps.

**Twelve upstream JPEGs are reused unchanged**, which is worth saying plainly rather than
burying: the hero photograph and eleven product and collection shots came across byte for byte
and were only renamed. They are the six bracelets and five collections the original catalogue
actually had; the other 24 bracelets and the sixth collection are drawings. So the grid mixes
photographs with illustrations and it is obvious which is which — the drawings look like
drawings. That is the honest choice: better a demo that is obviously illustrated than one
pretending to photographs it does not have.

## Deliberately not reproduced

| | |
|---|---|
| Password hashing | Compared in plain text against the seed row. There is nothing to protect: the "server" is a function call in the same tab, and the banner will sign you in as an administrator on request. |
| Email | There is no inbox in a browser tab. The reset mail is printed to the console in Django `console.EmailBackend` format, link included — exactly what a developer reads out of the runserver log against the real backend — and the flow works end to end, on a real 64-character token with a real one-hour TTL. |
| Rate limiting | The real backend defines no throttle at all, so `429` is not a state this demo can reach, and the mock does not invent one. |
| The image upload | A `data:` URI made in the tab, checked against the same five extensions and the same 8 MB ceiling, so both error paths are reachable and the preview works — but nothing is stored anywhere and the `path` it reports is invented. |
| Persistence of any kind | Reload is the reset. That is a product decision, not a missing feature. |
| Django's admin, the migrations, the deploy | Not part of the front end, so not part of the port. |
| `GET /collections/{slug}` · `GET /zodiac/{sign}` · `POST /admin/users` · `POST` and `DELETE` on `/admin/zodiac` | Served upstream, deliberately not registered — no caller exists for them anywhere in the front end, and registering a dead route would put a lie in `routes.md`. The last three answer **405**, not 404, because their paths exist for another verb. |
| The vitest suite | Three files, dropped with the twenty unused components. This monorepo has no test runner, and keeping them would mean installing vitest, jsdom and two `@testing-library` packages so that `npm run typecheck` could then be taught about `vitest/globals`. Tonnaro has no `typecheck` script for the same shape of reason. |

**One divergence worth naming.** Upstream, deleting a product that appears on an order raises
Django's `ProtectedError` out of the view and the client gets a 500. Here it is a 400 reading
`Cannot delete a product that appears on an order.`, and the bulk delete answers the same way.
That is the mock choosing to be readable rather than bug-compatible, and the only place it does
so. Every seeded product is on at least one order line, so Delete on a seeded row always answers
it; only a product you have just created is deletable.

**And one non-divergence**, because it looks like a bug: applying a discount code while signed
out returns 401 `Unauthorized` rather than a discount, since upstream mounts that router
`auth=jwt_auth`. The cart already renders a sign-in line above the button and the banner signs
you in in one click, so the gate stays where it was.

Two Web Storage keys survive a reload and nothing else does: `gisheri:lang`, which is upstream
behaviour rather than demo data, and `next-themes`' own theme key. The cart, the JWTs and the
whole store are held in memory — a reload restores the pristine shop and signs you out, and the
banner's Reset does the same without one.

## Layout

```
src/demo/
  schema.md      the contract: 12 tables, 10 id bands, 55 invariants, the media inventory
  routes.md      all 64 routes: owner, gate, envelope, honoured params, and what is left out
  seed/*.json    raw rows — 458 of them, plus two singletons
  types.ts       the row shapes, the enums, the store's own vocabulary
  store.ts       the in-memory tables, date rebasing, ids, validateSeed(), resetStore()
  router.ts      route table, dispatch, latency, the auth gate, the role gate, DemoApiError
  query.ts       search, filters, date ranges, Ninja's page envelope
  serialize.ts   the computed fields, and mediaUrl() — the only place a media URL is minted
  pricing.ts     one basket-pricing function, shared by the checkout and the phone-order form
  base.ts        the error registry, the one clock, money, request helpers
  auth-tokens.ts JWT-shaped stateless tokens, minted from a counter
  accounts.ts    the three demo accounts, two of them advertised
  base-path.ts   everything derived from import.meta.env.BASE_URL
  handlers/      auth · public · orders · discounts · admin-catalog ·
                 admin-orders · admin-users · admin-discounts · admin-ops
src/components/demo/DemoBanner.tsx   the only chrome that is not the product
```

The seed is 168 KB of JSON compiled into the entry chunk, which is where the whole fake backend
lives. The console is the split: nineteen modules behind `React.lazy`, exactly as upstream has
them, so a visitor who only browses bracelets never downloads it — the storefront's own pages
stay eager, also as upstream has them. `public/` is 704 KB, of which 589 KB is the twelve reused
JPEGs; the 28 drawings together are 114 KB, because flat fills and no gradients compress to
almost nothing.
