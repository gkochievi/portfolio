/**
 * Sinji - shared entity types (the wire format the mock API serves).
 *
 * Field names are snake_case on purpose: they mirror the JSON a real backend
 * would return, so pure helpers can be written against the payloads directly.
 * This file is the contract between every agent - ask the architect (via your
 * final message) before changing a shape; adding an OPTIONAL field is fine.
 */

/* ------------------------------------------------------------------ basics */

export type Id = string
/** ISO-8601 timestamp. Every `*_at` field is rebased by `rebaseDates` on load/reset. */
export type ISODate = string
/** UI languages. */
export type Lang = 'en' | 'ka'
/** Content / TTS / bot languages (the product itself handles Russian too). */
export type ContentLang = 'ka' | 'en' | 'ru'
export type LocalizedCopy = Record<ContentLang, string>

/** Machine roles the handlers check. The "agent" persona (Saba) is a `member`. */
export type Role = 'operator' | 'owner' | 'member'
/** What GET /auth/me reports; `guest` when signed out. */
export type Scope = 'admin' | 'tenant' | 'guest'

/* ------------------------------------------------------------- accounts */

export interface SinjiAccount {
  id: Id
  name: string
  name_ka: string
  email: string
  password: string
  role: Role
  /** Persona for the DemoBar label: operator / owner / member / agent. */
  persona: 'operator' | 'owner' | 'member' | 'agent'
  roleLabel: string
  roleLabel_ka: string
  description: string
  description_ka: string
  /** Tenant the account belongs to; null for the operator (acts as any tenant). */
  tenantId: Id | null
  /** Route the account lands on after sign-in. */
  home: string
  avatarColor: string
}

export interface Me {
  scope: Scope
  account: Omit<SinjiAccount, 'password'> | null
  /** The tenant the request is scoped to: own tenant, or the operator's act-as choice. */
  tenant: Tenant | null
  acting_tenant_id: Id | null
}

/* ---------------------------------------------------------------- tenancy */

export type Industry = 'bank' | 'insurance' | 'clinic' | 'telecom' | 'hotel' | 'delivery'

export interface Tenant {
  id: Id
  slug: string
  name: string
  name_ka: string
  industry: Industry
  region: string
  is_active: boolean
  /** Masked API key, e.g. `snj_live_...7Qx2`. The full key is only ever shown once. */
  api_key_hint: string
  settings: { timezone: string; default_language: ContentLang }
  created_at: ISODate
  /** Denormalised counts (recomputed by handlers). */
  users: number
  documents: number
}

export interface TenantUser {
  id: Id
  client_id: Id
  username: string
  display_name: string
  role: 'owner' | 'member'
  is_active: boolean
  created_at: ISODate
  last_login_at: ISODate | null
}

/** Registered self-service user (console > Registered users). */
export interface AppUser {
  id: Id
  email: string
  display_name: string
  is_active: boolean
  created_at: ISODate
  last_login_at: ISODate | null
  /** Per-user overrides of the registered-tier limits; null = inherit. */
  limits: Partial<Record<QuotaKind, number>> & { max_audio_mb?: number }
  used: Record<QuotaKind, number>
}

/* ------------------------------------------------------------ recordings */

export type RecordingStatus = 'pending' | 'transcribing' | 'ready' | 'analyzing' | 'done' | 'error'
export type Analyser = 'transcribe' | 'factcheck' | 'score' | 'semantic'
export type SpanLevel = 'good' | 'mid' | 'bad'
export type Speaker = 'speaker_0' | 'speaker_1' | 'speaker_2'

export interface Segment {
  i: number
  speaker: Speaker
  /** Seconds, 2 dp; null in text mode. */
  start: number | null
  end: number | null
  text: string
  /** English gloss of a Georgian line (demo aid, shown when the UI is English). */
  text_en?: string
}

export interface CallAnalysis {
  language: ContentLang
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed'
  topics: string[]
  key_points: string[]
  quality_score: number
  summary_en?: string
  topics_en?: string[]
  key_points_en?: string[]
}

export type Verdict = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'NOT_IN_KB'

export interface ClaimEvidence {
  document_id: Id
  chunk_id: Id
  title: string
  doc_type: KbDocType
  snippet: string
  score: number
}

export interface Claim {
  id: Id
  claim: string
  speaker: 'agent' | 'customer' | 'unknown'
  category: string
  segments: number[]
  start: number | null
  end: number | null
  verdict: Verdict
  rationale: string
  confidence: number
  evidence: ClaimEvidence | null
  claim_en?: string
  rationale_en?: string
}

export interface FactCheck {
  /** round(100*(supported + 0.5*partial) / (supported + partial + contradicted)); NOT_IN_KB excluded. */
  accuracy_score: number | null
  counts: { supported: number; partially_supported: number; contradicted: number; not_in_kb: number; total: number }
  claims: Claim[]
  ran_at: ISODate
}

export type TextTone = 'polite' | 'neutral' | 'curt' | 'impolite' | 'rude' | 'aggressive'
export type VoiceEmotion = 'calm' | 'happy' | 'neutral' | 'sad' | 'frustrated' | 'angry'
export type VoiceToneStatus = 'ok' | 'warming' | 'model_error' | 'unreachable' | 'disabled'

export interface SpeakerTone {
  speaker: Speaker
  role: 'agent' | 'customer'
  text: { politeness: number; overall: TextTone; flags: string[]; rationale: string }
  voice: { voice: VoiceEmotion; share_bad: number; share_good: number } | null
}

export interface SegmentTone {
  i: number
  text_tone: TextTone
  text_level: SpanLevel
  text_note: string | null
  voice_label: VoiceEmotion | null
  voice_level: SpanLevel | null
  voice_confidence: number | null
  text_note_en?: string
}

export interface Semantic {
  modes: Array<'text' | 'voice'>
  language: ContentLang
  speakers: SpeakerTone[]
  segments: SegmentTone[]
  summary: string
  voice_available: boolean
  voice_status: VoiceToneStatus
  ran_at: ISODate
  summary_en?: string
}

export type Agreement = 'agree' | 'partial' | 'conflict' | 'text_only' | 'prosody_only' | 'unknown'
export type Polarity = 'positive' | 'neutral' | 'negative'

/** Two-sided sentiment: text and voice are never averaged. */
export interface Sentiment {
  overall: Polarity
  agreement: Agreement
  text: { label: Polarity; polarity: number; rationale: string } | null
  prosody: {
    label: VoiceEmotion
    polarity: number
    arousal: number
    valence: number
    dominance: number
    confidence: number
  } | null
}

export interface ScoreEvidence {
  quote: string
  segments: number[]
  start: number | null
  end: number | null
  quote_en?: string
}

export interface ScoreDimension {
  key: string
  name: string
  weight: number
  score: number | null
  max: number
  /** score * weight / scored_weight, rounded to 1 dp. */
  contribution: number
  rationale: string
  evidence: ScoreEvidence[]
  /** `factcheck` / `sentiment` = measured dimension (badge it; only its weight is editable). */
  source: RubricSource
  applicable: boolean
  edited: boolean
  /** The model's original score when a reviewer has edited it. */
  ai_score: number | null
  name_en?: string
  rationale_en?: string
}

export interface Scorecard {
  config_version: number
  operator_speaker: Speaker
  dimensions: ScoreDimension[]
  /** sum(score*w)/sum(w) over scored, applicable dimensions (unscored are excluded, not zero). */
  weighted_total: number
  max_total: number
  scored_weight: number
  unscored: string[]
  manually_edited: boolean
  edited_by: string | null
  revision: number
  scored_at: ISODate
}

export interface ScoreRevision {
  /** 1 = the model's scores (immutable). */
  revision: number
  scores: Record<string, number | null>
  note: string
  edited_by: string
  created_at: ISODate
  weighted_total: number
}

export interface TranscriptionSettings {
  /** null = auto-detect. */
  language_code: ContentLang | null
  diarize: boolean
  keyterms: string[]
  audio_format: AudioFormat
}
export type AudioFormat = 'original' | 'flac_full' | 'flac_16k' | 'wav_16k' | 'mp3_16k'

export interface Recording {
  id: Id
  client_id: Id | null
  user_id: Id | null
  created_by: string
  filename: string
  source: 'audio' | 'text'
  status: RecordingStatus
  error: string | null
  language: ContentLang | null
  duration_s: number | null
  /** Relative to BASE_URL, e.g. `media/calls/mtb-01.m4a`. Null in text mode. */
  audio_url: string | null
  /** Precomputed waveform peaks 0..1 (about 600 values). Never decode audio at runtime. */
  peaks: number[] | null
  segments: Segment[]
  transcript: string
  analysis: CallAnalysis | null
  kb_used: Id[]
  kb_check: FactCheck | null
  semantic: Semantic | null
  sentiment: Sentiment | null
  scoring: Scorecard | null
  revisions: ScoreRevision[]
  ran: { factcheck: boolean; score: boolean; semantic: boolean; summary: boolean }
  /** Analysers currently running (the UI polls while non-empty). */
  running: Analyser[]
  transcription_override: Partial<TranscriptionSettings> | null
  stt_model: string | null
  llm_model: string | null
  processing_ms: number | null
  /** Which canned call this recording's precomputed results come from. */
  canned_id: Id | null
  created_at: ISODate
}

/** Light row for tables (GET /recordings). */
export type RecordingRow = Pick<
  Recording,
  'id' | 'client_id' | 'filename' | 'source' | 'status' | 'language' | 'duration_s' | 'ran' | 'running' | 'created_by' | 'created_at'
> & { score: number | null; accuracy: number | null; agreement: Agreement | null }

/**
 * A fully precomputed call. Seeded recordings are made from these, uploads
 * clone the closest one (hash of name+size) and analyser runs patch from it.
 */
export interface CannedCall {
  id: Id
  client_id: Id
  title: string
  language: ContentLang
  duration_s: number | null
  audio_url: string | null
  peaks: number[] | null
  segments: Segment[]
  analysis: CallAnalysis
  kb_check: FactCheck
  semantic: Semantic
  sentiment: Sentiment
  scoring: Scorecard
}

export interface SummaryParticipant {
  label: string
  role: 'agent' | 'customer' | 'other'
  appears_in: number[]
}

export interface CallSummary {
  id: Id
  client_id: Id | null
  job_ids: Id[]
  language: ContentLang
  title: string
  short_summary: string
  key_points: string[]
  action_items: string[]
  participants: SummaryParticipant[]
  calls: Array<{ index: number; recording_id: Id; title: string; summary: string; outcome: string }>
  /** Two-stage digest: per-call pass then merge. */
  stages: Array<{ name: 'per_call' | 'merge'; ms: number }>
  status: 'running' | 'done' | 'error'
  created_by: string
  created_at: ISODate
  title_en?: string
  short_summary_en?: string
  key_points_en?: string[]
  action_items_en?: string[]
}

/* ------------------------------------------------------------------ rubric */

export type RubricSource = 'model' | 'factcheck' | 'sentiment'

export interface RubricDimension {
  key: string
  name: string
  description: string
  guidance: string
  weight: number
  source: RubricSource
  name_en?: string
  description_en?: string
}

export interface ScoringConfig {
  id: Id
  /** null = the global default rubric. */
  client_id: Id | null
  version: number
  dimensions: RubricDimension[]
  rubric: string
  /** True while a tenant still uses the shared default. */
  is_default: boolean
  updated_at: ISODate
  updated_by: string | null
}

export interface ScoreBands {
  amber_from: number
  green_from: number
}

export interface RubricImportJob {
  id: Id
  stage: 'uploading' | 'queued' | 'extracting' | 'analysing' | 'done' | 'error'
  progress: number
  draft: Pick<ScoringConfig, 'dimensions' | 'rubric'> | null
  error: string | null
}

/* ---------------------------------------------------------- knowledge base */

export type KbDocType = 'product' | 'policy' | 'faq' | 'procedure' | 'script' | 'glossary' | 'other'
export type KbStatus = 'pending' | 'processing' | 'ready' | 'error'

export interface KbDocument {
  id: Id
  client_id: Id
  title: string
  doc_type: KbDocType
  tags: string[]
  content_text: string
  char_count: number
  chunk_count: number
  status: KbStatus
  error: string | null
  source_type: 'file' | 'paste' | 'csv' | 'api'
  filename: string | null
  /** Only `public` documents may be quoted by the customer-facing bot. */
  visibility: 'public' | 'internal'
  checksum: string
  actor: string
  ingest_ms: number | null
  metadata: Record<string, string>
  restructure: 'none' | 'running' | 'done'
  created_at: ISODate
  updated_at: ISODate
  title_en?: string
}

export interface KbChunk {
  id: Id
  client_id: Id
  document_id: Id
  chunk_index: number
  content: string
  token_count: number
  has_embedding: boolean
  metadata: Record<string, string>
}

export interface KbStats {
  documents: number
  public_documents: number
  chunks: number
  embedding_coverage: number
  failed: number
  in_progress: number
  approx_tokens: number
  last_updated: ISODate | null
}

export type KbEventAction = 'import' | 'edit' | 'delete' | 'reembed' | 'chunk_edit' | 'chunk_delete' | 'bulk' | 'export' | 'curation'

export interface KbEvent {
  id: Id
  client_id: Id
  document_id: Id | null
  document_title: string | null
  action: KbEventAction
  method: string | null
  status: 'ok' | 'error'
  detail: string
  actor: string
  chunk_count: number | null
  duration_ms: number | null
  created_at: ISODate
}

export type Confidence = 'high' | 'medium' | 'low'

export interface RetrievalHit {
  chunk_id: Id
  document_id: Id
  title: string
  doc_type: KbDocType
  visibility: 'public' | 'internal'
  chunk_index: number
  score: number
  snippet: string
}

export interface RetrievalResult {
  query: string
  method: 'vector' | 'keyword' | 'none'
  top_score: number
  margin: number
  confidence: Confidence
  hits: RetrievalHit[]
  took_ms: number
}

export interface DuplicateReport {
  exact: Array<{ checksum: string; documents: Array<{ id: Id; title: string; updated_at: ISODate; keep: boolean }> }>
  near: Array<{ a: { id: Id; title: string }; b: { id: Id; title: string }; similarity: number }>
  scanned_at: ISODate
}

export interface ReembedJob {
  id: Id
  client_id: Id
  state: 'queued' | 'running' | 'done' | 'failed'
  total_documents: number
  done_documents: number
  failed_documents: number
  created_at: ISODate
  finished_at: ISODate | null
  error: string | null
}

/* ---------------------------------------------------------------- curation */

export type CurationSignal = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'

export interface CurationEvidence {
  channel: Channel | 'call'
  locale: ContentLang
  occurred_at: ISODate
  source_kind: 'operator_rewrite' | 'operator_answer' | 'factcheck_contradiction' | 'factcheck_not_in_kb' | 'weak_retrieval' | 'bot_refusal'
  question: string
  answer: string
}

export interface CurationProposal {
  id: Id
  client_id: Id
  op: 'add' | 'update' | 'remove'
  state: 'pending' | 'accepted' | 'declined'
  signal: CurationSignal
  cluster: string
  title: string
  proposed_content: string
  rationale: string
  target: { document_id: Id; title: string; content: string } | null
  suggested_tags: string[]
  occurrences: number
  distinct_sources: number
  confidence: number
  priority: 'high' | 'medium' | 'low'
  risk: 'low' | 'medium' | 'high'
  apply_error: string | null
  decline_reason: string | null
  evidence: CurationEvidence[]
  created_at: ISODate
  decided_at: ISODate | null
  decided_by: string | null
  title_en?: string
  rationale_en?: string
}

/* -------------------------------------------------------- workspace configs */

export interface SentimentConfig {
  client_id: Id
  enabled: boolean
  guidance: string
  voice_tone: VoiceToneStatus
  updated_at: ISODate
  updated_by: string | null
}

/** Stored layer of the transcription inheritance chain (code < operator default < tenant < per-file). */
export interface TranscriptionConfigRecord {
  /** null = the operator default layer. */
  client_id: Id | null
  override: Partial<TranscriptionSettings>
  updated_at: ISODate
  updated_by: string | null
}

/** What GET /settings/transcription returns. */
export interface TranscriptionConfigView {
  effective: TranscriptionSettings
  inherited: TranscriptionSettings & { source: 'code' | 'operator' }
  override: Partial<TranscriptionSettings> | null
  is_default: boolean
  can_edit: boolean
  updated_at: ISODate | null
  updated_by: string | null
}

/* ---------------------------------------------------------------------- AI */

export type AiCapability = 'llm' | 'stt' | 'tts'

export interface AiProviderEntry {
  id: string
  name: string
  capabilities: AiCapability[]
  models: Partial<Record<AiCapability, string[]>>
  default_base_url: string | null
}

export interface AiConnection {
  id: Id
  name: string
  capability: AiCapability
  provider: string
  model: string
  base_url: string | null
  has_key: boolean
  key_hint: string | null
  settings: Record<string, string | number | boolean>
  is_active: boolean
  is_default: boolean
  last_test: { ok: boolean; at: ISODate; detail: string } | null
  updated_at: ISODate
  updated_by: string | null
}

export interface AiAssignment {
  client_id: Id
  capability: AiCapability
  connection_id: Id | null
}

/** Bring-your-own key a workspace owner sets (workspace > AI). */
export interface AiByoOverride {
  client_id: Id
  capability: AiCapability
  provider: string
  model: string
  has_key: boolean
  key_hint: string | null
  enabled: boolean
  notes: string
  updated_at: ISODate
}

/** Legacy text-AI override card in /ai-config/:tenantId. */
export interface AiLegacyOverride {
  client_id: Id
  enabled: boolean
  provider: string
  model: string
  base_url: string | null
  has_key: boolean
  notes: string
  updated_at: ISODate | null
}

export interface AiEffective {
  capability: AiCapability
  source: 'byo' | 'assigned' | 'default' | 'legacy'
  connection_id: Id | null
  name: string
  provider: string
  model: string
}

/* ------------------------------------------------------------ integrations */

export type ChatScope = 'chat:turn' | 'chat:suggest' | 'chat:answer' | 'chat:sync'

export interface IntegrationSecret {
  key_id: string
  label: string
  hint: string
  created_at: ISODate
  expires_at: ISODate | null
  revoked_at: ISODate | null
  last_used_at: ISODate | null
}

export interface Integration {
  id: Id
  name: string
  kind: 'chat_platform'
  scopes: ChatScope[]
  is_active: boolean
  created_at: ISODate
  grants: Array<{ client_id: Id; scopes: ChatScope[]; is_active: boolean }>
  secrets: IntegrationSecret[]
}

export type DiagnoseVerdict =
  | 'ok'
  | 'unknown_key_id'
  | 'secret_revoked'
  | 'secret_expired'
  | 'no_grant'
  | 'scope_missing'
  | 'tenant_inactive'
  | 'integration_inactive'

export interface SelfTestProbe {
  id: string
  label: string
  ok: boolean
  ms: number
  detail: string
}

/* --------------------------------------------------------------------- bot */

export type Channel = 'web' | 'instagram' | 'messenger' | 'whatsapp'
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface BotSettings {
  answer_policy: 'kb_only' | 'general' | 'open'
  business_scope: string
  hours: Record<Weekday, Array<{ from: string; to: string }>>
  timezone: string
  off_topic_handling: 'warn' | 'refuse' | 'handoff'
  off_topic_warn_after: number
  off_topic_cutoff_after: number
  handoff_notice: LocalizedCopy
  handoff_summary: boolean
  disclosure_mode: 'first' | 'always' | 'off'
  limits: { per_minute: number; per_conversation: number; per_channel: Record<Channel, number> }
  escalation_keywords: string[]
  max_reply_chars: number
}

export interface BotConfig {
  /** null = global default. */
  client_id: Id | null
  autopilot_enabled: boolean
  persona: string
  greeting: LocalizedCopy
  refusal_copy: LocalizedCopy
  languages: ContentLang[]
  canned: Array<{ trigger: string; reply: string }>
  min_score: number
  min_hits: number
  top_k: number
  suggestion_count: number
  settings: BotSettings
  version: number
  is_default: boolean
  updated_at: ISODate
  updated_by: string | null
}

export interface KillState {
  global_disabled: boolean
  disabled_clients: Id[]
  updated_at: ISODate
  updated_by: string | null
}

export interface Citation {
  n: number
  document_id: Id
  chunk_id: Id
  title: string
  score: number
  snippet: string
}

export interface ChatConversation {
  id: Id
  client_id: Id
  external_ref: string
  channel: Channel
  locale: ContentLang
  mode: 'copilot' | 'autopilot'
  state: 'open' | 'handoff' | 'resolved'
  subject: string
  off_topic_count: number
  created_at: ISODate
  last_message_at: ISODate
}

export interface ChatTurn {
  id: Id
  conversation_id: Id
  role: 'customer' | 'operator' | 'bot'
  content: string
  grounded: boolean | null
  method: 'vector' | 'keyword' | 'none' | 'canned' | null
  top_score: number | null
  citations: Citation[]
  tokens: number
  created_at: ISODate
}

export type Triage = 'business' | 'related' | 'chitchat' | 'off_topic' | 'risky'
export type AutopilotBlock = 'off' | 'no_public_docs' | 'killed' | 'missing_scope'

export interface Suggestion {
  index: number
  kind: 'answer' | 'clarify' | 'escalate'
  text: string
  citations: Citation[]
}

export interface Handoff {
  reason: 'low_score' | 'commitment' | 'risky' | 'off_topic' | 'requested' | 'out_of_hours'
  summary: string
  goal: string
}

export interface TurnEnvelope {
  turn_id: Id
  grounding: { grounded: boolean; kb_present: boolean; hits: number; top_score: number; triage: Triage }
  tier1: RetrievalHit[]
  citations: Citation[]
  suggestions: Suggestion[]
  /** Autopilot: the reply the customer sees (or a refusal). */
  reply: { text: string; kind: 'answer' | 'refusal' | 'handoff' | 'blocked'; blocked?: AutopilotBlock } | null
  handoff: Handoff | null
  usage: { input_tokens: number; output_tokens: number; total_tokens: number }
  stages: Array<{ name: 'grounding' | 'tier1' | 'suggestions' | 'reply'; ms: number }>
}

/** Events the copilot/autopilot async generator yields, in this order. */
export type CopilotStreamEvent =
  | { type: 'open'; turn_id: Id }
  | { type: 'grounding'; grounding: TurnEnvelope['grounding']; ms: number }
  | { type: 'tier1'; passages: RetrievalHit[]; ms: number }
  | { type: 'suggestion'; index: number; kind: Suggestion['kind']; delta: string }
  | { type: 'reply'; delta: string }
  | { type: 'handoff'; handoff: Handoff }
  | { type: 'done'; envelope: TurnEnvelope }

export interface CopilotFeedback {
  id: Id
  conversation_id: Id
  turn_id: Id
  suggestion_index: number
  action: 'shown' | 'inserted' | 'edited' | 'ignored'
  final_text: string | null
  created_at: ISODate
}

/* ------------------------------------------------------------------- usage */

export type UsageCapability = 'llm' | 'stt' | 'tts' | 'voice_tone' | 'embed'
export type UsageGroup = 'transcription' | 'analysis' | 'factcheck' | 'scoring' | 'tone' | 'summary' | 'kb' | 'bot' | 'voice'
export type UsageFeature =
  | 'transcribe'
  | 'analyze'
  | 'factcheck_extract'
  | 'factcheck_verify'
  | 'score'
  | 'semantic'
  | 'summarise'
  | 'kb_restructure'
  | 'rubric_import'
  | 'triage'
  | 'autopilot'
  | 'handoff'
  | 'copilot'
  | 'curation'
  | 'tts'
  | 'voice_tone'
  | 'embed'

export interface LlmUsage {
  id: Id
  created_at: ISODate
  client_id: Id | null
  actor: string
  feature: UsageFeature
  group: UsageGroup
  capability: UsageCapability
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_creation_tokens: number
  total_tokens: number
  byo: boolean
  audio_seconds: number | null
  characters: number | null
  latency_ms: number
  ok: boolean
  error: string | null
  job_id: Id | null
  conversation_id: Id | null
  turn_id: Id | null
  summary_id: Id | null
}

export type UsageWindow = '24h' | '7d' | '30d' | '90d' | 'custom'

export interface UsageFilters {
  window: UsageWindow
  from?: ISODate
  to?: ISODate
  client_id?: Id
  group?: UsageGroup
  provider?: string
  model?: string
  capability?: UsageCapability
  status?: 'ok' | 'failed'
  q?: string
}

/* ------------------------------------------------------------------ health */

export type HealthRange = '1h' | '6h' | '24h' | '7d' | '30d'

export interface HealthSample {
  ts: ISODate
  cpu_pct: number
  load1: number
  mem_used_mb: number
  mem_total_mb: number
  swap_used_mb: number
  disk: Array<{ mount: string; total_gb: number; used_gb: number; pct: number }>
  disk_read_mbs: number
  disk_write_mbs: number
  net_in_mbs: number
  net_out_mbs: number
  api_rss_mb: number
  api_cpu_pct: number
  db_size_mb: number
  db_pool_used: number
  db_pool_size: number
  active_jobs: number
  uptime_s: number
}

export interface TenantLoad {
  client_id: Id
  requests: number
  errors: number
  avg_ms: number
  max_ms: number
  bytes_in: number
  bytes_out: number
  ai_calls: number
  ai_tokens: number
  audio_jobs: number
  audio_ms: number
  load_share_pct: number
}

export interface HealthSettings {
  retention_days: number
  sample_interval_s: number
}

/* -------------------------------------------------------------- voice tools */

export type QuotaKind = 'analyses' | 'tts' | 'conversions'

export interface LimitsConfig {
  enabled: boolean
  max_analyses_per_day: number
  max_tts_per_day: number
  max_conversions_per_day: number
  max_audio_mb: number
  features: { analyze: boolean; tts: boolean; convert: boolean; score: boolean; semantic: boolean; summarise: boolean }
}

export interface LimitsSnapshot {
  anonymous: boolean
  enabled: boolean
  visitor_identified: boolean
  max: Record<QuotaKind, number>
  used: Record<QuotaKind, number>
  remaining: Record<QuotaKind, number>
  max_audio_mb: number
  features: LimitsConfig['features']
}

export interface TtsLanguage {
  code: ContentLang
  name: string
  note: string
  model: string
}

export interface Voice {
  voice_id: Id
  name: string
  language: ContentLang
  category: 'premade' | 'cloned' | 'designed'
  gender: 'female' | 'male'
  is_default: boolean
  /** Relative to BASE_URL. */
  preview_url: string
}

export interface TtsModel {
  model_id: string
  name: string
  supports: ContentLang[]
}

export interface TtsClip {
  id: Id
  text: string
  language_code: ContentLang
  voice_id: Id
  model_id: string
  /** Relative to BASE_URL (a pre-generated clip). */
  audio_url: string
  duration_s: number
  created_at: ISODate
}

/** Canned results for quick transcription / voice-in, chosen by file hash. */
export interface CannedTranscript {
  id: Id
  language: ContentLang
  transcript: string
  duration_s: number
  sentiment: Sentiment
}

export interface ConvertFormat {
  id: string
  label: string
  description: string
  ext: string
}

export interface ConvertLimits {
  max_files: number
  max_file_bytes: number
  max_batch_bytes: number
  download_ttl_seconds: number
}

export type ConvertRowState = 'queued' | 'converting' | 'done' | 'failed'

export interface ConversionBatch {
  id: Id
  token: string
  format: string
  rows: Array<{ index: number; name: string; bytes: number; state: ConvertRowState; error: string | null }>
  file_count: number
  ok: number
  failed: number
  total_bytes: number
  state: 'running' | 'done'
  created_at: ISODate
  expires_at: ISODate | null
}

/* ---------------------------------------------------------- platform blobs */

export interface PlatformSettings {
  analysis_instructions: string
  embeddings: {
    provider: string
    model: string
    base_url: string | null
    dim: number
    api_key_set: boolean
    api_key_hint: string | null
  }
  retention_days: number
  voices: { mode: 'all' | 'allowlist'; voice_ids: Id[] }
  health: HealthSettings
  public_sentiment: { enabled: boolean; guidance: string }
}

/* ---------------------------------------------------------- the database */

/** The whole in-memory store (`store.data`). The seed agent fills every array. */
export interface DemoDb {
  tenants: Tenant[]
  tenantUsers: TenantUser[]
  appUsers: AppUser[]

  cannedCalls: CannedCall[]
  recordings: Recording[]
  summaries: CallSummary[]

  scoringConfigs: ScoringConfig[]
  /** Keyed by tenant id. */
  scoreBands: Record<Id, ScoreBands>
  rubricImportJobs: RubricImportJob[]

  kbDocuments: KbDocument[]
  kbChunks: KbChunk[]
  kbEvents: KbEvent[]
  reembedJobs: ReembedJob[]
  curationProposals: CurationProposal[]

  sentimentConfigs: SentimentConfig[]
  transcriptionConfigs: TranscriptionConfigRecord[]

  aiProviders: AiProviderEntry[]
  aiConnections: AiConnection[]
  aiAssignments: AiAssignment[]
  aiByo: AiByoOverride[]
  aiLegacy: AiLegacyOverride[]
  integrations: Integration[]

  botConfigs: BotConfig[]
  killState: KillState
  conversations: ChatConversation[]
  turns: ChatTurn[]
  copilotFeedback: CopilotFeedback[]

  llmUsage: LlmUsage[]

  limits: { anonymous: LimitsConfig; registered: LimitsConfig }
  /** Today's spend per principal key (`guest`, account id); in memory only. */
  quotaUsed: Record<string, Record<QuotaKind, number>>
  ttsLanguages: TtsLanguage[]
  voices: Voice[]
  ttsModels: TtsModel[]
  ttsClips: TtsClip[]
  cannedTranscripts: CannedTranscript[]
  convertFormats: ConvertFormat[]
  convertLimits: ConvertLimits
  conversionBatches: ConversionBatch[]

  settings: PlatformSettings
}

/* ------------------------------------------------------------- event bus */

/** Events on the shared bus (`bus` from `@/demo/core`). Add new ones here. */
export interface DemoEvents {
  'recording:updated': { id: Id }
  'summary:updated': { id: Id }
  'kb:changed': { client_id: Id }
  'reembed:progress': { job: ReembedJob }
  'curation:changed': { client_id: Id }
  'convert:progress': { batch: ConversionBatch }
  'health:sample': { sample: HealthSample }
  'usage:appended': { count: number }
  'bot:kill-changed': { state: KillState }
  'acting-tenant:changed': { tenant_id: Id | null }
}
