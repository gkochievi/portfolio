# Mock API routes

Every endpoint the in-browser backend answers: **134 routes**, registered with `api.register(method, path, handler)` on the
`createMockApi` instance in `core.ts`. The UI calls them through `src/lib/api.ts` (`get`, `post`, `put`, `patch`, `del`), which dispatches
`/api<path>` into the mock; nothing is a network request.

- **Prefix.** `/api`. The paths below are shown without it, as they are registered.
- **Gate.** `createMockApi({ isAuthenticated: session.isSignedIn, publicPrefixes: ['/auth/', '/public/'] })`. Anything outside those prefixes
  answers **401** to a signed-out caller; `/auth/login` and `/auth/me` work signed out, and the public voice tools work for guests and every role.
- **Roles.** The guards live in `guards.ts`: `requireOperator()`, `requireWorkspaceEditor()` (owner or operator; a member gets **403**),
  `tenantScope()` (the caller's own workspace, or the one the operator is acting as; an operator who has not picked one gets 403).
  "Workspace-scoped" below means every query is filtered by that workspace id, the same multi-tenancy invariant the original enforced.
- **Latency.** The kit adds a small simulated delay to every call; long operations (analysers, imports, digests, re-embeds, conversions) are
  timer-driven state machines that patch the store and emit on the event bus, and the UI polls or subscribes.
- **Errors.** Handlers throw `DemoApiError` (`forbidden()`, `notFound()`, `DemoApiError.validation({...})`), which `lib/api.ts` re-dresses as the `ApiError` the screens
  already render, with per-field messages.
- **Streaming.** The copilot's turn stream is not an HTTP route: `POST /copilot/conversations/:id/turns` returns a ticket and the page iterates the async
  generator `streamTurn(ticket)` exported from `handlers/copilot.ts`.
- **Line column.** The `Line` column is the registration line in the owner file.

## Auth, workspace switcher

Owner file: `src/demo/handlers/auth.ts` (5 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| POST | `/auth/login` | Public | Checks email and password against the four demo accounts; returns `Me`. | 29 |
| POST | `/auth/logout` | Public | Clears the session. | 35 |
| GET | `/auth/me` | Public | Who is signed in, their tenant, and the operator's acting workspace; `scope: guest` when signed out. | 40 |
| GET | `/auth/tenants` | Operator | Workspace list for the operator's act-as picker. | 42 |
| PUT | `/auth/act-as` | Operator | Operator picks the workspace they act as (the `X-Act-As-Tenant` header upstream). | 47 |

## Public voice tools

Owner file: `src/demo/handlers/voice-tools.ts` (9 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/public/health` | Public | API status dot on the voice tools page. | 88 |
| GET | `/public/limits` | Public | Daily allowance snapshot (max, used, remaining, features) for the current principal. | 94 |
| GET | `/public/tts/catalog` | Public | Languages, voices and models for the speech tool, filtered by the operator's voice allowlist. | 103 |
| POST | `/public/tts` | Public | Synthesise: returns the pre-recorded clip for that voice and spends one allowance unit. | 117 |
| POST | `/public/transcribe` | Public | Quick transcription of a sample or recording: canned transcript and detected language after 1-3 s. | 189 |
| POST | `/public/sentiment` | Public | Two-sided read: text half and voice half side by side, with arousal, valence and agreement. | 218 |
| GET | `/public/convert/formats` | Public | Target formats and batch limits. | 252 |
| POST | `/public/convert/batches` | Public | Start a conversion batch; rows stream queued, converting, done or failed. | 268 |
| GET | `/public/convert/batches/:id` | Public | Poll one batch (progress, expiry countdown). | 349 |

## Calls workbench

Owner file: `src/demo/handlers/workbench.ts` (6 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/recordings` | Any role, workspace-scoped | Call table rows: status, language, analysers run, score, accuracy, agreement. | 707 |
| GET | `/recordings/:id` | Any role, workspace-scoped | One full recording with segments, fact-check, tone, sentiment and scorecard. | 717 |
| POST | `/recordings/upload` | Any role, workspace-scoped | Upload audio: "transcribing" 1.5 s, then a clone of the closest canned call, relabelled. | 719 |
| POST | `/recordings/text` | Any role, workspace-scoped | Analyse pasted text: split by speaker prefix into untimed segments. | 749 |
| POST | `/recordings/:id/run` | Any role, workspace-scoped | Run or re-run analysers (factcheck, score, semantic, summary); patches results after 1-3 s. | 779 |
| DELETE | `/recordings/:id` | Owner or operator, workspace-scoped | Delete a recording. Owner or operator. | 813 |

## Analysis results: score edits and digests

Owner file: `src/demo/handlers/analysis.ts` (4 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| PATCH | `/recordings/:id/scores` | Owner or operator, workspace-scoped | Manual score edit with a required note; writes a new revision and recomputes the total. | 41 |
| GET | `/summaries` | Any role, workspace-scoped | Digests list, optionally filtered by `recording_id`. | 117 |
| GET | `/summaries/:id` | Any role, workspace-scoped | One multi-call digest. | 126 |
| POST | `/summaries` | Any role, workspace-scoped | Create a digest from several recordings; per-call stage then merge stage. | 128 |

## Knowledge base

Owner file: `src/demo/handlers/knowledge-base.ts` (14 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/kb/stats` | Any role, workspace-scoped | Document, chunk and embedding-coverage tiles. | 308 |
| GET | `/kb/tags` | Any role, workspace-scoped | Distinct tags in the workspace. | 331 |
| GET | `/kb/documents` | Any role, workspace-scoped | Filtered, paged document table (status, type, tag, visibility, search). | 338 |
| GET | `/kb/documents/:id` | Any role, workspace-scoped | One document with its content. | 370 |
| GET | `/kb/documents/:id/chunks` | Any role, workspace-scoped | The document's chunks. | 372 |
| PATCH | `/kb/documents/:id` | Owner or operator, workspace-scoped | Edit title, type, tags, metadata, visibility or content; content change re-chunks. | 379 |
| DELETE | `/kb/documents/:id` | Owner or operator, workspace-scoped | Delete a document and its chunks. | 445 |
| POST | `/kb/documents/:id/reembed` | Owner or operator, workspace-scoped | Re-embed one document. | 456 |
| POST | `/kb/documents/bulk` | Owner or operator, workspace-scoped | Bulk publish, unpublish, re-embed, retag or delete; returns `{affected}`. | 467 |
| POST | `/kb/import/files` | Owner or operator, workspace-scoped | Import files; text formats are read, binaries get templated content; names containing "broken" fail. | 532 |
| POST | `/kb/import/text` | Owner or operator, workspace-scoped | Import pasted text, optionally with AI restructure. | 570 |
| POST | `/kb/import/csv` | Owner or operator, workspace-scoped | Import a question/answer CSV as a FAQ document. | 594 |
| PATCH | `/kb/chunks/:id` | Owner or operator, workspace-scoped | Edit one chunk. | 630 |
| DELETE | `/kb/chunks/:id` | Owner or operator, workspace-scoped | Delete one chunk. | 663 |

## KB quality and curation

Owner file: `src/demo/handlers/kb-quality.ts` (13 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| POST | `/kb/retrieve` | Any role, workspace-scoped | Retrieval playground: ranked hits with score, margin and confidence. | 148 |
| GET | `/kb/search` | Any role, workspace-scoped | Quick search box over the workspace's chunks. | 163 |
| GET | `/kb/duplicates` | Any role, workspace-scoped | Exact duplicates by checksum and near duplicates by Jaccard similarity. | 187 |
| GET | `/kb/events` | Any role, workspace-scoped | KB activity log, filterable by action. | 228 |
| GET | `/kb/export` | Any role, workspace-scoped | JSON or CSV export of the knowledge base. | 241 |
| GET | `/kb/reembed-jobs/current` | Any role, workspace-scoped | The running or latest full re-embed job. | 293 |
| POST | `/kb/reembed-jobs` | Owner or operator, workspace-scoped | Start a full re-embed (409 while one runs); progress advances every 500 ms. | 295 |
| GET | `/curation/proposals` | Any role, workspace-scoped | KB-health proposals grouped by cluster and state. | 364 |
| GET | `/curation/summary` | Any role, workspace-scoped | Pending count for the KB health badge. | 375 |
| POST | `/curation/proposals/bulk-accept` | Owner or operator, workspace-scoped | Accept many proposals; never `remove`. | 510 |
| POST | `/curation/proposals/:id/accept` | Owner or operator, workspace-scoped | Apply a proposal (optionally with edits): update, add or remove a document. | 534 |
| POST | `/curation/proposals/:id/decline` | Owner or operator, workspace-scoped | Decline with a required reason. | 545 |
| POST | `/curation/run` | Owner or operator, workspace-scoped | "Run now": adds 1-2 proposals after about 2 s. | 649 |

## Workspace settings, rubric, default rubric

Owner file: `src/demo/handlers/workspace-settings.ts` (19 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/settings/rubric` | Any role, workspace-scoped | The effective rubric (workspace, or shared default) and `can_edit`. | 113 |
| PUT | `/settings/rubric` | Owner or operator, workspace-scoped | Save a rubric: validation, version +1. | 115 |
| POST | `/settings/rubric/reset` | Owner or operator, workspace-scoped | Reset to the shared default; needs the demo password re-entered (wrong = 403). | 147 |
| POST | `/settings/rubric/import` | Owner or operator, workspace-scoped | Start an AI import job from a document. | 299 |
| GET | `/settings/rubric/import/:jobId` | Owner or operator, workspace-scoped | Poll the import job through its stages to a canned draft. | 313 |
| GET | `/settings/bands` | Any role, workspace-scoped | Amber and green thresholds. | 324 |
| PUT | `/settings/bands` | Owner or operator, workspace-scoped | Save thresholds. | 326 |
| DELETE | `/settings/bands` | Owner or operator, workspace-scoped | Reset thresholds to 50 / 80. | 342 |
| GET | `/settings/sentiment` | Any role, workspace-scoped | Sentiment guidance and voice-tone service status. | 380 |
| PUT | `/settings/sentiment` | Owner or operator, workspace-scoped | Save sentiment settings. | 382 |
| GET | `/settings/transcription` | Any role, workspace-scoped | Effective, inherited and override transcription settings. | 432 |
| PUT | `/settings/transcription` | Owner or operator, workspace-scoped | Save the workspace override (keyterm validation). | 434 |
| DELETE | `/settings/transcription` | Owner or operator, workspace-scoped | Revert to the inherited values. | 476 |
| GET | `/settings/ai` | Any role, workspace-scoped | Per-capability effective connection and own-key overrides. | 543 |
| PUT | `/settings/ai/:capability` | Owner or operator, workspace-scoped | Save an own-key override (write-only key). | 545 |
| DELETE | `/settings/ai/:capability` | Owner or operator, workspace-scoped | Remove the override and its key. | 585 |
| POST | `/settings/ai/:capability/test` | Owner or operator, workspace-scoped | Connection test (about 1 s; ok when a key is set). | 604 |
| GET | `/admin/rubric/default` | Operator | The global default rubric. | 639 |
| PUT | `/admin/rubric/default` | Operator | Save the global default rubric. | 644 |

## Copilot, autopilot, bot configuration

Owner file: `src/demo/handlers/copilot.ts` (13 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/bot/config` | Any role, workspace-scoped | The workspace's bot configuration with inherited markers. | 234 |
| PUT | `/bot/config` | Owner or operator, workspace-scoped | Save bot settings (autopilot blocked without public documents). | 239 |
| GET | `/admin/bot/default` | Operator | The global default bot configuration. | 261 |
| PUT | `/admin/bot/default` | Operator | Save the global default, including per-channel caps. | 266 |
| GET | `/admin/bot/control` | Operator | Kill switch plus a row per workspace (autopilot, reachable, public docs). | 315 |
| PUT | `/admin/bot/kill` | Operator | Flip the global kill switch; emits `bot:kill-changed`. | 320 |
| PUT | `/admin/bot/tenants/:tenantId` | Operator | Stop, resume or toggle autopilot for one workspace. | 329 |
| GET | `/copilot/workspaces` | Any signed-in role | Workspaces the harness can run against (all active for the operator, own otherwise). | 382 |
| POST | `/copilot/conversations` | Any signed-in role | Start a conversation (mode, locale, channel). | 401 |
| GET | `/copilot/conversations/:id` | Any signed-in role | The conversation and its turns. | 432 |
| POST | `/copilot/conversations/:id/turns` | Any signed-in role | Post a customer turn; returns `{turn_id, ticket}` for the stream. | 465 |
| POST | `/copilot/feedback` | Any signed-in role | Insert, edit-then-send or ignore a draft. | 486 |
| POST | `/copilot/stt` | Any signed-in role | Voice in: canned transcript for a recording. | 529 |

## Operator console: workspaces, health, users, limits, retention, voices

Owner file: `src/demo/handlers/console-platform.ts` (27 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/admin/settings` | Operator | Platform settings probe for the console layout. | 60 |
| GET | `/admin/tenants` | Operator | Workspace table with user and document counts. | 77 |
| POST | `/admin/tenants` | Operator | Create a workspace; API key returned once. | 115 |
| PATCH | `/admin/tenants/:id` | Operator | Edit or activate/deactivate a workspace. | 139 |
| DELETE | `/admin/tenants/:id` | Operator | Delete a workspace (type the slug to confirm in the UI). | 175 |
| POST | `/admin/tenants/:id/rotate-key` | Operator | Rotate the API key; new key returned once. | 196 |
| GET | `/admin/tenants/:id/users` | Operator | Users of a workspace. | 207 |
| POST | `/admin/tenants/:id/users` | Operator | Add a user; password returned once. | 215 |
| PATCH | `/admin/tenant-users/:id` | Operator | Change role or active flag. | 261 |
| DELETE | `/admin/tenant-users/:id` | Operator | Remove a user. | 275 |
| POST | `/admin/tenant-users/:id/reset-password` | Operator | New password, returned once. | 285 |
| GET | `/admin/health/overview` | Operator | KPI strip: CPU, memory, swap, disk, network, API, database, jobs, uptime. | 295 |
| GET | `/admin/health/series` | Operator | Time series for a range (1h to 30d), generated. | 302 |
| GET | `/admin/health/tenants` | Operator | Per-workspace load table derived from usage rows and recordings. | 307 |
| PUT | `/admin/health/settings` | Operator | Retention (1-365 days) and sample interval (5-300 s). | 312 |
| GET | `/admin/users` | Operator | Registered self-service users with limits and usage today. | 326 |
| PATCH | `/admin/users/:id` | Operator | Active toggle and limit overrides. | 342 |
| DELETE | `/admin/users/:id` | Operator | Delete a registered user. | 369 |
| POST | `/admin/users/:id/reset-password` | Operator | New password, returned once. | 378 |
| GET | `/admin/limits/registered` | Operator | Registered-tier limits and feature toggles. | 417 |
| PUT | `/admin/limits/registered` | Operator | Save them. | 422 |
| GET | `/admin/limits/anonymous` | Operator | Anonymous-tier limits plus public sentiment settings. | 429 |
| PUT | `/admin/limits/anonymous` | Operator | Save them. | 434 |
| GET | `/admin/storage` | Operator | Retention days (0 = forever). | 448 |
| PUT | `/admin/storage` | Operator | Save retention. | 453 |
| GET | `/admin/voices` | Operator | Voice allowlist mode and the voice catalogue. | 471 |
| PUT | `/admin/voices` | Operator | Save the allowlist (at least one voice). | 476 |

## AI providers, integrations, embeddings, AI setup

Owner file: `src/demo/handlers/console-ai.ts` (24 routes)

| Method | Path | Auth | Purpose | Line |
|---|---|---|---|---|
| GET | `/admin/ai/catalog` | Operator | Provider catalogue with models per capability. | 173 |
| GET | `/admin/ai/connections` | Operator | Connections for llm, stt and tts (masked keys). | 178 |
| POST | `/admin/ai/connections` | Operator | Create a connection. | 184 |
| PATCH | `/admin/ai/connections/:id` | Operator | Edit, deactivate or reactivate. | 213 |
| POST | `/admin/ai/connections/:id/test` | Operator | Connection test (about 1 s). | 258 |
| POST | `/admin/ai/connections/:id/default` | Operator | Make it the default for its capability. | 274 |
| GET | `/admin/ai/assignments` | Operator | Workspace x capability grid with the connection in effect. | 287 |
| GET | `/admin/ai/tenants/:tenantId` | Operator | One workspace's assignments, effective connections and legacy override. | 328 |
| PUT | `/admin/ai/tenants/:tenantId` | Operator | Save assignments and the legacy text-AI override. | 333 |
| DELETE | `/admin/ai/tenants/:tenantId/legacy-key` | Operator | Remove the legacy override key. | 389 |
| GET | `/admin/integrations/instructions` | Operator | Global analysis instructions. | 405 |
| PUT | `/admin/integrations/instructions` | Operator | Save them. | 410 |
| POST | `/admin/integrations/self-test` | Operator | Quick or deep probe list that fills in one by one. | 472 |
| GET | `/admin/transcription/default` | Operator | Operator-layer transcription defaults. | 497 |
| PUT | `/admin/transcription/default` | Operator | Save them. | 502 |
| GET | `/admin/chat/integrations` | Operator | Chat-service credentials with scopes, grants and secrets. | 591 |
| POST | `/admin/chat/integrations` | Operator | Create one; secret returned once. | 596 |
| PATCH | `/admin/chat/integrations/:id` | Operator | Edit scopes, grants, active flag. | 622 |
| POST | `/admin/chat/integrations/:id/rotate` | Operator | New secret returned once; the old one stays valid 7 days. | 649 |
| POST | `/admin/chat/integrations/:id/secrets/:keyId/revoke` | Operator | Revoke one secret. | 664 |
| POST | `/admin/chat/integrations/:id/diagnose` | Operator | Verdict code and plain-language reason for a key against a workspace. | 675 |
| GET | `/admin/embeddings` | Operator | Embedding provider, model, dimension. | 718 |
| PUT | `/admin/embeddings` | Operator | Save (a dimension change warns that a re-import is needed). | 723 |
| POST | `/admin/embeddings/test` | Operator | Embedding connection test. | 756 |

