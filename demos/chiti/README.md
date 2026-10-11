# Chiti — live demo

A multi-tenant support inbox, running with its backend cut off.

Chiti is a customer-support product Boulder built: an embeddable chat widget plus Messenger,
Instagram, WhatsApp, Telegram and TikTok, all landing in one queue. A bot answers first and hands
over to a person; operators work the queue with an AI copilot beside them; admins and a read-only
supervisor run the team; a platform super admin runs the tenants. The whole product speaks Georgian
and English, and tenant content (FAQ, quick replies, greetings, field labels) carries Russian too.

The demo presents it under its own fictional brand — **Chiti / ჩიტი**, "little bird", the
messenger — with a canary-yellow bird mark, a cream ground and the bot called **Chiti Assistant**.
The demo tenant is **Vazi Wine Cellar**, a fictional Tbilisi wine shop. Nothing in the UI, copy or
data comes from the client's product; only the behaviour does.

Upstream it is a React SPA talking to a Node API over REST and one Socket.IO namespace per tenant.
Here the same screens talk to an in-browser mock: seed data compiled into the bundle, an in-memory
store, 149 routes answered by `@portfolio/demo-kit`, and a set of simulators that play the
customers, the bot, the copilot and the colleagues. No server, no database, no network request of
any kind.

| | |
|---|---|
| **The storefront** | `/` — a Vazi Wine Cellar shop page with the Chiti widget launcher and a demo control panel |
| **The live desk** | `/live` — the widget and the operator inbox side by side; the whole hand-over in one screen |
| **Operator console** | `/operator` — live queue, six channels, conversation pane, copilot, notes, team chat; `/operator/profile` |
| **Admin console** | `/admin` — dashboard, spectate, team, history, statistics, activity log, settings, FAQ editor, channels, comments, AI link |
| **Super-admin console** | `/superadmin` — tenant lifecycle, manage tenant, platform integrations, system health, AI key |

## Running it

| Command | |
|---|---|
| `npm run dev:chiti` | Vite dev server at <http://localhost:5183/demos/chiti/> |
| `npm --workspace @demos/chiti run build` | `tsc -b --noEmit`, then `vite build` into `demos/chiti/dist/` |
| `npm --workspace @demos/chiti run typecheck` | TypeScript strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root. `VITE_BASE` (default `/demos/chiti/`) and `VITE_ROUTER=hash`
are the two build-time knobs — see the [root README](../../README.md). `?lang=ka` on the first load
opens Georgian (under the hash router it is read from the hash query); the language switch in the
header changes it afterwards, and nothing is stored.

The demo opens on the storefront **signed in as the customer** Ana. The bar in the corner switches
between the five headline accounts in one click, and signing out lands on the real login page.

## Demo accounts

Every account shares one password: **`chiti-demo`**. The same string confirms the destructive
settings actions (chat purge, tenant erase), which ask for the admin's password.

| Role | Name | Email | Password | Lands on |
|---|---|---|---|---|
| Customer | Ana Japaridze | `ana@chiti.example` | `chiti-demo` | `/` — the widget visitor; the pre-chat form is prefilled with her |
| Operator | Luka Beridze | `luka@chiti.example` | `chiti-demo` | `/operator` — the live-desk operator |
| Admin | Giorgi Abashidze | `giorgi@chiti.example` | `chiti-demo` | `/admin` — every admin page |
| Supervisor | Nino Lomidze | `nino@chiti.example` | `chiti-demo` | `/admin` — read-only subset |
| Super admin | Tamar Tsereteli | `tamar@chiti.example` | `chiti-demo` | `/superadmin` |

Twenty-three more accounts exist, one per remaining staff record of the six tenants (operators
Mariam, Lasha, Salome, Irakli and others). They sign in with their `<first name>@chiti.example`
address and the same password, and are what **Log in as** (super-admin console) switches to. The
customer persona and the staff both go through `POST /api/auth/login`, which accepts an email or a
username.

## What works

- **Widget** — launcher, FAQ decision tree as bubbles, pre-chat form built from the tenant's
  custom fields, bot-first chat with citations and an AI disclosure, "talk to a human", typing
  indicator, read receipts, emoji, image/file (object URLs) and location messages, inactivity
  warning, end-chat confirm, 1–5 star feedback, and the out-of-hours, temporarily-closed, banned,
  tenant-disabled and tenant-not-found states.
- **Storefront demo panel** — widget side, client theme (8 presets), bot on/off, force open /
  closed / temporarily closed, "be banned" preset, fast inactivity timer, new-chat spawner, and a
  copy-able embed snippet.
- **Operator inbox** — the live queue with wait timers, a channel rail across six channels,
  claim, reply, quick replies, internal notes, customer fields, previous chats of the same
  customer, a history panel, the AI copilot (drafts with citations, tone and language
  transforms, a commitment warning), the WhatsApp template picker when a window has closed,
  per-channel rules (reply windows, TikTok's consecutive-message cap, a locked Telegram chat,
  media support), reactions, delivery ticks and retry of failed sends.
- **Team chat and profile** — direct messages and a team room with presence, unread badges and
  colleagues who answer; an operator profile with nickname, avatar, language and stats.
- **Admin** — dashboard, spectate / intervene / end a chat / clear the queue, operators with force
  pause and logout, admins and supervisors CRUD, history search with the hand-over chain,
  statistics with CSV export, an activity log, and the settings hub: working hours, identity and
  themes, routing and timers, custom fields, quick replies, bans, purge.
- **Integrations** — a hand-built FAQ flow editor (drag, pan, zoom, minimap, validation), channel
  cards for Messenger / Instagram / WhatsApp / Telegram Business / TikTok with their connect
  states, page comments (reply, hide, delete) and the AI link with a connection test.
- **Super admin** — KPIs, tenant lifecycle (create, disable, enable, delete, restore, erase),
  manage tenant (members, channel feature flags, staff-chat audit), log in as, platform
  credentials, live system-health charts, the AI platform key.
- **Both tabs, one world** — open the demo twice and a message sent in one appears in the other.

## What is deliberately switched off

| | |
|---|---|
| Real channels | No webhooks, OAuth popups or Graph/Bot/TikTok APIs. Connect flows resolve on a timer to a canned state; Test returns a canned result (invalid when the token contains `bad`). All credentials shown are masked and fictional. |
| A real bot or copilot | Chiti Assistant answers from a small pre-written knowledge base; copilot drafts are pre-written per topic and language. An **AI outage** switch opens the circuit so the hand-over path can be seen. |
| Uploads | An attached file becomes an object URL for the life of the tab. Nothing is sent anywhere. |
| Web push and sound | Replaced by in-page toasts. There is no service worker. |
| Persistence of any kind | A reload is the reset. Nothing is written to `localStorage`, `sessionStorage` or IndexedDB — not the session, not the language, not the theme. |
| Authentication as a security property | The password is compared in plain text with a seed row. There is no token and nothing to forge: the "server" is a function call in the same tab. |
| Real time | Timers run on a scaled demo clock: one product minute is 9 s, so a 5-minute inactivity warning arrives after 45 s and the close after 90 s. |
| Legal pages, notification set-up popup, dashboard iframe embed, update banner | Not part of the product's working surface. |

## How the demo works

```
pages + components              react-router lazy routes, one feature folder per surface
        │   useQuery / useMutation
        ▼
src/api/client.ts → src/lib/api.ts   the client the UI calls — dispatch() into the mock where fetch() used to go
        │   api.dispatch('GET', '/api/operator/inbox')
        ▼
src/demo/api.ts                 createMockApi({ prefix: '/api' }): matching, 401/403/404/405, validation, latency
        │
        ▼
src/demo/handlers/*.ts          the 149 routes — see src/demo/routes.md
        │   engine.claimSession(), engine.postMessage(), engine.endSession() …
        ▼
src/demo/engine.ts              every mutation of chat state: mutate store, broadcast, write the activity row
        │
        ▼
src/demo/store.ts               createStore(seed) — plain arrays in memory; the demo's database
```

The seam is `@portfolio/demo-kit` (`createMockApi`, `createStore`, `createSession`, `rebaseDates`,
`createEventBus`, `createRandom`, `every`, `buildResources`, `createDemoRouter`, `DemoBar`). The
product code above it does not know the backend is gone.

- **Store.** `store.data` is a deep copy of the seed, rebased to "now" on every reset by
  `rebaseDates` against `SEED_ANCHOR` (Monday 5 October 2026, 15:00 Asia/Tbilisi). The seed is
  built once by deterministic generators and never mutated. Schema: `src/demo/schema.md`.
- **Session.** `src/demo/session.ts` holds one account per staff record plus the customer persona.
  It starts signed in as `cus_ana`. Impersonation ("log in as") is a second piece of state on
  top, so "Back to super admin" always knows where to return.
- **API.** Handlers register routes **without** the `/api` prefix. `/widget/*`, `/auth/login` and
  `/demo/*` are public; everything else needs a session and checks its role with `requireRole`.
  Failures are `DemoApiError`s (`401`, `403`, `404`, `409`, field-keyed `400`s). Route table:
  `src/demo/routes.md`.
- **Realtime.** The original's Socket.IO events are a typed in-process bus (`src/demo/bus.ts`).
  Every data event carries the full entity, so it can also cross tabs.
- **Mirror.** `src/demo/mirror.ts` opens `BroadcastChannel('chiti-demo')` and upserts the entities
  other tabs broadcast. It persists nothing, and if the channel is unavailable (sandboxed iframe,
  private window) the demo simply runs as one tab. Ids minted at runtime carry a per-tab tag so two
  tabs never collide.
- **Simulators.** `src/demo/simulators/*.ts` are the part of the world that is not the visitor:
  scripted customers answer after a delay, with progressive typing; a spawner adds a waiting chat
  every 25–40 s (at most 8 waiting); the bot answers the widget; Mariam claims the visitor's chat
  when nobody is driving the inbox; the copilot fills drafts; colleagues reply in team chat; the
  Telegram and TikTok handshakes finish on their own; page comments arrive; the health feed ticks
  every 2 s. They run only in the **leader tab** (the oldest, elected by heartbeat), pause while
  the tab is hidden, and restart after a reset.
- **Reset.** The bar's **Reset demo** restores the seed and the accounts, tells the other tabs and
  restarts the simulators — a reload without the round trip.

## The original architecture

Generic technology names only; the product's source is not part of this repository.

| Layer | What it was |
|---|---|
| Front end | One React + Vite SPA carrying the operator, admin and super-admin consoles and the standalone customer page; shadcn/ui on Radix plus Ant Design for the chat surfaces; i18next in three languages; React Flow for the FAQ editor; a typed REST wrapper that attaches a bearer token |
| Widget | A separate Vite library build (UMD) mounted into a host page, themed through CSS variables, CSS scoped under an id prefix, modals portalled to a sibling node; on mobile the card becomes a bottom sheet |
| API | Node + TypeScript on Express: REST mounts for auth, admin, super admin, sessions, uploads, integrations, staff chat, comments, AI, push and operator; webhook routes keep the raw body for HMAC verification |
| Realtime | Socket.IO with one namespace per tenant and rooms for operators, admins, each session and each operator |
| Data | PostgreSQL through Prisma; one database, every row carries a tenant id, every query is tenant-scoped |
| Auth | Tokens issued per role (customer, operator, admin, supervisor, super admin) behind a `requireAuth([roles])` guard; admins, supervisors and super admins share a login; impersonation tokens for log-in-as |
| Channels | An adapter per channel (Messenger, Instagram, WhatsApp, Telegram, TikTok) turns webhooks into one normalized message; a conversation router ingests with a per-contact queue, finds or creates the session, stores media, starts the AI, emits and auto-assigns |
| AI | A separate Python service reached through a client with a per-tenant circuit breaker and pause: an answer endpoint for the bot, a turns endpoint for copilot drafts, regenerate and feedback |
| Background work | In-process timers and sweeps: inactivity, auto-assignment, response timeout, logout grace, stale-waiting, presence reconciliation after a restart, system-health sampling, retention cleanup |
| Storage and push | Uploads on local disk or an S3-compatible driver; web push over VAPID with a service worker |
| Infra | Docker Compose (database, API, nginx-served front end) or a release-directory deploy behind an atomic symlink flip, PM2 for the API, nginx in front |

## The data

Seeded for one rich tenant, **Vazi Wine Cellar**; five more tenants exist as rows so the platform
console has something to manage (one of them is disabled). Counts are what `buildSeed()` produces.

| Table | Rows |
|---|---|
| `tenants` | 6 — Vazi, Bostani, Mtvare, Kvali, Aivani, Gza (disabled) |
| `operators` / `admins` / `supervisors` / `superAdmins` | 18 / 7 / 1 / 1 |
| `customers` | 117 |
| `sessions` | 369 — 6 active, 5 waiting, 2 inactive, 356 ended; 133 widget, 67 WhatsApp, 54 Instagram, 52 TikTok, 52 Messenger, 11 Telegram |
| `messages` | 753 — 71 sessions have a full transcript, 298 generate one on first read |
| `feedback` / `notes` / `assignments` | 64 / 20 / 409 |
| `activity` / `operatorAudit` | 296 / 16 |
| `customFields` / `quickReplies` / `bans` / `waTemplates` | 14 / 12 / 3 / 5 |
| `comments` / `staffConversations` / `staffMessages` | 12 / 6 / 45 |
| `healthSamples` | 673 — seven days at 15-minute steps, topped up live |

All of it is authored in English and Georgian. Media in `public/media/` is drawn locally (SVG
illustrations, two PDFs, two voice notes) and reached through `import.meta.env.BASE_URL`.

## Layout

```
src/
  main.tsx, routes.tsx, router.ts   entry, the route table (roles per route in `handle`)
  types.ts                          every entity, the contract between seed, handlers and screens
  app/                              shell: layouts per role, login, guards, header controls
  api/, lib/                        the client, query keys; channel rules, working hours, formatting
  i18n/                             i18next setup; `common` and the shared namespaces
  components/ui/                    the design system (see its README) · chat/ · brand/
  features/<surface>/               pages, components, api hooks and locales per surface:
                                    widget · inbox · operator-tools · team · admin-live ·
                                    admin-insights · admin-staff · admin-settings ·
                                    admin-integrations · superadmin
  demo/
    index.ts                        boot: seed → store → session → API → mirror → simulators
    seed/                           deterministic builders, compiled into the bundle
    handlers/                       the routes, one file per feature group
    simulators/                     the world around the visitor
    content/                        pre-written bot, copilot, team and widget content
    engine.ts, bus.ts, mirror.ts    chat mutations · typed event bus · cross-tab mirror
    schema.md, routes.md            the data model and the route table
  styles/                           tokens (Tailwind 4 theme) and base layer
```
