# Printomato Console — live demo

The operator console from the Printomato project, running with its backend cut off.

Upstream it is a React SPA that Django serves at `/app/`, talking to a session-authenticated
API at `/api/admin/` and to Channels over two WebSockets. Here the same bundle talks to an
in-browser mock of that API: seed JSON compiled into the build, an in-memory store, and a
router that answers the same paths with the same payloads. No server, no database, no network
request of any kind.

The store boots **signed in**, so the demo opens on the dashboard. Sign out and the real login
page appears with the only account that exists pre-filled: **`demo` / `printomato-demo`**.

## What changed, exactly

The console is a port, not a rewrite. Of the 35 files under `src/` that come from upstream,
26 are byte-identical and 9 differ:

| File | Change |
|---|---|
| `lib/api.ts` | Rewritten. Identical public surface; `dispatch()` into the mock where `fetch()` used to go. |
| `lib/bootstrap.ts` | Derives its config from `import.meta.env.BASE_URL` instead of the `window.__PRINTOMATO__` blob the Django template injected. |
| `lib/socket.ts` | `useSocket(path, {enabled, onMessage})` keeps its signature and its `{state, send}`, and subscribes to an in-process bus instead of opening a socket. |
| `App.tsx` | Picks `BrowserRouter` or `HashRouter` off `__DEMO_ROUTER__`, and mounts `DemoBanner`. |
| `pages/LoginPage.tsx` | Pre-fills the demo account and names it under the form — nobody can guess credentials that live in a seed file. |
| `components/layout/AppShell.tsx` | Dropped the "Classic interface" link to Django's server-rendered pages. There are none here. |
| `types.ts` | `BootstrapPayload` lost its four server-only fields; the `window.__PRINTOMATO__` declaration went with them. |
| `styles/theme.css` | The `@theme` block moved out to `@portfolio/brand/tokens.css`, shared with the portfolio site. Base layer and composites are untouched. |
| `i18n/locales/en.json` | Added `demo.*`; dropped `nav.legacy`. |

Plus two additions that are wholly new: `src/demo/` (the mock) and
`src/components/demo/DemoBanner.tsx` (the "this is a demo" chrome).

No page, no component and no query hook knows the backend is gone. That is the point: the
front end is the portfolio piece, so it stays the thing that actually shipped, and a fix made
upstream can be brought over by copying the file.

## The seam

```
pages/ + components/          22 files. Unchanged.
        │   useDevices(), useUpdateCampaign(), useDashboard() …
        ▼
lib/queries.ts                Unchanged. 23 TanStack Query hooks — cache keys and invalidation.
        │   api.get('/devices/', { presence: 'online' })
        ▼
lib/api.ts                    Rewritten. ApiError, request(), download(), csrfToken().
        │   dispatch('GET', '/api/admin/devices/', { params })
        ▼
demo/router.ts                Route table, path captures, simulated latency, the auth gate,
        │                     and DemoApiError as the only way to fail.
        ▼
demo/handlers/                auth.ts · fleet.ts · records.ts — ports of the DRF views.
        │   query.ts filters, orders and pages · serialize.ts computes the derived fields
        ▼
demo/store.ts                 Plain arrays in memory. The demo's database.
```

The live channel runs beside it and writes to the same store, which is what keeps it honest —
a print that only lit up a toast would be a lie:

```
AppShell.tsx  →  lib/socket.ts  →  demo/live.ts  →  store   (a photo row, a sheet of paper)
```

Failure crosses the seam unchanged. A handler throws `DemoApiError`; `lib/api.ts` re-dresses it
as the `ApiError` the console already understands; the `fieldErrors` on a 400 land under the
right input in forms that were already rendering them, with DRF's and Django's own wording. A
401 still redirects to `/login?next=…`.

## Running it

| Command | |
|---|---|
| `npm run dev:printomato` | Vite dev server at <http://localhost:5174/demos/printomato/> |
| `npm --workspace @demos/printomato run build` | `tsc -b --noEmit`, then `vite build` into `demos/printomato/dist/` |
| `npm --workspace @demos/printomato run typecheck` | TypeScript strict, `noUnusedLocals` and `noUnusedParameters` on |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root; the workspace is installed by the root `npm install`.
`VITE_BASE` (default `/demos/printomato/`) and `VITE_ROUTER=hash` are the two build-time knobs —
see the [root README](../../README.md).

## What the mock reproduces

33 handlers under the virtual prefix `/api/admin`, matched *after* that prefix and keeping
DRF's trailing slashes, because that is the path the console asks for. Reads answer in
90–260 ms and writes in 140–340 ms, which is what makes spinners, optimistic updates and
stale-while-revalidate visible instead of theoretical.

**Auth, options, dashboard** — `demo/handlers/auth.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/csrf/` | A no-op. `LoginPage` primes the cookie before its first POST, and a 404 there would look like a broken demo. |
| GET | `/auth/session/` | `SessionUser`, or 401 while signed out. |
| POST | `/auth/login/` | Checked against the seed row. Wrong credentials → 400 `{detail: 'Incorrect username or password.'}` — a detail, not a field error, exactly as a failed `authenticate()` reads. |
| POST | `/auth/logout/` | |
| GET · PATCH | `/auth/profile/` | Partial update with DRF's field errors: username pattern, email shape, max lengths. |
| POST | `/auth/password/` | Django's own validator messages. The new password is real for the rest of the session — the next sign-in checks against it. |
| GET | `/options/` | Device and campaign refs plus the enum choice lists. |
| GET | `/dashboard/?days=` | `days` clamped to 7…90, junk → 14. Analytics counters, a zero-filled daily print series, the devices attached to a campaign, running campaigns by end time, the 12 newest open alerts. |

**Fleet** — `demo/handlers/fleet.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/devices/` | Unpaginated, as upstream. `search`, `campaign`, `presence`, `mode`, `state`; online first, then natural name order, so PM-2 precedes PM-10. |
| GET · POST · PATCH · PUT · DELETE | `/devices/`, `/devices/{id}/` | Validation runs on the *merged* row, so a PATCH of one field cannot fail on an untouched one. Delete cascades alerts and payment sessions and `SET_NULL`s the photos, which is the promise the delete dialog makes. |
| POST | `/devices/{id}/command/` | `delivered` is the device's presence at the moment the command was accepted. `restart` on an online kiosk drops it off the fleet and brings it back ~4 s later, on the fleet socket. |
| GET | `/campaigns/` | 24 per page. `search`, `state`, `device`. Active first, then upcoming, then expired, newest of each. |
| POST · PATCH · PUT · DELETE | `/campaigns/`, `/campaigns/{id}/` | Bodies arrive as `FormData` because the existing form posts multipart. An uploaded image becomes an object URL, so the preview really renders; it is revoked when the field is replaced or the campaign deleted. Delete detaches the devices and cascades photos and alerts. |

**Records** — `demo/handlers/records.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/photos/` | 60 per page, newest first. `device` (pk **or** slug), `campaign`, `date_from`, `date_to`, `search`. |
| DELETE · POST | `/photos/{id}/`, `/photos/bulk-delete/` | |
| POST · GET | `/photos/download/`, `/photos/download-all/` | A real ZIP, built in the tab by `demo/zip.ts` — same entry names and same `<prefix>_<stamp>_<n>photos.zip` filename as the Django download. |
| GET · PATCH | `/notifications/`, `/notifications/{id}/` | 50 per page. `device`, `campaign`, `date_from`, `date_to`, `status`. Only `status` is writable. |
| GET · POST | `/notifications/unread-count/`, `/notifications/mark-all-read/` | |
| GET | `/payment-sessions/` | 50 per page. `device`, `status`, `date_from`, `date_to`, `search`; `ordering` over `created_at`, `updated_at`, `amount`, `status`, default `-created_at`. |
| GET | `/payment-sessions/summary/` | Totals, revenue and success rate over exactly the filters the list is showing. |

Every paginated route returns DRF's envelope — `{count, num_pages, page, page_size, has_next,
has_previous, results}` — `page_size` caps at 200, and a page past the last one is a 404
`{detail: 'Invalid page.'}`, the way `InvalidPage` surfaces. A path that matches with the wrong
verb is a 405; the write routes Django refuses (creating a photo or an alert from the console)
are simply never registered.

## The store

`demo/seed/*.json` holds raw rows — not API payloads. Computed fields belong to `serialize.ts`,
and URLs are built there too, so the seed survives a change of base path.

| Table | Rows |
|---|---|
| `devices` | 10 across Georgian venues. 6 online, 9 active, 7 paid; paper levels land in all three states, so the meters differ. |
| `campaigns` | 6 — at least one active, one upcoming, one expired, one default. |
| `photos` | 162 rows over the 98 JPEGs in `public/media/photos/` (rows reuse files). Nothing points at a file that is not there. |
| `notifications` | 14, six of them unread so the badge shows. |
| `payments` | 95 — 81 succeeded, 9 rejected, 5 started, in Georgian lari. |
| `user` | 1. |

The store is a `structuredClone` of that seed, held for the life of the tab. No demo data is
written to `localStorage`, `sessionStorage` or IndexedDB; the only thing that survives a reload
is the i18n language preference, which is upstream behaviour and stays. So every visitor gets an
identical, un-vandalised fleet, and the **Reset demo** button in the corner (`resetStore()` plus
`queryClient.clear()`) is a reload without the round trip.

Writes are real against that copy: ids continue from the seed's highest and are never reused,
deletes cascade the way `models.py` says they do, and an edit invalidates through the existing
query keys because `queries.ts` never changed.

### Date rebasing

A seed with absolute timestamps goes stale the day after it is written: nothing printed today,
an empty activity chart, every campaign expired. So at construction the store finds the newest
photo, measures the whole-day distance from its date to today, and shifts **every** timestamp by
that offset — photos, alerts, payment sessions, campaign windows, last login. Whole days only,
so the seed's mornings stay mornings.

A uniform shift preserves the spread between campaigns but not necessarily the *mix* of states,
so one pass afterwards nudges a window per missing state, borrowing only from a state that has
one to spare. Active, upcoming and expired all survive, whenever the demo is opened.

Day boundaries are drawn in `Asia/Tbilisi` — the zone Django ran in and the zone `lib/format.ts`
prints in — not the visitor's. Bucketing locally would let a console opened in Auckland report
"printed today: 4" over an archive whose newest nine rows all read today's date.

## The fleet keeps moving

`demo/live.ts` plays the part of the Channels layer: the payloads are the ones `core/consumers.py`
pushed, and each one also changes the store, so the queries `AppShell` invalidates come back with
something new in them.

| Channel | Event | Every | What it does to the store |
|---|---|---|---|
| `/ws/fleet/` | `device.print` | 12–25 s | Adds a photo row on an online kiosk, takes a sheet of paper, spends one of the campaign's prints. The image is one of the 98 bundled files — the demo cannot invent a 99th. |
| `/ws/fleet/` | `device.presence` | 45–90 s | Flips one active kiosk. Recovery is favoured over dropouts, otherwise a long session drifts into a fleet that is entirely dark. |
| `/ws/notifications/` | alert | ~2 min | Inserts an unread notification from an online kiosk and raises the toast `AppShell` expects. |
| `/ws/fleet/` | `device.presence` | on command | A `restart` the operator sends: off the fleet, then back ~4 s later. |

The scheduler runs only while something is subscribed, pauses whenever `document.hidden`, and
leaves no timer behind. `useSocket` still reports `connecting` for 500 ms before `open`, because
the live indicator in the header is built to show a handshake and going straight to green would
read as a painted-on badge.

## Deliberately not reproduced

| | |
|---|---|
| The device-facing API (`/api/photos/`, `/api/devices/{id}/`, `/api/payment/*`) | Nothing here is a kiosk. Prints arrive from `demo/live.ts` instead. |
| Channels, Redis, real WebSockets | An in-process bus with a fake handshake. Nothing reconnects because nothing can drop. |
| The KEEPZ payment flow | The ledger is history to read, filter and total. No session is created and no money moves. |
| Authentication as a security property | The password is compared in plain text against a seed row and `csrfToken()` returns the literal `'demo'`. There is no session and nothing to forge: the "server" is a function call in the same tab. |
| Persistence of any kind | Reload is the reset. That is a product decision, not a missing feature. |
| Photo upload and thumbnailing | A live print reuses a bundled JPEG; Pillow does not run in a browser. |
| Django's admin, the drf-spectacular schema, the 96-test suite, the legacy server-rendered pages | Not part of the front end, so not part of the port. |

One deliberate exception to "no network requests": the ZIP download `fetch()`es the bundle's own
JPEGs from the origin that served the page. The alternative is reading the bytes back out of an
`<img>`, which re-encodes them. Nothing leaves the origin, and nothing runs unless someone
clicks Download.

## Layout

```
src/demo/
  seed/*.json    raw rows — devices, campaigns, photos, notifications, payments, user
  store.ts       the in-memory tables, date rebasing, id allocation, resetStore()
  query.ts       search, relation filters, date ranges, ordering, pagination   (filters.py + pagination.py)
  serialize.ts   the computed fields: paper state, campaign progress, natural sort   (serializers.py)
  router.ts      route table, dispatch, latency, DemoApiError
  handlers/      auth.ts · fleet.ts · records.ts — the viewsets
  zip.ts         STORE-method ZIP writer                                        (services.py)
  live.ts        the event bus behind /ws/fleet/ and /ws/notifications/
```

First load is about 132 KB gzipped (JS plus CSS) including the seed; every route past the
dashboard is code-split. The media folder is 7.4 MB and dominates the deployed bundle —
thumbnails are `loading="lazy"`, so a visitor pays for the ones they scroll to.
