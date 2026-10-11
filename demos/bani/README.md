# Bani — live demo

A voice operations console, running with its backend cut off.

Bani (ბანი, the bass voice in Georgian three-part singing: the steady drone that holds the other
voices together) is the fictional brand this demo wears. Underneath it is a console Boulder built
for one company that runs its telephony on two different phone platforms and wanted a single
place to work with both. It searches and stitches call records across the platforms, rebuilds
transfers, plays and archives recordings with verifiable backups, staffs contact-centre agents
and outbound campaigns, provisions phone extensions, and watches the health of the whole estate —
all under per-role permissions.

Here the same screens talk to an in-browser mock of the API: seed data compiled into the bundle,
an in-memory store, and a router that answers the same paths with the same payloads. No server,
no database, no network request of any kind. The tenant is made up (**Saguramo Mutual**, domain
`bani.example`, time zone `Asia/Tbilisi`), every person, number and file is invented, and the
call recordings are three short clips generated offline from a local text-to-speech voice and
tones. Nothing here is a real call.

The store boots **signed in** as the superadmin, so the demo opens on the Call Explorer with
today's calls already searched. English is the default; `?lang=ka` on first load opens Georgian.

## Running it

| Command | |
|---|---|
| `npm run dev:bani` | Vite dev server at <http://localhost:5179/demos/bani/> |
| `npm --workspace @demos/bani run build` | `tsc -b --noEmit`, then `vite build` into `demos/bani/dist/` |
| `npm --workspace @demos/bani run typecheck` | TypeScript strict |
| `npm run build` (repo root) | Builds the site and every demo into the deployable `dist/` |

Run all of them from the repo root. `VITE_BASE` (default `/demos/bani/`) and `VITE_ROUTER=hash`
are the two build-time knobs — see the [root README](../../README.md). The bundle works in an
iframe, under a sub-path and with the hash router.

## Accounts

Eight one-click personas, one per role. The password for all of them is **`bani-demo`**. The
sign-in page also takes any non-empty username and password: a name that matches a persona (or
its `@bani.example` address) signs in as that persona, anything else signs in as the superadmin.
The *View as* switcher in the demo bar changes persona without a sign-out.

| Role | Name | Username | What it can do |
|---|---|---|---|
| superadmin | Ana Lomidze | `ana.lomidze` | Everything, including People, and no campaign port cap. |
| admin | Giorgi Beridze | `giorgi.beridze` | The whole estate except console accounts. |
| cc-admin | Nino Chikovani | `nino.chikovani` | Core Cluster calls, agents, campaigns (port cap 10), nodes. |
| tel-admin | Levan Gelashvili | `levan.gelashvili` | Edge PBX call records only. |
| cc-operator | Mariam Kapanadze | `mariam.kapanadze` | Core Cluster call records only. |
| tel-operator | Davit Kiknadze | `davit.kiknadze` | Edge PBX call records only. |
| it-support | Salome Shengelia | `salome.shengelia` | Reserves and creates extensions. |
| user | Luka Japaridze | `luka.japaridze` | Read-only: searches call records on both platforms. |

Access is layered the way the original was: each role's defaults, then overrides edited on the
**Roles** page, then the superadmin, who is always allowed. An override takes effect everywhere at
once — the rail, the route guard and the API's 403s all read the same `roleCan()` — so switching a
cell off and then *View as* that role shows the effect immediately. A role also clamps which call
platform it may search: Core Cluster roles never see Edge PBX rows and the other way round.

## What works

Twelve pages behind a 68 px icon rail (a bottom tab bar on phones), a top bar with breadcrumbs,
Cmd-K call search, a KA/EN toggle and a light/dark toggle.

| Route | Page | Needs |
|---|---|---|
| `/calls` | **Call Explorer.** Search by partial number (caller or called), by recording file name, or by date range; filter by platform. Legs are stitched into logical calls (expandable), transfers are rebuilt into a party chain, a drawer shows details, raw record and recording with a waveform player. Export the table to a real `.xlsx`; download selected recordings as a real ZIP with a manifest. | `cdr` |
| `/archive` | **Archive Jobs.** Four stacked sections: Core Cluster import (sync, reconcile, full history, reset), Edge PBX mirror (check a range, backfill), "Hangup by" backfill, and recording backup (per-source summaries, manual runs, live events, **Verify a date** with a day-by-day comparison and a backfill of what is missing). | `systems_sync` |
| `/agents` | **Agents.** *By agent*: team and skills editor. *By skill*: bulk staffing with a competency level per agent, a confirm step and a partial-failure result. | `cc_agents` |
| `/campaigns` | **Campaigns.** Pick a campaign, enable or disable it, tune dedicated ports, lines per port and dial attempts. Non-superadmins are capped. | `cc_campaigns` |
| `/nodes` | **Node monitor.** CPU, memory and uptime cards for the contact-centre servers, refreshing live; one server is down. | `cc_nodes` |
| `/extensions` | **Extension provisioning.** Reserve the next free number (a 10-minute lock with a countdown), create it, browse the directory. | `extensions` |
| `/extensions/activity` | Audit trail of provisioning, with a purge of old rows. | `extensions`, admin or superadmin |
| `/status` | **Platform status.** Voice lanes per ping target, live host metrics, the hourly self-test with history, and *Run tests now*. | `health` |
| `/activity` | **Activity hub.** Import runs, mirror runs, backup runs and contact-centre activity in one place. | `logs` |
| `/people` | **People.** Console users (directory, local and API accounts), a directory picker, group-to-role mappings, campaign scoping. | superadmin |
| `/roles` | **Roles.** The permission matrix: features by roles, with a "modified" dot on every cell that differs from its default. | `rbac` |
| `/connections` | **Connections.** Thirteen integration cards, each with an enabled switch, typed fields, masked secrets, Save and *Test connection*. | `settings` |

`/login` exists for signing out and switching persona; `/` redirects to the first page the role
may open.

## What is deliberately switched off

The original reaches into real infrastructure. None of that is reachable here, so each job is a
simulation that is honest about being one:

- **No infrastructure is touched.** Directory binds, SNMP polls, file-share copies, recording
  stores, phone-platform APIs and databases are all replaced by seeded state and timers. A sync,
  mirror check, backup, verify or self-test *behaves* like one — progress, log events, failures —
  and changes the store, but nothing is imported from anywhere.
- **Passwords are not checked.** Sign-in and the "confirm your password" step on destructive
  archive actions accept any non-empty value.
- **The three recordings are reused.** Every recorded call maps, by a hash of its id, to one of
  `rec-a`, `rec-b`, `rec-c`. Peaks for the waveform are precomputed, so no audio is decoded to
  draw it.
- **Test connection is simulated.** It answers after a realistic delay with a latency figure. One
  link (the second Edge PBX recordings share) is unhappy until its password is replaced, so the
  failure path can be seen.
- **Extension secrets are obviously fake** (`word-####`), shown behind a reveal toggle exactly as
  upstream does.
- **The legacy single-agent skills editor is not rebuilt.** It duplicated *By agent* and was cut.
- **Nothing is saved.** Not data, not the language, not the theme. A reload restores the pristine
  seed, in English, following the OS theme. The **Reset demo data** button in the demo bar does
  the same without the reload (`resetDemo()`: store reset, simulators told to drop their job
  state, the query cache cleared).

Exports are real: the `.xlsx` and the recordings ZIP are built in the tab and saved through a
Blob, and both open in ordinary tools.

## How the demo works

```
features/*/pages + components      12 pages. Know nothing about the mock.
        │   useCallsSearch(), useAgents(), useStartBackup() …
        ▼
features/*/api.ts                  TanStack Query hooks per feature: cache keys, invalidation.
        │   http.get('/cc/agents')
        ▼
lib/api.ts                         The client. request() calls api.dispatch(); a real backend
        │                          would swap that one line for fetch().
        ▼
demo/core.ts                       @portfolio/demo-kit: createMockApi (route table, latency,
        │                          401/403/404/405, validation errors, abort), createStore,
        │                          createSession, createEventBus.
        ▼
demo/handlers/*.ts                 67 routes in nine groups, plus the simulators beside them.
        │   requireFeature('cdr') → 403 unless the signed-in role has it
        ▼
demo/seed/*.ts                     Generated once at module load from fixed random seeds.
```

**The store.** `createStore(seed, { prepare })` holds a `structuredClone` of the seed for the life
of the tab. The seed is authored as of `SEED_ANCHOR` (2026-09-02 11:30 UTC); `prepare` runs
`rebaseDates` on every fresh copy — boot and every reset — which shifts each timestamp by *now
minus the anchor*, so "today" is never empty and "last sync 14 minutes ago" is always true. Then
`refreshDerived` re-derives the strings that embed a date and the shift would otherwise leave
stale: recording file names (rebuilt from their leg's call date) and archive day-folders and
file names (moved by the same whole days).

**The session.** `createSession(personas, { initial })` is in memory only. `/api/auth/*` is the
one unauthenticated prefix; every other call without a session is a 401. `GET /api/me` returns the
persona, the features its role may use (overrides applied), the call platforms it may search, the
campaigns it is scoped to and the tenant.

**The simulators.** Anything that would be a background process upstream is a timer started with
`every(ms, fn)`, which pauses while the tab is hidden:

| Simulator | Tick | What it does |
|---|---|---|
| Archive jobs (`handlers/archive.ts`) | 1 s | Advances every running job — Core Cluster sync, Edge PBX mirror, backfill, backup run, verify — through its own state machine, appends log events, and now and then starts an ambient scheduled run. Emits `archive:changed` / `archive:event`. |
| Host collector (`handlers/health.ts`) | 5 s | A live sample as a random walk around the last minute's bucket; one new 60 s metric row and ping row per target each minute, trimmed to 24 h; a scheduled self-test at :05 every hour. |
| Node monitor (`handlers/campaigns.ts`) | 5 s | Moves CPU, memory and uptime of the contact-centre servers. |
| Sign-ins (`handlers/people.ts`) | 40 s | Gives an active directory or local account a fresh "last login", so the People table moves while it is open. |
| Extension locks (`handlers/extensions.ts`) | 15 s | Releases expired reservations and logs them, even if nobody is on the page. |

The event bus (`bus`) carries `demo:reset`, `session:changed`, `rbac:changed`, `archive:*`,
`health:sample`, `selftest:completed`, `cc:*` and `extensions:*`; `useDemoEvent` and
`useInvalidateOn` in `lib/live.ts` turn those into query invalidations, which is how a page
updates while a job runs.

**Failure crosses the seam unchanged.** Handlers throw `DemoApiError` (`403`, `404`, `409`,
`DemoApiError.validation({field: msg})`); the field errors land under the right input of forms
that were already rendering them.

The endpoint list is in [`src/demo/routes.md`](src/demo/routes.md); the data model and seed
counts are in [`src/demo/schema.md`](src/demo/schema.md).

## The original architecture

What the real product is built from, and what this demo replaces.

| Layer | Original | In the demo |
|---|---|---|
| App | Next.js (App Router) with React and Tailwind. Server components gate each page by feature and redirect; client pages guard again through a permissions endpoint. | A Vite SPA. The same gates run in the route table (`handle.feature`) and in `AppShell`. |
| Auth | Auth.js credentials provider, JWT session carrying role and username; users come from a directory (LDAP bind) or are local or API accounts. Group-to-role mappings decide the role of directory users. | `createSession` over eight personas; 45 seeded users and a 62-entry directory to pick from. |
| Permissions | Per-role feature table with admin-editable overrides, enforced in the layout, the pages and the API routes. | `lib/rbac.ts`, one pure module read by the rail, the guards, the API and the Roles page. |
| Data | PostgreSQL through Prisma: a local import of the enterprise phone platform's call-detail records, self-test runs, lock table, activity logs, service settings; plus a MySQL mirror of the open-source PBX's call records. | Arrays in the store (`schema.md`). |
| Call records | Two sources merged on read: flat files dropped over SFTP and imported by a cron job, and the PBX's own database mirrored on an interval. Legs are stitched into calls and transfers rebuilt in TypeScript. | The stitching and transfer code is the same pure TypeScript, run over 425 seeded legs. |
| Recordings | Looked up on a voice-archive server, streamed, zipped on request; a daily cron with a seven-day trailing retry copies them to an SMB file archive. A verify pass compares both sides day by day and backfills the gap. | Three synthetic clips, a lookup that returns found/not-found for the reasons the original does, and the backup/verify state machines. |
| Contact centre | The platform's XML admin REST API, proxied by Next API routes and parsed in the client; writes are read-modify-write per agent. | JSON, flattened; a roster apply can fail for one agent because "another admin holds it", as upstream can. |
| Platform health | An in-process collector samples the host every 5 s, writes 60 s buckets (average, min, max) kept for 30 days, and pings the configured backends; an hourly cron stores self-test runs. SNMP for the node monitor. | Generated 24 h of buckets and pings; the collector and the self-test are timers. |
| Extensions | A lock table with a 10-minute TTL swept on read, merged with the PBX's API; a beacon logs when the tab is hidden while a number is held. | The same lock, countdown, sweep and beacon. |
| Infra | Docker, a Node server, Postgres, MySQL read access, file shares, directory and SNMP reachability from the host. | A static bundle on a CDN. |

## The data

Generated by `src/demo/seed/*.ts` from fixed random seeds (`createRandom(20260902 + domain)`, one stream per group), so every
visitor sees the same estate. Full field lists in [`schema.md`](src/demo/schema.md).

| Group | Contents |
|---|---|
| People | 45 console users (38 directory, 5 local, 2 API; one disabled), a 62-entry directory, 4 group-to-role mappings. |
| Calls | 250 Core Cluster legs (219 calls) and 175 Edge PBX legs (149 calls); 207 legs with a recording. |
| Archive | 120 import runs, 50 mirror runs, 274 backup runs, 403 backup events, 90 archive day inventories, 1 verify run. |
| Contact centre | 70 agents (5 supervisors), 8 teams, 18 skills, 12 campaigns (8 enabled), 4 nodes, 200 activity rows. |
| Extensions | 120 extensions, 6 reserved numbers, 149 activity rows. |
| Platform | 30 self-test runs of 20 checks, 1,440 host-metric buckets, 1,152 pings over 4 targets, 13 connection configs. |

Phone numbers follow an obviously fake pattern; names, e-mail addresses and the tenant are
fictional; every host is under `.example`.

## Language

UI strings live next to the code that owns them, in `locales/<lng>/<namespace>.json`, gathered by
`buildResources(import.meta.glob(…))` — about 1,360 English and 1,390 Georgian keys (Georgian has
extra plural forms) across ten namespaces. Georgian type is Noto Sans Georgian; Latin is Epilogue
for display and Public Sans for text, with JetBrains Mono for identifiers and numbers. Audit
details are stored as English system text and, in Georgian, rendered through pattern rules
(`features/extensions/lib/details.ts`).

## File map

```
index.html · vite.config.ts · tsconfig.json · package.json
public/
  favicon.svg
  media/recordings/        rec-a · rec-b · rec-c .wav — generated offline, streamed by the player
src/
  main.tsx · routes.tsx    entry; the route table (lazy pages, handle.feature gates)
  types.ts                 every entity, the DemoDb store shape, the event-bus map
  api/                     client.ts · queryKeys.ts
  lib/                     api.ts (the seam) · live.ts · queryClient.ts · rbac.ts · format.ts · cn.ts
  i18n/                    index.ts · locales/{en,ka}/common.json
  styles/index.css         tokens, light and dark, fonts
  components/
    ui/                    the design system — see ui/README.md
    brand/                 wordmark and the "bass line" mark
  shell/                   AppShell · AppChrome (demo bar) · LoginPage · CommandSearch · nav · state
  demo/
    core.ts                store · session · bus · mock api · helpers (requireFeature, paginate, …)
    index.ts               registers every handler group
    handlers/              auth · calls · archive · agents · campaigns · extensions · health
                           · people · access
    seed/                  index · util · personas · calls · archive · contactCentre
                           · extensions · people · platform
    routes.md · schema.md  endpoint list · data model
  features/
    calls/                 pages · components · lib (mergeCalls, transfers, xlsx, zip, …) · media
    archive/               pages · components (six sections)
    agents/ campaigns/ extensions/ health/ people/ access/
                           each: pages · components · api.ts · locales/{en,ka}
```
