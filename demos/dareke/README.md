# Dareke - live demo

An outbound contact-centre suite, running with its backend cut off.

*Dareke* (დარეკე, "call!") is the imperative of the Georgian verb for ringing someone: a dialer
that tells the next number to ring. It is run here by an invented tenant, **Ezo Contact Centre**
(ეზო კონტაქტ ცენტრი), whose campaigns phone customers of invented Georgian companies.

Upstream it is a React SPA on a Fastify API with PostgreSQL, Redis and an Asterisk/FreePBX PBX,
and the calls ring in the browser through a WebRTC softphone. Here a React front end talks to an
in-browser mock of that API: seed data generated at boot, an in-memory store, a router that
answers the same kinds of paths with the same kinds of payloads, and a set of simulators that
play the telephone network and a floor of colleagues. No server, no database, no PBX, and no
network request of any kind.

Three people use it, and the demo lets you be each of them:

| | |
|---|---|
| **The operator** | `/agent` - pick a campaign, go Available, press **Next lead** (or take an auto-dialled call from the incoming banner), talk to the script beside the lead card, then choose a disposition. Every call must end with one. |
| **The supervisor** | `/supervisor` - the live wall: KPI strip, agent tiles with live timers, campaign progress, the call feed, calls by hour and the auto-dialer pacing panel. Plus `/reports` and `/calls` (call history). |
| **The admin** | `/admin/*` - dashboard, campaigns and lead lists, users and the role matrix, agent statuses, dispositions, the Do-Not-Call list, dialer settings. A super admin also gets `/admin/integrations`. |

The best way to see it is two tabs: the operator in one, the supervisor in the other. They are
kept in sync over a `BroadcastChannel`, so the call you place as Mariam shows up as a live tile
on Levan's wall.

## Demo accounts

Login is by **email**. The password is the same for all four: **`dareke-demo`**.

| Role | Name | Email | Ext | Lands on |
|---|---|---|---|---|
| Operator | Mariam Gelashvili (მარიამ გელაშვილი) | `mariam@dareke.example` | 1101 | `/agent` |
| Supervisor | Levan Chikovani (ლევან ჩიქოვანი) | `levan@dareke.example` | 1201 | `/supervisor` |
| Admin | Tamar Lomidze (თამარ ლომიძე) | `tamar@dareke.example` | none | `/admin` |
| Super admin | Nino Beridze (ნინო ბერიძე) | `nino@dareke.example` | none | `/admin` |

The demo opens **signed in as Mariam**, Available and focused on the manual campaign, so **Next
lead** works on the first click. The bar in the corner switches role without a password; signing
out lands on the real login page, which has four one-click role tiles and the same email and
password form underneath them.

Nine other people exist as data: a second supervisor, seven more operators (one of them with no
extension, to show the warning; one inactive, to show enable and disable) and the fake agents
the wall is built on. None of them is a login.

A wrong role is redirected to its own home, not shown an error. Admins cannot see super admins in
the user list, and edit only operators and supervisors; the Integrations page and the **Grant
super admin** action are super admin only. Every handler checks the role again, so the route
guard is never the only gate.

It **opens in English**. The original's interface is Georgian-first and the brand brief defaults
to it, but a visitor who cannot read the interface cannot judge it, so English is the default.
The switch in the header is on every page; `?lang=ka` on the first load opens Georgian. The
language is kept in memory only.

## Running it

| Command | |
|---|---|
| `npm run dev:dareke` | Vite dev server at <http://localhost:5182/demos/dareke/> |
| `npm --workspace @demos/dareke run build` | `tsc -b --noEmit`, then `vite build` into `demos/dareke/dist/` |
| `npm --workspace @demos/dareke run typecheck` | TypeScript strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root; the workspace is installed by the root `npm install`.
`VITE_BASE` (default `/demos/dareke/`) and `VITE_ROUTER=hash` are the two build-time knobs - see
the [root README](../../README.md). The router derives its basename from `import.meta.env.BASE_URL`,
so the bundle works under a sub-path and inside an iframe, and in hash mode the language query
rides inside the hash (`/#/agent?lang=ka`).

## What works

Every screen is a working screen, and every write is real against the in-memory copy.

**Operator workspace**

- A three-zone layout: lead and history on the left, the call script and custom data in the
  middle, dispositions and notes on the right, with the dial bar underneath.
- A status control with the eight statuses; **Wrap-up** counts down its own timeout and
  returns to Available on its own.
- **Manual dialling.** Next lead walks `requesting`, `dialing`, `ringing`, then answered (85 %),
  no answer (10 %) or busy (5 %). An answered customer sometimes hangs up on their own after 45
  to 120 seconds.
- **Auto dialling.** On an AUTO campaign the dialler offers answered customers to free
  operators; an incoming banner appears and auto-rejects after 15 seconds, which abandons the
  call and puts the lead back on the retry path.
- Mute, hold (with a running hold timer), transfer and hang up. Keyboard: `M` mute, `H` hold,
  `E` end, `1`-`9` pick a disposition, `Enter` submit, `Ctrl/Cmd+K` command palette, `?` the
  shortcut list.
- **Forced disposition.** No new call until the last one has one. Dispositions can require a
  callback date and time, or add the number to the Do-Not-Call list; the lead's status follows.
- Today's KPIs, the operator's own recent calls, and the history of the lead being called.

**Supervisor wall, reports and call history**

- KPI strip, an agent tile per operator (status, timer, current customer), campaign progress
  bars, a live call feed, calls by hour and the **auto-dialer panel**: per campaign the available
  agents, the dial ratio, the pacing target, calls in flight, the abandon rate and the backoff
  state, with controls to start and stop the engine, trigger a cycle, reset a campaign or inject
  an originate failure to watch the 30-second backoff.
- Reports in three tabs - agent performance, campaign, call detail - with date and campaign
  filters, charts and a **real CSV export** (a Blob download, with a BOM so Excel reads Georgian).
- Call history with filters, paging and a detail drawer.

**Admin console**

- Dashboard of totals and the most recently touched campaigns.
- Campaigns: list with status filter and search, create and edit in a drawer, and the lifecycle
  **start / pause / stop**, validated the way the original validates it (a draft with no agents
  or no pending leads will not start). Detail has a Numbers tab, an Agents tab and Settings with
  the dialling-mode editor.
- **Lead lists.** A real CSV import: the file is parsed in the tab, rows are normalised,
  de-duplicated per campaign (with an allow-duplicates switch that bumps `instanceNumber`) and
  checked against the DNC list; the result dialog reports inserted, skipped, duplicates, DNC
  marked and invalid. Sample files are in `public/samples/`.
- Users with the role matrix, create, edit, reset password, enable and disable, and grant super
  admin (which asks for the password again).
- Agent statuses, dispositions, the global DNC list (add, check, delete, bulk import), and
  dialler settings (pacing ratios, target abandon rate, wrap-up times, working hours).
- Integrations (super admin): PBX, directory, softphone and deployment cards, secrets shown only
  as "set", and a **Test connection** button that waits a second or so and returns a plausible
  answer.

**Shell:** light, dark and system themes, the command palette, the shortcut sheet, bilingual
everything (1,383 keys per language), and a demo bar with **Reset demo data**.

## Deliberately switched off

| | |
|---|---|
| The PBX and the telephone network | There is no Asterisk, no AMI and no SIP. The ring, answer, busy and hang-up are played by `demo/sim/operator.ts`; the softphone is a chip that "registers" the operator's extension and reads connected, with no audio. |
| Real WebRTC | The registration, ICE and media path are not reproduced. Nothing here touches a microphone. |
| The WebSocket and Redis fan-out | An in-process event bus, `demo/bus.ts`, delivers the same events. The client reacts by invalidating query caches, as the original's socket handler does. |
| Authentication as a security property | The password is compared in plain text against a seed row. There is no token, no expiry and no directory bind. The "server" is a function call in the same tab. |
| Directory (LDAP) sign-in and auto-provisioning | Shown on the Integrations page; the test button is a timer. |
| The predictive dialling mode | An enum value in the original too, and shown as "coming soon". PREDICTIVE campaigns are never dialled. |
| Call recordings | `recordingUrl` is always null. No audio is bundled. |
| Agent sessions, audit logs, XLSX import | Not part of the front end the portfolio shows; CSV import covers the lead list. |
| Persistence of any kind | Reload is the reset. That is a product decision, not a missing feature. |
| The auto-dialler's real timing | The 1-second loop is real, but the outcomes are random draws from a seeded generator, so the call mix is plausible rather than recorded. |

## How the demo works

The seam is the same as in the other demos: the pages never know the backend is gone.

```
pages/ + components/        Screens. Render from TanStack Query hooks only.
        |   useUsers(), useGrantSuperAdmin(), useLiveStrip() ...
        v
features/*/api.ts           Typed wrappers: api.get('/supervisor/metrics') ...
        |
        v
lib/api.ts                  request(): ApiError, query params, abort signal. dispatch() into the
        |   mock where fetch() would go. createMockApi({ prefix: '/api', latency })
        v
demo/index.ts               Route table from @portfolio/demo-kit: matching, 401/403/404/405,
        |                   validation errors, abort, simulated latency (reads 150-320 ms,
        |                   writes 200-400 ms).
        v
demo/handlers/*.ts          81 handlers. Each starts with a role check; failure is always a
        |                   DemoApiError, which the client re-dresses as ApiError.
        v
demo/domain/index.ts        The state machines the handlers and simulators share: agent status
        |                   changes, call lifecycle, disposition effects, DNC, campaign stats.
        v
demo/store.ts               createStore(buildSeed()): plain arrays in memory. The demo's database.
```

**Store.** `createStore` holds a structured clone of the seed for the life of the tab. The seed
is not a JSON file but a deterministic builder, `buildSeed(now)`, driven by `createRandom('dareke')`.
Every timestamp is generated relative to `now`, which is what keeps the wall and the charts alive
on any day; *Reset demo data* rebuilds it for the current moment. Ids continue past the seed's
and are never reused. Nothing is written to `localStorage`, `sessionStorage` or IndexedDB.

**Session.** `createSession(accounts, { initial: 'u_mariam' })` is the kit's in-memory session.
The login handler checks the email and password against the four accounts; the demo bar uses
`session.signIn(id)` to switch role without a password. Signing in or out clears the query cache.

**Simulators.** Three engines keep the product moving. All of them run off `every()` ticks that
pause while the tab is hidden, and all of them drop their plans on `demo:reset`.

| Engine | File | What it plays |
|---|---|---|
| Operator engine | `demo/sim/operator.ts` | The telephone network for the signed-in operator: the manual call sequence, the customer's side of the conversation, the incoming-offer timer, the wrap-up deadline. |
| Floor simulator | `demo/sim/floor.ts` | The other operators: Available, ringing, talk of 30 to 150 seconds with an occasional hold, a weighted disposition, Wrap-up, back to Available, and now and then (about 5 % of idle moments) a break or lunch. It keeps about four to six on a call. It never drives Mariam. |
| Auto-dialler | `demo/sim/autoDialer.ts` | The pacing loop ported from the original: for each active AUTO campaign, `target = floor(availableAgents x dialRatio)`, capped by `maxConcurrentCalls` and one originate per `dialIntervalMs`; answered customers go round-robin to a free agent, and with nobody free the call is abandoned; five consecutive errors back the campaign off for 30 seconds. |

**Live updates.** `demo/bus.ts` is the in-browser replacement for the WebSocket. Handlers and
simulators emit `data:changed` with a list of scopes (`agents`, `calls`, `campaigns`, `metrics`
...); `lib/live.ts` maps scopes to query keys and invalidates them, so the wall refreshes
because the data changed, not on a timer. A call that only lit up a toast would be a lie, so
every event also changes the store.

**Cross-tab.** `startTabSync()` mirrors the human operator's records (agent state, calls,
numbers, DNC entries, feed events) to other tabs over `BroadcastChannel('dareke-demo')`, tagged
with a per-tab id so a tab never echoes its own messages, and human-made ids carry the tab id so
two tabs cannot collide. The floor simulation is not mirrored; each tab runs its own. The channel
persists nothing: a reload still restores the seed.

**Failure.** A handler throws `DemoApiError`; the client turns it into the `ApiError` the pages
already understand, and field errors land under the right input. Validation messages are
translation keys where the UI owns the wording.

**Look.** Dareke is rebuilt, not ported: the interface is original and shares nothing with the
upstream design. Warm paper and carbon, electric lime as the live signal (lime on screen means a
call is going out), Archivo for display, Instrument Sans for text, Noto Sans Georgian for `ka`
and Geist Mono for phone numbers and timers, all bundled through `@fontsource`. The logo is the
outbound ring: one dot sending concentric quarter-arcs to the upper right.

## The original's architecture

What the real product is, in generic terms. None of this is bundled here.

| Layer | Detail |
|---|---|
| **Front end** | React 18, Vite, TypeScript, Tailwind and shadcn/ui on Radix, TanStack Query, React Router, framer-motion, Recharts, react-i18next, sonner, date-fns, and **SIP.js** for the browser softphone. It loads a public runtime config (API URL, WebSocket URL, WebRTC switch, SIP WSS URL and domain, ICE servers) from the back end before it renders. |
| **API** | Node 20 and Fastify with Zod validation, `@fastify/jwt` and `@fastify/websocket`, pino logging. Twelve modules (auth, users, campaigns, agents, calls, dialer, dispositions, DNC, recordings, dashboard, settings, system config) behind more than a hundred routes. |
| **Auth** | JWT with local bcrypt passwords, or an LDAP / Active Directory bind (sAMAccountName filter) that auto-provisions the user on first sign-in. Four roles: operator, supervisor, admin, super admin. |
| **Data** | PostgreSQL 16 through Prisma: 14 models (users, agent statuses and sessions, agent state logs and current states, campaigns, campaign agents, campaign numbers, disposition codes, call records, DNC list, system settings, system config with encrypted secrets, audit logs) and 3 migrations. Lead rows are unique on campaign, phone and instance number, which is how duplicates are kept on purpose. |
| **Realtime** | Redis 7 pub/sub channels (agent state changes, PBX hangup / bridge / hold / unhold events, campaign and call updates) fan out to one authenticated `/ws` WebSocket. Clients get a snapshot of agent states on connect, are subscribed by role, and ping every 30 seconds. |
| **Telephony** | An Asterisk / FreePBX PBX driven over AMI (Originate, Hangup, Redirect for transfer, QueueAdd / QueueRemove / QueuePause, QueueStatus) with auto-reconnect. A call is originated to the customer, and once they answer it is placed in the campaign's queue, FreePBX rings the agent's PJSIP extension, and the agent answers in the browser over SIP on WSS. Queue membership follows agent status: working unpauses, paused pauses with a reason, offline removes. A built-in mock mode simulates calls when no PBX is attached. |
| **Dialler** | An in-process 1-second loop with ratio pacing per campaign, round-robin agent assignment, retries for no-answer and busy leads after a delay, working-hours and DNC checks, and error backoff. |
| **Integrations config** | PBX and directory settings are stored encrypted in the database by a super admin and override environment variables, each with a connection test. |
| **Infra** | Docker Compose with PostgreSQL, Redis, the API and the front end, plus a database browser and a Redis browser for development. Setup guides for the PBX, the WebRTC path and the dialler. |

## The data

`demo/seed/reference.ts` holds the static reference data - users, statuses, dispositions and
campaigns with their bilingual call scripts, plus the name and city lists leads are drawn from -
and `demo/seed/index.ts` builds the rest relative to `now`. Everything is invented; phone numbers
come from one obviously synthetic block (`+9955000xxxxx`), the email domain is `.example`, and the
client companies on the campaigns do not exist. The full field-by-field model is in
[`src/demo/schema.md`](src/demo/schema.md) and every endpoint in [`src/demo/routes.md`](src/demo/routes.md).

| Table | Rows |
|---|---|
| `users` | 13: 1 super admin, 1 admin, 2 supervisors, 9 operators (one inactive, one without an extension). |
| `agentStatuses` | 8: Available, On call, Wrap-up, Break, Lunch, Meeting, Training, Offline. |
| `dispositions` | 9: Sale, Interested, Call back later, Not interested, Voicemail, No answer, Busy, Wrong number, Do not call. The sort order is the hotkey. |
| `campaigns` | 7: two active AUTO, one active MANUAL, one paused AUTO, one draft with no agents, one completed, one archived. |
| `campaignAgents` | 22 assignments. |
| `numbers` | About 750 leads (753 at the time of writing), with statuses derived from the call history. Active campaigns keep at least 80 pending; a few pending leads are on the DNC list to show the skip. |
| `calls` | Roughly 450 to 530 depending on the hour: the last 30 days of weekday traffic, about 90 of them today, plus four in progress for the fake agents already on a call. |
| `dnc` | 25, from all four sources. |
| `agentStates`, `agentStateLogs`, `callEvents` | 9, 9 and 30: who is doing what right now, and the live feed's backlog. |
| `settings`, `systemConfig`, `autoDialer` | One object each. |

## Layout

```
src/
  main.tsx, routes.tsx        Boot and the lazy route table with its role guards
  types.ts                    Every shared type (the contract between the mock backend and the UI)
  app/                        Shell: layout, guards, nav, command palette, shortcuts, theme, demo chrome, login
  components/ui/              The design-system primitives (see its README); components/brand/ the logo
  features/
    agent-workspace/          /agent - zones, dial bar, top-bar controls
    supervisor-wall/          /supervisor - tiles, feed, charts, auto-dialler panel
    reports/                  /reports and /calls
    campaigns/                /admin/campaigns - list, detail, tabs, import dialog
    admin-users/              /admin, /admin/users, the role rules
    admin-config/             statuses, dispositions, DNC, settings, integrations
      (each feature: api.ts, pages/, components/, locales/{en,ka}/*.json)
  demo/
    index.ts                  Wires the mock API, the handlers and the simulators; resetDemo()
    accounts.ts               The four sign-in accounts and the shared password
    store.ts                  createStore + createSession
    bus.ts                    Event bus and BroadcastChannel tab sync
    seed/                     reference.ts (static data) and index.ts (buildSeed)
    domain/index.ts           Shared state machines and helpers
    handlers/                 auth, agent-workspace, supervisor-wall, reports, campaigns, admin-users, admin-config
    sim/                      operator.ts, floor.ts, autoDialer.ts
    schema.md, routes.md      The data model and the endpoint list
  i18n/, lib/                 i18next setup and common strings; api client, CSV, formatting, live invalidation
  styles/index.css            Tokens and base styles
public/
  favicon.svg
  samples/                    A sample lead list and a sample DNC list for the import dialogs
```

The bundle has no media folder: the interface is type, colour and the ring, and there is nothing
to download that is not code.
