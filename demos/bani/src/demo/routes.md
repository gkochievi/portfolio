# Bani demo: endpoints

Every route the mock API answers: 67 registered calls in nine handler groups. All paths are
under the virtual prefix `/api` (set in `createMockApi` in `src/demo/core.ts`); the UI reaches them
through `http.get/post/put/patch/del` in `src/lib/api.ts`. Request and response bodies are
structured-cloned, so a handler can never hand the UI a live reference into the store.

**Behaviour shared by all routes**

- **Latency.** Reads answer in 120 to 380 ms and writes in 200 to 520 ms, on top of any `sleep` a
  handler adds for a long-running action.
- **Auth.** `/api/auth/*` is the only unauthenticated prefix. Everything else answers `401
  Authentication credentials were not provided.` while signed out.
- **Feature gate.** "Needs `x`" means `requireFeature('x')`: `403` unless the signed-in role has
  that feature after RBAC overrides (the superadmin always does). The default holders are in
  `src/lib/rbac.ts`: `cdr` admin, user, cc-admin, tel-admin, cc-operator, tel-operator;
  `cc_campaigns`, `cc_agents`, `cc_nodes` admin, cc-admin; `extensions` admin, it-support;
  `systems_sync`, `logs`, `health`, `settings`, `rbac` admin; `users` nobody (superadmin only).
- **Errors.** `DemoApiError.validation({field: message})` is a `400` whose `fieldErrors` land under
  the right form input. `409` is used for "already running", "no reservation" and similar state
  conflicts, `404` for an unknown id, `403` for a missing feature.
- **Paging.** `paginate()` slices by `?page=1&pageSize=50` (page size 1 to 500) and answers
  `{items, total, page, pageSize, hasMore}`.
- **Owner files** are `src/demo/handlers/<group>.ts`; simulators live in the same file as the
  routes they animate.

## Auth and session — `handlers/auth.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Signs in. Matches a persona by username or `@bani.example` e-mail; any other non-empty pair signs in as the superadmin. Empty fields → `400 Invalid username or password`. Returns the persona. |
| POST | `/auth/logout` | public | Signs out. |
| GET | `/me` | session | The persona, role, allowed features (overrides applied), allowed call platforms, the campaigns a cc-admin is scoped to, and the tenant. |
| POST | `/auth/verify-password` | session | The "confirm your password" step before destructive archive actions. Any non-empty password passes after 300 to 700 ms; empty → `400` field error. |

## Calls and recordings — `handlers/calls.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/calls/search` | `cdr` | Searches both platforms at once: partial number (caller or called), or a recording file name (which ignores number and dates), over a date range. The requested platform is clamped to what the role may see; each source reports its own count and availability, plus warnings and elapsed time. Rows come back as legs; merging and transfer chains are computed in the client. |
| POST | `/recordings/lookup` | `cdr` | The recording for one call id, if any: `found` with the results (exact or fuzzy match, primary and backup copy), or not found with a reason (`call_not_found`, `never_answered`, `no_recording`). 403 for a platform the role may not search. |
| POST | `/recordings/bundle` | `cdr` | Decides what a ZIP download contains: up to 200 call ids, `original` or `mp3`; returns `included` (with a de-duplicated file name and the asset) and `skipped` (with a reason, including `not_permitted`). The ZIP itself is built in the tab. |

## Archive jobs — `handlers/archive.ts` (all need `systems_sync`)

A one-second tick advances every running job through its state machine and appends log events;
`archive:changed` and `archive:event` make the page refetch.

| Method | Path | Purpose |
|---|---|---|
| GET | `/archive/core/status` | Core Cluster import: record and file totals, oldest and newest record, local files waiting, last sync, running flags. |
| POST | `/archive/core/sync` | Starts a job. Body `mode`: `local`, `reconcile`, `full`, or `reset` (forgets which drop files were imported). `409` while one runs. |
| DELETE | `/archive/core/records` | Empties the imported records (the "start over" action); `409` while a sync runs. |
| GET | `/archive/core/runs` | Paged import runs, filter `?type=`, with a summary (total runs, records imported, last success). |
| GET | `/archive/edge/mirror` | Edge PBX mirror status and the last range check. |
| POST | `/archive/edge/mirror/check` | Compares a date range of the source with the mirror: total, distinct, duplicates, mirrored, missing. Takes 0.5 to 1.3 s. |
| POST | `/archive/edge/mirror/reconcile` | Starts a backfill run for a range; `409` if a manual one is running. |
| GET | `/archive/edge/mirror/runs` | Paged mirror runs. |
| GET | `/archive/hangup` | The "Hangup by" probe: event table present, carries a hangup source, rows filled, rows not yet checked. |
| POST | `/archive/hangup/backfill` | Starts the backfill for a range; its length scales with the number of days. `409` if running. |
| GET | `/archive/backup` | Recording backup overview: per-source summaries, schedule, retry window. |
| GET | `/archive/backup/runs` | Paged backup runs, filter `?flow=`. |
| GET | `/archive/backup/runs/:id` | One run; `404` if unknown. |
| POST | `/archive/backup/runs` | Starts a manual backup per chosen source over a range (one run per source). Files to copy come from the seeded per-day inventory. `409` if that source already has a running backup. |
| POST | `/archive/backup/runs/:id/cancel` | Requests cancellation; only a running backup can be canceled. |
| GET | `/archive/backup/events` | The live event tail, filters `flow`, `minLevel`, `limit` (at most 500). |
| GET | `/archive/verify` | The 12 most recent verify runs, without their per-day rows. |
| POST | `/archive/verify` | Starts a verify for a date range (today excluded) on one or all sources, one run per source. `409` if that source is already being verified. |
| GET | `/archive/verify/:id` | One verify run with its day rows. |
| POST | `/archive/verify/:id/cancel` | Cancels a running verify. |
| POST | `/archive/verify/:id/backfill` | Copies what the verify found missing: starts a backup run triggered by `verify:<id>` and links it as `backfillRunId`. `409` if nothing is missing or one is already running. |

## Contact centre

### Agents — `handlers/agents.ts` (all need `cc_agents`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/cc/agents` | Every agent with team name and skill list, sorted by name. |
| GET | `/cc/agents/:userId` | One agent. |
| PUT | `/cc/agents/:userId` | Sets one team and the skill levels (1 to 10), validated; writes an activity row. |
| GET | `/cc/skills` | Skills with how many agents hold each. |
| GET | `/cc/teams` | Teams. |
| POST | `/cc/skills/:skillId/roster` | Bulk staffing: `changes: {userId, level \| null}[]`. Answers `{assigned, unassigned, levelChanged, unchanged, failed[]}`. With two or more changes, one effective change fails about a third of the time ("held by another admin"), so the partial-failure result can be seen. |

### Campaigns and nodes — `handlers/campaigns.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/cc/campaigns` | `cc_campaigns` | Campaigns, narrowed to the ids a scoped cc-admin may manage. |
| GET | `/cc/campaign-settings` | `cc_campaigns` | `isSuperAdmin` and the dedicated-port cap for everyone else. |
| GET | `/cc/campaigns/:id` | `cc_campaigns` | One campaign; logs a `campaign_view` (rate-limited). |
| PUT | `/cc/campaigns/:id` | `cc_campaigns` | Partial update: `enabled`, `numDedicatedPorts`, `linesPerPort` (1.0 to 3.0, one decimal), `maxDialAttempts` (1 to 3). Over-cap ports for non-superadmins are refused and logged as `dedicated_ports_above_limit`. |
| GET | `/cc/activity` | `logs` or `cc_campaigns` | Paged contact-centre activity, newest first, last 200. |
| GET | `/cc/nodes` | `cc_nodes` | The server cards; a tick moves CPU, memory and uptime every 5 s. |

## Extensions — `handlers/extensions.ts` (need `extensions`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/extensions` | The directory, by number. Sweeps expired locks first. |
| GET | `/extensions/next` | The next free number above the current maximum (skipping reserved and locked ones, wrapping to the lowest gap), the reserved list and the range. `409` when the range is full. |
| GET | `/extensions/lock` | The caller's current reservation, or `null`. |
| POST | `/extensions/lock` | Reserves the next free number for 10 minutes (idempotent per user). Writes `create_start`. |
| DELETE | `/extensions/lock` | Releases it (`create_abort`). |
| POST | `/extensions` | Creates the reserved number for an e-mail and secret. Needs a lock (`409 no_reservation`). Validation codes: `required`, `invalid_email`, `duplicate_email:<number>`; the display name defaults to the e-mail's local part. Writes `create_finish` or `create_error`. |
| POST | `/extensions/beacon` | Called when the tab is hidden while a number is held; logs `disconnect` once per few seconds. The lock is kept until it expires. |
| GET | `/extensions/activity` | The audit trail, newest first. Admin or superadmin only. |
| POST | `/extensions/activity/purge` | Deletes rows older than 90 days, writes `purge_logs`, returns `{deleted}`. Admin or superadmin only. |

## Platform health — `handlers/health.ts` (all need `health`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/metrics` | Host metric buckets for the last `?hours=`. |
| GET | `/health/live` | One live host sample, fresh on every call; the page polls it for the sparklines. |
| GET | `/health/pings` | Ping rows per target for the last `?hours=`. |
| GET | `/health/snapshot` | The platform as it was at `?at=`: the nearest metric bucket and the nearest ping per target. `400` for an unparsable or future time. |
| GET | `/selftest` | Latest run, paged history, collector flag and the next scheduled run (at :05 every hour). |
| POST | `/selftest` | *Run tests now.* Takes 1.5 to 3 s, prepends a new run; `409` if one is running. |

## People — `handlers/people.ts` (all need `users`, so superadmin only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/users` | Console users by username. |
| POST | `/users` | Creates a directory, local or API account. Validates role, type pairing, username shape and uniqueness, e-mail; generates a password when none is sent and returns it once as `generatedPassword`. |
| PATCH | `/users/:id` | Edits role, display name, e-mail, active flag, access mode, download format, campaign scoping. Cannot change an API account's role, your own role, or disable yourself. |
| POST | `/users/:id/password` | Resets and returns a generated password for a local or API account; directory accounts → `400`. |
| DELETE | `/users/:id` | Deletes. Not the superadmin, not yourself. |
| GET | `/directory` | The directory, filtered by `?search=`, with `alreadyRegistered` derived. |
| GET | `/directory/role-mappings` | Group-to-role mappings and the nested-groups flag. |
| PUT | `/directory/role-mappings` | Replaces them; validates the distinguished-name shape, duplicates and the role. |

A simulator gives an active directory or local account a fresh last-login from time to time, so the
table moves while it is open.

## Access — `handlers/access.ts`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/rbac` | `rbac` | The matrix: roles, features (with `overridable`), defaults, current overrides, the caller's role. |
| PUT | `/rbac` | `rbac` | Replaces the overrides after sanitising: unknown roles, non-overridable features and non-boolean values are dropped, and a non-superadmin's edits to its own row are ignored. Emits `rbac:changed` so the rail and guards recompute. |
| GET | `/connections` | `settings` | The 13 service configs; stored secrets come back as `__UNCHANGED__`. |
| PUT | `/connections/:key` | `settings` | Saves `enabled` and the field values; secrets sent back as the sentinel are kept. Field validation → `400`. Saving `contact_centre` updates the campaign port cap; saving `backup_schedule` derives its cron string. |
| POST | `/connections/:key/test` | `settings` | Tests what is on screen (an optional draft overrides the stored values). Takes 0.8 to 2 s. Missing or invalid fields fail without a probe; one link fails on a rejected login; the rest answer `ok` with a latency figure. |
