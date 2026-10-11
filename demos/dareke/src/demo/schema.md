# Dareke data model

The demo's database is one object, `DemoData` (`src/types.ts`), held in memory by
`createStore` (`src/demo/store.ts`). Each key below is an array of rows unless it says
"object". The types are the single contract between the seed, the handlers, the simulators and
the screens.

Conventions

- **Ids are strings with a prefix**: `u_*` users, `st_*` statuses, `disp_N` dispositions,
  `cmp_N` campaigns, `num_N` leads, `call_N` calls, `dnc_N`, `log_N`, `evt_N`. `store.nextId(prefix)`
  continues past the seed's and never reuses one. Rows created by the human operator carry the
  tab id so two open tabs cannot collide.
- **Timestamps are ISO-8601 strings**, generated relative to `now` by `buildSeed(now)`, so the
  data lands on today whenever the demo is opened or reset.
- **`Localized`** is `{ en: string; ka: string }`. Anything a person reads that is data rather
  than interface (names, campaign titles, scripts, dispositions) is stored in both languages.
  `LText` is `string | Localized`.
- **`Tone`** is `'lime' | 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'ink'`, the
  colour vocabulary shared by statuses, dispositions and badges.
- **Durations** are whole seconds unless the name ends in `Ms` or `Minutes`.
- Phone numbers are E.164 strings from one synthetic block (`+9955000` plus five digits).

## Entity relationships

```
User 1---* CampaignAgent *---1 Campaign 1---* CampaignNumber
 |                                |  1             |  1
 |  1                             |                |
 +---1 AgentCurrentState          +---* CallRecord *---+      (CallRecord.campaignNumberId)
 |        |  *---1 AgentStatus         |  *---1 Disposition (by code)
 |        +---0..1 CallRecord          +---* CallEvent
 +---* AgentStateLog *---1 AgentStatus
 +---* DncEntry.addedById   (DNC is global; a CampaignNumber on it becomes status DNC)
SystemSettings, SystemConfig, AutoDialerRuntime: one object each
```

## Tables

### `users` - `User` (13)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `u_<firstname>`. The four demo accounts use the same id as `DarekeAccount.userId`. |
| `username` | string | Unique. Locked after creation (editing it is a validation error). |
| `displayName` | Localized | |
| `email` | string | `@dareke.example`. Login is by email. |
| `role` | `'super_admin' \| 'admin' \| 'supervisor' \| 'operator'` | |
| `sipExtension` | string \| null | Operators and supervisors; null shows the "no extension" warning and keeps the operator out of AUTO pacing. |
| `isActive` | boolean | An inactive account cannot sign in and is never driven by the floor simulator. |
| `createdAt`, `lastLoginAt` | ISO string, ISO string \| null | `lastLoginAt` is set by the login handler. |

`UserSummary` is `Pick<User, 'id' | 'username' | 'displayName' | 'role' | 'sipExtension'>`.
`DarekeAccount` extends the kit's `DemoAccount` with `role`, `userId` and `home`.

Seed: 1 super admin (Nino), 1 admin (Tamar), 2 supervisors (Levan, Zurab), 9 operators (Mariam,
Giorgi, Salome, Davit, Irakli, Ana, Luka, Elene with no extension, Beka inactive).

### `agentStatuses` - `AgentStatus` (8)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `st_available`, `st_on_call`, `st_wrap_up`, `st_break`, `st_lunch`, `st_meeting`, `st_training`, `st_offline`. |
| `name` | string | Stable key (`available`, `on_call` ...) used by `statusIdByName`. |
| `displayName` | Localized | |
| `type` | `'working' \| 'paused' \| 'offline'` | Only `working` can take calls. |
| `timeoutSeconds` | number | 0 for none. Wrap-up 20, Break 900, Lunch 3600. |
| `autoReturn` | boolean | At timeout, return to the default status. Wrap-up has it. |
| `color` | Tone | |
| `sortOrder` | number | |
| `isDefault`, `isSystem`, `isActive` | boolean | The default and system statuses cannot be deleted; a status in use cannot be deleted. |

### `dispositions` - `Disposition` (9)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `disp_1` ... `disp_9`. |
| `code` | string | `SALE`, `INTERESTED`, `CALLBACK_LATER`, `NOT_INTERESTED`, `VOICEMAIL`, `NO_ANSWER`, `BUSY`, `WRONG_NUMBER`, `DNC`. Call records reference the code. |
| `name`, `description` | Localized, Localized \| null | |
| `isFinal` | boolean | The lead is closed (status COMPLETED). Otherwise it goes on the retry path. |
| `scheduleCallback` | boolean | The operator must pick a callback date and time; the lead becomes CALLBACK_SCHEDULED. |
| `addToDnc` | boolean | Adds the number to the global DNC list (source DISPOSITION). |
| `color` | Tone | |
| `sortOrder` | number | Doubles as the hotkey, 1 to 9. |
| `isActive` | boolean | |

### `campaigns` - `Campaign` (7)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `cmp_1` ... `cmp_7`. |
| `name`, `clientName`, `description` | Localized | |
| `status` | `'draft' \| 'active' \| 'paused' \| 'completed' \| 'archived'` | Lifecycle below. |
| `dialingMode` | `'MANUAL' \| 'AUTO' \| 'PREDICTIVE'` | PREDICTIVE is never dialled. |
| `callerId` | string | |
| `queueName` | string \| null | `q_<slug>`; null on the draft. |
| `workingHoursStart`, `workingHoursEnd` | `'HH:mm'` | |
| `maxAttempts`, `retryDelayMinutes` | number | Retry path for NO_ANSWER and BUSY. |
| `dialRatio`, `maxConcurrentCalls`, `dialIntervalMs` | number | AUTO pacing: `target = floor(availableAgents x dialRatio)`. |
| `script` | `ScriptStep[]` | `{ id, title: Localized, body: Localized }`, 4 to 5 steps per campaign. |
| `createdById` | string | `User.id`. |
| `createdAt`, `updatedAt`, `startedAt`, `completedAt` | ISO string (last two nullable) | |

Lifecycle: `draft` or `paused` -> `start` -> `active` (needs a pending lead and an assigned
agent); `active` -> `pause` -> `paused`; anything but `completed` / `archived` -> `stop` ->
`completed`. Deleting an active campaign is refused; deleting one with call history archives it
instead of removing it.

Derived, never stored: **`CampaignStats`** (`totalNumbers`, `dialed`, `connected`, `pending`,
`completed`, `failed`, `dnc`, `callbacks`, `sales`, `progress`, `answerRate`, `conversionRate`)
and **`CampaignWithStats`** (`Campaign` plus `stats` and `agentCount`).

Seed: `cmp_1` Mobile plan upgrade (active, MANUAL, 183 leads); `cmp_2` Customer satisfaction
survey (active, AUTO 1.5, 160); `cmp_3` Home fibre win-back (active, AUTO 1.8, 140); `cmp_4` Car
insurance renewal (paused, AUTO 1.2, 110); `cmp_5` New-build viewing appointments (draft, no
agents, 40); `cmp_6` Wine club membership callback (completed, 90); `cmp_7` Delivery
confirmation (archived, 30).

### `campaignAgents` - `CampaignAgent` (22)

`{ campaignId, agentId, assignedAt }`. The pair is the key. An operator sees only active
campaigns they are assigned to; `cmp_5` has none, which is what blocks its start.

### `numbers` - `CampaignNumber` (about 750; 753 at the time of writing)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `num_N`. |
| `campaignId` | string | |
| `phoneNumber` | string | Unique on `(campaignId, phoneNumber, instanceNumber)`. |
| `customerName` | Localized \| null | Georgian script for `ka`, Latin transliteration for `en`. |
| `customData` | `Record<string, LText>` | Per-campaign columns (city, current plan, monthly spend, contract end ...); shown beside the script. |
| `status` | `'PENDING' \| 'DIALING' \| 'CONNECTED' \| 'COMPLETED' \| 'NO_ANSWER' \| 'BUSY' \| 'FAILED' \| 'DNC' \| 'CALLBACK_SCHEDULED'` | |
| `attempts` | number | |
| `lastAttemptAt`, `nextAttemptAt` | ISO string \| null | `nextAttemptAt` is the retry or callback time. |
| `lastDispositionCode` | string \| null | |
| `instanceNumber` | number | 1 for the first copy of a number; 2 and up for intentional duplicates (three in `cmp_1`). |
| `createdAt` | ISO string | |

### `calls` - `CallRecord` (about 450 to 530; depends on the hour)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `call_N`, chronological. |
| `campaignId`, `campaignNumberId`, `agentId` | string, string, string \| null | `agentId` is null for an abandoned AUTO call. |
| `callerId`, `destinationNumber` | string | |
| `customerName` | Localized \| null | Denormalised from the lead. |
| `mode` | `'MANUAL' \| 'AUTO'` | |
| `outcome` | `'IN_PROGRESS' \| 'ANSWERED' \| 'NO_ANSWER' \| 'BUSY' \| 'FAILED' \| 'ABANDONED'` | |
| `callInitiatedAt`, `callAnsweredAt`, `callEndedAt` | ISO string (last two nullable) | |
| `ringDuration`, `talkDuration`, `holdDuration`, `totalDuration` | number | Seconds. |
| `dispositionCode`, `dispositionNote` | string \| null | |
| `hangupCause`, `hangupCauseText`, `hangupBy` | number \| null, string \| null, `'AGENT' \| 'CUSTOMER' \| 'SYSTEM'` \| null | Causes mirror Q.850: 16 normal clearing, 17 busy, 19 no answer. |
| `recordingUrl`, `recordingDuration` | null, null | Recordings are switched off. |
| `callbackScheduledAt`, `callbackNote` | ISO string \| null, string \| null | |

`CallRecordView` adds `agentName`, `campaignName`, `dispositionName` and `dispositionColor`,
joined at read time. `CallDetail` (the drawer) adds `otherCalls`, the other calls to the same lead.

Seed: about 30 days of weekday traffic between 10:00 and 19:00 plus about 90 calls today spread
from 10:00 to now (the nine hours before now if that falls outside working hours, so the charts
are never empty). Answer rate about 65 %; SALE about 15 % of answered; talk 40 to 420 seconds.
Four calls are `IN_PROGRESS`, one for each fake agent on a call at boot.

### `dnc` - `DncEntry` (25)

| Field | Type | Notes |
|---|---|---|
| `id` | string | `dnc_N`. |
| `phoneNumber` | string | Normalised; unique. |
| `reason` | string | |
| `source` | `'MANUAL' \| 'CUSTOMER_REQUEST' \| 'DISPOSITION' \| 'IMPORT'` | |
| `addedById` | string \| null | `User.id`. |
| `createdAt` | ISO string | |

`DncEntryView` adds `addedByName`. Adding a number marks every matching pending lead DNC; the
import dialog and the dial path both check this list. Seed: 15 DISPOSITION, 4 CUSTOMER_REQUEST,
4 MANUAL, 2 IMPORT.

### `agentStates` - `AgentCurrentState` (9, one per operator)

`{ agentId, statusId, stateSince, currentCallId, currentCampaignId, callPhase }` where
`callPhase` is `'ringing' | 'answered' | 'hold' | null`. This is the row the wall reads. The
visitor's own row is mirrored across tabs. Seed: Mariam and one other operator Available (Mariam on `cmp_1`); four on a call;
one in Wrap-up; one on Break; one Offline.

`AgentStateView` (what the API returns) joins the agent summary, the full status, the campaign
`{ id, name, dialingMode }` and the live call `{ id, destinationNumber, customerName,
initiatedAt, answeredAt, phase }`.

### `agentStateLogs` - `AgentStateLog` (9)

`{ id, agentId, statusId, previousStatusId, startedAt, endedAt, campaignId, callRecordId }`.
One open row per operator at boot; every status change closes one and opens the next.

### `callEvents` - `CallEvent` (30; capped at 50)

`{ id, callId, agentId, agentName, phoneNumber, customerName, campaignId, event, cause,
causeText, timestamp }` where `event` is `'ringing' | 'answered' | 'ended' | 'hold' | 'unhold' |
'no_answer' | 'busy' | 'abandoned'`. This is the wall's live feed; newest first.

### `settings` - `SystemSettings` (object)

`dialer { baseDialRatio, maxDialRatio, minDialRatio, targetAbandonRate }`, `wrapup
{ defaultWrapupTime, maxWrapupTime }`, `workingHours { startTime, endTime, workingDays: number[] }`.

### `systemConfig` - `SystemConfig` (object; super admin only)

`app` (`port`, `host`, `jwtExpiresIn`, `corsOrigin`, `recordingsPath`, `dialerMockMode`),
`client` (`apiUrl`, `wsUrl`, `webrtcEnabled`, `sipWssUrl`, `sipDomain`, `iceServers`,
`useMockData`), `pbx` (`host`, `port`, `username`, `secretSet`, `trunk`, `context`, `enabled`),
`ldap` (`url`, `bindDn`, `bindPasswordSet`, `baseDn`, `userSearchFilter`, `enabled`), plus
`updatedAt` and `updatedById`. Secrets are never returned: a `secretSet` flag stands in, and
saving a secret only flips it. Every host is a made-up `.demo.local` name.

### `autoDialer` - `AutoDialerRuntime` (object)

`{ enabled, campaigns: Record<campaignId, AutoDialerCampaignState> }`, where a state holds
`isRunning`, `availableAgents`, `dialRatio`, `target`, `inFlight`, `maxConcurrentCalls`,
`dialIntervalMs`, `consecutiveErrors`, `backoffUntil`, `lastDialAt`, `dialedThisSession` and
`abandonRate`. The auto-dialler loop owns it; `GET /dialer/auto` joins the campaign name, mode
and status as `AutoDialerOverview`.

## Not stored (in the simulators' memory)

| Type | Where | What |
|---|---|---|
| `OperatorCall` | `demo/sim/operator.ts` | The signed-in operator's live call: `phase` (`requesting`, `dialing`, `ringing`, `incoming`, `answered`, `ended`), hold state and seconds, `endReason`, `suggestedDisposition`, `awaitingDisposition`. |
| `DialerOffer` | the bus (`dialer:offer`) | An answered AUTO call offered to the visitor: `{ callId, agentId, campaignId, numberId }`. |
| Floor plans | `demo/sim/floor.ts` | The due-times for each fake agent's next step. Dropped on `demo:reset`. |

## Derived views the API returns

`RealtimeMetrics` (wall KPIs: active calls, agents working / paused / on call / offline, calls
this hour, average wait, dialled and connected today, abandon rate), `HourlyCallData`,
`CampaignProgress`, `AgentPerformanceRow`, `DispositionBreakdown`, `CampaignReport`,
`AgentTodayKpis`, `AdminDashboardData`, `ImportResult` (`inserted`, `skipped`, `duplicates`,
`dncMarked`, `invalid`), `DncImportResult` (`imported`, `duplicates`, `invalid`),
`ConnectionTestResult` (`ok`, `message`, `latencyMs`) and `Paginated<T>` (`items`, `total`,
`page`, `pageSize`). They are computed from the tables above on every request.

## The bus

`DemoEvents` (`src/types.ts`) is the in-browser replacement for the WebSocket: `call:event`,
`operator:call`, `dialer:offer`, `agent:state`, `data:changed { scopes }`, `demo:reset` and
`sync:patch`. `DataScope` names what a write touched (`me`, `agents`, `calls`, `campaigns`,
`numbers`, `users`, `statuses`, `dispositions`, `dnc`, `settings`, `config`, `dialer`,
`metrics`, `reports`); `lib/live.ts` maps scopes to query keys. `SyncCollection` (`agentStates`,
`calls`, `numbers`, `dnc`, `callEvents`, `agentStateLogs`) lists what is mirrored to other tabs.
