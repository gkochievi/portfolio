# Azri demo — data schema

The store is `Seed` (`src/types.ts`): nine plain arrays, a `structuredClone` of the generated JSON in
`seed/`, held in memory for the life of the tab and restored by `resetDemoData()`. Nothing is
written to browser storage. Every identifier is a string except question ids, which are numbers in
the original's style (1101, 1102 …).

Conventions:

- **`LocalizedText`** is `{ en: string, ka: string }`. Seed copy is authored in both languages.
  Survey handlers resolve it to a plain string for the requested `lang`; console handlers return it
  whole and the UI picks with `lt(text, lang)`.
- **`ISODate`** is a UTC ISO-8601 string. Every seed timestamp is authored relative to
  `SEED_DATE = 2026-10-01T09:00:00Z` and shifted by `rebaseDates` to the moment the tab boots, so
  the demo never goes stale. Keys ending in `At`, `Date`, `_at`, `date`, `time` or `Time` are
  rebased.
- **Phones** are always masked, `+995 5•• ••• 451`. No real-looking number exists anywhere.
- **Time** in handlers is `clock.now()` (the demo clock), never `new Date()`.

## Seed counts

| Table | Rows | Notes |
|---|---|---|
| `tenants` | 5 | bank, telecom, car service, clinic, café chain |
| `branches` | 10 | Tbilisi and Batumi |
| `staff` | 16 | one with a demo account |
| `campaigns` | 6 | |
| `questions` | 21 | 3-4 per campaign |
| `recipients` | 6 | the inbox personas |
| `links` | 286 | 156 completed, 92 expired, 38 pending; 11 persona links, 275 background; 16 sent by a staff member, 270 by `system` |
| `messages` | 13 | 11 `survey`, 1 `unknown`, 1 `missing` |
| `responses` | 156 | all `source: 'seed'` at boot; 554 answers (52 skipped), mean 4.23; 60 with a comment (42 `ka`, 18 `en`) |
| comment pools | 119 | `comments.json` — 65 positive, 29 neutral, 25 negative; read by the simulator, not part of the store |
| accounts | 3 | `seed/accounts.ts`; not part of the store, owned by the session |

Links per tenant: Nergi Bank 117, Elva Telecom 88, Puri da Chai 30, Kalakuri Clinic 26, Borbali
Auto Service 25.

## Entities

### `Tenant` — a business that sends surveys

| Field | Type | |
|---|---|---|
| `id` | `string` | `t_nergi`, `t_elva`, `t_borbali`, `t_kalakuri`, `t_puri` |
| `name` | `LocalizedText` | |
| `monogram` | `string` | two letters, drawn in the brand mark |
| `industry` | `'bank' \| 'telecom' \| 'auto' \| 'clinic' \| 'cafe'` | |
| `copyrightName` | `string` | the footer's copyright holder |
| `smsSender` | `string` | alphanumeric sender ID, 11 characters at most |
| `primary` | `string` (hex) | white-label primary, at least 4.5:1 against `onPrimary` |
| `onPrimary` | `string` (hex) | `#FFFFFF` for all five |
| `tint` | `string` (hex) | light tint for chips and header bands |
| `primaryDark` | `string` (hex) | the primary on dark surfaces |

Has many `Branch`, `Staff`, `Campaign`, `SurveyLink`, `SurveyResponse`, `SmsMessage`.
`TenantBranding` is the wire subset (`id, monogram, copyrightName, smsSender, primary, onPrimary,
tint, primaryDark` plus a resolved `name: string`) that re-skins the microsite.

### `Branch`

| Field | Type | |
|---|---|---|
| `id` | `string` | `br_nergi_vake`, `br_elva_isani` … |
| `tenantId` | `string` | → `Tenant` |
| `name` | `LocalizedText` | |
| `city` | `LocalizedText` | |

Has many `Staff`, `SurveyLink`, `SurveyResponse`.

### `Staff`

| Field | Type | |
|---|---|---|
| `id` | `string` | `stf_levan` … |
| `tenantId` | `string` | → `Tenant` |
| `branchId` | `string` | → `Branch` (the same tenant) |
| `name` | `LocalizedText` | |
| `title` | `LocalizedText` | a job title, "Loan officer" |
| `accountId` | `string \| null` | the demo account that is this person (`acc_levan`), else `null` |

### `Campaign`

| Field | Type | |
|---|---|---|
| `id` | `string` | `cmp_nergi_visit`, `cmp_elva_shop`, `cmp_elva_call`, `cmp_borbali_service`, `cmp_kalakuri_visit`, `cmp_puri_visit` |
| `tenantId` | `string` | → `Tenant` |
| `title` | `LocalizedText` | shown at the top of the survey |
| `description` | `LocalizedText` | |
| `createdAt` | `ISODate` | |
| `linkTtlDays` | `number` | how long a link stays valid after it is sent; 7, or 3 for the café |
| `touchpoint` | `LocalizedText` | the interaction being rated, "Branch visit" |

Has many `Question` and `SurveyLink`.

### `Question`

| Field | Type | |
|---|---|---|
| `id` | `number` | 1101-1104, 1201-1203, 1211-1213, 1301-1304, 1401-1403, 1501-1504 |
| `campaignId` | `string` | → `Campaign` |
| `order` | `number` | 1-based display order |
| `text` | `LocalizedText` | |

### `Recipient` — an inbox persona (demo-only)

| Field | Type | |
|---|---|---|
| `id` | `string` | `rcp_mariam`, `rcp_eka`, `rcp_giorgi`, `rcp_irakli`, `rcp_tamar`, `rcp_luka` |
| `name` | `LocalizedText` | |
| `phoneMasked` | `string` | always masked |
| `avatarColor` | `string` (hex) | |

Has many `SmsMessage` and `SurveyLink`. Only Mariam is also an account.

### `SurveyLink` — the one-time token (`?id=`)

| Field | Type | |
|---|---|---|
| `id` | `string` | the `survey_id`: six characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` |
| `campaignId` | `string` | → `Campaign` |
| `tenantId` | `string` | → `Tenant` |
| `branchId` | `string` | → `Branch` |
| `staffId` | `string` | → `Staff`, the person being rated |
| `recipientId` | `string \| null` | → `Recipient`; `null` for a background customer |
| `phoneMasked` | `string` | for background recipients; persona links use the persona's |
| `interactionAt` | `ISODate` | when the visit, call or service happened |
| `sentAt` | `ISODate` | |
| `expiresAt` | `ISODate` | `sentAt + campaign.linkTtlDays` |
| `status` | `'pending' \| 'completed' \| 'expired'` | the stored status; see below |
| `completedAt` | `ISODate \| null` | |
| `responseId` | `string \| null` | → `SurveyResponse`, 0..1 |
| `sentBy` | `string` | a staff id, or `'system'` for the CRM's own automations |

**Effective status.** `effectiveStatus(link, now)` is what every screen shows: a `pending` link
whose `expiresAt <= clock.now()` reads as `expired` even before the sweeper has flipped it. The
sweeper (every 30 s and on `clock:changed`) keeps the stored value in step, and revives the links it
expired itself when the clock moves back. Seeded expired links are never touched.

The four hand-placed tokens: `7KQ2M9` (Mariam, Nergi Bank Vake, pending), `C4WN8T` (Mariam, Elva
Didube shop, completed), `X2HB5R` (Giorgi, Nergi Bank Batumi, expired), and `4TQ7PL`, printed in an
SMS but deliberately **absent from the store**, which is how "unknown id" works. It is reserved:
`generateToken()` never issues it.

### `SmsMessage` — a text in a persona's inbox

| Field | Type | |
|---|---|---|
| `id` | `string` | `sms_…` |
| `recipientId` | `string` | → `Recipient` |
| `tenantId` | `string` | → `Tenant` |
| `sender` | `string` | the tenant's `smsSender` |
| `body` | `LocalizedText` | the full text including the short link |
| `shortLink` | `string` | `azri.example/s/7KQ2M9`; `azri.example/s/` for a missing id |
| `href` | `string` | the in-app target: `/?id=7KQ2M9`, or `/survey` for a missing id |
| `surveyId` | `string \| null` | the token the link carries |
| `kind` | `'survey' \| 'unknown' \| 'missing'` | `unknown` = token not in the store; `missing` = no `?id` |
| `receivedAt` | `ISODate` | 0-3 days before the anchor; expired ones 9-12 |

A message is shown only once `receivedAt <= clock.now()`. A message created by Send survey SMS is
added ~1.2 s after the link, with `kind: 'survey'`.

### `SurveyResponse` — the `fill-survey` payload, stored

| Field | Type | |
|---|---|---|
| `id` | `string` | `rsp_…` |
| `surveyId` | `string` | → `SurveyLink.id` |
| `campaignId` · `tenantId` · `branchId` · `staffId` | `string` | copied from the link |
| `answers` | `Answer[]` | one per campaign question, in order |
| `comment` | `string` | verbatim, at most 2000 characters |
| `commentLang` | `'en' \| 'ka'` | detected from the text; never translated |
| `submittedAt` | `ISODate` | |
| `source` | `'seed' \| 'session' \| 'simulated'` | `session` rows get the "just now" tag for 10 minutes |

`Answer` is `{ id: number, question_rate: number | null }` — `id` is a `Question.id`, the rate is
an integer 1-5, and `null` means skipped. A submit that omits a question stores `null` for it.

## Accounts and session

`AzriAccount` (`seed/accounts.ts`), held by demo-kit's session, which starts signed in as the first.

| Field | Type | |
|---|---|---|
| `id` | `string` | `acc_mariam`, `acc_nino`, `acc_levan` |
| `name` · `nameKa` | `string` | |
| `email` · `password` | `string` | `…@azri.example` · `azri-demo`; the password never leaves `auth.ts` |
| `role` | `'respondent' \| 'admin' \| 'agent'` | |
| `roleLabel` · `description` · `avatarColor` | `string` | for the demo bar |
| `staffId` | `string \| null` | → `Staff` (agent only) |
| `recipientId` | `string \| null` | → `Recipient` (respondent only) |
| `home` | `string` | the route it lands on |

An **agent is always scoped to their own `staffId`, `branchId` and `tenantId`**, whatever params a
request sends.

## Wire types

What the handlers return. Console types carry `LocalizedText`; survey types carry resolved strings.

| Type | Shape |
|---|---|
| `ApiEnvelope<T>` | `{ success: true, data: T }` or `{ success: false, message, meta?: { tenantId, status } }`. Always HTTP 200, like the original. |
| `ValidateData` | `campaign { title, description }`, `questions [{ id, question_text }]`, `tenant: TenantBranding`, `context { touchpoint, branch, staff, interactionAt, expiresAt }` |
| `SURVEY_MESSAGES` | `'Survey not found'` · `'Survey already completed'` · `'Survey link expired'` — the page branches on these |
| `KpiSet` | `csat` (share of ratings that are 4-5, 0-100), `avgRating`, `responseRate` (completed ÷ sent in the window, 0-100), `responsesToday`, `sent`, `completed`, `expired`, `pending` |
| `TrendPoint` | `{ date: 'yyyy-MM-dd', responses, avgRating }`, one per day, zero-filled |
| `Distribution` | `[n1, n2, n3, n4, n5]`, answers per rating |
| `QuestionStat` | `questionId`, `text`, `avg`, `answered`, `skipped`, `distribution` |
| `ResponseRow` | a response joined with tenant, campaign, branch and staff names, masked phone, persona name, `avgRating`, `answeredCount`, `questionCount` |
| `ResponseDetail` | `ResponseRow` plus every answer with its question text, and the link's `sentAt`, `expiresAt`, `completedAt`, `interactionAt`, `sentBy` |
| `LinkRow` | `SurveyLink` plus tenant, campaign, branch, staff and persona names; `status` is the effective one |
| `Page<T>` | `{ items, total, page, pageSize }`; `pageSize` capped at 100, a page past the end clamps to the last |
| `MetaLookups` | `{ tenants, branches, staff, campaigns }` |
| `DemoEvents` | `link:updated` · `response:created` · `sms:received` · `clock:changed` · `store:reset` |

Group-local wire types live in `src/features/<group>/types.ts`: `RecipientSummary`, `InboxMessage`,
`BranchSample`, `ClockState`, `PlaygroundRoute` (launcher); `Overview`, `BreakdownRow` (insights);
`CampaignSummary`, `CampaignDetail`, `LinksPage`, `LinkCounts` (campaigns); `MyOverview`,
`SendOptions`, `SendSurveyRequest` (staff).

## Relations

```
Tenant ─┬─< Branch ─┬─< Staff
        │           └─< SurveyLink >─ Staff           (the person being rated)
        ├─< Campaign ─┬─< Question
        │             └─< SurveyLink ─── 0..1 ─ SurveyResponse
        └─< SmsMessage >─ Recipient ─< SurveyLink     (a persona link; background links have none)
```

## Invariants the handlers keep

- A token is spent once. Submitting sets `status: 'completed'`, `completedAt` and `responseId`
  and creates exactly one `SurveyResponse`; a second submit of the same token gets the
  "already completed" envelope.
- `question_rate` is `null` or an integer 1-5; anything else is a 400.
- Ids continue from the seed's highest (`rsp_…`, `sms_…`) and are never reused. `resetDemoData()`
  restores the pristine rows and the real clock.
- Background respondents only ever complete links with `recipientId === null`.
