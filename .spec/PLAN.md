# Portfolio build spec

Single source of truth for the agents building this repo. Read it fully before writing code.

**Repo being built:** `/Users/gela/Desktop/Projects/portfolio`
**Reference source (read-only, never edit):** `/Users/gela/Desktop/Projects/printomatoDjango`
— the Django API this mock reproduces lives in `core/admin_api/` (`views.py`, `serializers.py`,
`filters.py`, `pagination.py`, `services.py`) and `core/models.py`. When this spec and that code
disagree, the code wins; say so in your report.

## 1. What this repo is

A **business portfolio site** plus the **live product demos** it links to. Every demo is a
static bundle with **no backend of any kind**: no server, no database, no network calls.
Data comes from JSON seed files compiled into the bundle and served out of an in-browser
mock API.

The first demo is **Printomato** — a real Django + React fleet console for photo-printing
kiosks, ported here so a visitor can click through the whole product. A second project will
be added later as a sibling under `demos/`, so everything shared must live in
`packages/brand` or `scripts/`, never inside a demo.

### Non-negotiables

| Rule | Why |
|---|---|
| **No network requests.** No `fetch` to any origin, no WebSocket, no analytics, no CDN JS. | The demo must work offline, inside an iframe, and on any static host. Google Fonts via `<link>` in `index.html` is the one allowed exception, already present. |
| **Session-only state.** Demo data lives in memory. A page reload restores the pristine seed. | The user chose this: every visitor gets an identical, un-vandalised demo. Do **not** persist demo data to `localStorage`/`sessionStorage`/IndexedDB. (`localStorage` for the i18n language preference is pre-existing and stays.) |
| **The React app is a port, not a rewrite.** Pages, components, hooks, styles and copy stay as they are. | It is the portfolio piece. Only the transport layer under `src/lib/` changes, plus the new `src/demo/` folder. |
| **Host-agnostic build.** Base path is a build-time env var; SPA-fallback configs ship for every common host. | Hosting is not decided yet. |
| **TypeScript strict, zero new runtime dependencies.** `noUnusedLocals` and `noUnusedParameters` are on. | Matches the source project's bar; keeps the bundle honest. |

## 2. Repo layout

Already created (do not re-scaffold):

```
portfolio/
├── package.json                  npm workspaces: packages/*, site, demos/*
├── .gitignore
├── .spec/
│   ├── PLAN.md                   this file
│   └── media-manifest.json       ground truth for the 98 demo photos (see §7)
├── packages/brand/
│   ├── package.json              exports ./tokens.css and ./assets/*
│   ├── tokens.css                the @theme block: colours, type, radii, shadows, motion
│   └── assets/                   logo-light.png, logo-icon.png, favicon.png
├── site/                         portfolio shell — an agent owns this whole folder
├── demos/printomato/
│   ├── package.json              @demos/printomato
│   ├── vite.config.ts            base = VITE_BASE ?? '/demos/printomato/'
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── favicon.png
│   │   └── media/
│   │       ├── photos/*.jpg          98 files, flat, unique basenames
│   │       ├── thumbnails/*_thumb.jpg 98 files, flat
│   │       └── campaigns/*.jpg        5 files: <campaign-slug>.jpg
│   └── src/                      the ported console (see §3)
├── scripts/                      build-all.mjs, preview.mjs
└── deploy/                       per-host SPA fallback configs
```

## 3. The seam: how the port works

The console's data layer is already cleanly separated, which is why this port is small:

```
pages/ + components/     ← UNCHANGED
        ↓
lib/queries.ts           ← UNCHANGED (TanStack Query hooks, cache keys, invalidation)
        ↓
lib/api.ts               ← REWRITTEN: same exports, routes to the mock instead of fetch()
        ↓
demo/                    ← NEW: in-memory store + request router + handlers
```

`lib/api.ts` must keep its **exact public surface** so nothing upstream changes:

```ts
export class ApiError extends Error { status; fieldErrors; fieldError(name): string | undefined }
export type FieldErrors = Record<string, string[]>
export interface RequestOptions { method?; body?; params?; signal?; allowUnauthenticated? }
export function csrfToken(): string
export function toAppRelative(pathname: string): string
export function request<T>(path: string, options?: RequestOptions): Promise<T>
export const api = { get, post, patch, put, delete }
export async function download(path, options?): Promise<number>
```

Error semantics carry over unchanged: a handler rejecting with status `< 500` must produce an
`ApiError` whose `fieldErrors` drives the inline form errors the existing forms already render,
and a 401 still redirects to the login route.

`lib/socket.ts` keeps its `useSocket(path, { enabled, onMessage })` signature and its
`{ state, send }` return, but subscribes to the in-process demo event bus instead of opening a
WebSocket. `AppShell.tsx` must not need an edit.

`lib/bootstrap.ts` no longer reads `window.__PRINTOMATO__`. It derives everything from
`import.meta.env.BASE_URL`:

```ts
apiBase: '/api/admin'            // a virtual prefix the mock router matches on
appBase: import.meta.env.BASE_URL.replace(/\/$/, '')   // '' when served at '/'
mediaUrl: import.meta.env.BASE_URL + 'media/'
logoUrl:  new URL('@portfolio/brand/assets/logo-light.png', import.meta.url).href  // or a src/assets import
timeZone: 'Asia/Tbilisi'
```

`App.tsx` changes in exactly one way: pick `BrowserRouter` or `HashRouter` from
`__DEMO_ROUTER__` (declared in `src/vite-env.d.ts`, injected by `vite.config.ts`), with
`basename={APP_BASE}` only on the browser router.

## 4. Module map — file ownership

Every agent writes only the files listed against its task. Do not edit another agent's files;
if you need something from one, code against the interface documented here.

| Path | Contents |
|---|---|
| `src/demo/seed/*.json` | Seed data: devices, campaigns, photos, notifications, payments, user |
| `src/demo/store.ts` | In-memory store built from the seed, date rebasing, id allocation, `resetStore()` |
| `src/demo/query.ts` | Filter/search/date-range/ordering/pagination helpers mirroring `admin_api/filters.py` + `pagination.py` |
| `src/demo/serialize.ts` | Computed-field logic mirroring `admin_api/serializers.py` (§6) |
| `src/demo/router.ts` | Route table + dispatch + `registerHandlers()`; latency simulation; `ApiError`-shaped rejections |
| `src/demo/handlers/auth.ts` | `/auth/*`, `/options/`, `/dashboard/` |
| `src/demo/handlers/fleet.ts` | `/devices/*`, `/campaigns/*` |
| `src/demo/handlers/records.ts` | `/photos/*`, `/notifications/*`, `/payment-sessions/*` |
| `src/demo/zip.ts` | Store-method (no compression) ZIP writer for the photo download |
| `src/demo/live.ts` | Event bus that fakes `/ws/fleet/` and `/ws/notifications/` traffic |
| `src/lib/api.ts` `src/lib/bootstrap.ts` `src/lib/socket.ts` `src/App.tsx` | Transport swap |
| `src/components/demo/DemoBanner.tsx` | The "this is a demo" chrome (§9) |

## 5. API contract

Base prefix `/api/admin`. Paths are matched **after** that prefix. Trailing slashes are part of
the path, exactly as DRF serves them.

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/session/` | 200 `SessionUser`, or 401 `{detail}` when signed out |
| POST | `/auth/login/` | `{username, password}` → 200 `SessionUser`; wrong creds → 400 `{detail: 'Incorrect username or password.'}` |
| POST | `/auth/logout/` | 200 `{detail}` |
| GET/PATCH | `/auth/profile/` | PATCH accepts `username, email, first_name, last_name` → `SessionUser` |
| POST | `/auth/password/` | `{old_password, new_password1, new_password2}`; mismatched → 400 field error on `new_password2`; wrong current → 400 on `old_password`; under 8 chars → 400 on `new_password1` |
| GET | `/dashboard/?days=` | `days` clamped to 7…90, default 14 → `Dashboard` |
| GET | `/options/` | `Options` |
| GET | `/devices/` | **unpaginated array**, filters: `search`, `campaign`, `presence=online\|offline`, `mode=paid\|free`, `state=active\|inactive`; sorted online-first then natural device name order |
| POST/PATCH/DELETE | `/devices/`, `/devices/{id}/` | Validation in §6 |
| POST | `/devices/{id}/command/` | `{command, payload?}` → `{device_id, command, is_online, delivered}`; `delivered` is the device's `is_online` |
| GET | `/campaigns/` | paginated, page_size 24; filters `search`, `state=active\|upcoming\|expired`, `device` |
| POST/PATCH/DELETE | `/campaigns/`, `/campaigns/{id}/` | Body arrives as `FormData` (the existing form sends multipart). `device_ids` may repeat; a single empty string means "detach all". Image fields arrive as `File` — see §8. |
| GET | `/photos/` | paginated, page_size 60; filters `device` (pk **or** `device_id` slug), `campaign`, `date_from`, `date_to`, `search`; ordered `-timestamp` |
| DELETE | `/photos/{id}/` | 204 |
| POST | `/photos/bulk-delete/` | `{ids}` → `{deleted}` |
| POST | `/photos/download/` | `{ids}` → zip blob |
| GET | `/photos/download-all/` | current filters → zip blob |
| GET | `/notifications/` | paginated, page_size 50; filters `device`, `campaign`, `date_from`, `date_to`, `status` (1/2/3); ordered `-timestamp` |
| PATCH | `/notifications/{id}/` | `{status}` → `AppNotification` |
| GET | `/notifications/unread-count/` | `{unread}` — status 2 |
| POST | `/notifications/mark-all-read/` | `{updated}` — status 2 → 1 |
| GET | `/payment-sessions/` | paginated, page_size 50; filters `device`, `status`, `date_from`, `date_to` (on `created_at`), `search`; `ordering` in `created_at\|updated_at\|amount\|status`, `-` prefix allowed, default `-created_at` |
| GET | `/payment-sessions/summary/` | `{total, succeeded, rejected, started, revenue, success_rate}` over the **same filters** |

Pagination envelope (every paginated endpoint):

```ts
{ count, num_pages, page, page_size, has_next, has_previous, results }
```

`page` and `page_size` come from query params; `page_size` caps at 200. A page beyond the last
one is a 404 `{detail: 'Invalid page.'}` in DRF — mirror that.

Enum labels: notification `message` 1 `Camera not found`, 2 `Printer not found`; `status`
1 `Read`, 2 `Unread`, 3 `Closed`. Payment status values `started`/`success`/`rejected` with
labels `Started`/`Success`/`Rejected`.

TypeScript shapes for every payload are already in `src/types.ts` — **the mock must satisfy
those types exactly**; do not edit `types.ts` except to drop the `window.__PRINTOMATO__`
declaration and adjust `BootstrapPayload` if a field is genuinely gone.

## 6. Computed fields (port these rules exactly)

**Device**
- `paper_percentage` = `paper_capacity ? round(min(paper_count / paper_capacity, 1) * 100) : 0`
- `paper_state` = `>= 60` healthy, `>= 25` warning, else critical
- `total_printed` = photos for that device; `printed_today` = those dated today
- `has_notifications` = has a notification with status != 3 (closed)
- Validation → 400 with field errors: `paper_count > paper_capacity` →
  `{paper_count: 'Paper count cannot exceed paper capacity'}`; negative price →
  `{photo_price: 'Photo price cannot be negative'}`; `requires_payment` true with no price →
  `{photo_price: 'A price is required when the device runs in paid mode'}`. Validate the
  **merged** value (submitted, else current, else the model default: `paper_capacity` 200) so a
  PATCH of one field cannot fail on an untouched one.
- Rounding note: `photo_price` is a decimal **string** on the wire (e.g. `"1.50"`).

**Campaign**
- `state`: `start_time > now` upcoming, `end_time < now` expired, else active
- `days_gone`: `` `${elapsedWholeDays}/${totalWholeDays}` `` (e.g. `"4/21"`), where both are
  whole days from the timestamp difference; when `totalWholeDays === 0` it is the literal `"1/1"`
- `days_gone_percentage`: `elapsedWholeDays / totalWholeDays * 100`, or `100` when
  `totalWholeDays === 0`, then clamped to 0…100 and rounded to one decimal
- `online_devices` / `total_devices` from the attached devices; `total_printed` from photos
- Validation: `start_time > end_time` → 400 with **both** `start_time` and `end_time` messages
- List order: active first, then upcoming, then expired, then `-id`

**Dashboard**
- `analytics`: the counters listed in `types.ts::Analytics`, computed over the whole store.
  `low_paper_devices` = `paper_count < 25`. `revenue_*` sums `amount` over **successful**
  payments only. `unread_notifications` = status 2; `open_notifications` = status != 3.
- `print_activity`: zero-filled daily counts for the last `days` days, oldest first,
  `{date: 'YYYY-MM-DD', count}`
- `devices`: only devices attached to at least one campaign, natural-sorted
- `campaigns`: currently active only, ordered by `end_time`
- `notifications`: the 12 most recent non-closed

**Natural device sort** — port `core/views.py::natural_sort_key` exactly. The key is
`(!is_online, prefixBeforeFirstDigit, firstNumber)`; a name with no digit sorts as
`(!is_online, name, Infinity)`. So online devices come first, then alphabetically by the part
before the first number, then numerically — `PM-2` precedes `PM-10`.

## 7. Seed data

`.spec/media-manifest.json` lists all 98 photos with the `date`, `device` and `campaign` they
were captured under. **Derive the photo rows from it** — every `photo_url` and `thumbnail_url`
must point at a file that actually exists in `public/media/`, and every photo's device and
campaign must match its manifest entry.

Photo URLs: `${import.meta.env.BASE_URL}media/photos/${file}` and
`${BASE_URL}media/thumbnails/${stem}_thumb.jpg`. Build them in `serialize.ts`, not in the JSON,
so the seed stays path-agnostic.

Devices in the manifest: `PM-01 Gallery`, `PM-02 Atrium`, `PM-03 Seaside`, `PM-07 Foyer`.
Campaigns: `Tbilisi Mall Winter`, `Rustaveli Premiere`, `Batumi Boulevard`. Campaign images
also exist for `Gudauri Season` and `Kutaisi Expo`.

Build a fleet that shows the product off:
- **8–10 devices** across Georgian venues (Tbilisi, Batumi, Kutaisi, Gudauri). The four manifest
  devices keep their exact names. Mix online/offline, active/inactive, paid/free, and paper
  levels that land in all three states (healthy / warning / critical) so the meters differ.
- **5–6 campaigns**: at least one active, one upcoming, one expired, one `is_default`. The five
  with images use them as `banner`; logos/icons may reuse the brand assets.
- **~98 photos** from the manifest, plus none invented — the files must exist.
- **10–15 notifications** spread across statuses, including several unread so the badge shows.
- **60–90 payment sessions** across the three statuses over the last few weeks, amounts in
  Georgian lari (`"1.00"`–`"5.00"`), mostly `success`, so the summary and success rate look real.

### Seed record shapes

The JSON files hold **raw rows**, not API payloads — computed fields belong in `serialize.ts`.
Ids are stable integers assigned in the seed; `store.ts` continues numbering from `max + 1`.

```jsonc
// devices.json
{ "id": 1, "name": "PM-01 Gallery", "device_id": "pm-01-gallery", "location": "Tbilisi Mall, Level 2",
  "is_online": true, "is_active": true, "paper_count": 148, "paper_capacity": 200,
  "requires_payment": true, "photo_price": "2.00", "payment_token": "tok_...", 
  "keepz_receiver_id": "KZ-...", "campaign_ids": [1, 2] }

// campaigns.json — image fields are paths under public/media/, or null
{ "id": 1, "name": "Tbilisi Mall Winter", "sponsor": "...", "is_default": false,
  "start_time": "2026-08-01T09:00:00.000Z", "end_time": "2026-08-31T21:00:00.000Z",
  "location": "...", "line_1": "...", "line_2": "...",
  "main_logo": null, "secondary_logo": null, "icon": null,
  "banner": "campaigns/tbilisi-mall-winter.jpg", "qr_link": "https://...", "photo_quantity": 480 }

// photos.json — `file`/`stem` come straight from .spec/media-manifest.json
{ "id": 1, "file": "tbilisi_mall_winter_0-1.jpg", "stem": "tbilisi_mall_winter_0-1",
  "photo_code": "TMW-0431", "timestamp": "2026-08-07T14:22:11.000Z",
  "device_id": 1, "campaign_id": 1 }

// notifications.json
{ "id": 1, "device_id": 3, "campaign_id": 2, "message": 2, "status": 2,
  "timestamp": "2026-08-19T08:14:00.000Z" }

// payments.json
{ "id": 1, "device_id": 1, "payment_id": "kz_9f2c...", "status": "success",
  "amount": "2.00", "created_at": "2026-08-19T12:03:44.000Z",
  "updated_at": "2026-08-19T12:03:52.000Z" }

// user.json — `password` is only compared against the login form, never displayed
{ "id": 1, "username": "demo", "password": "printomato-demo", "email": "...",
  "first_name": "...", "last_name": "...", "is_staff": true, "is_superuser": true,
  "last_login": "2026-08-20T07:40:00.000Z" }
```

Note `photos.json` uses `device_id`/`campaign_id` as **numeric foreign keys**, while a Device's
own `device_id` field is the slug — same name, different meaning, exactly as in Django. Keep
them straight.

**Date rebasing (important).** The seed carries absolute ISO timestamps. At store construction,
compute `offset = startOfToday - startOfDay(latest photo timestamp)` and shift **every**
timestamp in the store by that offset. That keeps "printed today", the 14-day chart and campaign
windows alive no matter when the demo is opened. Rebase photos, notifications, payments and
campaign start/end times with the same offset, then adjust campaign windows if needed so the
active/upcoming/expired mix survives.

## 8. Behaviour under mutation

Writes are real against the in-memory store and must invalidate correctly through the existing
query keys (that already works — `queries.ts` is unchanged).

- Creating/updating a device or campaign returns the full serialized object.
- Campaign writes arrive as `FormData`. Read scalars with `get()`, `device_ids` with
  `getAll()`. For an image `File`, produce an object URL (`URL.createObjectURL`) and store it as
  the field value so an upload preview actually renders; revoke it when the campaign is deleted
  or the field replaced. Non-`File` values pass through unchanged.
- Deleting a campaign detaches it from its devices. Cascade rules come straight from
  `core/models.py` and are not symmetric: `Photo.device` is `SET_NULL` (deleting a device leaves
  its photos in the archive with a null device), while `Photo.campaign` is `CASCADE` (deleting a
  campaign takes its photos with it). Notifications and payment sessions cascade from the device.
- `POST /devices/{id}/command/` never fails in the demo; it returns `delivered: is_online`, and
  the fleet event bus should emit a matching presence blip so the UI visibly reacts.

## 9. Demo chrome

A slim, dismissible bar (or a corner pill — your call, but it must not cover navigation) that
states: this is a live demo, data is fake and resets on reload, with a **Reset demo** button
calling `resetStore()` + `queryClient.clear()`, and a link back to the portfolio site
(`../../` relative, so it works at any base). Style it with existing theme tokens.

The store starts **signed in** as the demo user so a first-time visitor lands on the dashboard.
Signing out reveals the real `LoginPage`, which should pre-fill the demo credentials
(`demo` / `printomato-demo`) and show a hint line naming them.

## 10. Live event simulation

`demo/live.ts` exposes a tiny bus: `subscribe(path, handler)` returning an unsubscribe, plus an
internal scheduler. It must emit:

- on `/ws/fleet/`: `{type: 'device.presence', ...}` when a simulated device flips online/offline,
  and `{type: 'device.print', ...}` when a simulated print lands — the print must also mutate the
  store (new photo row reusing an existing media file, paper count down by one) so the
  invalidated queries show a real change.
- on `/ws/notifications/`: an occasional alert matching the toast shape AppShell expects
  (`{id, device: {name}, message}`), which also inserts a notification row.

Pace it for a demo, not a stress test: a print every ~12–25s, a presence flip every ~45–90s, an
alert every couple of minutes. Pause the scheduler when `document.hidden`. Use
`Math.random()` freely here — this is runtime, not build time.

## 11. The portfolio site (`site/`)

A small React + Vite + Tailwind v4 app, same stack and tokens as the console so the whole thing
reads as one brand. Owned entirely by one agent.

- **Content-driven**: `site/content/projects.json` holds every project entry (slug, name,
  tagline, summary, role, period, stack, highlights, metrics, demo URL, source URL, cover image,
  screenshots). Adding project #2 must mean editing that file and dropping a folder into
  `demos/` — nothing else.
- **Routes**: `/` landing (hero, what I build, project grid, contact) and `/work/:slug` case
  study (problem → approach → architecture → results, screenshots, prominent **Launch live
  demo** button). 404 route.
- The Printomato entry is real: Django 5 + DRF + Channels + PostgreSQL backend, React 18 +
  TypeScript + Vite + TanStack Query + Tailwind v4 console, WebSocket fleet telemetry, KEEPZ
  payment integration, Docker deploy. The demo it links to is the one in `demos/printomato/`
  with its backend replaced by an in-browser mock — say so plainly on the case-study page;
  honesty about the demo's nature is part of the pitch.
- Contact: `gkochiev@cellfie.ge` as a `mailto:` link. No form (no backend).
- Accessible and responsive: real landmarks, visible focus rings, keyboard-reachable
  everything, no horizontal body scroll, `prefers-reduced-motion` respected.
- Same `VITE_BASE` convention; default `/`.

## 12. Build, verify, deploy

```bash
npm install                 # at the repo root — workspaces link @portfolio/brand
npm run typecheck           # every workspace
npm run build               # scripts/build-all.mjs → dist/
```

`scripts/build-all.mjs` builds `site` into `dist/`, then each demo into `dist/demos/<name>/`
with `VITE_BASE=/demos/<name>/`, and copies the host-fallback files. `scripts/preview.mjs`
serves `dist/` with SPA fallback using only `node:http` — no dependency.

`deploy/` ships: `_redirects` (Netlify), `vercel.json`, `nginx.conf` snippet, and a GitHub
Pages workflow plus the `404.html` copy trick. Document in the root README which knob to turn
per host, including `VITE_ROUTER=hash` as the zero-config escape hatch.

**Definition of done:** `npm install && npm run typecheck && npm run build` is clean from a
cold clone, `dist/` serves correctly through `npm run preview`, and every route of both apps
renders with no console errors.
