# Dareke mock API routes

81 handlers, registered on the kit's `createMockApi({ prefix: '/api' })` in
`src/demo/handlers/*.ts`. Paths below are what the front end asks for (`/api` + path); the
handlers register them without the prefix. `:id` style segments are path captures.

**Auth column.** *public* needs no session; *signed in* needs any active account; *operator*,
*supervisor+* (supervisor, admin, super admin), *admin+* (admin, super admin) and *super admin*
add a role check inside the handler, so the route guards in `routes.tsx` are never the only gate.
A missing session is a 401, a wrong role a 403, an unknown path a 404 and a known path with the
wrong verb a 405. Validation failures are a 400 whose field errors the forms render inline.

**Latency.** Reads answer in 150 to 320 ms and writes in 200 to 400 ms; the two connection tests
wait 0.8 to 1.5 s on purpose.

**Live effects.** Every write ends with `changed(...scopes)`, which emits `data:changed` on
`demo/bus.ts`; `lib/live.ts` invalidates the matching queries, so other screens refresh.

## Auth and shared reads - `handlers/auth.ts` (5)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Email and password against the four demo accounts. Missing fields are field errors; a wrong pair is a 400 `Unable to log in with provided credentials.`; a disabled account is refused. Returns `{ user, account }` and stamps `lastLoginAt`. |
| POST | `/auth/logout` | public | Ends the session. `{ ok: true }`. |
| GET | `/auth/me` | signed in | The signed-in `User`. |
| GET | `/dialer/status` | signed in | `{ connected, activeCalls }`: the header's dialler indicator. |
| GET | `/lookups/campaigns` | signed in | Every campaign as `{ id, name, status, dialingMode }`, for filter dropdowns. |

## Agent workspace - `handlers/agent-workspace.ts` (15)

All are operator-only except the lead history. The live call itself is owned by the operator
engine, `demo/sim/operator.ts`; these handlers start it, steer it and read it.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/agent/me/state` | operator | The operator's `AgentStateView`: status, since when, campaign, live call. |
| POST | `/agent/me/status` | operator | Change status (`{ statusId }`). Field error for an unknown status or a system one (set by the dialler); 409 during a call. |
| POST | `/agent/me/campaign` | operator | Focus a campaign the operator is assigned to. |
| GET | `/agent/me/campaigns` | operator | Active campaigns the operator is assigned to, with stats. |
| GET | `/agent/me/kpis` | operator | Today's calls, answered, average and talk time, conversions and recent dispositions. |
| GET | `/agent/me/calls` | operator | The operator's own recent calls. |
| GET | `/agent/me/call` | operator | The current `OperatorCall`, or `null`. The workspace polls this and the bus invalidates it. |
| POST | `/dialer/next` | operator | **Next lead.** Takes the next due lead of the chosen campaign and starts the call (the operator engine walks it through dialling and ringing). 400 with no campaign; 403 if not assigned; 409 if the campaign is not active or the operator is not in a working status. |
| POST | `/dialer/calls/:id/answer` | operator | Accept an AUTO offer from the incoming banner. |
| POST | `/dialer/calls/:id/reject` | operator | Reject an offer; the call is abandoned and the lead goes back on the retry path. |
| POST | `/dialer/calls/:id/hold` | operator | Put the call on or off hold (`{ onHold }`); hold seconds accumulate. |
| POST | `/dialer/calls/:id/hangup` | operator | End the call from the agent side and move to awaiting disposition. |
| POST | `/dialer/calls/:id/transfer` | operator | Transfer to an extension (`{ extension }`); the call ends with reason `TRANSFERRED`. |
| POST | `/calls/:id/disposition` | operator | The **forced disposition**: code, note, and a callback time when the code requires one. Updates the call and the lead, adds to DNC if the code says so, starts Wrap-up. |
| GET | `/dialer/numbers/:id/history` | signed in | Earlier calls to the same lead, newest first. |

## Supervisor wall and auto-dialler - `handlers/supervisor-wall.ts` (12)

All require supervisor+. The extra super-admin allowance fixes a quirk of the original, which
refused super admins here.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/supervisor/metrics` | supervisor+ | `RealtimeMetrics`: the KPI strip (active calls, agents by state, calls this hour, dialled and connected today, abandon rate). |
| GET | `/supervisor/agents` | supervisor+ | `WallAgentView[]`, one tile per operator with status, timer, campaign and current customer. |
| GET | `/supervisor/events` | supervisor+ | The call-event feed, newest first. |
| GET | `/supervisor/hourly` | supervisor+ | Calls by hour for today: dialled and connected per hour. |
| GET | `/supervisor/campaigns` | supervisor+ | Active and paused campaigns (active first) with stats, for the progress bars. |
| GET | `/supervisor/campaigns/:id/progress` | supervisor+ | `CampaignProgress` for one campaign. |
| GET | `/dialer/auto` | supervisor+ | `AutoDialerOverview`: the engine switch, target abandon rate and per-campaign pacing state. |
| POST | `/dialer/auto/start` | supervisor+ | Turn the auto-dialler engine on. |
| POST | `/dialer/auto/stop` | supervisor+ | Turn it off. |
| POST | `/dialer/auto/:campaignId/trigger` | supervisor+ | Run one dial cycle now. 409 unless the campaign is active and not backing off. |
| POST | `/dialer/auto/:campaignId/reset` | supervisor+ | Clear a campaign's error count and backoff. |
| POST | `/dialer/auto/:campaignId/fail` | supervisor+ | Inject an originate failure so the five-errors-then-30-second backoff can be watched. |

## Reports and call history - `handlers/reports.ts` (6)

All require supervisor+.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/reports/filters` | supervisor+ | The campaigns, operators and dispositions the filter bar offers. |
| GET | `/reports/agent-performance` | supervisor+ | `?from&to`. Calls handled, talk time, average duration, sales, callbacks and not-interested per agent. |
| GET | `/reports/campaign/:id` | supervisor+ | `?from&to`. `CampaignReport`: dialled, answered, rates, average talk time and the disposition breakdown. |
| GET | `/reports/call-detail` | supervisor+ | `?from&to&campaignId&agentId`. The flat call rows behind the third tab and its CSV. |
| GET | `/calls` | supervisor+ | Call history, paginated (`page`, `pageSize` capped at 100). Filters: `from`, `to`, `campaignId`, `agentId`, `disposition`, `outcome`, `phone`. An inverted range or unknown outcome is a 400. |
| GET | `/calls/:id` | supervisor+ | `CallDetail`: the record plus the other calls to the same lead, for the drawer. |

## Campaigns and lead lists - `handlers/campaigns.ts` (17)

All require admin+.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/campaigns` | admin+ | `?q&status`. Campaigns with stats, newest first. |
| POST | `/campaigns` | admin+ | Create (starts as a draft). Validates the input fields. |
| GET | `/campaigns/:id` | admin+ | One campaign with stats and agent count. |
| PATCH | `/campaigns/:id` | admin+ | Edit details, script, pacing and dialling mode. |
| DELETE | `/campaigns/:id` | admin+ | Refused while active. With call history the campaign is archived (`{ archived: true }`); without, it and its leads are removed. |
| POST | `/campaigns/:id/start` | admin+ | draft or paused to active. 400 with no pending lead or no assigned agent. |
| POST | `/campaigns/:id/pause` | admin+ | active to paused. |
| POST | `/campaigns/:id/stop` | admin+ | Any open state to completed. |
| GET | `/campaigns/:id/numbers` | admin+ | `?status&q`. Leads, filtered by status group and by phone or name. |
| POST | `/campaigns/:id/numbers/import` | admin+ | **CSV import.** The tab parses the file and posts rows; returns `ImportResult` (`inserted`, `skipped`, `duplicates`, `dncMarked`, `invalid`). Duplicates are skipped unless `allowDuplicates`, which bumps `instanceNumber`. Numbers on the DNC list are inserted as DNC. |
| POST | `/campaigns/:id/numbers` | admin+ | Add one lead by hand (refused on a completed or archived campaign). |
| DELETE | `/campaigns/:id/numbers` | admin+ | Clear the campaign's leads. |
| DELETE | `/campaigns/:id/numbers/:numberId` | admin+ | Remove one lead. |
| GET | `/campaigns/:id/duplicates` | admin+ | Numbers present more than once. |
| GET | `/campaigns/:id/agents` | admin+ | Operators assigned to the campaign. |
| GET | `/campaigns/:id/assignable-agents` | admin+ | Active operators who could be assigned. |
| PUT | `/campaigns/:id/agents` | admin+ | Replace the assignment list. |

## Users and the admin dashboard - `handlers/admin-users.ts` (7)

Admin+ for all but the last. Visibility and edit rights follow the role matrix in
`features/admin-users/rules.ts`: an admin sees and edits only operators and supervisors; a super
admin sees everyone.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/dashboard` | admin+ | `AdminDashboardData`: campaign and user totals, active operators, calls today and the recent campaigns. |
| GET | `/users` | admin+ | `?role&q&active`. Users the actor may see, ordered by role then name. |
| POST | `/users` | admin+ | Create a user. Field errors for username, email, role and extension. |
| PATCH | `/users/:id` | admin+ | Edit. The username is locked; an operator on a call cannot be edited out from under the call. |
| POST | `/users/:id/reset-password` | admin+ | Validates the new password and its confirmation. Every demo account keeps the shared demo password, so nothing is stored. |
| POST | `/users/:id/active` | admin+ | Enable or disable. Refused on your own account and on someone mid-call. |
| POST | `/users/:id/grant-super-admin` | super admin | Promote an active admin. Asks for the actor's password again (`confirmPassword`). |

## Configuration - `handlers/admin-config.ts` (19)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/agent-statuses` | signed in | The status list. |
| POST | `/agent-statuses` | admin+ | Create a status. |
| PATCH | `/agent-statuses/:id` | admin+ | Edit. |
| DELETE | `/agent-statuses/:id` | admin+ | 409 for the default and system statuses and for one in use by an agent right now. |
| GET | `/dispositions` | signed in | The disposition list. |
| POST | `/dispositions` | admin+ | Create. |
| PATCH | `/dispositions/:id` | admin+ | Edit; the sort order is the hotkey. |
| DELETE | `/dispositions/:id` | admin+ | Delete; the remaining sort orders close the gap so the hotkeys stay 1 to n. |
| GET | `/dnc` | admin+ | The global Do-Not-Call list, newest first, with `?q` search over number and reason. |
| GET | `/dnc/check` | signed in | `?phone`. `{ onDnc }`. |
| POST | `/dnc` | admin+ | Add a number. Field errors for an empty, invalid or already-listed number. Pending leads with that number become DNC. |
| DELETE | `/dnc/:id` | admin+ | Remove an entry. |
| POST | `/dnc/import` | admin+ | Bulk import, one number per line or CSV; an empty file is a field error. `DncImportResult` (`imported`, `duplicates`, `invalid`). |
| GET | `/settings` | signed in | `SystemSettings`: pacing, wrap-up and working hours. |
| PUT | `/settings` | admin+ | Save, validated against the current values. |
| GET | `/system-config` | super admin | `SystemConfig` with secrets reduced to `secretSet` flags. |
| PUT | `/system-config/:section` | super admin | Save one section: `app`, `client`, `pbx` or `ldap`. A secret field only flips its flag. |
| POST | `/system-config/pbx/test` | super admin | Fake connection test: waits, then ok with a latency, or a message for a missing host or bad port. |
| POST | `/system-config/ldap/test` | super admin | The same for the directory: URL scheme and bind DN are checked. |

## What is not registered

The original's `/recordings` stream and download, its agent session and state-log reads, the
audit-log reads and the WebSocket are not registered. A request for one is the kit's 404, and
nothing in the front end asks for them.
