# Chiti demo — data schema

The in-memory database is `store.data`, typed `ChitiDb` (`src/types.ts`). It is a deep copy of
`seed` (`src/demo/seed/`), rebased to "now" on every reset. Nothing here is persisted.

Conventions

- Every timestamp is an ISO string (`ISODate`). The seed is authored as of `SEED_ANCHOR`
  (`2026-10-05T11:00:00Z`, Monday 15:00 Asia/Tbilisi) and `rebaseDates` shifts every key listed in
  `TIMESTAMP_KEYS` (`src/demo/clock.ts`) by *now − anchor*.
- Every tenant-scoped row carries `tenantId`; handlers filter on it and `findSession` and friends
  return 404 across tenants.
- Ids are strings. Seeded ids are readable (`ten_vazi`, `op_luka`); runtime ids come from
  `newId(prefix)` as `${prefix}${tabTag}_${n}` so two mirrored tabs never mint the same id.
- UI language is `Lang` (`en | ka`). Tenant **content** is `LocalizedText` (`ka` and `en` required,
  `ru` optional). People are `PersonName` (`en`, `ka`).
- Nothing points at a remote URL: avatars are preset ids, media is `${BASE_URL}media/…` or an
  object URL created in the tab.

## Enumerations

| Type | Values |
|---|---|
| `Channel` | `web_widget` · `facebook_messenger` · `instagram` · `whatsapp` · `telegram` · `tiktok` |
| `Role` | `customer` · `operator` · `admin` · `supervisor` · `superadmin` |
| `SessionStatus` | `waiting` · `active` · `inactive` · `ended` |
| `EndedBy` / `EndReason` | `customer` · `operator` · `admin` · `system` / `manual` · `inactivity` · `customer_return` · `queue_cleared` · `stale_waiting` |
| `AiState` | `bot` · `handed_off` · `copilot` · `closed` · `null` |
| `HandoffReason` | `customer_request` · `operator_claim` · `ai_recommended` · `unsupported_content` · `no_answer` · `circuit_open` · `bot_paused` · `delivery_failed` |
| `SessionTopic` | `delivery` · `order_status` · `returns` · `payment` · `pairing` · `gift` · `corporate` · `other` |
| `MessageType` | `text` · `file` · `image` · `location` · `audio` · `template` |
| `DeliveryStatus` / `FailureKind` | `pending` · `sent` · `delivered` · `read` · `failed` / `window_closed` · `cap_reached` · `unsupported_media` · `network` |
| `ThemePreset` | `canary` · `olive` · `clay` · `plum` · `moss` · `slate` · `night` · `paper` |
| `DistributionStrategy` | `ordered` · `round_robin` · `random` · `least_busy` |

## Tenancy and settings

### `tenants` — 6 rows

| Field | Type | Notes |
|---|---|---|
| `id`, `slug` | string | `ten_vazi`/`vazi`, `ten_bostani`, `ten_mtvare`, `ten_kvali`, `ten_aivani`, `ten_gza` |
| `name`, `industry` | `LocalizedText` | |
| `allowedOrigins` | string[] | embed origins, fictional `.example` hosts |
| `disabled`, `disabledAt`, `deletedAt` | boolean, `ISODate \| null` | state is `active` / `disabled` / `deleted`; Gza is seeded disabled |
| `createdAt` | `ISODate` | |
| `features` | `ChannelFeatures` | five booleans: `facebook_messenger`, `instagram`, `whatsapp`, `telegram`, `tiktok` — which channels the tenant may use |
| `counts` | `{ operators, admins, supervisors, customers, sessions }` | headline counters for the super-admin table; Vazi's are recomputed from the seed |

### `settings` — 1 per tenant (6), `TenantSettings`

| Field | Type | Notes |
|---|---|---|
| `tenantId` | string | FK → `tenants` |
| `chatTitle` | `LocalizedText` | the widget header |
| `clientTheme`, `operatorTheme`, `adminTheme` | `ThemePreset` | one per surface |
| `operatorEnterDirectly` | boolean | auto-assign on |
| `chatDistributionStrategy` | `DistributionStrategy` | |
| `operatorChatLimit` | number | 0 = unlimited |
| `typingTransparency`, `requestFeedback`, `messageNotesEnabled`, `clientIpEnabled`, `autoGreetingEnabled` | boolean | |
| `autoGreeting`, `bannedMessage` | `LocalizedText` | |
| `inactiveWarningMinutes`, `inactiveDisconnectMinutes` | number | product minutes; 1 minute = 9 s of demo time |
| `operatorResponseMinutes`, `operatorLogoutGraceMinutes` | number | 0 = off |
| `chatRetentionDays` | number | |
| `faqEnabled`, `faqShowOperatorButton` | boolean | |
| `faqTree` | `FaqTree` | see below |
| `aiBotEnabled` | boolean | bot answers first |
| `widgetPosition` | `'right' \| 'left'` | |

### `workingHours` — 1 per tenant (6)

`tenantId`, `timezone` (`Asia/Tbilisi`), `weeklySchedule: DaySchedule[]` (`day` 0–6, `enabled`,
`start`/`end` as `HH:mm`), `isTemporarilyClosed`, `temporaryClosedFrom`/`Until`,
`temporaryClosedMessage`, `nextAvailableMessage` (`LocalizedText`), and `demoOverride`
(`auto | open | closed`; the storefront panel sets it). `computeStatus` turns it into a
`WorkingHoursStatus` (`isOpen`, `reason`, `nextOpen`, today's hours).

### `customFields` — 14 rows (4 on Vazi)

`id`, `tenantId`, `label`, `placeholder` (`LocalizedText`), `type` (`text | number | email | phone |
select`), `required`, `options: { value, label }[]`, `sortOrder`, `enabled`, `groupBy` (the key that
links a customer's previous chats — the phone number).

### `FaqTree` (inside `settings.faqTree`; Vazi's has 9 nodes)

`rootIds: string[]` and `nodes: Record<string, FaqNode>`. A `FaqNode` is `id`, `type`
(`question | answer`), `text` (`LocalizedText`), `position {x, y}` for the editor canvas, and
`options: FaqOption[]`. A `FaqOption` is `id`, `label`, `nextId` (→ another node, or `null`) and
`transferToOperator`.

### `quickReplies` — 12 rows (3 each in `greetings`, `delivery`, `payment`, `closing`)

`id`, `tenantId`, `title`, `content` (`LocalizedText`), `category`, `sortOrder`, `enabled`.

### `bans` — 3 rows

`id`, `tenantId`, `type` (`ip | customField`), `value`, `fieldId`/`fieldLabel` (for a field rule),
`reason`, `createdBy`, `createdAt`. One IP rule matches the storefront panel's "be banned" preset.

## People

### `operators` — 18 rows (6 on Vazi)

| Field | Type | Notes |
|---|---|---|
| `id`, `tenantId` | string | `op_luka`, … |
| `name` | `PersonName` | |
| `nickname`, `username`, `email` | string | the nickname is what customers see |
| `operatorNumber` | string | 3–4 digits, shown as `#1205` |
| `isExternal` | boolean | |
| `avatarId` / `avatarUrl` | string \| null | preset id / object URL of an upload |
| `status` | `online \| away \| offline` | two of each on Vazi |
| `pausedAt`, `pausedBy` | `ISODate \| null`, `self \| admin \| null` | a forced pause by an admin |
| `activeChatCount` | number | computed at seed time from active/inactive sessions |
| `language` | `ContentLang` | |
| `pushEnabled` | boolean | a preference only; there is no push |
| `lastSeen`, `createdAt` | `ISODate` | |

### `admins` — 7 rows (2 on Vazi) and `supervisors` — 1 row

Same shape minus presence: `id`, `tenantId`, `name`, `nickname`, `username`, `email`,
`adminNumber` / `supervisorNumber`, `isExternal`, `language`, `createdAt`. An admin also has
`operatorId` → `operators` for "become operator" (a linked operator profile), or `null`.

### `superAdmins` — 1 row

`id`, `name`, `username`, `email`, `language`. No tenant.

### Accounts (`seedAccounts`, not in `ChitiDb`) — 28 rows

One sign-in-able `ChitiAccount` per staff record, plus the customer persona. `id`, `name`,
`nameKa`, `email`, `username`, `password` (always `chiti-demo`), `role`, `roleLabel`,
`description`, `avatarColor`, `staffId` (→ the staff table of that role), `tenantId` (null for the
super admin), `homeRoute`, `headline` (the five the demo bar lists). The array in
`src/demo/session.ts` is mutable: creating or deleting staff adds or drops accounts, and a reset
rebuilds it.

## Conversations

### `customers` — 117 rows

| Field | Type | Notes |
|---|---|---|
| `id`, `tenantId` | string | |
| `name` | string | |
| `number` | string | unique per tenant: `anon-…` for the widget, `wa:…` `fb:…` `ig:…` `tg:…` `tt:…` per channel |
| `channel` | `Channel` | first-contact channel |
| `status` | `waiting \| connected \| disconnected` | |
| `activeSessionId` | string \| null | → `sessions` |
| `fields` | `Record<customFieldId, string>` | the pre-chat answers |
| `externalContact` | `ExternalContact \| null` | `channel`, `externalUserId`, `displayName`, `username` (`@handle`), `avatarId`, `locale` |
| `language` | `ContentLang` | |
| `createdAt` | `ISODate` | |

### `sessions` — 369 rows, `ChatSession`

One conversation. 6 active · 5 waiting · 2 inactive · 356 ended. By channel: widget 133, WhatsApp 67,
Instagram 54, TikTok 52, Messenger 52, Telegram 11. By topic: delivery 84, order status 52, payment 51,
pairing 43, gift 42, returns 41, other 36, corporate 20.

| Field | Type | Notes |
|---|---|---|
| `id`, `tenantId` | string | |
| `customerId` | string | → `customers`; `customerName`, `customerNumber` are denormalised |
| `channel`, `status`, `origin`, `topic` | enums | `origin` is `seed`, `spawner` or `visitor` |
| `startedAt`, `lastActivity`, `endedAt` | `ISODate` | `endedAt` null while open |
| `endedBy`, `endReason`, `endSummary` | enums, string | the short line on history rows |
| `warningIssuedAt`, `inactiveSince` | `ISODate \| null` | the inactivity ladder |
| `operatorId` | string \| null | → `operators`; the current holder |
| `excludedOperatorIds` | string[] | operators the chat was returned from; they are not offered it again |
| `clientIp`, `clientLanguage` | string \| null, `ContentLang` | |
| `faqPath` | `FaqStep[]` | `nodeId`, `question`, `answer` — what the customer walked before the form |
| `customFields` | `SessionFieldValue[]` | `fieldId`, `label`, `value` snapshot |
| `firstStaffReplyAt`, `lastInboundAt` | `ISODate \| null` | `lastInboundAt` drives the channel reply window |
| `consecutiveBusinessMessages` | number | TikTok allows 10 in a row |
| `externalThreadId` | string \| null | |
| `adminInterventionActive`, `interventionAdminId` | boolean, string \| null | an admin is writing in the chat |
| `aiState`, `aiHandoff` | `AiState`, `AiHandoff \| null` | `aiHandoff` is `at`, `reason`, `summary`, `goal` (in the customer's language), `source` |
| `unreadCount`, `messageCount` | number | |
| `transcript` | `full \| summary` | `summary` sessions get a deterministic transcript on first read (`engine.ensureTranscript`) |

### `messages` — 753 rows, `Message`

`id`, `tenantId`, `sessionId`; `sender` (`user | operator | admin | bot | system`), `senderId`,
`senderName`; `type`, `content`, `file` (`url`, `name`, `mimeType`, `size`), `location` (`lat`,
`lng`, `label`); `sentByAdmin`; `timestamp`; `deliveryStatus`, `failureKind`; `seenAt`;
`reactionEmoji`; `channel`; `isPreChat`, `isAutoGreeting`; `citations: string[]` (bot answers);
`copilotRef { draftId, variantIndex, action }`; `template { templateId, name, preview }`
(WhatsApp template sends).

### `assignments` — 409 rows

`id`, `sessionId`, `operatorId`, `operatorName`, `assignedVia` (`auto_assign | claim | admin`),
`assignedAt`, `releasedAt`, `releaseReason` (`response_timeout | logout_grace | operator_removed |
reassigned`). A session's assignments, in order, are the hand-over chain the history page draws.

### `notes` — 20 rows

`id`, `tenantId`, `sessionId`, `authorRole`, `authorId`, `authorName`, `content`, `createdAt`.
Internal; the customer never sees them.

### `feedback` — 64 rows

`id`, `tenantId`, `sessionId`, `customerId`, `operatorId`, `rating` (1–5; 5 ×43, 4 ×15, 3 ×6),
`comment`, `submittedAt`.

## Channels and integrations

### `waTemplates` — 5 rows

WhatsApp message templates: `id`, `tenantId`, `externalId`, `name`, `language`, `category`
(`MARKETING | UTILITY | AUTHENTICATION`), `status` (3 approved, 1 pending, 1 rejected),
`qualityScore`, `sendable`, `unsendableReasons`, `recommendedForReengagement`, `slots`
(`key`, `component`, `kind`, `position`, `label`, `example`, `buttonIndex`, `mediaFormat`),
`preview` (`header`, `body` with `{{n}}` placeholders, `footer`, `buttons`), `syncedAt`.

### `integrations` — 6 rows (1 per tenant), `TenantIntegrations`

- `meta`: three `MetaIntegration` — one per `facebook_messenger`, `instagram`, `whatsapp`:
  `enabled`, `displayName`, `routingId`, `accessTokenPreview` (masked), `hasAppSecret`,
  `verifyToken`, `webhookUrl`, `authStatus` (`not_configured | disabled | connected |
  invalid_credentials | network_error | saved_untested`), `lastTestedAt`, `lastTestError`.
- `telegram`: `state` (`not_configured | awaiting_business_connection | connected`), `botUsername`,
  `businessAccount`, `connectedAt`.
- `tiktok`: `state` (`not_configured | connected | unverified | blocked | needs_reauth`), `account`
  (`name`, `username`, `avatarId`), `euInboundDropped`, `connectedAt`.

### `comments` — 12 rows (6 Messenger page, 6 Instagram)

Public comments on a post: `id`, `tenantId`, `channel`, `externalPostId`, `postCaption`,
`parentExternalId`, `authorName`, `authorAvatarId`, `text`, `permalink`, `isHidden`, `isDeleted`,
`repliedAt`, `replyText`, `repliedByName`, `externalCreatedAt`.

### `platform` — 1 object, `PlatformSettings`

Platform-level credentials, all masked: Meta app id/secret preview/config ids, OAuth redirect base,
TikTok app id/secret preview, expected and registered webhook URLs, `systemHealthRetentionMonths`,
and `ai { source, keyId, keyPreview, baseUrl, suggestedBaseUrl }` (the AI platform key).

## AI layer

### `aiLinks` — 6 rows, `AiLinkStatus`

Per tenant: `serverConfigured`, `aiClientId`, `aiBotEnabled`, `autopilotEnabled`, `circuit`
(`state` `closed | open | half_open`, `failures`, `lastReason`, `openUntil`), `botPause`
(`until`, `reason`) or null, `lastTestAt`, `lastTestOk`. All six are seeded closed; the demo's AI
outage switch opens one.

### `copilotDrafts` — 1 row (more are generated live), `CopilotDraft`

`id`, `tenantId`, `sessionId`, `turnMessageId` (the customer message answered), `state` (`running |
ready | refused | error | not_found | rate_limited`), `retryAfterMs`, `knowledge: KnowledgeCard[]`
(`n`, `title`, `snippet`, `documentId`, `score`), `suggestions: CopilotSuggestion[]` (`index`,
`kind` `answer | clarify | escalate`, `text` with `[n]` citation markers, `citations`), `handoff`
(`recommended`, `reason`, `summary`, `goal`) or null, `grounded`, `commitmentWarning`, `transform`
(`shorter | warmer | formal | to_ru | to_ka | to_en`) or null, `createdAt`.

### `copilotFeedback` — 0 rows at boot

`id`, `sessionId`, `draftId`, `action` (`shown | inserted | edited_sent | sent_asis | ignored`),
`variantIndex`, `finalText`, `at`. Written as the operator uses drafts.

## Team chat

### `staffConversations` — 6 rows (1 team room, 5 direct)

`id`, `tenantId`, `kind` (`direct | room`), `title` (`LocalizedText`, rooms only), `dmKey` (sorted
`role:id|role:id`), `members: StaffMember[]` (`role`, `memberId`, `name`, `lastReadAt`),
`lastMessageText`, `lastMessageAt`.

### `staffMessages` — 45 rows

`id`, `tenantId`, `conversationId`, `senderRole`, `senderId`, `senderName`, `type`
(`text | image | file`), `content`, `fileUrl`, `fileName`, `timestamp`, `pending`, `failed`,
`clientId` (the optimistic id a pending bubble reconciles on).

## Audit and platform

### `activity` — 296 rows, `ActivityLog`

`id`, `tenantId`, `action` (one of 41 `ActivityAction`s — 29 occur in the seed), `section`
(`auth | users | chats | reports | integrations`), `actorRole`, `actorId`, `actorName`, `targetId`,
`targetLabel`, `metadata: Record<string, string | number | boolean | null>`, `ipAddress` (from the
`192.0.2.0/24` documentation range), `createdAt`.

### `operatorAudit` — 16 rows

`id`, `tenantId`, `operatorId`, `operatorEmail`, `action` (`created | updated | deleted`),
`performedBy`, `changes: Record<field, { from, to }>`, `createdAt`.

### `healthSamples` — 673 rows

`SystemHealthSample`: `at`, `cpuPercent`, `loadAvg1`, `memUsedMb`, `memTotalMb`, `memPercent`,
`diskUsedGb`, `diskTotalGb`, `diskPercent`, `netRxKbps`, `netTxKbps`, `eventLoopLagMs`, `pingMs`,
`uptimeSeconds`. Seven days at 15-minute steps; the superadmin simulator adds a 1-minute tail for
the last hour and one live sample every 2 s (about 300 kept).

### `demo` — 1 object, `DemoControls`

Demo chrome, not product data: `fastInactivity`, `simulatedIp` (the fake client IP the widget logs
in with), `aiOutageUntil`, `operatorDriving` (true while an inbox is mounted and the visitor plays
the operator), `spawnerEnabled`, `tiktokConnectResult` (`connected | needs_reauth | blocked`).

## Relations

```
tenants 1─1 settings, workingHours, integrations, aiLinks
tenants 1─* operators, admins, supervisors, customers, sessions, customFields, quickReplies,
            bans, waTemplates, comments, staffConversations, activity
admins *─0..1 operators            (operatorId: "become operator")
customers 1─* sessions             (customers.activeSessionId → the open one)
sessions 1─* messages, notes, assignments, copilotDrafts
sessions 0..1─1 feedback
sessions *─0..1 operators          (operatorId; excludedOperatorIds *)
assignments *─1 operators
messages 0..1─1 copilotDrafts      (copilotRef.draftId)
messages 0..1─1 waTemplates        (template.templateId)
staffConversations 1─* staffMessages
accounts *─1 operators | admins | supervisors | superAdmins   (staffId, by role)
```
