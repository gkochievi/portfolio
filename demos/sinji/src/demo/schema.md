# Data model

The mock backend's database is one typed object, `DemoDb` in `src/types.ts`, held in memory by `createStore` (`core.ts`). It is the contract between the seed,
the handlers and every screen. Field names are snake_case on purpose: they mirror the JSON a real backend returns, so the pure helpers in `src/lib` and
`src/demo/lib` work directly on payloads.

- **Ids** are strings with a readable prefix (`tn_mtiebi`, `rec_mtb_01`, `doc_mtb_...`, `chk_mtb_<slug>_<n>`, `cur_...`). Chunk ids are fixed so the calls seed can cite evidence
  without waiting on the knowledge-base seed.
- **Timestamps** are ISO-8601 strings. The seed is written around `SEED_DATE` (2026-10-01T09:00:00Z) and `rebaseDates` shifts every key matching
  `At|Date|_at|date|time|Time|^at` by the whole-day distance to today on load and on every reset, so "today" always has calls, usage and proposals in it.
- **Tenancy.** Every workspace-owned row carries `client_id` (the original's invariant: every query filters by it). Handlers get the workspace from `tenantScope()`.
- **English glosses.** Georgian content (transcripts, claims, rationales, KB titles, digests) carries optional `*_en` fields. They are a demo aid, shown when the UI is
  English and the "gloss" switch in the top bar is on (`src/lib/gloss.ts`, in memory).
- **Seed counts** below were read by compiling `src/demo/seed/index.ts`. Generated usage rows are added by `prepare` on every load and reset.

## Shape of the store

```
tenants ─┬─ tenantUsers                         (workspace staff: owner | member)
         ├─ recordings ─┬─ revisions            (score history, revision 1 = the model)
         │              └─ ← cannedCalls        (precomputed results, by canned_id)
         ├─ summaries ── job_ids → recordings
         ├─ scoringConfigs / scoreBands         (rubric, thresholds)
         ├─ kbDocuments ── kbChunks             (document_id)
         │        └─ kbEvents · curationProposals · reembedJobs
         ├─ botConfigs · conversations ── turns · copilotFeedback
         ├─ sentimentConfigs · transcriptionConfigs · aiByo · aiLegacy · aiAssignments
         └─ llmUsage                            (client_id, job_id → recording, conversation_id, summary_id)
platform:  aiProviders · aiConnections · integrations · killState · settings · limits · voices · ttsModels · ttsLanguages
public:    ttsClips · cannedTranscripts · convertFormats · conversionBatches · quotaUsed · appUsers
```

## Accounts and tenancy

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `SinjiAccount` (`accounts.ts`, not in the store) | 4 | `id`, `name`, `name_ka`, `email`, `password`, `role` (`operator` \| `owner` \| `member`), `persona` (adds `agent`), `roleLabel(_ka)`, `description(_ka)`, `tenantId \| null`, `home`, `avatarColor` | The sign-in list. The operator has no tenant and acts as any. |
| `Tenant` | 6 | `id`, `slug`, `name`, `name_ka`, `industry` (`bank` \| `insurance` \| `clinic` \| `telecom` \| `hotel` \| `delivery`), `region`, `is_active`, `api_key_hint`, `settings {timezone, default_language}`, `created_at`, `users`, `documents` | `users` and `documents` are denormalised counts recomputed by handlers. Five active, one inactive (Mzetamze Hotels). |
| `TenantUser` | 14 | `id`, `client_id`, `username`, `display_name`, `role` (`owner` \| `member`), `is_active`, `created_at`, `last_login_at` | `client_id` → `Tenant`. |
| `AppUser` | 12 | `id`, `email`, `display_name`, `is_active`, `created_at`, `last_login_at`, `limits` (overrides per `QuotaKind` plus `max_audio_mb`), `used` (per `QuotaKind`) | Registered self-service users, shown only in the console. |
| `Me` (response) | - | `scope` (`admin` \| `tenant` \| `guest`), `account` (no password), `tenant`, `acting_tenant_id` | What `GET /auth/me` returns. |

## Calls

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `Recording` | 17 (9 text, 8 audio) | `id`, `client_id`, `user_id`, `created_by`, `filename`, `source` (`audio` \| `text`), `status` (`pending` \| `transcribing` \| `ready` \| `analyzing` \| `done` \| `error`), `error`, `language`, `duration_s`, `audio_url`, `peaks`, `segments`, `transcript`, `analysis`, `kb_used`, `kb_check`, `semantic`, `sentiment`, `scoring`, `revisions`, `ran {factcheck, score, semantic, summary}`, `running` (analysers in flight), `transcription_override`, `stt_model`, `llm_model`, `processing_ms`, `canned_id`, `created_at` | 9 Mtiebi Bank, 3 Pari Insurance, 2 Iasamani Clinic, 2 Darbazi Telecom, 1 Nobati. Statuses: 15 `done`, 1 `ready` (uploaded, not yet analysed), 1 `error`. `kb_used` → `KbDocument.id[]`. `canned_id` → `CannedCall.id`. `audio_url` is relative to `BASE_URL`; `peaks` is a precomputed ~600-value waveform, so audio is never decoded at runtime. |
| `Segment` | within recordings | `i`, `speaker` (`speaker_0..2`), `start`, `end` (seconds, null in text mode), `text`, `text_en?` | Analysers refer to segments by index `i`, never by seconds. |
| `CannedCall` | 16 | `id`, `client_id`, `title`, `language`, `duration_s`, `audio_url`, `peaks`, `segments`, `analysis`, `kb_check`, `semantic`, `sentiment`, `scoring` | A fully precomputed call. Seeded recordings are built from these; an upload clones the closest one by `hashString(name + size)`; an analyser run patches its result from it. 83 claims across the 16. |
| `CallAnalysis` | per call | `language`, `summary`, `sentiment` (`positive` \| `neutral` \| `negative` \| `mixed`), `topics`, `key_points`, `quality_score`, `*_en?` | |
| `FactCheck` | per call | `accuracy_score`, `counts {supported, partially_supported, contradicted, not_in_kb, total}`, `claims[]`, `ran_at` | `accuracy_score = round(100 * (supported + 0.5 * partial) / (supported + partial + contradicted))`; `NOT_IN_KB` is excluded. |
| `Claim` | 83 in canned calls | `id`, `claim`, `speaker`, `category`, `segments[]`, `start`, `end`, `verdict` (`SUPPORTED` \| `PARTIALLY_SUPPORTED` \| `CONTRADICTED` \| `NOT_IN_KB`), `rationale`, `confidence`, `evidence {document_id, chunk_id, title, doc_type, snippet, score} \| null`, `*_en?` | `evidence` → a real `KbChunk`. Checked at build time. |
| `Semantic` (tone) | per call | `modes`, `language`, `speakers[] {speaker, role, text {politeness, overall, flags, rationale}, voice {voice, share_bad, share_good} \| null}`, `segments[] {i, text_tone, text_level, text_note, voice_label, voice_level, voice_confidence}`, `summary`, `voice_available`, `voice_status`, `ran_at` | Text tone and voice emotion are kept apart, never averaged. |
| `Sentiment` | per call | `overall`, `agreement` (`agree` \| `partial` \| `conflict` \| `text_only` \| `prosody_only` \| `unknown`), `text {label, polarity, rationale}`, `prosody {label, polarity, arousal, valence, dominance, confidence}` | |
| `Scorecard` | per call | `config_version`, `operator_speaker`, `dimensions[]`, `weighted_total`, `max_total`, `scored_weight`, `unscored[]`, `manually_edited`, `edited_by`, `revision`, `scored_at` | `weighted_total = sum(score * weight) / sum(weight)` over scored, applicable dimensions; unscored dimensions are excluded, not zero (`computeTotals` in `lib/scoring.ts`). |
| `ScoreDimension` | within scorecards | `key`, `name`, `weight`, `score`, `max`, `contribution`, `rationale`, `evidence[] {quote, segments, start, end}`, `source` (`model` \| `factcheck` \| `sentiment`), `applicable`, `edited`, `ai_score`, `*_en?` | `source != model` is a **measured** dimension: only its weight is editable. |
| `ScoreRevision` | within recordings | `revision`, `scores`, `note`, `edited_by`, `created_at`, `weighted_total` | Revision 1 is the model and immutable. |
| `CallSummary` (digest) | 3 | `id`, `client_id`, `job_ids`, `language`, `title`, `short_summary`, `key_points`, `action_items`, `participants[]`, `calls[] {index, recording_id, title, summary, outcome}`, `stages[] {name: per_call \| merge, ms}`, `status` (`running` \| `done` \| `error`), `created_by`, `created_at`, `*_en?` | `job_ids` / `calls[].recording_id` → `Recording`. |

## Rubric and settings

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `ScoringConfig` | 2 (default with 6 dimensions; Mtiebi with 10) | `id`, `client_id \| null`, `version`, `dimensions[]`, `rubric` (free text), `is_default`, `updated_at`, `updated_by` | `client_id = null` is the global default; a workspace without a row inherits it. |
| `RubricDimension` | within configs | `key`, `name`, `description`, `guidance`, `weight`, `source`, `name_en?`, `description_en?` | Weights are percentages; `validateRubric` reports `empty`, `unnamed`, `sum`, `negative`, `duplicate_key`. |
| `scoreBands` | 6 (one per tenant) | `Record<tenantId, {amber_from, green_from}>` | Default 50 / 80. |
| `RubricImportJob` | 0 | `id`, `stage` (`uploading` \| `queued` \| `extracting` \| `analysing` \| `done` \| `error`), `progress`, `draft`, `error` | Created at runtime by the AI-import flow. |
| `SentimentConfig` | 6 | `client_id`, `enabled`, `guidance`, `voice_tone` (`ok` \| `warming` \| `model_error` \| `unreachable` \| `disabled`), `updated_at`, `updated_by` | One per workspace. |
| `TranscriptionConfigRecord` | 3 | `client_id \| null`, `override {language_code, diarize, keyterms, audio_format}`, `updated_at`, `updated_by` | Layers: code < operator default (`client_id = null`) < workspace < per-file, merged by object spread. |

## Knowledge base

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `KbDocument` | 39 (Mtiebi 15, Pari 8, four each for the other four; 32 public, 7 internal) | `id`, `client_id`, `title`, `doc_type` (`product` \| `policy` \| `faq` \| `procedure` \| `script` \| `glossary` \| `other`), `tags`, `content_text`, `char_count`, `chunk_count`, `status` (`pending` \| `processing` \| `ready` \| `error`), `error`, `source_type` (`file` \| `paste` \| `csv` \| `api`), `filename`, `visibility` (`public` \| `internal`), `checksum`, `actor`, `ingest_ms`, `metadata`, `restructure` (`none` \| `running` \| `done`), `created_at`, `updated_at`, `title_en?` | `visibility = internal` means the bot refuses to quote it. `checksum` drives the exact-duplicate scan. |
| `KbChunk` | 91 (Mtiebi 60, Pari 13, 5 / 5 / 4 / 4) | `id`, `client_id`, `document_id`, `chunk_index`, `content`, `token_count`, `has_embedding`, `metadata` | `document_id` → `KbDocument`. Retrieval is TF-IDF with light Georgian stemming (`demo/lib/text.ts`); there are no vectors. |
| `KbEvent` | 54 | `id`, `client_id`, `document_id`, `document_title`, `action` (`import` \| `edit` \| `delete` \| `reembed` \| `chunk_edit` \| `chunk_delete` \| `bulk` \| `export` \| `curation`), `method`, `status`, `detail`, `actor`, `chunk_count`, `duration_ms`, `created_at` | Activity log; every KB write adds one. |
| `ReembedJob` | 1 | `id`, `client_id`, `state` (`queued` \| `running` \| `done` \| `failed`), `total_documents`, `done_documents`, `failed_documents`, `created_at`, `finished_at`, `error` | One running job per workspace (409 otherwise). |
| `CurationProposal` | 7, all Mtiebi (5 pending: 3 update, 1 add, 1 remove; 1 accepted; 1 declined) | `id`, `client_id`, `op` (`add` \| `update` \| `remove`), `state` (`pending` \| `accepted` \| `declined`), `signal` (`S1`..`S6`), `cluster`, `title`, `proposed_content`, `rationale`, `target {document_id, title, content} \| null`, `suggested_tags`, `occurrences`, `distinct_sources`, `confidence`, `priority`, `risk`, `apply_error`, `decline_reason`, `evidence[]`, `created_at`, `decided_at`, `decided_by`, `*_en?` | `target.document_id` → `KbDocument`. `evidence[]` holds `{channel, locale, occurred_at, source_kind, question, answer}`. |
| Derived (not stored) | - | `KbStats`, `RetrievalResult` (`method`, `top_score`, `margin`, `confidence`, `hits[]`), `DuplicateReport` (`exact[]`, `near[]`) | Computed in the handlers on each request. Confidence is `high` when top > 0.75 and margin > 0.1, `medium` when top > 0.5, else `low`. |

## Bot, copilot and autopilot

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `BotConfig` | 7 (global default + 6 workspaces) | `client_id \| null`, `autopilot_enabled`, `persona`, `greeting`, `refusal_copy` (each a `{ka, en, ru}` record), `languages`, `canned[]`, `min_score`, `min_hits`, `top_k`, `suggestion_count`, `settings {answer_policy, business_scope, hours, timezone, off_topic_handling, off_topic_warn_after, off_topic_cutoff_after, handoff_notice, handoff_summary, disclosure_mode, limits, escalation_keywords, max_reply_chars}`, `version`, `is_default`, `updated_at`, `updated_by` | `client_id = null` is the global default. `hours` is per weekday in `Asia/Tbilisi`. |
| `killState` | 1 | `global_disabled`, `disabled_clients[]`, `updated_at`, `updated_by` | One switch for the platform, one list per workspace; `bot:kill-changed` is emitted on change. |
| `ChatConversation` | 20 (Mtiebi 9) | `id`, `client_id`, `external_ref`, `channel` (`web` \| `instagram` \| `messenger` \| `whatsapp`), `locale`, `mode` (`copilot` \| `autopilot`), `state` (`open` \| `handoff` \| `resolved`), `subject`, `off_topic_count`, `created_at`, `last_message_at` | |
| `ChatTurn` | 92 | `id`, `conversation_id`, `role` (`customer` \| `operator` \| `bot`), `content`, `grounded`, `method` (`vector` \| `keyword` \| `none` \| `canned`), `top_score`, `citations[]`, `tokens`, `created_at` | `citations[]` → `{n, document_id, chunk_id, title, score, snippet}`. |
| `CopilotFeedback` | 19 | `id`, `conversation_id`, `turn_id`, `suggestion_index`, `action` (`shown` \| `inserted` \| `edited` \| `ignored`), `final_text`, `created_at` | |
| `TurnEnvelope` / `CopilotStreamEvent` (runtime) | - | envelope: `grounding {grounded, kb_present, hits, top_score, triage}`, `tier1[]`, `citations[]`, `suggestions[] {index, kind, text, citations}`, `reply`, `handoff {reason, summary, goal}`, `usage`, `stages[] {name, ms}`; events: `open`, `grounding`, `tier1`, `suggestion`, `reply`, `handoff`, `done` | Produced by the async generator `streamTurn`, with `performance.now()` per stage. Triage is `business` \| `related` \| `chitchat` \| `off_topic` \| `risky`. |

## AI configuration and integrations

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `AiProviderEntry` | 5 | `id`, `name`, `capabilities[]`, `models` (per capability), `default_base_url` | The catalogue the connection forms offer. Vendor names appear only here. |
| `AiConnection` | 7 (3 llm, 2 stt, 2 tts) | `id`, `name`, `capability` (`llm` \| `stt` \| `tts`), `provider`, `model`, `base_url`, `has_key`, `key_hint`, `settings`, `is_active`, `is_default`, `last_test {ok, at, detail}`, `updated_at`, `updated_by` | One default per capability. Keys are write-only: only `has_key` and a hint are ever returned. |
| `AiAssignment` | 18 | `client_id`, `capability`, `connection_id \| null` | 6 workspaces x 3 capabilities; null = use the default. |
| `AiByoOverride` | 1 (Darbazi) | `client_id`, `capability`, `provider`, `model`, `has_key`, `key_hint`, `enabled`, `notes`, `updated_at` | Workspace-owned key; wins over the assignment (`source: byo`). |
| `AiLegacyOverride` | 1 | `client_id`, `enabled`, `provider`, `model`, `base_url`, `has_key`, `notes`, `updated_at` | The older text-AI override card. |
| `AiEffective` (derived) | - | `capability`, `source` (`byo` \| `assigned` \| `default` \| `legacy`), `connection_id`, `name`, `provider`, `model` | Resolved per workspace and capability. |
| `Integration` | 2 (web chat widget, helpdesk sync; 2 secrets each) | `id`, `name`, `kind`, `scopes[]` (`chat:turn` \| `chat:suggest` \| `chat:answer` \| `chat:sync`), `is_active`, `created_at`, `grants[] {client_id, scopes, is_active}`, `secrets[] {key_id, label, hint, created_at, expires_at, revoked_at, last_used_at}` | Rotation keeps the old secret valid 7 days. `diagnose` returns one of eight verdict codes. |

## Usage and health

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `LlmUsage` | 0 seeded, about 2,000 generated per load (`generators/usage.ts`, `createRandom('sinji-usage')`) | `id`, `created_at`, `client_id`, `actor`, `feature`, `group`, `capability` (`llm` \| `stt` \| `tts` \| `voice_tone` \| `embed`), `provider`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `total_tokens`, `byo`, `audio_seconds`, `characters`, `latency_ms`, `ok`, `error`, `job_id`, `conversation_id`, `turn_id`, `summary_id` | 90 days, diurnal and weekday patterns, about 2% failures. `job_id` → `Recording`, `conversation_id` → `ChatConversation`, `summary_id` → `CallSummary`. Tokens only, never money. Handlers append rows through `logUsage`. |
| `HealthSample` / `TenantLoad` (generated, not stored) | - | sample: `ts`, `cpu_pct`, `load1`, `mem_*`, `swap_used_mb`, `disk[]`, `disk_*_mbs`, `net_*_mbs`, `api_rss_mb`, `api_cpu_pct`, `db_size_mb`, `db_pool_*`, `active_jobs`, `uptime_s`; load: `requests`, `errors`, `avg_ms`, `max_ms`, `bytes_*`, `ai_calls`, `ai_tokens`, `audio_jobs`, `load_share_pct` | A seeded sinusoid plus noise per metric and range (`console-platform/sim/health.ts`); a new point every 15 s while the tab is visible. The load table is derived from usage rows and recordings. |

## Public voice tools and platform settings

| Entity | Seed | Fields | Relations / notes |
|---|---|---|---|
| `Voice` | 8 (ka 3, en 3, ru 2) | `voice_id`, `name`, `language`, `category`, `gender`, `is_default`, `preview_url` | `preview_url` is relative to `BASE_URL`. |
| `TtsLanguage` / `TtsModel` | 3 / 2 | language: `code`, `name`, `note`, `model`; model: `model_id`, `name`, `supports[]` | |
| `TtsClip` | 6 (ka 3, en 2, ru 1) | `id`, `text`, `language_code`, `voice_id`, `model_id`, `audio_url`, `duration_s`, `created_at` | Synthesising returns the pre-recorded clip for that voice. |
| `CannedTranscript` | 5 | `id`, `language`, `transcript`, `duration_s`, `sentiment` | Chosen by file hash for quick transcription and voice-in. |
| `ConvertFormat` / `ConvertLimits` | 6 / 1 | format: `id`, `label`, `description`, `ext`; limits: `max_files`, `max_file_bytes`, `max_batch_bytes`, `download_ttl_seconds` | |
| `ConversionBatch` | 3 | `id`, `token`, `format`, `rows[] {index, name, bytes, state, error}`, `file_count`, `ok`, `failed`, `total_bytes`, `state`, `created_at`, `expires_at` | Row states: `queued`, `converting`, `done`, `failed`. |
| `limits` | 2 | `{anonymous, registered}`, each `{enabled, max_analyses_per_day, max_tts_per_day, max_conversions_per_day, max_audio_mb, features {analyze, tts, convert, score, semantic, summarise}}` | |
| `quotaUsed` | 0 | `Record<principalKey, Record<QuotaKind, number>>` | Today's spend per principal (`guest` or an account id), in memory only. |
| `settings` (`PlatformSettings`) | 1 | `analysis_instructions`, `embeddings {provider, model, base_url, dim, api_key_set, api_key_hint}`, `retention_days`, `voices {mode: all \| allowlist, voice_ids}`, `health {retention_days, sample_interval_s}`, `public_sentiment {enabled, guidance}` | The operator's platform blob. |

## The event bus

`DemoEvents` in `types.ts`: `recording:updated`, `summary:updated`, `kb:changed`, `reembed:progress`, `curation:changed`, `convert:progress`, `health:sample`,
`usage:appended`, `bot:kill-changed`, `acting-tenant:changed`. Handlers emit after a timer-driven change; screens subscribe and invalidate the matching query keys.
