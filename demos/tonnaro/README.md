# Tonnaro — live demo

A specialised-transport ordering platform, running with its backend cut off.

Upstream it is a Django 4.2 + DRF application behind nginx: 11 apps, 22 models, 88 views, a
JWT-authenticated API, PostgreSQL, and a React 18 SPA on top. Here the same front end talks to
an in-browser mock of that API — seed JSON compiled into the build, an in-memory store, and a
router that answers the same paths with the same payloads. No server, no database, and the only
network request the page makes is for map tiles.

The demo opens **signed out**, on the public marketing site, because that is the product's real
front door. The banner in the corner signs you in as either of the two accounts that exist:

| | |
|---|---|
| **Customer** | `demo@tonnaro.ge` / `tonnaro-demo` |
| **Dispatcher** | `admin@tonnaro.ge` / `tonnaro-demo` |

Twenty-two other customers exist as data — they own orders and fill the admin list — but none of
them is reachable, which is the arrangement the real product has.

## The brand is fictional

The original is a real client's platform. Everything that identifies them — name, logo, accent
colour, domain, phone number, and every customer, company, driver and vehicle-owner name in the
seed — has been replaced. **Tonnaro is invented.** What is kept is Georgia as the service area
and the Georgian/English/Russian interface, because the trilingual work is the engineering worth
showing and a city name identifies nobody.

## What changed, exactly

The front end is a port, not a rewrite. Of the 70 files under `src/` that come from upstream,
**48 are byte-identical** and 22 differ — and 16 of those 22 differ *only* because of the
rename. Six files changed for real reasons:

| File | Change |
|---|---|
| `api/client.js` | Rewritten. Same axios-shaped surface — `get/post/patch/put/delete` resolving to `{data, headers}`, rejecting with `err.response.data` — so all 152 call sites are untouched. `dispatch()` into the mock where axios used to go. Both interceptors are reproduced: the bearer token is attached per request, and a 401 still burns one refresh before bouncing to a login page. |
| `index.js` | Picks `BrowserRouter` or `HashRouter` off `__DEMO_ROUTER__` and gives the browser router the base path Vite compiled against; imports `./demo` to boot the mock. |
| `App.js` | Three lines: mounts `DemoBanner` inside `AuthProvider`. It has to live there — the banner signs you in through the real login path rather than faking a token, so it needs the context. |
| `components/map/MapPicker.js` | Leaflet pin images come from the bundle instead of cdnjs and `raw.githubusercontent.com`. Six lines. |
| `components/map/FullscreenLocationPicker.js` | The same. |
| `contexts/LanguageContext.js` | One line. Upstream opens in Georgian, because the product's customers are in Georgia. This demo's first-time visitor is reading a portfolio, so it opens in English and leaves the switcher to show the other two. |

The other sixteen are the rename: brand strings across all three language objects in
`i18n/translations.js` (plus the new `demo.*` keys), the green palette in `theme.css` swapped for
the orange one, the `DGD` monogram in two layouts, a `localStorage` key, and the placeholder text
in the admin settings and SEO forms — which a reviewer would otherwise open and read the real
client's name out of.

No page, no component and no context knows the backend is gone. That is the point: the front end
is the portfolio piece, so it stays the thing that actually shipped, and a fix made upstream can
still be brought over by copying the file.

## The seam

```
pages/ + components/          48 files. Unchanged.
        │   api.get('/orders/admin/', { params })
        ▼
api/client.js                 Rewritten. Axios's shape, the mock's guts.
        │   dispatch('GET', '/api/orders/admin/', { params, token })
        ▼
demo/router.js                Route table, path captures, simulated latency, the role gate,
        │                     and DemoApiError as the only way to fail.
        ▼
demo/handlers/                auth · orders · catalog · pricing · site · analytics
        │   query.js filters, orders and pages  ·  serialize.js computes derived fields
        ▼
demo/store.js                 Plain arrays in memory. The demo's database.
```

Failure crosses the seam unchanged. A handler throws `DemoApiError`; `api/client.js` re-dresses
it as the axios error every `catch (err) { err.response?.data }` upstream already reads; DRF's
`{field: ['message']}` lands under the right input in forms that were already rendering it. A
401 still redirects, and a customer reaching an admin route still gets a 403.

## Running it

| Command | |
|---|---|
| `npm run dev:tonnaro` | Vite dev server at <http://localhost:5175/demos/tonnaro/> |
| `npm --workspace @demos/tonnaro run build` | → `demos/tonnaro/dist/` |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |
| `npm run preview` | Serves `dist/` the way a correct host would |

Run them from the repo root. `VITE_BASE` (default `/demos/tonnaro/`) and `VITE_ROUTER=hash` are
the two build-time knobs — see the [root README](../../README.md).

There is no `typecheck` script, and its absence is deliberate: upstream is plain JavaScript, and
adding TypeScript would have made this a rewrite rather than a port. The root
`npm run typecheck` uses `--if-present` and skips this workspace.

## What the mock reproduces

**128 routes**, matched after the `/api` prefix and keeping DRF's trailing slashes. Reads answer
in 90–260 ms and writes in 140–340 ms, which is what makes Ant Design's spinners and table
loading states visible instead of theoretical.

| Module | Covers |
|---|---|
| `handlers/auth.js` | Login, JWT refresh with rotation and blacklisting, logout, registration, the code-based email verification and two-step password reset with attempt limits and a resend cooldown, profile and avatar, company contracts, and the whole admin-users module — including the one genuinely server-filtered, server-paginated list in the app. |
| `handlers/orders.js` | The customer side (list, active, multipart create, detail by id *or* public uuid, cancel, accept) and the dispatcher side (filtered and paginated list, detail, PATCH with edit history, status transitions, price recalculation, auto-promotion undo, the notification poll, and two CSV exports). Plus `/orders/route-profile/` and `/orders/preview-price/`. |
| `handlers/catalog.js` | Categories, services, vehicles and their galleries, drivers, car owners — with the keyword suggestion engines, image upload, primary-image promotion and drag-to-reorder. |
| `handlers/pricing.js` | The six admin CRUD collections and the quote engine, ported from `backend/pricing/`. It exports `quote()`, which the orders module imports — so the customer's estimate, the dispatcher's calculator and the recalculation cannot disagree. |
| `handlers/site.js` | Landing page, site settings, restricted time windows, terms and SEO. Three singletons whose edits are visible on the public pages immediately. |
| `handlers/analytics.js` | The dashboard aggregate and the 25-key analytics payload, computed over the live store. |

Every paginated route returns DRF's `{count, next, previous, results}` at `PAGE_SIZE = 20`, and
`?page_size=` is genuinely ignored because the real settings define no
`page_size_query_param`. A page past the last is a 404 `{detail: 'Invalid page.'}`. Lists whose
views set `pagination_class = None` return bare arrays, and `demo/schema.md` records which is
which.

## The store

`demo/seed/*.json` holds raw rows — not API payloads. Computed fields belong to the handlers,
and media URLs are built at serialisation time, so the seed survives a change of base path.
**428 rows across 24 tables, 372 KB.**

| Table | Rows |
|---|---|
| `orders` | 46, every status in the flow, deliberately over the page limit so the pager is real |
| `orderStatusHistory` | 179 — every order opens with its `created` row |
| `users` | 24: one dispatcher, one demo customer, 22 more that fill the admin list |
| `vehicles` · `drivers` | 18 each — genuinely paginated at 20, and nothing walks to page 2 |
| `categories` · `services` | 19 and 18, each multilingual, each with a keyword list |
| `pricing*` | 6 zones, 15 rates, 7 equipment items, 4 elevation buckets, 2 pump rows |
| `carOwners` · `contracts` | 10 and 9, the contracts backed by real PDFs |

`demo/schema.md` is the full contract: every row shape, the disjoint id band per table, and the
cross-table invariants the seed has to satisfy.

### Date rebasing

A seed with absolute timestamps goes stale the day after it is written: nothing ordered today,
an empty analytics chart, every job in the past. So at construction the store measures the
whole-day distance from the newest order to today and shifts every timestamp by it — whole days
only, so the seed's mornings stay mornings — then squeezes anything that lands after "now" back
into the elapsed part of today, because nothing in an archive may be newer than the moment it is
read. Day boundaries are drawn in `Asia/Tbilisi`, the zone Django ran in, not the visitor's.

A uniform shift preserves the spread but not the *mix*, so a second pass moves `requested_date`s
until at least three non-terminal orders sit today and three ahead, no terminal order is dated in
the future, and nothing is requested for a day before it was placed.

## Routing, geocoding and the map

The one part of the product that cannot be faked with a fixture file: a visitor will drop pins
in places nobody seeded.

- **`demo/routing.js`** synthesises the HGV route that `/orders/route-profile/` answers with.
  It is *deterministic* — the same coordinates always produce the same route, which matters
  because `orsClient` caches by coordinate list with no eviction — and *internally consistent by
  construction*: `summary.distance` is the haversine length of the geometry it ships, `ascent`
  and `descent` are that geometry's summed deltas, and the steepness bands are run-length encoded
  from its real gradients. A hand-written fixture gets one of those three wrong and the panel
  contradicts its own chart. Elevation comes from inverse-distance weighting over 55 surveyed
  anchor points, so Gudauri reads 2 231 m against a true 2 200 and Batumi reads 4 m against 5.
  Pins in the Black Sea or outside the country return a 404 `{code: 'no_route'}`, which is a
  real state the UI has copy for.

- **`demo/nominatim.js`** answers the geocoder from a bundled Georgian gazetteer, in whichever
  of the three languages the UI is set to. Serving it locally is not merely convenient:
  Nominatim's usage policy forbids exactly this shape of traffic, so a demo that called the real
  service would be both rude and, once rate-limited, broken.

- **Map tiles are the one deliberate exception** to no-network. A logistics product without a
  real map underneath the pins is not the product. Everything else — routing, geocoding, pin
  images — is in the bundle.

## The artwork is drawn, not photographed

A demo cannot ship photographs of trucks that do not exist, and a gallery of grey placeholder
boxes reads as broken rather than as unfinished. So every image under `public/media/` is a
generated SVG: six vehicle silhouettes drawn to match the machines they represent (a Liebherr
LTM 1050 gets a boom, a MAN mixer gets a drum), each labelled with its plate; job-site scenes
for the order photos; initial-based avatars; the wordmark, favicon and OG card. Contract
downloads are real, valid, single-page PDFs, because the UI links to them with `<a download>`
and a missing file there is a dead link rather than a fallback.

They are drawings and they look like drawings. That is the honest choice: better a demo that
is obviously illustrated than one pretending to photographs it does not have.

## Deliberately not reproduced

| | |
|---|---|
| Email | There is no inbox in a browser tab. Verification and reset codes are returned in the response and logged to the console, and the flows they exist to demonstrate work end to end. |
| Password hashing | Compared in plain text against the seed row. There is nothing to protect: the "server" is a function call in the same tab, and the banner will sign you in as an admin on request. |
| `POST /orders/<id>/upload/`, `reset-password/`, `mark-verified/` | Registered but dead — no caller exists for them anywhere in the front end. |
| The SEO hydration script | Upstream, an inline script fetches admin-managed SEO settings and patches the meta tags before the bundle loads. It runs before any JavaScript the mock could answer from, so the demo ships the static tags it falls back to. The admin screen that edits those values still works. |
| Django's admin, the migrations, the deploy | Not part of the front end, so not part of the port. |

**One divergence worth naming.** Upstream, the analytics chart axes bind `dataKey="name"`
straight onto a `{en, ka, ru}` JSONField, and that page carries no localiser — so those labels
render `[object Object]` in the real product too. The mock returns a localised string instead.
That is the mock choosing to be readable rather than bug-compatible, and it is the only place it
does so.

## Layout

```
src/demo/
  schema.md      the contract: 24 tables, id bands, cross-table invariants
  seed/*.json    raw rows — 428 of them
  store.js       the in-memory tables, date rebasing, id allocation, resetStore()
  router.js      route table, dispatch, latency, the role gate, DemoApiError
  query.js       search, filters, date ranges, ordering, the DRF page envelope
  serialize.js   shared computed fields
  handlers/      auth · orders · catalog · pricing · site · analytics
  routing.js     the deterministic HGV route synthesiser
  nominatim.js   the geocoder and its gazetteer
  geolocation.js a fixed Tbilisi fix, so no permission prompt lands on the map
  markers.js     Leaflet pin images, bundled
  auth.js        JWT-shaped stateless tokens
  base.js        base-path helpers
  accounts.js    the two advertised demo accounts
src/components/demo/DemoBanner.js   the only chrome that is not the product
```

The bundle is 3.6 MB across 44 chunks, route-split so the landing page does not pay for the
admin console. The entry chunk is the heavy one at 200 KB gzipped, because it carries the whole
fake backend — every handler and all 372 KB of seed — and Ant Design is another 406 KB gzipped
on any route that renders a control.
