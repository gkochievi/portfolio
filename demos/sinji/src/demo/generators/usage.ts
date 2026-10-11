/**
 * Seeded generator for ~2,000 LlmUsage rows over 90 days (OWNED BY THE usage GROUP).
 * Called by `createStore`'s prepare after `rebaseDates`, so timestamps are computed
 * relative to `Date.now()`; `createRandom('sinji-usage')` keeps the shape deterministic.
 *
 * Two layers:
 *  1. Tied rows: derived from the real seeded recordings, digests and bot
 *     conversations, so every drill-down (recording detail, conversation detail)
 *     resolves to something that exists.
 *  2. Background rows: the rest of the 90 days (re-runs, archived recordings and
 *     conversations, knowledge-base work, public voice tools) with a diurnal and
 *     weekday pattern, ~3% failures, and workspace-owned keys for Darbazi.
 *
 * Tokens only, never money.
 */
import { createRandom, type Random } from '@portfolio/demo-kit'

import type {
  AiCapability,
  CallSummary,
  ChatConversation,
  ChatTurn,
  DemoDb,
  Id,
  LlmUsage,
  Recording,
  Tenant,
  UsageCapability,
  UsageFeature,
  UsageGroup,
} from '@/types'

const DAY = 86_400_000
const HOUR = 3_600_000
const TARGET_ROWS = 2000
const HISTORY_DAYS = 90

/* ------------------------------------------------------------- feature table */

interface FeatureSpec {
  group: UsageGroup
  capability: UsageCapability
  /** [min, max] fixed prompt overhead (system prompt, rubric, KB context). */
  base: [number, number]
  /** [min, max] output tokens. */
  out: [number, number]
  /** Share of the prompt served from the provider cache (0..1) on repeat calls. */
  cache: number
  /** Whether the transcript is part of the prompt. */
  transcript: boolean
}

const FEATURES: Record<UsageFeature, FeatureSpec> = {
  transcribe: { group: 'transcription', capability: 'stt', base: [0, 0], out: [0, 0], cache: 0, transcript: false },
  analyze: { group: 'analysis', capability: 'llm', base: [1800, 3200], out: [420, 980], cache: 0.5, transcript: true },
  factcheck_extract: { group: 'factcheck', capability: 'llm', base: [1500, 2600], out: [380, 1100], cache: 0.45, transcript: true },
  factcheck_verify: { group: 'factcheck', capability: 'llm', base: [3800, 8200], out: [800, 2400], cache: 0.55, transcript: false },
  score: { group: 'scoring', capability: 'llm', base: [2400, 4200], out: [700, 1700], cache: 0.5, transcript: true },
  semantic: { group: 'tone', capability: 'llm', base: [1600, 2800], out: [900, 2100], cache: 0.45, transcript: true },
  summarise: { group: 'summary', capability: 'llm', base: [1200, 2400], out: [450, 1300], cache: 0.3, transcript: true },
  kb_restructure: { group: 'kb', capability: 'llm', base: [2000, 5200], out: [1800, 4800], cache: 0, transcript: false },
  rubric_import: { group: 'scoring', capability: 'llm', base: [4200, 9800], out: [1500, 3400], cache: 0, transcript: false },
  triage: { group: 'bot', capability: 'llm', base: [320, 880], out: [18, 64], cache: 0.6, transcript: false },
  autopilot: { group: 'bot', capability: 'llm', base: [1800, 4200], out: [120, 460], cache: 0.5, transcript: false },
  handoff: { group: 'bot', capability: 'llm', base: [1200, 3000], out: [150, 420], cache: 0.4, transcript: false },
  copilot: { group: 'bot', capability: 'llm', base: [2000, 5200], out: [320, 1200], cache: 0.5, transcript: false },
  curation: { group: 'kb', capability: 'llm', base: [3000, 8000], out: [600, 1800], cache: 0.2, transcript: false },
  tts: { group: 'voice', capability: 'tts', base: [0, 0], out: [0, 0], cache: 0, transcript: false },
  voice_tone: { group: 'tone', capability: 'voice_tone', base: [0, 0], out: [0, 0], cache: 0, transcript: false },
  embed: { group: 'kb', capability: 'embed', base: [400, 7800], out: [0, 0], cache: 0, transcript: false },
}

const ERRORS = [
  'Upstream timeout after 30000 ms',
  'Rate limit exceeded (429)',
  'Provider unavailable (503)',
  'Model returned malformed JSON',
  'Output budget exceeded; response truncated',
]

/* ------------------------------------------------------------- tenant profile */

interface Route {
  provider: string
  model: string
  byo: boolean
}

interface Profile {
  tenant: Tenant
  weight: number
  /** Epoch ms between which this workspace produced usage. */
  from: number
  to: number
  llm: Route
  llmBefore: Route
  /** When the workspace-owned LLM key took over (epoch ms), or Infinity. */
  byoSince: number
  stt: Route
  tts: Route
  voiceTone: boolean
  users: string[]
}

const WEIGHTS: Record<string, number> = {
  tn_mtiebi: 5,
  tn_pari: 2.2,
  tn_iasamani: 1.4,
  tn_darbazi: 2,
  tn_nobati: 1,
  tn_mzetamze: 0.7,
}

function buildProfiles(db: DemoDb, now: number): Profile[] {
  const routeFor = (clientId: Id, cap: AiCapability): Route => {
    const assigned = db.aiAssignments.find((a) => a.client_id === clientId && a.capability === cap)?.connection_id
    const connection =
      db.aiConnections.find((c) => c.id === assigned) ?? db.aiConnections.find((c) => c.capability === cap && c.is_default)
    return { provider: connection?.provider ?? 'anthropic', model: connection?.model ?? 'claude-sonnet-4-5', byo: false }
  }

  return db.tenants.map((tenant) => {
    const users = db.tenantUsers.filter((u) => u.client_id === tenant.id)
    const lastLogin = Math.max(0, ...users.map((u) => (u.last_login_at ? Date.parse(u.last_login_at) : 0)))
    const to = tenant.is_active ? now : Math.min(now, lastLogin || now - 60 * DAY)
    const created = Date.parse(tenant.created_at)
    const byo = db.aiByo.find((b) => b.client_id === tenant.id && b.capability === 'llm' && b.enabled)
    const base = routeFor(tenant.id, 'llm')
    return {
      tenant,
      weight: WEIGHTS[tenant.id] ?? 1,
      from: Math.max(created, now - HISTORY_DAYS * DAY),
      to,
      llm: byo ? { provider: byo.provider, model: byo.model, byo: true } : base,
      llmBefore: base,
      byoSince: byo ? Date.parse(byo.updated_at) : Number.POSITIVE_INFINITY,
      stt: routeFor(tenant.id, 'stt'),
      tts: routeFor(tenant.id, 'tts'),
      voiceTone: db.sentimentConfigs.find((s) => s.client_id === tenant.id)?.voice_tone !== 'disabled',
      users: users.filter((u) => u.is_active).map((u) => u.display_name),
    }
  })
}

/* ------------------------------------------------------------------- helpers */

/** Share of a day's traffic by local (Tbilisi, UTC+4) hour. */
const HOUR_WEIGHT = [
  0.02, 0.01, 0.01, 0.01, 0.02, 0.04, 0.08, 0.2, 0.5, 0.9, 1, 1, 0.8, 0.65, 0.95, 1, 0.9, 0.7, 0.4, 0.25, 0.18, 0.12, 0.07, 0.04,
]
/** Sunday..Saturday. */
const WEEKDAY_WEIGHT = [0.12, 1, 1, 1, 0.95, 0.9, 0.22]

const iso = (ms: number) => new Date(ms).toISOString()

function rate(provider: string, model: string): number {
  if (provider === 'anthropic') return model.includes('haiku') ? 5 : 13
  if (model.includes('mini')) return 6
  if (provider === 'openai') return 10
  return 22
}

interface Ctx {
  rnd: Random
  now: number
  rows: LlmUsage[]
  counter: number
}

interface RowOpts {
  at: number
  feature: UsageFeature
  client_id: Id | null
  actor: string
  route: Route
  /** Prompt tokens in addition to the feature's fixed overhead. */
  extraIn?: number
  /** Exact totals (bot turns that already carry a token count). */
  exactTotal?: number
  audio_seconds?: number
  characters?: number
  job_id?: Id | null
  conversation_id?: Id | null
  turn_id?: Id | null
  summary_id?: Id | null
  /** Never fail (primary rows that the seeded data says succeeded). */
  primary?: boolean
  fail?: string
  zero?: boolean
}

function emit(ctx: Ctx, o: RowOpts): LlmUsage | null {
  const { rnd, now } = ctx
  if (o.at > now - 20_000) return null
  const spec = FEATURES[o.feature]
  let input = 0
  let output = 0
  if (!o.zero && (spec.capability === 'llm' || spec.capability === 'embed')) {
    if (o.exactTotal != null) {
      output = Math.max(0, Math.round(o.exactTotal * rnd.int(11, 19) / 100))
      input = Math.max(0, o.exactTotal - output)
    } else {
      input = rnd.int(spec.base[0], spec.base[1]) + Math.round(o.extraIn ?? 0)
      output = spec.out[1] ? rnd.int(spec.out[0], spec.out[1]) : 0
    }
  }
  const failMsg = o.fail ?? (!o.primary && rnd.chance(0.03) ? rnd.pick(ERRORS) : null)
  let ok = true
  let error: string | null = null
  if (failMsg) {
    ok = false
    error = failMsg
    if (!failMsg.includes('JSON') && !failMsg.includes('truncated')) input = 0
    if (spec.capability === 'embed') input = 0
    output = failMsg.includes('truncated') ? Math.round(output * 0.4) : 0
  }

  let cacheRead = 0
  let cacheCreate = 0
  if (spec.cache > 0 && input > 0 && ok) {
    if (o.route.provider === 'anthropic') {
      if (rnd.chance(0.78)) cacheRead = Math.round(input * spec.cache * (0.7 + rnd.next() * 0.5))
      else cacheCreate = Math.round(input * spec.cache * 0.6)
    } else if (o.route.provider === 'openai' && rnd.chance(0.55)) {
      cacheRead = Math.round(input * spec.cache * 0.55)
    }
  }

  let latency: number
  if (spec.capability === 'stt') latency = 900 + (o.audio_seconds ?? 60) * rnd.int(150, 260)
  else if (spec.capability === 'voice_tone') latency = 700 + (o.audio_seconds ?? 60) * rnd.int(40, 90)
  else if (spec.capability === 'tts') latency = 380 + (o.characters ?? 80) * rnd.int(5, 11)
  else if (spec.capability === 'embed') latency = rnd.int(70, 380)
  else latency = 420 + output * rate(o.route.provider, o.route.model) + rnd.int(0, 500)
  if (!ok) latency = failMsg?.includes('timeout') ? 30_000 + rnd.int(0, 400) : rnd.int(240, 2600)

  ctx.counter += 1
  const row: LlmUsage = {
    id: `use_h${String(ctx.counter).padStart(5, '0')}`,
    created_at: iso(o.at),
    client_id: o.client_id,
    actor: o.actor,
    feature: o.feature,
    group: spec.group,
    capability: spec.capability,
    provider: o.route.provider,
    model: o.route.model,
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead,
    cache_creation_tokens: cacheCreate,
    total_tokens: input + output,
    byo: o.route.byo,
    audio_seconds: o.audio_seconds ?? null,
    characters: o.characters ?? null,
    latency_ms: Math.round(latency),
    ok,
    error,
    job_id: o.job_id ?? null,
    conversation_id: o.conversation_id ?? null,
    turn_id: o.turn_id ?? null,
    summary_id: o.summary_id ?? null,
  }
  ctx.rows.push(row)
  return row
}

/* ------------------------------------------------------------------ tied rows */

const routeAt = (p: Profile, at: number): Route => (at >= p.byoSince ? p.llm : p.llmBefore)

const tokensOf = (chars: number) => Math.round(Math.min(24_000, Math.max(700, chars * 0.7)))

function recordingRows(ctx: Ctx, rec: Recording, p: Profile, now: number): void {
  const start = Date.parse(rec.created_at)
  const actor = rec.created_by || p.users[0] || 'system'
  const route = routeAt(p, start)
  const common = { client_id: rec.client_id, actor, job_id: rec.id, primary: true }
  const audio = rec.source === 'audio'
  const dur = Math.round(rec.duration_s ?? 90)
  const transcript = tokensOf(rec.transcript.length)
  let t = start + 3_000

  if (audio) {
    emit(ctx, { ...common, at: t, feature: 'transcribe', route: p.stt, audio_seconds: dur, fail: rec.status === 'error' ? (rec.error ?? 'Transcription failed') : undefined })
    t += 6_000 + dur * 150
    if (rec.status === 'error') return
    if (p.voiceTone) {
      emit(ctx, { ...common, at: t, feature: 'voice_tone', route: { provider: 'local', model: 'voice-emotion-v2', byo: false }, audio_seconds: dur })
      t += 2_500
    }
  } else if (rec.status === 'error') {
    return
  }
  if (!['ready', 'done', 'analyzing'].includes(rec.status)) return

  emit(ctx, { ...common, at: t, feature: 'analyze', route, extraIn: transcript })
  t += 4_000
  if (rec.ran.factcheck) {
    emit(ctx, { ...common, at: t, feature: 'factcheck_extract', route, extraIn: transcript })
    emit(ctx, { ...common, at: t + 5_500, feature: 'factcheck_verify', route, extraIn: ctx.rnd.int(0, 1800) })
    t += 11_000
  }
  if (rec.ran.semantic) {
    emit(ctx, { ...common, at: t, feature: 'semantic', route, extraIn: transcript })
    t += 5_000
  }
  if (rec.ran.score) {
    emit(ctx, { ...common, at: t, feature: 'score', route, extraIn: transcript })
    t += 5_000
  }
  if (rec.ran.summary) emit(ctx, { ...common, at: t, feature: 'summarise', route, extraIn: transcript })

  // A reviewer re-ran an analyser a day or two later.
  if (ctx.rnd.chance(0.3)) {
    const later = start + ctx.rnd.int(3, 40) * HOUR
    const feature: UsageFeature = ctx.rnd.pick(['score', 'factcheck_verify', 'semantic'] as const)
    if (later < now - 60_000) {
      emit(ctx, { client_id: rec.client_id, actor: ctx.rnd.pick(p.users.length ? p.users : [actor]), job_id: rec.id, at: later, feature, route: routeAt(p, later), extraIn: transcript })
    }
  }
}

function digestRows(ctx: Ctx, s: CallSummary, profiles: Profile[]): void {
  const p = profiles.find((x) => x.tenant.id === s.client_id)
  if (!p) return
  const at = Date.parse(s.created_at)
  const route = routeAt(p, at)
  const base = { client_id: s.client_id, actor: s.created_by || p.users[0] || 'system', summary_id: s.id, primary: true }
  const n = Math.max(1, s.job_ids.length)
  for (let i = 0; i < n; i += 1) emit(ctx, { ...base, at: at + i * 400, feature: 'summarise', route, extraIn: ctx.rnd.int(1200, 3200) })
  emit(ctx, { ...base, at: at + n * 400 + 900, feature: 'summarise', route, extraIn: n * 700 })
}

function conversationRows(ctx: Ctx, c: ChatConversation, turns: ChatTurn[], profiles: Profile[]): void {
  const p = profiles.find((x) => x.tenant.id === c.client_id)
  if (!p) return
  const operator = p.users.find((u) => u.length) ?? 'system'
  const sorted = [...turns].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const base = { client_id: c.client_id, conversation_id: c.id, primary: true }
  for (const turn of sorted) {
    const at = Date.parse(turn.created_at)
    const route = routeAt(p, at)
    if (turn.role === 'customer') {
      if (c.mode === 'autopilot') emit(ctx, { ...base, at: at + 150, feature: 'triage', route, actor: 'autopilot', turn_id: turn.id })
    } else if (turn.role === 'bot') {
      if (turn.method === 'canned') continue
      const refused = turn.grounded === false || turn.tokens <= 0
      emit(ctx, { ...base, at: at - 600, feature: 'autopilot', route, actor: 'autopilot', turn_id: turn.id, exactTotal: refused ? undefined : turn.tokens, zero: refused })
    } else if (turn.role === 'operator' && (turn.citations.length > 0 || turn.tokens > 0)) {
      emit(ctx, { ...base, at: at - 4_000, feature: 'copilot', route, actor: operator, turn_id: turn.id, exactTotal: turn.tokens > 0 ? turn.tokens : undefined })
    }
  }
  if (c.state === 'handoff') {
    const at = Date.parse(c.last_message_at)
    emit(ctx, { ...base, at: at - 1_200, feature: 'handoff', route: routeAt(p, at), actor: 'autopilot' })
  }
}

/* ------------------------------------------------------------ background rows */

const PUBLIC_ACTORS = ['guest', 'guest', 'guest', 'elene.m@mail.example', 'nika.j@mail.example', 'davit.n@mail.example', 'salome.g@mail.example']

function pickMoment(ctx: Ctx): number {
  const { rnd, now } = ctx
  for (let i = 0; i < 400; i += 1) {
    const daysAgo = rnd.next() * HISTORY_DAYS
    const at = now - daysAgo * DAY
    const local = new Date(at + 4 * HOUR)
    const w = HOUR_WEIGHT[local.getUTCHours()] * WEEKDAY_WEIGHT[local.getUTCDay()] * (0.45 + 0.55 * (1 - daysAgo / HISTORY_DAYS))
    if (rnd.next() < w) return at
  }
  return now - rnd.int(1, 40) * HOUR
}

function pickProfile(ctx: Ctx, profiles: Profile[], at: number): Profile | null {
  const live = profiles.filter((p) => at >= p.from && at <= p.to)
  if (!live.length) return null
  return ctx.rnd.weighted(live.map((p) => [p, p.weight] as const))
}

function backgroundEvent(ctx: Ctx, db: DemoDb, profiles: Profile[]): void {
  const { rnd } = ctx
  const at = pickMoment(ctx)
  const kind = rnd.weighted([
    ['pipeline', 26],
    ['bot', 16],
    ['kb', 15],
    ['public', 24],
    ['digest', 4],
    ['rubric', 1.5],
  ] as const)

  if (kind === 'public') {
    const actor = rnd.pick(PUBLIC_ACTORS)
    if (rnd.chance(0.72)) {
      const model = rnd.weighted([
        ['eleven_multilingual_v2', 70],
        ['eleven_v3', 22],
      ] as const)
      const route: Route = rnd.chance(0.12)
        ? { provider: 'google', model: 'gemini-2.5-flash-tts', byo: false }
        : { provider: 'elevenlabs', model, byo: false }
      emit(ctx, { at, feature: 'tts', client_id: null, actor, route, characters: rnd.int(40, 940) })
    } else if (rnd.chance(0.75)) {
      emit(ctx, { at, feature: 'transcribe', client_id: null, actor, route: { provider: 'elevenlabs', model: 'scribe_v1', byo: false }, audio_seconds: rnd.int(8, 150) })
    } else {
      emit(ctx, { at, feature: 'semantic', client_id: null, actor, route: { provider: 'anthropic', model: 'claude-sonnet-4-5', byo: false }, extraIn: rnd.int(300, 1400) })
    }
    return
  }

  const p = pickProfile(ctx, profiles, at)
  if (!p) return
  const route = routeAt(p, at)
  const user = rnd.pick(p.users.length ? p.users : ['system'])
  const tenantId = p.tenant.id

  if (kind === 'pipeline') {
    const eligible = db.recordings.filter((r) => r.client_id === tenantId && Date.parse(r.created_at) <= at && r.source === 'audio')
    const rec = eligible.length ? rnd.pick(eligible) : null
    const job_id = rec ? rec.id : `rec_hist_${String(rnd.int(1, 220)).padStart(3, '0')}`
    const dur = rec?.duration_s ? Math.round(rec.duration_s) : rnd.int(45, 420)
    const transcript = rec ? tokensOf(rec.transcript.length) : tokensOf(dur * 14)
    const common = { client_id: tenantId, actor: user, job_id }
    const full = !rec && rnd.chance(0.85)
    let t = at
    if (full) {
      emit(ctx, { ...common, at: t, feature: 'transcribe', route: p.stt, audio_seconds: dur })
      t += 8_000 + dur * 150
      if (p.voiceTone && rnd.chance(0.7)) {
        emit(ctx, { ...common, at: t, feature: 'voice_tone', route: { provider: 'local', model: 'voice-emotion-v2', byo: false }, audio_seconds: dur })
        t += 2_500
      }
      emit(ctx, { ...common, at: t, feature: 'analyze', route, extraIn: transcript })
      t += 4_000
    }
    const steps: UsageFeature[] = full ? ['factcheck_extract', 'factcheck_verify', 'semantic', 'score'] : [rnd.pick(['score', 'factcheck_verify', 'semantic', 'factcheck_extract'] as const)]
    for (const feature of steps) {
      if (!full && rnd.chance(0.3)) continue
      emit(ctx, { ...common, at: t, feature, route, extraIn: feature === 'factcheck_verify' ? rnd.int(0, 1800) : transcript })
      t += 5_000
    }
    if (full && rnd.chance(0.5)) emit(ctx, { ...common, at: t, feature: 'summarise', route, extraIn: transcript })
    return
  }

  if (kind === 'bot') {
    // Only conversations older than the seeded ones are archived; newer ones are tied above.
    const earliest = Math.min(Number.POSITIVE_INFINITY, ...db.conversations.map((c) => Date.parse(c.created_at)))
    if (at >= earliest) return
    const conversation_id = `conv_hist_${String(rnd.int(1, 160)).padStart(3, '0')}`
    const autopilot = rnd.chance(0.55)
    const base = { client_id: tenantId, conversation_id, actor: autopilot ? 'autopilot' : user }
    const turns = rnd.int(1, 4)
    let t = at
    for (let i = 0; i < turns; i += 1) {
      if (autopilot) {
        emit(ctx, { ...base, at: t, feature: 'triage', route })
        emit(ctx, { ...base, at: t + 900, feature: 'autopilot', route, zero: rnd.chance(0.12) })
      } else {
        emit(ctx, { ...base, at: t, feature: 'copilot', route })
      }
      t += rnd.int(40, 260) * 1000
    }
    if (rnd.chance(0.3)) emit(ctx, { ...base, at: t, feature: 'handoff', route, actor: 'autopilot' })
    return
  }

  if (kind === 'kb') {
    const batches = rnd.int(2, 7)
    for (let i = 0; i < batches; i += 1) {
      emit(ctx, {
        at: at + i * 1_300,
        feature: 'embed',
        client_id: tenantId,
        actor: user,
        route: { provider: 'local', model: 'multilingual-e5-large', byo: false },
        extraIn: rnd.int(0, 1800),
      })
    }
    if (rnd.chance(0.45)) emit(ctx, { at: at + 9_000, feature: 'kb_restructure', client_id: tenantId, actor: user, route })
    if (rnd.chance(0.25)) emit(ctx, { at: at + 60_000, feature: 'curation', client_id: tenantId, actor: 'system', route })
    return
  }

  if (kind === 'digest') {
    const summary_id = `sum_hist_${String(rnd.int(1, 60)).padStart(2, '0')}`
    const calls = rnd.int(2, 4)
    for (let i = 0; i < calls; i += 1) emit(ctx, { at: at + i * 500, feature: 'summarise', client_id: tenantId, actor: user, route, summary_id, extraIn: rnd.int(1200, 3200) })
    emit(ctx, { at: at + calls * 500 + 900, feature: 'summarise', client_id: tenantId, actor: user, route, summary_id, extraIn: calls * 700 })
    return
  }

  emit(ctx, { at, feature: 'rubric_import', client_id: tenantId, actor: user, route })
}

/* ---------------------------------------------------------------------- main */

export function generateUsage(db: DemoDb): LlmUsage[] {
  const now = Date.now()
  const ctx: Ctx = { rnd: createRandom('sinji-usage'), now, rows: [], counter: 0 }
  const profiles = buildProfiles(db, now)
  const profileOf = (id: Id | null) => profiles.find((p) => p.tenant.id === id)

  for (const rec of db.recordings) {
    const p = profileOf(rec.client_id)
    if (p) recordingRows(ctx, rec, p, now)
  }
  for (const s of db.summaries) digestRows(ctx, s, profiles)
  for (const c of db.conversations) conversationRows(ctx, c, db.turns.filter((t) => t.conversation_id === c.id), profiles)

  let guard = 0
  while (ctx.rows.length < TARGET_ROWS && guard < 12_000) {
    backgroundEvent(ctx, db, profiles)
    guard += 1
  }

  return ctx.rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
}
