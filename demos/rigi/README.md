# Rigi — live demo

A back office and client portal for a contact-centre software vendor, running with the backend
cut off.

*Rigi* (რიგი) is Georgian for a queue, a row, a turn — and the root of *წესრიგი*, "order". That is
the product: tickets wait in a queue, licences sit in ledger rows, invoices run in sequence.

Upstream it is a pnpm monorepo: a NestJS API on Postgres with a job queue, and a Next.js 15
front end with five role areas. Here the same screens talk to an in-browser mock of that API —
seed data generated at load, an in-memory store, and a router that answers the same paths with
the same payloads. No server, no database, no network request of any kind.

| | |
|---|---|
| **Staff app** | `/admin` superadmin · `/accountant` finance · `/l1` support desk · `/technician` |
| **Partner portal** | `/partner` — a separate realm for the vendor's client companies, with its own sign-in and an ochre accent |
| **Counts** | 59 routes · 163 mocked endpoints · 5 personas · 2 languages · 2,310 translation keys each |

The demo opens **already signed in** as the superadmin, on the dashboard, because that is the
screen that explains the product. The demo bar in the corner switches persona from any screen —
each one lands on its own home — and signs out to the real login pages.

## Demo accounts

Every account shares one password, **`rigi-demo`**. The bar signs you in with one click; the login
pages also list the personas as cards.

| Persona | Role | Email | Password | Lands on |
|---|---|---|---|---|
| Nino Kapanadze | Superadmin | `nino@rigi.example` | `rigi-demo` | `/admin` |
| Levan Abashidze | Accountant | `levan@rigi.example` | `rigi-demo` | `/accountant` |
| Mariam Japaridze | Support desk (L1) | `mariam@rigi.example` | `rigi-demo` | `/l1` |
| Giorgi Lomidze | Technician (VoIP engineer) | `giorgi@rigi.example` | `rigi-demo` | `/technician` |
| Tamar Gogua | Partner admin at Zemo Systems | `tamar@rigi.example` (portal username `tamar.gogua`) | `rigi-demo` | `/partner` |

Staff sign in at `/login`, partners at `/partner/login`. Other people exist as data only — five
more staff members and ten more portal admins fill the lists and own tasks and messages — but
only the five above can be signed in as. Where a screen asks for "your password" (enabling,
disabling or deleting a partner), type `rigi-demo`.

Add `?lang=ka` to the first URL to open in Georgian. The demo opens in English because a
portfolio visitor who cannot read the interface cannot judge it; the language switch is in the
app shell on every screen and the choice lives in memory only.

## What works

Nothing is a mock-up. Every list is filtered, sorted and paged by a handler; every form validates
and writes to the store; every number on a dashboard is computed from the rows beside it.

**Superadmin** — dashboard with four KPI tiles and work queues; partners (list, create, edit, a
nine-tab detail page: overview, documents with versions, rate history, task-template overrides,
licences with seat pool and price overrides, the licence mapper, API keys with a one-time secret
reveal, synced users, portal admins); licence catalogue; task templates with per-partner prices;
staff users; API-key overview; audit log with JSON diffs; system log with CSV export; system
health with a live snapshot, history chart and incidents; settings with simulated IMAP and SMTP
tests, a mail backfill run, and a **Scheduler** panel that runs the five cron jobs on demand.

**Accountant** — dashboard; invoice list with URL-synced filters; monthly generation with the
duplicate-period dialog; one-time invoices; the invoice lifecycle (issue, mark paid, void,
regenerate, VAT toggle, email to a fake outbox, print to PDF); partner billing profile; payments
and unused-allowance reports; the invoice template designer (block builder, raw HTML and CSS,
signature pad, live preview); bank details.

**Support desk (L1)** — dashboard; mail inbox in threads and flat views; mail and thread detail
with attachment previews; create a task from a mail or a thread; the task workspace (transitions,
assignees, linked mail and threads, history, chat); projects with pricing, completion and
cancellation. New mail arrives on a timer.

**Technician** — a "what's on your plate" dashboard; tasks in Mine, Unassigned and All tabs;
claim, work and finish a task from the same workspace.

**Partner portal** — submit a task from priced templates; edit or cancel it; approve a finished
task (which bills points against the free monthly allowance) or send it back with a comment;
chat with the support team; projects; documents with previews; licences and users; invoices with
dispute and print-to-PDF; the points meter with a twelve-month history.

Cmd-K opens a command palette; the theme follows the OS with a manual override; the sidebar
collapses.

## What is deliberately switched off

| | |
|---|---|
| The API server, Postgres and the job queue | Replaced by the mock described below. Nothing reconnects because nothing can drop. |
| IMAP and SMTP | The inbox is seeded and fed from a pending list; the connection tests only check that a host contains a dot; invoice email appends to an in-memory outbox. |
| Real PDF generation | Upstream renders PDFs on the server. Here "Download PDF" prints the rendered invoice HTML through a hidden iframe and lets the browser save it; a Georgian font is bundled so the glyphs print. |
| Authentication as a security property | One shared demo password is compared in plain text. There are no tokens, cookies or refresh rotation. The "server" is a function call in the same tab. |
| The partner machine API | The credentialled endpoints partners' phone systems use to push user counts have no UI upstream either. A **Simulate partner sync** button plays one round of it. |
| Password reset | The forgot and reset pages accept anything and send nothing. |
| Document upload | A file input reads only name, size and type; previews and downloads use five bundled sample files. |
| Persistence | None. A reload is the reset. That is a product decision, not a missing feature. |
| The rich-text editor for templates | Dropped in favour of the block builder plus raw HTML and CSS. |

## Running it

| Command | |
|---|---|
| `npm run dev:rigi` | Vite dev server at <http://localhost:5180/demos/rigi/> |
| `npm --workspace @demos/rigi run build` | `tsc -b --noEmit`, then `vite build` into `demos/rigi/dist/` |
| `npm --workspace @demos/rigi run typecheck` | TypeScript, strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root. `VITE_BASE` (default `/demos/rigi/`) and `VITE_ROUTER=hash`
are the two build-time knobs — see the [root README](../../README.md). The bundle works in an
iframe, under a sub-path and on the hash router.

## How the demo works

### The seam

```
pages/ + components/            UI built only from src/components/ui and the feature locales
        │   useQuery(['tasks', …]) · useMutation(...)
        ▼
features/<group>/api.ts         Typed hooks per feature: query keys start with a ChangedEntity
        │   http.get('/tasks', { state })
        ▼
lib/api.ts                      The only door. Prefixes /api and calls the mock's dispatch()
        │   mockApi.dispatch('GET', '/api/tasks', { params })
        ▼
demo/api.ts                     @portfolio/demo-kit createMockApi: matching, latency, 401/404/405
        │
        ▼
demo/handlers/*.ts              Eleven modules, 163 routes, role checks, validation, audit
        │   reads and writes
        ▼
demo/runtime.ts                 store · session · event bus (demo-kit createStore / createSession)
        ▲
        └── demo/seed/*.ts      buildSeed(now): the whole database, generated at load
```

Swap `dispatch` for `fetch` in `lib/api.ts` and nothing above it changes. Requests and responses
are structured-cloned on the way through, as the wire would, so UI code can never mutate the
store by accident. Reads answer in 90–260 ms and writes in 140–340 ms, which is what makes
spinners and optimistic updates visible instead of theoretical.

### The pieces

| Piece | Where | Job |
|---|---|---|
| **Store** | `demo/runtime.ts` | `createStore(buildSeed(now))`. Plain arrays in memory; `reset()` regenerates the seed. |
| **Session** | `demo/accounts.ts`, `demo/session.ts` | Five personas; the session starts as Nino. `requireStaff(...)` and `requirePartnerAdmin()` in `demo/ctx.ts` gate handlers. |
| **Event bus** | `demo/events.ts`, `app/layouts/RootLayout.tsx` | Every mutation calls `emitChanged('tasks', …)`. The shell invalidates every React Query whose first key element names that entity, so a change on one screen shows on the others without wiring. `notify` raises toasts; `partner.access` re-checks the portal when a partner is disabled. |
| **Domain** | `demo/domain/*` | Pure functions the handlers *and* the seed share: the task state machine, the points ledger, seat pools, invoice maths, mail threading. One implementation means the seeded history and a freshly generated invoice cannot disagree. |
| **Simulators** | `demo/handlers/*` | Timers that make the product move: new mail in the first minutes after load, a staff reply about six seconds after a partner message, health incidents, backfill progress, pricing review of freeform tasks. Listed in [`src/demo/routes.md`](./src/demo/routes.md). |
| **Jobs** | `demo/jobs.ts` | The five cron jobs register runners; the Scheduler panel runs them. |

Failure crosses the seam unchanged. A handler throws `DemoApiError`; field errors from a 400 land
under the right input in forms that already render them; a 409 from an invalid task transition or
a duplicate invoice period opens the dialog the product already has for it.

### Time-relative data

A seed with absolute dates goes stale the day after it is written. `buildSeed(now)` is
deterministic (`createRandom('rigi')`) but generated **relative to the load time**: this month
is period 0, history reaches six months back, deadlines are in the future or recently overdue,
one contract expires in ten days and another has lapsed. The store runs it on load and again on
every reset, so a tab left open overnight resets onto *today*. In development, `validateSeed()`
checks the graph and logs problems.

### No storage

Nothing is written to `localStorage`, `sessionStorage` or IndexedDB — not data, not session, not
theme, not language, not sidebar state. A reload restores the pristine seed and the persona the
demo opens as. **Reset demo** in the demo bar does the same without the reload.

## The original architecture

Generic technology only; the product itself is private.

| Layer | What it was |
|---|---|
| Repository | pnpm workspaces: an API app, a web app, and a shared package of zod contracts used on both sides |
| API | NestJS under `/api/v1`, REST, OpenAPI via swagger with a generated TypeScript client; `RolesGuard` deny-by-default; a global audit interceptor with JSON-patch diffs (superadmin skipped); request-id middleware |
| Database | PostgreSQL 16 through Prisma, about 40 models; money as `Decimal(12,2)`; multi-tenant by a `partner_id` column; partial unique indexes added in raw migration SQL; `pgcrypto` and `citext` |
| Jobs | pg-boss on the same database, cron in `Asia/Tbilisi`: mail polling, month close, invoice generation and auto-draft, daily user-count snapshot, retention pruning, backfill batches |
| Auth | argon2id hashes; a 15-minute internal JWT plus a rotating opaque refresh token in an httpOnly cookie, bridged through Next route handlers; a separate partner-portal realm; partner machine auth with HTTP Basic key id and secret exchanged for a 15-minute scoped JWT, throttled to 60 a minute |
| Web | Next.js 15 App Router, shadcn/ui and Tailwind, route groups per role, edge middleware for role routing, server components calling the API and client components calling route-handler proxies; English and Georgian dictionaries |
| Mail | An IMAP poller storing `.eml` files and attachments on a volume, RFC 5322 threading; SMTP out for password resets and invoice emails |
| PDF | Headless Chromium through Puppeteer, rendering editable HTML and CSS invoice templates, with a Georgian-capable font |
| Observability | A system-log table, a health sampler with persisted history, retention and incidents, health endpoints for liveness and readiness |
| Infra | Docker Compose for development and production; nginx with TLS in front, the API and web containers behind it, a database dump container for backups, an Ubuntu host |

## The data

Thirty-four collections plus a settings object, typed in [`src/types.ts`](./src/types.ts) and
documented field by field in [`src/demo/schema.md`](./src/demo/schema.md). The shape of the
seed, as of any load:

| | |
|---|---|
| Partners | 9 client companies (eight active) across GEL, USD and EUR, with contacts, rate history, documents and API keys |
| People | 9 staff users, 11 portal admins, **399 synced partner users** with 412 membership periods and 720 daily headcount rows |
| Licences | 7 in the catalogue (five per-user, two add-ons), 15 price overrides, 54 seat batches |
| Tasks | 90 across all seven states, 11 templates, 339 history rows, 92 chat messages; 6 projects |
| Mail | 106 mails in 55 threads, 19 attachments, 15 more waiting to arrive |
| Money | 43 invoices (39 monthly, 4 one-time) with 147 lines over six months; one disputed; 53 point transactions; 3 invoice templates |
| Ops | 189 audit rows, 503 system-log rows, 4 incidents, 9 scheduler runs |

Money is a plain number in major units, rounded to two decimals; VAT is 18%. Points are the
support-work currency: each partner has a free monthly allowance, and points beyond it are billed
at the partner's rate. Points are debited when the partner **verifies** a task, not when staff
finish it — which is the rule the original code settled on.

Every endpoint is catalogued, with method, path, role and purpose, in
[`src/demo/routes.md`](./src/demo/routes.md).

## Design

The interface is deliberately its own: a pale ledger surface with graphite ink, one signal green
that means "now serving / your turn", and an ochre accent that marks the partner portal as a
different house. Square chips, mono ticket numbers and a queue motif carry the name. Type is
Schibsted Grotesk for display, Instrument Sans for text, Noto Sans Georgian for Georgian and
JetBrains Mono for numbers and ids, all bundled through `@fontsource-variable`. Components live
in `src/components/ui` (cheat-sheet in its README); pages are built only from those.

## Layout

```
src/
  main.tsx  router.ts  routes.tsx   entry, router (BrowserRouter or hash), all 59 routes (lazy)
  types.ts                          every entity
  app/
    layouts/                        Root, Auth, Staff (4 areas), Portal
    pages/                          login, partner login, forgot/reset, 403, 404, home redirect
    locales/{en,ka}/shell.json
  components/
    ui/                             the design system (see its README)
    layout/                         sidebar, command palette, auth screen, system screens
    brand/                          logo, queue motif
    demo/DemoChrome.tsx             the demo bar wiring
    status.tsx                      state, invoice, mail and health chips
  features/                         one folder per group, each with pages/, components/, api.ts, locales/
    partners  licensing  admin-catalog  ops  invoicing  invoice-templates
    support-desk  tasks  portal  ledger
  demo/
    handlers/                       the eleven API modules          → routes.md
    seed/                           buildSeed(now) and validateSeed → schema.md
    domain/                         billing · points · seats · tasks · mail · dates · trend
    runtime.ts  api.ts  ctx.ts  events.ts  jobs.ts  accounts.ts  session.ts  store.ts
  lib/  api/  i18n/  styles/        client, formatting, CSV, i18n setup, Tailwind tokens
public/samples/                     contract PDF, diagram PNG, CSV, TXT, DOCX for previews
```

About 34,000 lines of TypeScript and TSX. Every route past the first screen is code-split;
Recharts, React Query and i18next are split into their own chunks.
