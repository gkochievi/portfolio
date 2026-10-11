# Bani demo: data model

The store is one object, `DemoDb` (`src/types.ts`), held in memory by `createStore` in
`src/demo/core.ts`. It is a `structuredClone` of the seed built by `src/demo/seed/index.ts`, and it is
rebuilt on boot and on every *Reset demo data*.

Conventions that hold for every entity:

- **Timestamps are ISO strings** (`2026-09-02T11:30:00.000Z`), never `Date` objects, so request and
  response bodies can be structured-cloned like a wire would. Every stored timestamp key ends in
  `At`, `Date`, `date`, `time` or `Time`; that suffix is what `rebaseDates` looks for when it shifts
  the whole seed onto "now". Date-only fields (`ISODate`, `2026-09-02`) are tenant calendar days
  (`Asia/Tbilisi`, UTC+4) and shift by whole days.
- **Ids** are strings. Seeded ids are stable; new ones come from `store.nextId(prefix)`.
- **Platform vocabulary is neutral**: `core` is the Core Cluster (the enterprise phone platform),
  `edge` is the Edge PBX (the open-source PBX).
- **Derived values are never stored.** `UnifiedCdr` (a searchable call row, merged or single) and
  the transfer chain are computed per search from legs.
- Seed counts below were read by compiling `src/demo/seed/index.ts` with esbuild and counting.

Anchor: `SEED_ANCHOR = 2026-09-02T11:30:00Z`. About 45 Core Cluster legs fall in the six hours
before it, so the default "today" search is never empty.

## Summary

| Collection | Rows | Collection | Rows |
|---|---|---|---|
| `users` | 45 | `agents` | 70 |
| `directory` | 62 | `teams` | 8 |
| `ldapRoleMappings.mappings` | 4 | `skills` | 18 |
| `rbacOverrides` | `{}` | `campaigns` | 12 |
| `coreLegs` | 250 | `ccActivity` | 200 |
| `edgeLegs` | 175 | `nodes` | 4 |
| `recordingAssets` | 3 (filled by the calls feature) | `extensions` | 120 |
| `syncRuns` | 120 | `reservedExtensions` | 6 |
| `mirrorRuns` | 50 | `extensionLocks` | 0 |
| `backupRuns` | 274 | `extensionActivity` | 149 |
| `flowSummaries` | 3 | `testRuns` | 30 |
| `backupEvents` | 403 | `hostMetrics` | 1,440 |
| `archiveInventory` | 90 | `pings` | 1,152 |
| `verifyRuns` | 1 | `connections` | 13 |

Singletons: `coreImport`, `edgeMirror`, `hangupBackfill`, `campaignSettings`.

## People and access

### `users` — `ConsoleUser` (45)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `username` | string | Unique, case-insensitive. |
| `email` | string \| null | |
| `displayName` | string \| null | At most 120 characters. |
| `role` | `UserRole` | `superadmin` `admin` `cc-admin` `tel-admin` `cc-operator` `tel-operator` `it-support` `user` `api_service`. |
| `userType` | `'ldap' \| 'internal' \| 'api_service'` | An `api_service` role forces the `api_service` type, and the reverse. |
| `isActive` | boolean | |
| `accessMode` | `'direct' \| 'group'` | Direct role, or the role comes from a directory group mapping. |
| `description` | string | |
| `downloadFormat` | `'mp3' \| 'original'` | Default format for API recording downloads. |
| `allowedCampaigns` | string[] | Campaign ids a cc-admin may manage; `[]` = all. |
| `lastLoginAt` | ISODateTime \| null | `null` renders as "Never". |
| `createdAt`, `updatedAt` | ISODateTime | |

Seed: 1 superadmin, 4 admin, 3 cc-admin, 5 tel-admin, 11 cc-operator, 6 tel-operator, 5 it-support,
8 user, 2 api_service. By type: 38 directory, 5 local, 2 API. One is disabled.

### `directory` — `Omit<DirectoryEntry, 'alreadyRegistered'>` (62)

`username`, `displayName`, `email`. `alreadyRegistered` is derived from `users` at read time.

### `ldapRoleMappings` — `LdapRoleMappingConfig`

`mappings: { groupDn: string; role: RoleId }[]` (4 seeded) and `nestedGroups: boolean`.

### `rbacOverrides` — `RbacOverrides`

`Partial<Record<RbacRole, Partial<Record<FeatureKey, boolean>>>>`. Starts empty. `users` and `rbac`
are not overridable, and a non-superadmin's edits to its own role's row are dropped.

Feature keys: `cdr`, `cc_campaigns`, `cc_agents`, `cc_nodes`, `extensions`, `systems_sync`, `logs`,
`health`, `settings`, `users`, `rbac`. Matrix roles (columns): `admin`, `user`, `cc-admin`,
`tel-admin`, `cc-operator`, `tel-operator`, `it-support`; the superadmin is never shown.

### `Persona` (8, in `seed/personas.ts`, not in the store)

`DemoAccount` from the kit plus `id` (= `username`), `username`, `role`, `nameKa`. Shared password
`bani-demo`. Tenant: `Saguramo Mutual` / `საგურამო მუტუალი`, `Asia/Tbilisi`, `bani.example`.

## Calls

### `coreLegs` — `CoreLeg` (250 legs, 219 calls)

One raw Core Cluster call-detail leg, with generic field names. Legs of one call share `callId`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `clusterNodeId`, `callId`, `origLegId`, `destLegId` | number | Stitching keys. |
| `originatedAt`, `disconnectedAt` | ISODateTime | |
| `connectedAt` | ISODateTime \| null | `null` = never answered. |
| `callingNumber`, `callingPartition` | string | |
| `originalCalledNumber`, `originalCalledPartition` | string | |
| `finalCalledNumber`, `finalCalledPartition` | string | |
| `lastRedirectNumber` | string | |
| `lastRedirectReason` | number | 0 none, 2 forward busy, 15 forward no answer, 98 conference, … |
| `lastRedirectOnBehalfOf` | number | 4 = transfer, 10 = redirect via hunt, 0 = none. |
| `origDevice`, `destDevice` | string | |
| `origCause`, `destCause` | number | `destCause` 16 normal, 17 busy, 19 no answer, 393216 = ended by a transfer. |
| `huntPilot` | string | |
| `durationSec` | number | |
| `accountCode` | string | |
| `hasRecording` | boolean | 127 legs. |

### `edgeLegs` — `EdgeLeg` (175 legs, 149 linked calls)

Edge PBX call-detail columns, kept under their real names.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `calldate` | ISODateTime | |
| `clid`, `src`, `dst`, `cnum`, `did` | string | |
| `dcontext`, `channel`, `dstchannel` | string | |
| `lastapp` | string | `Dial` `Queue` `Transfer` `BlindTransfer` `AttendedTransfer` `ConfBridge` `Hangup`. |
| `lastdata`, `accountcode`, `uniqueid`, `userfield` | string | |
| `duration`, `billsec` | number | Seconds. |
| `disposition` | `'ANSWERED' \| 'NO ANSWER' \| 'BUSY' \| 'FAILED'` | |
| `recordingfile` | string | `''` when none; 80 legs have one. Re-derived from `calldate` after a rebase. |
| `linkedid` | string | Shared by every leg of one logical call. |
| `sequence` | number | Orders legs within a `linkedid`. |
| `hangupsource` | string | `''` until the "Hangup by" backfill has filled it. |
| `hasRecording` | boolean | |

### `UnifiedCdr` (derived, never stored)

A searchable row: `id`, `timestamp`, `source`, `callerNumber`, `calledNumber`, `finalNumber?`,
`duration` (wall clock across legs for a merged call), `billableSeconds`, `status`
(`completed` `no_answer` `busy` `failed` `unknown`), `disposition`, `originatingDevice?`,
`terminatingDevice?`, `accountCode?`, `context?`, `hangupBy?`, `rawData` (the leg), `transfer?`,
`segmentCount?`, `segments?`, `agentTalkSeconds?`, `searchBlob?`, `hasRecording`.
`TransferInfo` = `wasTransferred`, `transferCount`, `transferFrom?`, `transferTo?`, `reason?`
(`transfer` `blindTransfer` `attendedTransfer` `forward` `conference` `redirect`), `chain: string[]`,
`hops: { from, fromPartition?, to, toPartition?, reason }[]`.

### `recordingAssets` — `RecordingAsset` (3)

`id` (`rec-a` `rec-b` `rec-c`), `path` (base-relative, `media/recordings/<id>.wav`), `durationSec`,
`sizeBytes`, `peaks` (64 normalised values, 0 to 1). Owned by the calls feature
(`features/calls/media/assets.ts`); the store field is left empty. A leg maps to an asset by an
FNV-1a hash of its id.

A lookup yields `RecordingResult`s: `id` (`<legId>:primary`), `assetId`, `source`
(`voice_archive` `voice_archive_backup` `edge_primary` `edge_backup`), `sourceLabel`, `path`,
`format`, `confidence` (`exact` `fuzzy`), `streamUrl`, `fileSizeBytes`, `durationSec`, `peaks`.

## Archive

### `coreImport` — `CoreImportStatus`

`available`, `totalRecords` (1,284,512), `totalFiles` (38,406), `oldestRecordAt`, `newestRecordAt`,
`localFilesAvailable` (12), `lastSync` (`id`, `status`, `completedAt`, `filesProcessed`,
`recordsImported`) or `null`, `isRunning`, `cronRunning`, `dropListenerRunning`.

### `syncRuns` — `SyncRun` (120: 117 completed, 3 failed)

`id`, `status` (`running` `completed` `failed` `canceled`), `syncType` (`local` `scheduled`
`reconcile` `full`), `triggeredBy`, `fromDate`/`toDate` (ISODate \| null), `filesFound`,
`filesSkipped`, `filesProcessed`, `recordsImported`, `gapFilesFound`, `gapFilesFilled`,
`errors: string[]`, `durationMs`, `startedAt`, `completedAt`.

### `edgeMirror` — `EdgeMirrorStatus`; `mirrorRuns` — `MirrorSyncRun` (50)

Status: `enabled`, `configured`, `syncIntervalMinutes` (5), `totalRecords` (412,880),
`oldestRecordAt`, `newestRecordAt`, `lastCheck` (`MirrorCheckResult`: `fromDate`, `toDate`, `total`,
`distinct`, `duplicates`, `mirror`, `missing`, `checkedAt`), `isRunning`.
Run: `id`, `status`, `trigger` (`interval` `manual` `reconcile`), `fromDate`, `toDate`, `fetched`,
`inserted`, `durationMs`, `error`, `startedAt`, `completedAt`.

### `hangupBackfill` — `HangupBackfillStatus`

`eventTablePresent`, `carriesHangupSource`, `rowsWithHangupBy` (160), `notYetChecked` (15),
`running`, `lastResult` (`fromDate`, `toDate`, `scanned`, `filled`, `noSource`, `completedAt`).

### `backupRuns` — `BackupRun` (274: 183 Edge PBX, 91 Voice Archive)

`id`, `flow` (`voice_archive` `edge_pbx`), `sourceKey` (`primary` `secondary` `null`), `status`,
`triggeredBy` (`cron`, `manual:<username>`, `verify:<verifyRunId>`), `fromDate`, `toDate`,
`filesListed`, `filesCopied`, `filesSkipped`, `filesFailed`, `bytesCopied`, `errors`, `durationMs`,
`cancelRequested`, `startedAt`, `completedAt`.

### `flowSummaries` — `FlowSummary` (3)

`flow`, `sourceKey`, `lastRunId`, `openGaps`, `backedUpTotal`, `bytesTotal`, `cronEnabled`.
`BackupOverview` (the API view) adds `lastRun` per flow, `schedule` (`daily 02:00`) and `retryDays`.

### `backupEvents` — `LogEvent` (403)

`id`, `runId` \| null, `flow`, `level` (`debug` `info` `warn` `error`), `event` (`file_copied`,
`file_skipped`, `run_started`, `share_timeout`, …), `dateDir` (`2026/09/01`), `relativePath`,
`sizeBytes`, `durationMs`, `message`, `createdAt`. Capped at 1,500 rows while running.

### `archiveInventory` — `ArchiveDayInventory` (90)

The per-day truth verify runs are computed from: `flow`, `sourceKey`, `date`, `sourceCount`,
`destCount`, `missingFromDest` and `missingFromSource` (`MissingFile`: `name`, `rawRelativePath`,
`sourceSizeBytes`).

### `verifyRuns` — `VerifyRun` (1) with `VerifyDayRow[]`

Run: `id`, `flow`, `sourceKey`, `fromDate`, `toDate`, `status`, `daysTotal`, `daysCompleted`,
`daysWithMismatch`, `daysFailed`, `sourceCount`, `destCount`, `presentOnBoth`, `missingFromDest`,
`missingFromSource`, `cancelRequested`, `backfillRunId` (the backup run started to fix it),
`startedAt`, `completedAt`, `days`.
Day: `date`, `sourcePath`, `destPath`, `sourceCount`, `destCount`, `presentOnBoth`,
`missingFromDest`, `missingFromSource`, `durationMs`, `error`, `status`
(`pending` `ok` `mismatch` `failed`). Ranges are limited to 31 days.

## Contact centre

| Entity | Fields | Rows |
|---|---|---|
| `teams` — `Team` | `id`, `name` | 8 |
| `skills` — `Skill` | `id`, `name` (`SkillWithCount` adds `assignedCount`) | 18 |
| `agents` — `Agent` | `userId`, `firstName`, `lastName`, `extension`, `isSupervisor`, `teamId`, `skillLevels: Record<skillId, 1..10>` | 70 (5 supervisors) |
| `campaigns` — `Campaign` | `id`, `name`, `enabled`, `type`, `numDedicatedPorts`, `linesPerPort` (1.0 to 3.0, step 0.1), `maxDialAttempts` (1 to 3), `timeZone`, `updatedAt` | 12 (8 enabled) |
| `campaignSettings` | `maxDedicatedPortsNonSuperAdmin` (10) | 1 |
| `ccActivity` — `CcActivity` | `id`, `username`, `action`, `details`, `createdAt` | 200 |
| `nodes` — `CcNode` | `id`, `label`, `host`, `sysName`, `status` (`up` `down`), `error`, `cpuPct`, `memory` (`totalMB`, `availableMB`, `usedPct`), `uptimeSeconds`, `updatedAt` | 4 (3 up) |

Relations: `Agent.teamId` → `Team.id` (exactly one team); `Agent.skillLevels` keys → `Skill.id`;
`ConsoleUser.allowedCampaigns` → `Campaign.id`.
Campaign `type` is `ivrProgressive` (3), `agentProgressive` (2), `ivrPredictive` (3),
`agentPredictive` (2) or `preview` (2); only the first four have ports and lines per port.
`CcActivityAction`: `campaign_change` `campaign_view` `campaign_error` `skills_update`
`skills_bulk_update` `skills_error` `dedicated_ports_above_limit`.

## Extensions

| Entity | Fields | Rows |
|---|---|---|
| `extensions` — `Extension` | `id` (= `number`), `number`, `name`, `email`, `secret` (obviously fake, `word-####`), `createdBy`, `createdAt` | 120 |
| `reservedExtensions` | string[] of numbers that are never offered | 6 |
| `extensionLocks` — `ExtensionLock` | `id`, `extension`, `username`, `createdAt`, `expiresAt` (10 minutes later) | 0 |
| `extensionActivity` — `ExtensionActivity` | `id`, `username`, `action` (`create_start` `create_finish` `create_abort` `create_error` `purge_logs` `disconnect`), `details`, `createdAt` | 149 |

One lock per username. Expired locks are swept on every read and every 15 s, and each sweep writes a
`create_abort` row. Purge removes rows older than 90 days.

## Platform

### `testRuns` — `TestRun` (30: 28 passed, 2 degraded)

`id`, `status` (`passed` `degraded` `failed`), `triggeredBy` (`schedule` or a username), `total`,
`passed`, `failed`, `skipped`, `durationMs`, `startedAt`, `completedAt`, `results`. Each run holds 20
`TestResult`s: `id`, `category` (`core` `cron` `filesystem` `integration`), `testKey`, `testName`,
`status` (`passed` `failed` `skipped`), `message`, `durationMs`.

### `hostMetrics` — `HostMetricRow` (1,440 one-minute buckets, 24 h)

`recordedAt`, `bucketStartAt`, `bucketEndAt`, `sampleCount`, CPU `cpuPctAvg` / `Max` / `Min`,
memory `memUsedBytesAvg` / `Max` / `Min` and `memTotalBytes`, disk `diskFreeBytes`,
`diskTotalBytes`, `diskUsedPct`, network `netRxBytesPerSecAvg` / `Max` and `netTxBytesPerSecAvg` /
`Max`, `loadAvg1` / `5` / `15`, `processCount`. The live view is a `HostLiveSample` (the same
quantities as a single reading, plus `uptimeSeconds` and `collectorRunning`).

### `pings` — `PingRow` (1,152 over four targets)

`recordedAt`, `label` (`Core Cluster` `Edge PBX` `Voice Archive` `Directory`), `target`,
`packetsSent`, `packetsReceived`, `packetLossPct`, `rttAvgMs` / `Min` / `Max` / `Mdev`, `reachable`,
`error`.

### `connections` — `ServiceConfig` (13)

`key`, `section` (`core` `recordings` `extensions` `contact_centre` `record_store`), `enabled`,
`configured`, `value: Record<string, string | number | boolean>`, `updatedAt`.

Keys: `directory`, `core_admin_api`, `edge_api`, `transfer_detection`, `voice_archive`,
`edge_recordings_a`, `edge_recordings_b`, `backup_target_a`, `backup_target_b`, `backup_schedule`,
`extension_provisioning`, `contact_centre`, `record_mirror`.

A stored secret is returned as the sentinel `__UNCHANGED__`; sending it back keeps the stored value.
Saving `contact_centre` writes its port cap into `campaignSettings`. Saving `backup_schedule`
derives a `cron` string.

## Events (the in-browser bus, not stored)

`demo:reset`, `session:changed`, `rbac:changed`, `users:changed`, `archive:changed`
(`kind`: `core-sync` `mirror` `hangup` `backup` `verify`), `archive:event`, `health:sample`,
`selftest:completed`, `cc:activity`, `cc:nodes`, `extensions:changed`, `extensions:activity`.
