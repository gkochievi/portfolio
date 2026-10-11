# Azri demo — registered endpoints

24 handlers, registered with `api.register(method, path, handler)` from `src/demo/handlers/*.ts`.
The mock API is created in `core.ts` with `prefix: '/api'`, and the UI calls
`request(method, path)` from `@/lib/api`, which dispatches `/api` + path. Paths below are the full
paths the router answers. They are registered **without a trailing slash**.

The same list is served live by `GET /api/playground/routes` and rendered in the playground's
endpoint panel (method, path, public or authenticated).

## Cross-cutting rules

| | |
|---|---|
| **Latency** | Reads answer in 120-320 ms and writes in 350-800 ms, applied once by `createMockApi`. Handlers never sleep. The survey calls are POSTs, so they get the longer, write-sized delay: the validation spinner and the submit animation need the time. |
| **Auth gate** | `/auth/`, `/surveys/`, `/inbox/`, `/playground/` and `/meta` are public. Everything else needs a session, or the router answers **401** before the handler runs. |
| **Role gate** | Console handlers call `requireRole('admin')` or `requireRole('admin', 'agent')` first. A wrong role is **403** `You do not have permission to perform this action.` |
| **Agent scoping** | An agent is always scoped to their own `staffId`, `branchId` and `tenantId`, whatever params or body they send. |
| **Survey envelope** | The three survey calls return **HTTP 200** with `{ success: true, data }` or `{ success: false, message, meta? }`, as the original did. Only a malformed request is a 400. |
| **Validation errors** | `DemoApiError.validation({ field: message })` → **400**, with `fieldErrors` surfaced under the matching input. |
| **Unknown record** | `notFound()` → **404**. A known path with the wrong verb is **405**. |
| **Pagination** | `?page` (1-based, clamps to the last page) and `?pageSize` (1-100) → `Page<T>`; the default size is listed per route. |
| **Time** | Expiry and "today" read `clock.now()`, the demo clock. |
| **Realtime** | Writes emit on the event bus; `lib/realtime.ts` invalidates every query scope except `survey`. |

## Meta and auth

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/api/meta` | public | `MetaLookups`: all tenants, branches, staff and campaigns, for filters, chips and the send form | `handlers/meta.ts` |
| POST | `/api/auth/login` | public | `{ email, password }` → the account without its password; signs the session in. Missing fields → 400 field errors; a wrong pair is rejected by the session | `handlers/auth.ts` |
| POST | `/api/auth/logout` | public | Signs out; returns `null` | `handlers/auth.ts` |
| GET | `/api/auth/me` | public | The current account, or `null` | `handlers/auth.ts` |

## Survey (the respondent microsite)

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| POST | `/api/surveys/validate` | public | `{ survey_id, lang? }` → `ApiEnvelope<ValidateData>`: campaign title and description, the ordered questions, the tenant's branding and the visit context (touchpoint, branch, staff, dates). Failures: unknown → `Survey not found`; spent → `Survey already completed`; past `expiresAt` or expired → `Survey link expired`; the latter two carry `meta { tenantId, status }` so the end screens stay branded. A missing `survey_id` → 400 | `handlers/survey.ts` |
| POST | `/api/surveys/questions` | public | `{ survey_id, lang? }` → `ApiEnvelope<{ questions }>`, the same failure rules | `handlers/survey.ts` |
| POST | `/api/surveys/responses` | public | `{ survey_id, responses: [{ id, question_rate }], comment }` → `ApiEnvelope<{ responseId }>`. `question_rate` must be `null` or an integer 1-5, the comment at most 2000 characters (400 otherwise). Stores a `SurveyResponse` (source `session`) with one answer per campaign question, sets the link `completed`, emits `response:created` and `link:updated`. A used, expired or unknown token gets the same failure envelope as above | `handlers/survey.ts` |

## Inbox and playground (the launcher)

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/api/inbox/recipients` | public | `RecipientSummary[]`: the six personas with live pending, completed, expired and total counts, and the account that plays each | `handlers/launcher.ts` |
| GET | `/api/inbox/recipients/:recipientId/messages` | public | `InboxMessage[]` for one persona, newest first, with the live `linkStatus` (`pending`, `completed`, `expired`, `unknown`, `missing`), the tenant's colours and the campaign title. Unknown persona → 404 | `handlers/launcher.ts` |
| GET | `/api/inbox/branches` | public | `BranchSample[]` for the "try every branch" strip: valid, already answered, expired, unknown id, missing id. Once time travel has spent every persona link, "valid" falls back to a background link | `handlers/launcher.ts` |
| GET | `/api/playground/routes` | public | This list: `{ method, path, requiresAuth }[]`, read from the router itself | `handlers/launcher.ts` |
| GET | `/api/playground/clock` | public | `{ offsetMs, now }` — the demo clock | `handlers/launcher.ts` |
| POST | `/api/playground/clock` | public | `{ days }` (0-60; strings accepted) → sets the clock offset to that many days ahead and returns the new state. `0` resets to real time and revives links that only expired because the clock moved past them. Out of range or non-numeric → 400. Emits `clock:changed` | `handlers/launcher.ts` |

## Console, admin

All need a session with the **admin** role.

| Method | Path | Params | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/api/console/overview` | `tenantId`, `branchId`, `staffId`, `campaignId`, `days` (7, 30 or 90; default 30) | `Overview`: KPIs and the same KPIs for the previous window (for the deltas), the daily trend, the 1-5 distribution, a per-tenant breakdown (per-branch once a tenant is chosen), per-question stats when a campaign is chosen, and the 8 newest comments | `handlers/insights.ts` |
| GET | `/api/console/responses` | the overview filters, plus `rating` (1-5, matched on the rounded average), `hasComment=true`, `q`, `page`, `pageSize` (default 20) | `Page<ResponseRow>`, newest first. `q` is a fuzzy search over comment, staff, branch and token (Fuse.js) | `handlers/insights.ts` |
| GET | `/api/console/responses/:responseId` | | `ResponseDetail`: every question with its rating, the comment verbatim, the link's dates. Unknown → 404 | `handlers/insights.ts` |
| GET | `/api/console/campaigns` | `tenantId`, `days` | `CampaignSummary[]`: each campaign with its tenant, question count, KPIs and a 14-day trend | `handlers/campaigns.ts` |
| GET | `/api/console/campaigns/:campaignId` | `days` | `CampaignDetail`: per-question stats and histograms, KPIs, trend, distribution, a by-branch table and the latest comments. Unknown → 404 | `handlers/campaigns.ts` |
| GET | `/api/console/links` | `status` (`pending`, `completed`, `expired`), `tenantId`, `campaignId`, `branchId`, `q` (token or masked phone digits), `page`, `pageSize` (default 20) | The SMS dispatch log: `Page<LinkRow>` plus `counts { all, pending, completed, expired }` computed before the status filter, so the tabs always add up. Newest sent first; links sent "in the future" of a rewound clock are hidden | `handlers/campaigns.ts` |

## Console, branch staff

| Method | Path | Auth | Purpose | Owner file |
|---|---|---|---|---|
| GET | `/api/console/me/overview` | agent | `?days` (7, 30, 90) → `MyOverview`: the staff member, branch and tenant; KPIs, trend and distribution over their own responses; per-question stats for their main campaign; their average against the branch's and the tenant's; their rank among the branch's staff | `handlers/staff.ts` |
| GET | `/api/console/me/responses` | agent | `?page&pageSize&hasComment=true` (default 8) → `Page<ResponseRow>` of their own responses | `handlers/staff.ts` |
| GET | `/api/console/send/options` | admin, agent | `SendOptions`: tenants, campaigns, branches, staff and the six personas. An agent gets only their own tenant, branch and self, with `locked: true` | `handlers/staff.ts` |
| POST | `/api/console/send` | admin, agent | `{ campaignId, branchId, staffId, recipientId? \| phone?, interactionAt? }` → the new `LinkRow`. Validation: the campaign must belong to the branch's tenant, the staff member to the branch, and exactly one of a persona or a phone — the phone must match the obvious fake pattern `5XX 00 00 XX`; the interaction must not be in the future or older than 30 days (all 400 field errors). An agent is forced to their own branch and staff. Creates a pending link with a fresh token and `expiresAt = now + linkTtlDays`, `sentBy` the staff member; emits `link:updated`. For a persona, an `SmsMessage` is added ~1.2 s later and `sms:received` is emitted; a free phone number has no inbox | `handlers/staff.ts` |
| GET | `/api/console/me/links` | admin, agent | `?page&pageSize` (default 8) → `Page<LinkRow>`: links sent by me (admin: every link sent through the form, i.e. `sentBy !== 'system'`), newest first | `handlers/staff.ts` |

## Not endpoints, but part of the surface

| | |
|---|---|
| `simulators/insights.ts` | Every 40-70 s (paused while the tab is hidden) completes one random background pending link with a generated response, then emits `response:created` and `link:updated`. Never touches a persona link |
| `simulators/campaigns.ts` | The expiry sweeper: every 30 s and on `clock:changed` |
| `simulators/staff.ts` | Bookkeeping for the ~1.2 s SMS delivery timers; a demo reset cancels the ones in flight |
| `sync.ts` | A `BroadcastChannel` (`azri-demo`) replays writes — an answered survey, a sent link, a delivered SMS, a clock change, a reset — on the other open tab's store. Persists nothing |
