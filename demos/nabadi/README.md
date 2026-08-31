# Nabadi Barbershop — live demo

A barbershop booking platform, running with its backend cut off.

Upstream it is a Django 5 + DRF application on Postgres — 11 apps, 18 models, JWT in HttpOnly
cookies, Celery for the reminder SMS — with **two** React 19 front ends on top of it: the
customer site and the staff console, deployed separately and meeting only through the API.

Here they share a bundle, and the API they meet through is an in-browser mock: seed JSON
compiled into the build, an in-memory store, and a router that answers the same paths with the
same payloads. No server, no database, and no network request of any kind.

That merge is the point. Book a chair on the site, sign in as the administrator, and the
booking is sitting in the console's list — because there is only one store, and both apps are
reading it.

| | |
|---|---|
| **The site** | `/demos/nabadi/` — landing page, services, barbers, the four-step booking wizard, your own appointments |
| **The console** | `/demos/nabadi/admin/` — the day's chairs, walk-ins, customers, catalogue, hours, time off, promotions, reviews, analytics, audit |

The demo opens **signed out**, on the customer site, because that is the product's real front
door. The banner in the corner signs you in as either of the two accounts it offers — nobody
can guess credentials that live in a seed file:

| Role | Phone | Password |
|---|---|---|
| **Customer** | `+995555100001` | `nabadi-demo` |
| **Administrator** | `+995555300002` | `nabadi-demo` |

Two buttons is the whole cast. `admin` is the only role the console admits and `customer` is
the only role the site has, so there is no third account worth offering. The seed does carry
more staff rows than the banner shows — a second admin (`+995555300001`) and four barbers — but
signing in as a barber only demonstrates the gate: every non-admin session lands on
`/unauthorized`. A `barber` role survives as a **data tag** on the user rows behind the
`barbers` table, which is what keeps a barber off the Customers list without handing anyone a
console login.

## The brand is fictional

The original is a real shop. Everything that identifies it — name, logo, domain, Facebook page,
address, phone number, and every person in the seed — has been replaced. **Nabadi is invented**:
a *nabadi* (ნაბადი) is the Georgian felt shepherd's cloak, which is also what a barber drapes
over you.

What is kept is Tbilisi as the city, the Georgian/English interface, and the caramel-and-oat
palette. The bilingual work and the design system are the engineering worth showing, and
neither identifies a particular barbershop.

## What changed, exactly

The front ends are a port, not a rewrite.

| File | Change |
|---|---|
| `customer/lib/api.ts`, `admin/lib/api.ts` | Rewritten. Identical public surface — `api.get/post/patch/delete`, `postMultipart`, `apiDownload`, `ApiError{status, code, message, field}` — with `dispatch()` into the mock where `fetch()` used to go. The console's silent-refresh-then-retry on a 401 is reproduced, because it is behaviour the UI depends on. |
| `customer/App.tsx` | Three lines: the router is picked off `__DEMO_ROUTER__` and given a `basename`. The route table is verbatim upstream — that is what the basename buys. |
| `admin/App.tsx`, `admin/features/admin/Sidebar.tsx` | The same `__DEMO_ROUTER__` swap, and then the role collapse. Upstream's `AdminRoute` carries `roles` and `feature` props and the sidebar filters every item by both; here `admin` is the only console role, so the props, the `/permissions` screen and the barber's `/my/*` screens are gone and a route is `RequireStaff` plus the layout. |
| `customer/components/Logo.tsx`, `admin/components/Logo.tsx` | The mark is a drawn SVG for the invented brand, addressed through `import.meta.env.BASE_URL` instead of a root-absolute `/brand/logo.png` that would 404 under a sub-path. Each keeps its own size scale. |
| `admin/lib/site.ts` | `SITE_URL` is the other surface of this bundle rather than an env var pointing at a second dev server. |
| `admin/lib/i18n.ts` | Creates its own i18next instance instead of configuring the shared singleton, which the site also configures. Opens in EN. |
| `customer/lib/i18n.ts` | Opens in EN. |
| `admin/index.css` | Deleted. It was a strict subset of the site's — same `@theme`, same tokens, two comments apart — and two `@import 'tailwindcss'` in one bundle is two copies of the utility layer. |
| the locale files | The brand rename, and the new `demo.*` keys. |

Of the 167 files ported from the two apps, **125 are byte-identical** and 42 differ. Twelve of
the 42 are locale files carrying the brand rename and the new `demo.*` keys, nine are the port
itself (the table above), and the remaining 21 are the role collapse — this demo admits one
staff role where upstream has three, so every gate, comment and dropdown that named the other
two had to go. No page, no component and no query hook knows the backend is gone. That is the point: the front end is the
portfolio piece, so it stays the thing that actually shipped, and a fix made upstream can still
be brought over by copying the file.

Plus what is wholly new: `src/demo/` (the mock), `src/components/demo/DemoBanner.tsx` (the
"this is a demo" chrome), and the small shell that mounts two apps in one page —
`src/main.tsx`, `src/surface.ts`, `src/i18n-bridge.ts` and the two entry files.

## Two apps in one bundle

Upstream these are separate deployments. Merging them is what makes the demo worth clicking
through, and it costs four small pieces of machinery:

```
index.html
   └── src/main.tsx            one React root. Reads the path, picks a surface.
        │                      Surfaces load through import.meta.glob, so the console's
        │                      16k lines never reach a visitor who only books a haircut.
        ├── customer-entry.tsx   QueryClient + i18n + <App/> + banner
        └── admin-entry.tsx      QueryClient + i18n + ToastProvider + <App/> + banner
                │
        src/surface.ts          which surface, on what basename, and how to cross between
                │               them with pushState — a page load would reset the store,
                │               which is the one thing this demo cannot afford
                ▼
        src/demo/               ONE store, read by both
```

Four collisions had to be resolved, and each is worth naming because they are what "two apps,
one page" actually costs:

- **`@/` means two different trees.** 216 imports in the site and 470 in the console resolve
  `@/lib/api` to two different files. A single Vite alias cannot do that — it never sees who is
  asking — so `vite.config.ts` resolves `@/` in a `resolveId` hook, where the importer's own
  path decides. That is what keeps 125 ported files byte-identical instead of rewriting 686
  import statements and making every future diff against the real apps useless. TypeScript gets
  the same treatment as two projects, one per tree.
- **Routes.** Both apps declare `/`, `/login`, `/services`, `/barbers`, `/barbers/:id`,
  `/profile` and `*`. Two routers on two basenames, mounted one at a time, so neither has to
  give any of them up.
- **i18n.** Both call `init()` on the default `i18next` singleton; the second would erase the
  first's namespaces. The console gets its own instance, both surfaces provide theirs
  explicitly, and `i18n-bridge.ts` relays a language change so the other surface is already
  correct when you cross to it.
- **React itself.** The other two demos in this repo are on React 18, so npm hoists 18 to the
  root and nests 19 here — and anything that hoists with it, Radix included, would resolve
  `react` by walking up out of this workspace. Two React runtimes in one page means every hook
  throws. `resolve.dedupe` and a `paths` pin in both tsconfigs hold the line.

## The seam

```
pages/ + components/          71 files. Nine touched, the rest unchanged.
        │   api.get('/admin/bookings/?status=pending&page=2')
        ▼
lib/api.ts  × 2               Rewritten. The apps' own ApiError, the mock's guts.
        │   dispatch('GET', '/api/admin/bookings/', {params, body})
        ▼
demo/router.ts                Route table, path captures, simulated latency, the auth gate,
        │                     the role gate, and DemoApiError as the only way to fail.
        ▼
demo/handlers/                auth · public · barbers · bookings · admin-bookings ·
        │                     admin-catalog · admin-ops — ports of the DRF views
        │   query.ts filters, orders and pages · serialize.ts computes the derived fields
        ▼
demo/store.ts                 Plain arrays in memory. The demo's database.
```

Failure crosses the seam unchanged. A handler throws `DemoApiError`; `lib/api.ts` re-dresses it
as the `ApiError` both apps already understand; a `slot_taken` still arrives as a 409 with the
code the booking wizard has copy for, and a customer deep-linking into the console still gets a
403 and the Unauthorized page.

## Running it

| Command | |
|---|---|
| `npm run dev:nabadi` | Vite dev server at <http://localhost:5176/demos/nabadi/> |
| `npm --workspace @demos/nabadi run build` | typecheck, then `vite build` into `demos/nabadi/dist/` |
| `npm --workspace @demos/nabadi run typecheck` | four `tsc` projects: the mock (`strict`), then one per ported tree, then the config |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |
| `npm run preview` | Serves `dist/` the way a correct host would |

Run them from the repo root. `VITE_BASE` (default `/demos/nabadi/`) and `VITE_ROUTER=hash` are
the two build-time knobs — see the [root README](../../README.md). The console lives at
`<base>admin/`, and the demo's whole bundle is served from one `index.html`, so the repo's
existing `/demos/:demo/*` fallback rule covers its deep links with nothing added.

## What the mock reproduces

**93 routes**, matched after the `/api` prefix and keeping DRF's trailing slashes. Reads answer
in 90–260 ms and writes in 140–340 ms, which is what makes the spinners, the optimistic updates
and the stale-while-revalidate visible instead of theoretical.

`src/demo/routes.md` is the contract: every route with its owning module, its role gate, its
envelope and the query params it honours. It was derived from the call sites in both
ported apps and reconciled against the Django URLconf, so a route the front end never calls is
not registered — and the file says which those are, and why.

| Module | Routes | Covers |
|---|---|---|
| `handlers/auth.ts` | 9 | Register, login, the session probe, profile, password change, and the code-based forgot/reset pair with its attempt limit and TTL. |
| `handlers/public.ts` | 2 | `GET /services/` and `GET /landing/` — the customer site's whole read API, including the drop-an-empty-category rule and the PII-reduced featured reviews. |
| `handlers/barbers.ts` | 3 | The barber list, the availability slots and the calendar's day summary — all three public, because the booking wizard asks before anyone signs in. |
| `handlers/bookings.ts` | 4 | The customer's own bookings: create, list, stats and cancel — every one of them through the shared availability engine. Staff drive a booking's lifecycle from `/admin/bookings/` instead. |
| `handlers/admin-bookings.ts` | 17 | The console's bookings, customers and users, staff-side create and reschedule, and two XLSX exports. |
| `handlers/admin-catalog.ts` | 32 | Services, categories, barbers, working hours, shop hours, time off — plus the two multipart uploads. |
| `handlers/admin-ops.ts` | 26 | Promotions, review moderation, the audit log, analytics computed over the live store, site settings, the CMS and the notification templates. |

Every paginated route returns DRF's `{count, next, previous, results}` with a **real, walkable
`next` URL** — `admin/lib/paginated.ts` loops until `next` is null, so a hard-coded null would
silently truncate nine lists at 25 rows with no error anywhere.

The three XLSX exports are genuine workbooks, not a CSV wearing an `.xlsx` name: `demo/zip.ts`
writes the archive and `demo/xlsx.ts` the OOXML parts, by hand, with no new dependency. A
formula-leading cell is written with `quotePrefix` so no spreadsheet is handed an injection.

### The availability engine

One module, `demo/availability.ts`, answers "when can this barber do this service", and three
handler modules call it: the customer's calendar, the console's day view, and the write path
that validates a booking. That is not tidiness — if the read side and the write side disagree by
one minute, the wizard offers a slot the POST refuses, which is the most confusing failure this
product has. A sweep over 14 days × 4 barbers × 3 services offered **0 slots that the write path
then refused**.

## The store

`demo/seed/*.json` holds raw rows, not API payloads. Computed fields belong to `serialize.ts`
and media URLs are built at read time, so the seed survives a change of base path.
**349 rows across 17 tables**, plus the CMS singleton.

| Table | Rows | | Table | Rows |
|---|---|---|---|---|
| `bookings` | 76 — four pages of 25 | | `audit_logs` | 46 |
| `notification_logs` | 41 | | `barber_services` | 40 |
| `users` | 38 | | `working_hours` | 23 |
| `notification_templates` | 16 | | `reviews` | 15 — 8 published, 7 not |
| `services` | 10 in 4 categories | | `site_settings` | 10 |
| `time_off` | 8 — 2 shop-wide | | `specialties` | 8 |
| `shop_hours` | 6 | | `barbers` | 4 |
| `service_categories` | 4 | | `promotions` | 3 |

The seed is deliberately richer than the upstream `seed_demo` command, which was written to
bootstrap a developer's database rather than to fill a showcase. It has no walk-ins, no
no-shows, no audit rows and no unpublished reviews — so upstream's own seed leaves the console's
audit page, its moderation queue and its no-show KPI empty, and an empty screen reads as broken.
This one carries all five booking statuses (45 completed, 11 confirmed, 7 pending, 7 cancelled,
6 no-show), 11 walk-ins, a promotion sitting at 4 of its 5 uses, and reviews still waiting to be
moderated.

`validateSeed()` checks eleven cross-table invariants and the per-table id bands at
construction, under `import.meta.env.DEV`. Each table has a disjoint id band — Postgres starts
every sequence at 1, so a stray `service_id` would otherwise resolve silently against the barber
table.

### Date rebasing

A seed with absolute timestamps goes stale the day after it is written: nothing booked today, an
empty dashboard, every appointment in the past. So at construction the store measures the
whole-day distance from the newest booking to today and shifts every timestamp by it — whole
days only, so the seed's mornings stay mornings — then squeezes anything landing after "now"
back into the elapsed part of today, because nothing in an archive may be newer than the moment
it is read. Day boundaries are drawn in `Asia/Tbilisi`, the zone Django ran in, not the
visitor's.

Because the shift is by whole days the weekday drifts, so every active booking is authored
inside the window its barber works on *every* weekday — otherwise a Wednesday appointment lands
on a Saturday the barber does not work, and the console shows a booking outside its own
availability.

One upstream detail deliberately not reproduced: `seed_demo` builds its times off a UTC instant,
so its bookings land at 14:00–22:00 Tbilisi and several fall outside the 10:00–20:00 shop
window. The seed exists to fill a showcase, not to reproduce a bug.

## Deliberately not reproduced

| | |
|---|---|
| SMS and email | There is no inbox in a browser tab. The reset code is returned through the console line, exactly as the project's own `ConsoleSMSProvider` stand-in does, and the flows it exists to demonstrate work end to end. The notification log records what would have been sent. |
| Password hashing | Compared in plain text against the seed row. There is nothing to protect: the "server" is a function call in the same tab, and the banner will sign you in as an admin on request. |
| CSRF | The seam still reads the cookie and sends the header, because that code is the seam and stays shaped like the original — but nothing checks it. There is no cross-origin request to forge when the server is a function call. |
| Rate limiting | The real backend nulls all four throttle rates outside production, so `429` is not a state this demo can reach, and the mock does not invent one. |
| Celery | The hourly sweep that closes yesterday's unfinished appointments runs on every dispatch instead. Without it, a booking you make can never reach `completed`, and review eligibility would be unreachable for anything you booked. |
| The Google Maps embed | A live iframe is a network request, and the rule is that there are none. `map_embed_url` seeds empty and both pages take the fallback they were already designed to have. |
| Django admin, the migrations, the deploy | Not part of the front end, so not part of the port. |

Three pieces of browser storage survive, all upstream behaviour rather than demo data: the
booking wizard's in-progress selection, and two console UI preferences (the collapsed sidebar,
the bookings list/calendar view). The language choice deliberately does **not** persist — see
the comment in `customer/lib/i18n.ts` — so the demo always opens in its default language. No
seeded row is ever written to storage — a reload restores the pristine shop and signs you out.

## The artwork is drawn, not photographed

A demo of an invented barbershop cannot ship photographs of barbers who do not exist, and a
gallery of grey placeholder boxes reads as broken rather than as unfinished. So all **27 images**
under `public/` are hand-authored SVG: the cape wordmark and its favicon, ten service
still-lifes, four barber portraits drawn to match the people in the seed, the shop interior, six
gallery corners and the about-page scene.

They obey the same rules the product does — no gradients, no blur, 1px lines, and the caramel
accent never more than a few percent of any drawing — and they are drawings that look like
drawings. That is the honest choice: better a demo that is obviously illustrated than one
pretending to photographs it does not have.
