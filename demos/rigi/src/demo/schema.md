# Rigi demo schema

The in-memory database behind the mock API: 34 collections and one settings object, all typed in
[`src/types.ts`](../types.ts) and assembled by `buildSeed(now)` in
[`seed/index.ts`](./seed/index.ts). This file is the reference; the types are the source of truth.

## Conventions

- **Ids** are short prefixed strings (`prt_zemo`, `tsk_41`, `inv_12`), never UUIDs. New rows draw
  from `store.nextId(prefix)`; the seed draws from a counter provider so ids are stable.
- **Money** is a plain `number` in major units (12.50 = twelve lari fifty), rounded to two
  decimals. Each partner has one `Currency` (`GEL`, `USD`, `EUR`) and everything billed to it
  follows. VAT is 18% (`VAT_RATE` in `domain/billing.ts`).
- **Points** are the support-work unit (pts / ქულა). A partner gets `freeMonthlyAllowance` free
  points a month; points beyond that cost `ratePerPoint` each. Points are debited when the
  partner **verifies** a finished task, never when staff finish it. Internal and project tasks are
  never billed.
- **Timestamps** are ISO-8601 strings (`ISODateTime`); calendar days are `YYYY-MM-DD`
  (`ISODate`).
- **Time-relative seed.** `buildSeed(now)` is deterministic (`createRandom('rigi')`) and generated
  *relative to the load time*: period 0 is the current month and history reaches six months
  back, so deadlines, overdue invoices and contract expiry are always in the right place. The
  store runs it on load and again on every reset; there is no `rebaseDates` pass.
- **Soft deletes.** `deletedAt` on `StaffUser` and `Partner`; deleting a partner only
  deactivates it, as in the original.
- **Derived data is not stored.** Seat summaries, point usage, invoice totals, display statuses
  and dashboards are computed by `src/demo/domain/*` from the collections below.

## Seed at a glance

Counts come from compiling and running `buildSeed(new Date())`; the seed is deterministic, so
they do not vary between loads.

| Collection | Rows | Collection | Rows |
|---|---|---|---|
| `staffUsers` | 9 | `invoices` | 43 |
| `partners` | 9 | `invoiceLines` | 147 |
| `partnerRates` | 12 | `invoiceTemplates` | 3 |
| `partnerDocuments` | 23 | `outbox` | 7 |
| `apiKeys` | 10 | `mails` | 106 |
| `partnerAdmins` | 11 | `threads` | 55 |
| `licenses` | 7 | `pendingMails` | 15 |
| `licenseOverrides` | 15 | `attachments` | 19 |
| `seatAllocations` | 54 | `activityLog` | 189 |
| `partnerUsers` | 399 | `systemLogs` | 503 |
| `membershipPeriods` | 412 | `incidents` | 4 |
| `userCountDaily` | 720 | `backfillRuns` | 1 |
| `taskTemplates` | 11 | `schedulerRuns` | 9 |
| `templateOverrides` | 7 | `projects` | 6 |
| `tasks` | 90 | `pointTransactions` | 53 |
| `taskAssignees` | 83 | `taskMessages` | 92 |
| `taskHistory` | 339 | `taskMailLinks` | 89 |
| `taskThreadLinks` | 40 | `settings` | 1 object |

Distributions worth knowing:

- **Partners (9)**: Zemo Systems, Kolkheti Networks (USD), Batumi Wave Integrations (EUR), Mzeo
  Bank, Lukma Delivery, Talgha Telecom (USD), Alvani Insurance, Vake Dental Group, Ruisi
  Utilities (inactive). Eight are active. Contract dates are seeded relative to load: Kolkheti's ends
  ten days out and Talgha's has already lapsed, which lights the expiry banners.
- **Staff (9)**: 1 superadmin, 1 accountant, 2 L1, 5 technicians. **Partner admins (11)** across
  all nine partners (Zemo and Mzeo have two each).
- **Synced users (399)** over the nine partners (Mzeo 130, Talgha 85, Lukma 48, Alvani 32,
  Kolkheti 27, Ruisi 26, Zemo 23, Batumi Wave 16, Vake 12), with 720 daily headcount rows for the
  sparklines.
- **Licenses (7)**: `AGENT_BASIC`, `AGENT_PRO`, `SUPERVISOR`, `QUALITY_ANALYST`, `LEGACY_SEAT`
  (per user) and `CALL_RECORDING`, `SMS_GATEWAY` (add-ons).
- **Task templates (11)**, ten fixed-price and one freeform (`OTHER_PROBLEM`), priced in points.
- **Tasks (90)** cover every state: 53 verified, 13 in progress, 10 accepted, 6 finished (waiting
  for the partner), 4 cancelled, 2 pending, 2 testing.
- **Projects (6)**: 3 open, 2 completed, 1 cancelled.
- **Invoices (43)**: 39 monthly and 4 ad hoc; 36 paid, 3 issued, 3 draft, 1 void; one carries a
  partner dispute.
- **Mails (106)** in **55 threads**: 82 turned into tasks, 7 follow-ups, 6 new, 6 triaged, 5
  ignored. **15 more are held in `pendingMails`**: four carry a delivery timer (45 s, 2, 4 and 7
  minutes after load) and arrive by themselves; the other eleven wait for **Poll now** or the
  `mail.imap.poll` job. Five delivered mails have `partnerId: null` (an unrecognised sender).
- **Invoice templates (3)**: Standard, Compact (HTML), and a partner-specific procurement format.

`validateSeed()` (`seed/validate.ts`) checks the graph in development builds and logs problems
to the console: unique ids, task history chains ending at the current state, seat pools holding
every mapped user, invoice totals equal to their lines, unique invoice numbers, the point ledger
matching verified billable tasks, and dangling mail and thread links. It is not run in production
builds.

## Relations

Everything is joined by `partnerId`, the tenant key, or by an explicit foreign key:

```
Partner 1─* PartnerRateHistory          (append-only; effectiveFrom/effectiveTo, one open row)
Partner 1─* PartnerDocument 1─* DocumentVersion   (versions embedded; last is current)
Partner 1─* PartnerApiKey               (secret never stored; shown once on create)
Partner 1─* PartnerAdmin                (portal logins; an account id == the PartnerAdmin id)
Partner 1─* PartnerUser 1─* MembershipPeriod      (hotel-nights billing runs on these)
PartnerUser *─0..1 License              (licenseId; add-ons are never mapped)
Partner 1─* SeatAllocation *─1 License  (batches; the pool is the sum of open batches)
Partner 1─* PartnerLicenseOverride *─1 License    (price override; effective = override ?? catalog)
Partner 1─* UserCountDaily              (headcount snapshot per day)
Partner 1─* PartnerTemplateOverride *─1 TaskTemplate   (hide / rename / re-point per partner)
Partner 1─* Task *─0..1 TaskTemplate    (partnerId null = internal task)
Task 1─* TaskAssignee *─1 StaffUser
Task 1─* TaskStateChange                (history timeline; changedById null = a partner move)
Task 1─* TaskMessage                    (chat; internalOnly never reaches the portal)
Task *─* Mail via TaskMailLink          Task *─* MailThread via TaskThreadLink
Task *─0..1 Project                     (project tasks are billed at the project's fixed price)
Partner 1─* Project
Partner 1─* PointTransaction            (debit_free / debit_chargeable / adjustments; ties to a task)
Partner 1─* Invoice 1─* InvoiceLineItem (kind: subscription, points_overflow, adhoc, discount, project)
Invoice *─0..1 InvoiceTemplate          Invoice 1─* OutboxEmail
Mail *─1 MailThread                     Mail 1─* Attachment      (partnerId null = unmatched sender)
PendingMail                             (a Mail not yet delivered; shape minus threadId/status)
ActivityLog                             (actor + entity + JSON diff; superadmin is never recorded)
SystemLog, HealthIncident, MailBackfillRun, SchedulerRun   (ops, no foreign keys beyond partnerId)
```

Account ids double as record ids: the five demo personas in `src/demo/accounts.ts` use the ids of
their `StaffUser` / `PartnerAdmin` rows (`usr_nino`, `usr_levan`, `usr_mariam`, `usr_giorgi`,
`padm_tamar`), so a handler can join the session to the data without a lookup table.

## Enumerations

| Type | Values |
|---|---|
| `Currency` | `GEL`, `USD`, `EUR` |
| `StaffRole` | `superadmin`, `accountant`, `l1_employee`, `technician` |
| `TechnicianType` | `webdeveloper`, `voip_engineer`, `both` |
| `AccountRole` | `StaffRole`, `partner_admin` |
| `StaffArea` | `admin`, `accountant`, `l1`, `technician` |
| `Architecture` | `cloud`, `hybrid`, `onprem` |
| `ContactRole` | `technical`, `management`, `financial`, `legal` |
| `DocumentKind` | `contract`, `technical` |
| `ApiKeyScope` | `user_count:write`, `user_count:read` |
| `LicenseKind` | `per_user`, `addon` |
| `SeatAllocationReason` | `cutover`, `set`, `split` |
| `MembershipReason` | `created`, `reactivated`, `deleted`, `disabled`, `cutover` |
| `TaskState` | `accepted`, `in_progress`, `pending`, `testing`, `finished`, `verified`, `cancelled` |
| `MessageAuthorKind` | `internal`, `partner` |
| `ProjectState` | `open`, `completed`, `cancelled` |
| `PointTransactionKind` | `debit_free`, `debit_chargeable`, `adjustment_credit`, `adjustment_debit` |
| `InvoiceKind` | `monthly`, `adhoc` |
| `InvoiceStatus` | `draft`, `issued`, `paid`, `void` |
| `InvoiceDisplayStatus` | `pending`, `overdue`, `paid`, `void`, `disputed` |
| `InvoiceLineKind` | `subscription`, `points_overflow`, `adhoc`, `discount`, `project` |
| `TemplateBlockType` | `text`, `image`, `spacer`, `divider`, `page-number`, `line-items`, `tasks`, `totals`, `notes` |
| `TemplateMode` | `blocks`, `html` |
| `MailStatus` | `new`, `triaged`, `task_created`, `followup`, `ignored` |
| `AuditEntityType` | `task`, `user`, `invoice`, `partner`, `mail`, `license`, `settings`, `template`, `project` |
| `LogLevel` | `debug`, `info`, `warn`, `error` |
| `HealthDependency` | `postgres`, `jobqueue`, `smtp`, `imap`, `attachments` |
| `ServiceStatus` | `ok`, `degraded`, `down` |
| `BackfillState` | `running`, `completed`, `cancelled`, `failed` |
| `SchedulerJobName` | `mail.imap.poll`, `points.month.close`, `invoices.generate.month`, `invoices.autodraft.daily`, `usercount.snapshot.daily` |

## People

### StaffUser — `staffUsers`, **9** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `email` | `string` |  |
| `fullName` | `string` |  |
| `fullNameKa` | `string` | Georgian spelling of the name, shown when the UI is in ka. |
| `role` | `StaffRole` |  |
| `technicianType` | `TechnicianType \| null` |  |
| `isActive` | `boolean` |  |
| `lastLoginAt` | `ISODateTime \| null` |  |
| `createdAt` | `ISODateTime` |  |
| `deletedAt` | `ISODateTime \| null` |  |

## Partners

### PartnerContact

| Field | Type | Notes |
|---|---|---|
| `role` | `ContactRole` |  |
| `name` | `string` |  |
| `phone` | `string` |  |
| `email` | `string` |  |

### Partner — `partners`, **9** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `name` | `string` |  |
| `legalName` | `string` | Registered name, usually Georgian (e.g. `შპს ზემო სისტემსი`). |
| `companyId` | `string` | 9-digit Georgian company id. |
| `city` | `string` |  |
| `contactEmail` | `string` |  |
| `billingEmail` | `string` | Primary billing email (first of billingEmails). |
| `billingEmails` | `string[]` | Up to 20. |
| `currency` | `Currency` |  |
| `ratePerPoint` | `number` | Price of one chargeable point, in the partner's currency. Default 20. |
| `freeMonthlyAllowance` | `number` | Free points per calendar month. Default 10. |
| `isActive` | `boolean` |  |
| `onboardedAt` | `ISODateTime` |  |
| `contractStartOn` | `ISODate \| null` |  |
| `contractEndOn` | `ISODate \| null` |  |
| `invoiceGenerationDay` | `number` | Day of month (1-28) the daily autodraft job drafts this partner's invoice. |
| `pbxServerIp` | `string` |  |
| `webServerIp` | `string` |  |
| `webServerDomain` | `string` |  |
| `architecture` | `Architecture` |  |
| `vpnType` | `string` |  |
| `phoneNumbers` | `string[]` | Up to 50. |
| `contacts` | `PartnerContact[]` | Exactly four slots, one per ContactRole. |
| `notes` | `string` |  |
| `createdAt` | `ISODateTime` |  |
| `updatedAt` | `ISODateTime` |  |
| `deletedAt` | `ISODateTime \| null` | Soft delete: set together with isActive=false. |

### PartnerRateHistory — `partnerRates`, **12** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `ratePerPoint` | `number` |  |
| `freeAllowance` | `number` |  |
| `effectiveFrom` | `ISODate` |  |
| `effectiveTo` | `ISODate \| null` | Null for the open (current) row. |
| `createdByName` | `string \| null` |  |
| `createdAt` | `ISODateTime` |  |

### PartnerDocument — `partnerDocuments`, **23** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `kind` | `DocumentKind` |  |
| `title` | `string` |  |
| `createdAt` | `ISODateTime` |  |
| `versions` | `DocumentVersion[]` | Ascending by versionNo; the last one is current. |

### DocumentVersion

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `versionNo` | `number` |  |
| `filename` | `string` |  |
| `sizeBytes` | `number` |  |
| `mimeType` | `string` |  |
| `note` | `string` |  |
| `createdAt` | `ISODateTime` |  |
| `uploadedByName` | `string` |  |
| `sampleFile` | `string` | Bundled sample under public/, relative to BASE_URL (e.g. `samples/contract.pdf`). |

### PartnerApiKey — `apiKeys`, **10** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `keyId` | `string` | Public half, e.g. `demo_7F3K29QD`. The secret is never stored. |
| `label` | `string` |  |
| `scopes` | `ApiKeyScope[]` |  |
| `createdAt` | `ISODateTime` |  |
| `createdByName` | `string \| null` |  |
| `lastUsedAt` | `ISODateTime \| null` |  |
| `revokedAt` | `ISODateTime \| null` |  |

### PartnerAdmin — `partnerAdmins`, **11** rows in the seed

A partner-portal login (separate realm from staff).

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `username` | `string` |  |
| `email` | `string \| null` |  |
| `fullName` | `string` |  |
| `isActive` | `boolean` |  |
| `lastLoginAt` | `ISODateTime \| null` |  |
| `createdAt` | `ISODateTime` |  |

## Licensing and seats

### License — `licenses`, **7** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `code` | `string` | UPPER_SNAKE, immutable after create (e.g. AGENT_PRO). |
| `name` | `string` |  |
| `kind` | `LicenseKind` |  |
| `unitPrice` | `number` | Catalog price per seat per month. Treated as the partner's currency unless overridden. |
| `currency` | `Currency` |  |
| `isActive` | `boolean` |  |
| `createdAt` | `ISODateTime` |  |

### PartnerLicenseOverride — `licenseOverrides`, **15** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `partnerId` | `ID` |  |
| `licenseId` | `ID` |  |
| `unitPrice` | `number` |  |

### SeatAllocation — `seatAllocations`, **54** rows in the seed

One batch of seats. The pool for a license = sum of open batches (effectiveTo null).

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `licenseId` | `ID` |  |
| `quantity` | `number` |  |
| `effectiveFrom` | `ISODate` |  |
| `effectiveTo` | `ISODate \| null` |  |
| `note` | `string` |  |
| `reason` | `SeatAllocationReason \| null` |  |
| `createdByName` | `string \| null` |  |
| `createdAt` | `ISODateTime` |  |

### PartnerUser — `partnerUsers`, **399** rows in the seed

A call-centre user synced from the partner's own telephony system.

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `externalId` | `string` |  |
| `username` | `string` |  |
| `fullName` | `string` |  |
| `role` | `string` | Free text from the partner system: agent, supervisor, quality analyst, admin. |
| `email` | `string` |  |
| `status` | `string` | Free text status label from the partner system ("Available", "On break"). |
| `statusCode` | `number` |  |
| `billingEnabled` | `boolean` |  |
| `licenseId` | `ID \| null` | Null = unmapped ("Users without a license"). Never an addon license. |
| `isActive` | `boolean` |  |
| `syncedAt` | `ISODateTime` |  |
| `createdAt` | `ISODateTime` |  |
| `deactivatedAt` | `ISODateTime \| null` |  |

### MembershipPeriod — `membershipPeriods`, **412** rows in the seed

Billable presence of a user on a license; drives subscription user-days.

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `partnerUserId` | `ID` |  |
| `licenseId` | `ID \| null` |  |
| `startedOn` | `ISODate` |  |
| `endedOn` | `ISODate \| null` |  |
| `reason` | `MembershipReason` |  |

### UserCountDaily — `userCountDaily`, **720** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `partnerId` | `ID` |  |
| `day` | `ISODate` |  |
| `userCount` | `number` |  |

## Tasks and projects

### TaskTemplate — `taskTemplates`, **11** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `code` | `string` | UPPER_SNAKE of the name, numeric suffix on collision, immutable. |
| `name` | `string` |  |
| `description` | `string` | Shown to partners in the catalogue. |
| `defaultPoints` | `number \| null` | Null for the freeform "Other problem" template. |
| `isFreeform` | `boolean` |  |
| `isActive` | `boolean` |  |
| `sortOrder` | `number` |  |
| `archivedAt` | `ISODateTime \| null` |  |
| `createdAt` | `ISODateTime` |  |

### PartnerTemplateOverride — `templateOverrides`, **7** rows in the seed

Per-partner catalogue override; also the "partner price" rows on the template page.

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `templateId` | `ID` |  |
| `partnerId` | `ID` |  |
| `isHidden` | `boolean` |  |
| `points` | `number \| null` |  |
| `nameOverride` | `string \| null` |  |
| `descriptionOverride` | `string \| null` |  |

### Task — `tasks`, **90** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `number` | `number` | Display number, shown as TCK-1187. |
| `partnerId` | `ID \| null` | Null = Internal task. |
| `templateId` | `ID \| null` |  |
| `projectId` | `ID \| null` |  |
| `title` | `string` |  |
| `description` | `string` |  |
| `state` | `TaskState` |  |
| `points` | `number \| null` |  |
| `pricingPending` | `boolean` | Freeform tasks wait for staff to set points; cannot be finished while true. |
| `deadline` | `ISODateTime \| null` |  |
| `createdById` | `ID \| null` |  |
| `createdByPartnerAdminId` | `ID \| null` |  |
| `finishedAt` | `ISODateTime \| null` |  |
| `verifiedAt` | `ISODateTime \| null` |  |
| `hasNewReplies` | `boolean` | A mail arrived on a linked thread since staff last opened the task. |
| `createdAt` | `ISODateTime` |  |
| `updatedAt` | `ISODateTime` |  |

### TaskAssignee — `taskAssignees`, **83** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `taskId` | `ID` |  |
| `userId` | `ID` |  |
| `assignedById` | `ID \| null` |  |
| `assignedAt` | `ISODateTime` |  |

### TaskStateChange — `taskHistory`, **339** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `taskId` | `ID` |  |
| `fromState` | `TaskState \| null` | Null for the creation row. |
| `toState` | `TaskState` |  |
| `changedById` | `ID \| null` | Null = the partner (portal) made the move. |
| `changedByName` | `string` |  |
| `changedAt` | `ISODateTime` |  |
| `note` | `string \| null` |  |

### TaskMessage — `taskMessages`, **92** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `taskId` | `ID` |  |
| `authorKind` | `MessageAuthorKind` |  |
| `authorId` | `ID \| null` |  |
| `authorName` | `string` |  |
| `body` | `string` |  |
| `internalOnly` | `boolean` | Staff-only note; never returned by /portal endpoints. |
| `createdAt` | `ISODateTime` |  |

### TaskMailLink — `taskMailLinks`, **89** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `taskId` | `ID` |  |
| `mailId` | `ID` |  |
| `linkedAt` | `ISODateTime` |  |
| `linkedById` | `ID \| null` |  |

### TaskThreadLink — `taskThreadLinks`, **40** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `taskId` | `ID` |  |
| `threadId` | `ID` |  |
| `linkedAt` | `ISODateTime` |  |
| `linkedById` | `ID \| null` |  |

### Project — `projects`, **6** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `number` | `number` |  |
| `partnerId` | `ID` |  |
| `name` | `string` |  |
| `description` | `string` |  |
| `state` | `ProjectState` |  |
| `price` | `number \| null` | Fixed price in the partner's currency; null while pricing is pending. |
| `pricingPending` | `boolean` |  |
| `priceAdjustNote` | `string \| null` |  |
| `requestedByPartner` | `boolean` |  |
| `createdAt` | `ISODateTime` |  |
| `completedAt` | `ISODateTime \| null` |  |
| `cancelledAt` | `ISODateTime \| null` |  |
| `billedInvoiceId` | `ID \| null` |  |

### PointTransaction — `pointTransactions`, **53** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `taskId` | `ID \| null` |  |
| `periodYear` | `number` |  |
| `periodMonth` | `number` | 1-12 |
| `points` | `number` |  |
| `kind` | `PointTransactionKind` |  |
| `ratePerPoint` | `number` | Snapshot of the rate effective on day 1 of the period. |
| `amount` | `number` | points x rate for chargeable rows; 0 for free rows. |
| `invoiceLineItemId` | `ID \| null` | Set once an invoice has billed this row (points_overflow line). |
| `createdByName` | `string \| null` |  |
| `note` | `string \| null` |  |
| `createdAt` | `ISODateTime` |  |

## Invoicing

### Invoice — `invoices`, **43** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `partnerId` | `ID` |  |
| `invoiceNumber` | `string` | INV-YYYY-MM-NNNNNN, a global per-period sequence. Null on drafts is NOT used: drafts get a number too. |
| `kind` | `InvoiceKind` |  |
| `title` | `string \| null` | Ad-hoc subject (<=200); null for monthly. |
| `periodYear` | `number` |  |
| `periodMonth` | `number` |  |
| `status` | `InvoiceStatus` |  |
| `currency` | `Currency` |  |
| `subtotal` | `number` |  |
| `tax` | `number` |  |
| `total` | `number` |  |
| `vatInclusive` | `boolean` | true: line prices already include VAT; false: VAT is added on top. |
| `vatRate` | `number` | 0.18 (Georgian VAT). |
| `notes` | `string` |  |
| `issuedAt` | `ISODateTime \| null` |  |
| `dueAt` | `ISODateTime \| null` |  |
| `paidAt` | `ISODateTime \| null` |  |
| `voidedAt` | `ISODateTime \| null` |  |
| `voidReason` | `string \| null` |  |
| `disputedAt` | `ISODateTime \| null` |  |
| `disputeReason` | `string \| null` |  |
| `templateId` | `ID \| null` |  |
| `createdAt` | `ISODateTime` |  |
| `updatedAt` | `ISODateTime` |  |

### InvoiceLineItem — `invoiceLines`, **147** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `invoiceId` | `ID` |  |
| `kind` | `InvoiceLineKind` |  |
| `description` | `string` |  |
| `quantityNumerator` | `number` |  |
| `quantityDenominator` | `number` |  |
| `unitPrice` | `number` |  |
| `amount` | `number` |  |
| `sortOrder` | `number` |  |
| `metadata` | `InvoiceLineMetadata` |  |

### InvoiceLineMetadata

| Field | Type | Notes |
|---|---|---|
| `licenseCode?` | `string` |  |
| `sumUserDays?` | `number` |  |
| `daysInMonth?` | `number` |  |
| `projectId?` | `ID` |  |
| `points?` | `number` |  |

### InvoiceTemplate — `invoiceTemplates`, **3** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `name` | `string` |  |
| `partnerId` | `ID \| null` | Null = Global. |
| `mode` | `TemplateMode` |  |
| `html` | `string` | Mustache-style HTML; used when mode = 'html' and generated from blocks otherwise. |
| `css` | `string` |  |
| `layout` | `TemplateBlock[]` |  |
| `signatureDataUrl` | `string \| null` | Signature image (PNG data URL) drawn on the 600x200 pad; null when none. |
| `isDefault` | `boolean` |  |
| `createdAt` | `ISODateTime` |  |
| `updatedAt` | `ISODateTime` |  |

### TemplateBlock

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `type` | `TemplateBlockType` |  |
| `props` | `Record<string, string \| number \| boolean \| null>` | Block-specific settings: text (may hold {{tokens}}), image data URL, height, align... |

### OutboxEmail — `outbox`, **7** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `invoiceId` | `ID` |  |
| `to` | `string[]` |  |
| `cc` | `string[]` |  |
| `subject` | `string` |  |
| `sentAt` | `ISODateTime` |  |
| `sentByName` | `string` |  |

## Mail

### Mail — `mails`, **106** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `threadId` | `ID` |  |
| `messageId` | `string` | RFC 5322 Message-ID, e.g. `<a1b2@mail.zemo.example>`. |
| `subject` | `string` |  |
| `fromAddr` | `string` |  |
| `fromName` | `string` |  |
| `toAddrs` | `string[]` |  |
| `ccAddrs` | `string[]` |  |
| `bodyText` | `string` |  |
| `bodyHtml` | `string \| null` | Static, sanitized HTML; rendered in a sandboxed iframe. |
| `receivedAt` | `ISODateTime` |  |
| `ingestedAt` | `ISODateTime` |  |
| `status` | `MailStatus` |  |
| `inReplyTo` | `string \| null` |  |
| `references` | `string[]` |  |
| `attachmentIds` | `ID[]` |  |
| `partnerId` | `ID \| null` | Matched from the sender's domain; null for unknown senders. |

### MailThread — `threads`, **55** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `subject` | `string` |  |
| `subjectNormalized` | `string` |  |
| `participantAddrs` | `string[]` |  |
| `firstMessageAt` | `ISODateTime` |  |
| `lastMessageAt` | `ISODateTime` |  |
| `messageCount` | `number` |  |
| `status` | `MailStatus` | Rolled up from its mails: followup > new > triaged > task_created > ignored. |
| `partnerId` | `ID \| null` |  |

### Attachment — `attachments`, **19** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `mailId` | `ID` |  |
| `filename` | `string` |  |
| `mimeType` | `string` |  |
| `sizeBytes` | `number` |  |
| `sampleFile` | `string` | Bundled sample under public/, relative to BASE_URL (e.g. `samples/call-log.csv`). |

### PendingMail — `pendingMails`, **15** rows in the seed

A mail waiting on the fake IMAP server; "Poll now" / the poll job ingests these.

| Field | Type | Notes |
|---|---|---|
| `deliverAfterSec` | `number \| null` | Seconds after load at which the timed injector may deliver it (null = only on Poll now). |

## Operations

### ActivityLog — `activityLog`, **189** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `createdAt` | `ISODateTime` |  |
| `actorUserId` | `ID` |  |
| `actorName` | `string` |  |
| `actorEmail` | `string` |  |
| `actorRole` | `StaffRole` |  |
| `actorIp` | `string` |  |
| `action` | `string` | e.g. task.transition, invoice.issue, partner.set_seats. |
| `entityType` | `AuditEntityType` |  |
| `entityId` | `ID` |  |
| `partnerId` | `ID \| null` |  |
| `before` | `unknown` |  |
| `after` | `unknown` |  |
| `diff` | `JsonPatchOp[]` |  |
| `requestId` | `string` |  |

### JsonPatchOp

| Field | Type | Notes |
|---|---|---|
| `op` | `'add' \| 'remove' \| 'replace'` |  |
| `path` | `string` |  |
| `value?` | `unknown` |  |

### SystemLog — `systemLogs`, **503** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `createdAt` | `ISODateTime` |  |
| `level` | `LogLevel` |  |
| `source` | `string` | e.g. partner.user_sync.sync, partner.auth.token, jobs.run, http.exception. |
| `message` | `string` |  |
| `partnerId` | `ID \| null` |  |
| `requestId` | `string \| null` |  |
| `context` | `Record<string, unknown> \| null` |  |
| `payload` | `unknown` |  |

### HealthIncident — `incidents`, **4** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `dependency` | `HealthDependency` |  |
| `startedAt` | `ISODateTime` |  |
| `endedAt` | `ISODateTime \| null` |  |
| `reason` | `string` |  |

### ServiceHealth

| Field | Type | Notes |
|---|---|---|
| `dependency` | `HealthDependency` |  |
| `status` | `ServiceStatus` |  |
| `latencyMs` | `number \| null` |  |
| `reason` | `string \| null` |  |
| `sparkline` | `number[]` | Rolling, newest last (max 60). |
| `lastCheckedAt` | `ISODateTime` |  |

### HealthSnapshot

| Field | Type | Notes |
|---|---|---|
| `takenAt` | `ISODateTime` |  |
| `services` | `ServiceHealth[]` |  |
| `resources` | `{` |  |
| `cpuLoad` | `[number, number, number]` |  |
| `eventLoopP50Ms` | `number` |  |
| `eventLoopP99Ms` | `number` |  |
| `rssMb` | `number` |  |
| `diskFreePct` | `number` |  |
| `nodeVersion` | `string` |  |
| `uptimeSec` | `number` |  |
| `pid` | `number` |  |
| `backlog` | `{` |  |
| `queuedJobs` | `number` |  |
| `failedJobs24h` | `number` |  |
| `staleSyncPartners` | `number` |  |
| `errors15m` | `number` |  |

### HealthHistoryPoint

| Field | Type | Notes |
|---|---|---|
| `bucketAt` | `ISODateTime` |  |
| `avg` | `number` |  |
| `min` | `number` |  |
| `max` | `number` |  |

### BillingDetails

| Field | Type | Notes |
|---|---|---|
| `bankName` | `string` |  |
| `accountHolder` | `string` |  |
| `iban` | `string` |  |
| `swift` | `string` |  |
| `address` | `string` |  |
| `notes` | `string` |  |

### SystemSettings

| Field | Type | Notes |
|---|---|---|
| `imap` | `{ host: string; port: number; user: string; password: string; tls: boolean }` |  |
| `smtp` | `{ host: string; port: number; user: string; password: string; from: string; tls: boolean }` |  |
| `appBaseUrl` | `string` |  |
| `billing` | `BillingDetails` |  |
| `retention` | `{ healthDays: number; systemLogDays: number }` |  |

### MailBackfillRun — `backfillRuns`, **1** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `state` | `BackfillState` |  |
| `cancelRequested` | `boolean` |  |
| `totalCount` | `number` |  |
| `processedCount` | `number` |  |
| `ingestedCount` | `number` |  |
| `skippedCount` | `number` |  |
| `errorCount` | `number` |  |
| `lastError` | `string \| null` |  |
| `startedAt` | `ISODateTime` |  |
| `finishedAt` | `ISODateTime \| null` |  |
| `startedByName` | `string` |  |
| `limit` | `number \| null` |  |

### SchedulerRun — `schedulerRuns`, **9** rows in the seed

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` |  |
| `job` | `SchedulerJobName` |  |
| `startedAt` | `ISODateTime` |  |
| `finishedAt` | `ISODateTime` |  |
| `ok` | `boolean` |  |
| `summary` | `string` | Human summary, e.g. "4 mails ingested, 0 skipped". |
| `triggeredByName` | `string` |  |

