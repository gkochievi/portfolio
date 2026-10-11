/**
 * Mock handlers for the `console-ai` group: AI provider registry, workspace
 * assignments, integrations (instructions, self-test, transcription defaults,
 * chat credentials) and embeddings. Operator only. OWNED BY: console-ai.
 */
import { DemoApiError, conflict, every, notFound } from '@portfolio/demo-kit'

import { CAPABILITIES, CHAT_SCOPES } from '@/features/console-ai/types'
import type {
  AssignmentCell,
  AssignmentRow,
  AssignmentsPayload,
  ConnectionTestResult,
  DiagnoseResult,
  EmbeddingsPayload,
  EmbeddingsProviderOption,
  LegacyView,
  TenantAiPayload,
  TranscriptionDefaultPayload,
} from '@/features/console-ai/types'
import type {
  AiCapability,
  AiConnection,
  AiLegacyOverride,
  ChatScope,
  DemoDb,
  DiagnoseVerdict,
  Id,
  Integration,
  IntegrationSecret,
  SelfTestProbe,
  TranscriptionSettings,
} from '@/types'
import { api, store } from '../core'
import { actorName, requireOperator } from '../guards'

type Body = Record<string, unknown>

const db = (): DemoDb => store.data
const nowIso = (): string => new Date().toISOString()
const body = (raw: unknown): Body => (raw && typeof raw === 'object' ? (raw as Body) : {})
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const isCapability = (v: unknown): v is AiCapability => v === 'llm' || v === 'stt' || v === 'tts'
const isScope = (v: unknown): v is ChatScope => (CHAT_SCOPES as readonly unknown[]).includes(v)
const scopesOf = (v: unknown): ChatScope[] => (Array.isArray(v) ? [...new Set(v.filter(isScope))] : [])

const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** A stable-looking latency for a probe: a base plus a per-id wobble. */
const latency = (seed: string, base: number, spread: number): number => base + (hash(seed + Math.floor(Date.now() / 60000)) % spread)

const randomToken = (length: number): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
const maskKey = (key: string): string => `••••${key.slice(-4).toUpperCase()}`

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Optional base URL: '' -> null, otherwise must be http(s). */
function baseUrlOf(value: unknown, errors: Record<string, string>): string | null {
  const v = text(value)
  if (!v) return null
  if (!isHttpUrl(v)) errors.base_url = 'Enter a full http(s) URL.'
  return v
}

const fail = (errors: Record<string, string>): void => {
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

/* ----------------------------------------------------------------- catalog */

function findConnection(id: string): AiConnection {
  const c = db().aiConnections.find((x) => x.id === id)
  if (!c) throw notFound('Connection not found.')
  return c
}

const defaultConnection = (cap: AiCapability): AiConnection | undefined =>
  db().aiConnections.find((c) => c.capability === cap && c.is_default && c.is_active)

function settingsOf(raw: unknown, errors: Record<string, string>): AiConnection['settings'] {
  const out: AiConnection['settings'] = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Body)) {
    const key = k.trim()
    if (!key) continue
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) {
      errors.settings = `Setting names use letters, digits and underscores (got "${key}").`
      continue
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = v
  }
  return out
}

/** Check provider / model / capability against the catalog; returns the base URL to store. */
function validateConnection(b: Body, capability: AiCapability, existingId?: string): { name: string; provider: string; model: string; base_url: string | null; settings: AiConnection['settings'] } {
  const errors: Record<string, string> = {}
  const name = text(b.name)
  const provider = text(b.provider)
  const model = text(b.model)
  if (name.length < 2) errors.name = 'Give the connection a name.'
  if (name.length > 60) errors.name = 'Keep the name under 60 characters.'
  const clash = db().aiConnections.find(
    (c) => c.id !== existingId && c.capability === capability && c.name.toLowerCase() === name.toLowerCase(),
  )
  if (clash) errors.name = 'A connection with this name already exists for this capability.'
  const entry = db().aiProviders.find((p) => p.id === provider)
  if (!entry) errors.provider = 'Choose a provider from the catalog.'
  else if (!entry.capabilities.includes(capability)) errors.provider = 'This provider does not offer this capability.'
  if (!model) errors.model = 'Choose or enter a model.'
  if (model.length > 80) errors.model = 'Model names are at most 80 characters.'
  const base_url = baseUrlOf(b.base_url, errors)
  if (entry && !entry.default_base_url && provider === 'local' && !base_url) errors.base_url = 'A base URL is required.'
  if (provider === 'local' && !base_url) errors.base_url = 'A self-hosted endpoint needs a base URL.'
  const settings = settingsOf(b.settings, errors)
  fail(errors)
  return { name, provider, model, base_url, settings }
}

/* --------------------------------------------------------------- effective */

function effectiveFor(tenantId: Id, cap: AiCapability): AssignmentCell {
  const data = db()
  const byo = data.aiByo.find((o) => o.client_id === tenantId && o.capability === cap && o.enabled && o.has_key)
  const assignment = data.aiAssignments.find((a) => a.client_id === tenantId && a.capability === cap)
  const assigned = assignment?.connection_id ? data.aiConnections.find((c) => c.id === assignment.connection_id && c.is_active) : undefined
  const legacy = cap === 'llm' ? data.aiLegacy.find((l) => l.client_id === tenantId && l.enabled && l.has_key) : undefined
  const dflt = defaultConnection(cap)
  const own_key = Boolean(byo)
  const base = { capability: cap, own_key }
  if (byo) return { ...base, source: 'byo', connection_id: null, name: 'Own key', provider: byo.provider, model: byo.model, assigned: Boolean(assigned) }
  if (assigned) return { ...base, source: 'assigned', connection_id: assigned.id, name: assigned.name, provider: assigned.provider, model: assigned.model, assigned: true }
  if (legacy) return { ...base, source: 'legacy', connection_id: null, name: 'Text-AI override', provider: legacy.provider, model: legacy.model, assigned: false }
  if (dflt) return { ...base, source: 'default', connection_id: dflt.id, name: dflt.name, provider: dflt.provider, model: dflt.model, assigned: false }
  return { ...base, source: 'default', connection_id: null, name: '', provider: '', model: '', assigned: false }
}

function ensureAssignment(tenantId: Id, cap: AiCapability) {
  const data = db()
  let row = data.aiAssignments.find((a) => a.client_id === tenantId && a.capability === cap)
  if (!row) {
    row = { client_id: tenantId, capability: cap, connection_id: null }
    data.aiAssignments.push(row)
  }
  return row
}

const legacyView = (tenantId: Id): LegacyView => {
  const l: AiLegacyOverride | undefined = db().aiLegacy.find((x) => x.client_id === tenantId)
  if (!l) {
    return { client_id: tenantId, enabled: false, provider: 'openai', model: '', base_url: null, has_key: false, notes: '', updated_at: null, key_hint: null, updated_by: null }
  }
  return { ...l, key_hint: l.has_key ? '••••' + hash(tenantId + 'legacy').toString(36).slice(-4).toUpperCase() : null, updated_by: 'Levan Kipiani' }
}

/* ------------------------------------------------------------ connections */

api.register('GET', '/admin/ai/catalog', () => {
  requireOperator()
  return db().aiProviders
})

api.register('GET', '/admin/ai/connections', ({ params }) => {
  requireOperator()
  const includeInactive = params.include_inactive === 'true' || params.include_inactive === '1'
  return db().aiConnections.filter((c) => includeInactive || c.is_active)
})

api.register('POST', '/admin/ai/connections', ({ body: raw }) => {
  requireOperator()
  const b = body(raw)
  if (!isCapability(b.capability)) throw DemoApiError.validation({ capability: 'Choose LLM, STT or TTS.' })
  const capability = b.capability
  const v = validateConnection(b, capability)
  const key = text(b.api_key)
  const hasDefault = db().aiConnections.some((c) => c.capability === capability && c.is_default && c.is_active)
  const connection: AiConnection = {
    id: store.nextId('aic_'),
    name: v.name,
    capability,
    provider: v.provider,
    model: v.model,
    base_url: v.base_url,
    has_key: Boolean(key),
    key_hint: key ? maskKey(key) : null,
    settings: v.settings,
    is_active: true,
    is_default: !hasDefault,
    last_test: null,
    updated_at: nowIso(),
    updated_by: actorName(),
  }
  db().aiConnections.push(connection)
  store.notify()
  return connection
})

api.register('PATCH', '/admin/ai/connections/:id', ({ path, body: raw }) => {
  requireOperator()
  const c = findConnection(path.id ?? '')
  const b = body(raw)
  if (typeof b.is_active === 'boolean' && Object.keys(b).length === 1) {
    if (!b.is_active && c.is_default) throw conflict('This is the default for its capability. Make another connection the default first.')
    c.is_active = b.is_active
  } else {
    const v = validateConnection({ ...c, ...b }, c.capability, c.id)
    c.name = v.name
    c.provider = v.provider
    c.model = v.model
    c.base_url = v.base_url
    c.settings = v.settings
    const key = text(b.api_key)
    if (key) {
      c.has_key = true
      c.key_hint = maskKey(key)
    } else if (b.clear_key === true) {
      c.has_key = false
      c.key_hint = null
    }
    if (typeof b.is_active === 'boolean') {
      if (!b.is_active && c.is_default) throw conflict('This is the default for its capability. Make another connection the default first.')
      c.is_active = b.is_active
    }
    // Connection details changed: the last test no longer describes it.
    c.last_test = null
  }
  c.updated_at = nowIso()
  c.updated_by = actorName()
  store.notify()
  return c
})

function probeConnection(c: AiConnection): { ok: boolean; detail: string } {
  const ms = latency(c.id, 420, 900)
  const keyless = c.provider === 'local'
  if (!c.is_active) return { ok: false, detail: 'Connection is inactive' }
  if (keyless ? !c.base_url : !c.has_key) return { ok: false, detail: keyless ? 'No base URL' : 'no key stored' }
  if (c.capability === 'stt') return { ok: true, detail: `Transcribed the 4 s probe in ${ms + 500} ms` }
  if (c.capability === 'tts') return { ok: true, detail: `Synthesised 18 characters in ${ms} ms` }
  return { ok: true, detail: `Responded in ${ms} ms` }
}

api.register('POST', '/admin/ai/connections/:id/test', ({ path }) => {
  requireOperator()
  const id = path.id ?? ''
  findConnection(id)
  return new Promise<ConnectionTestResult>((resolve, reject) => {
    setTimeout(() => {
      const c = db().aiConnections.find((x) => x.id === id)
      if (!c) return reject(notFound('Connection not found.'))
      const result = probeConnection(c)
      c.last_test = { ok: result.ok, at: nowIso(), detail: result.detail }
      store.notify()
      resolve({ ...result, at: c.last_test.at, connection: c })
    }, 1000)
  })
})

api.register('POST', '/admin/ai/connections/:id/default', ({ path }) => {
  requireOperator()
  const c = findConnection(path.id ?? '')
  if (!c.is_active) throw conflict('Reactivate this connection before making it the default.')
  for (const other of db().aiConnections) if (other.capability === c.capability) other.is_default = other.id === c.id
  c.updated_at = nowIso()
  c.updated_by = actorName()
  store.notify()
  return c
})

/* ------------------------------------------------------------ assignments */

api.register('GET', '/admin/ai/assignments', (): AssignmentsPayload => {
  requireOperator()
  const defaults = {} as AssignmentsPayload['defaults']
  for (const cap of CAPABILITIES) {
    const d = defaultConnection(cap)
    defaults[cap] = d ? { connection_id: d.id, name: d.name, provider: d.provider, model: d.model } : null
  }
  const rows: AssignmentRow[] = db().tenants.map((t) => ({
    tenant_id: t.id,
    name: t.name,
    name_ka: t.name_ka,
    slug: t.slug,
    is_active: t.is_active,
    cells: {
      llm: effectiveFor(t.id, 'llm'),
      stt: effectiveFor(t.id, 'stt'),
      tts: effectiveFor(t.id, 'tts'),
    },
  }))
  return { defaults, rows }
})

function tenantPayload(tenantId: Id): TenantAiPayload {
  const t = db().tenants.find((x) => x.id === tenantId)
  if (!t) throw notFound('Workspace not found.')
  const assignments = {} as TenantAiPayload['assignments']
  const effective = {} as TenantAiPayload['effective']
  for (const cap of CAPABILITIES) {
    assignments[cap] = db().aiAssignments.find((a) => a.client_id === tenantId && a.capability === cap)?.connection_id ?? null
    const cell = effectiveFor(tenantId, cap)
    effective[cap] = { capability: cap, source: cell.source, connection_id: cell.connection_id, name: cell.name, provider: cell.provider, model: cell.model, own_key: cell.own_key }
  }
  return {
    tenant: { id: t.id, name: t.name, name_ka: t.name_ka, slug: t.slug, is_active: t.is_active },
    assignments,
    effective,
    connections: db().aiConnections,
    legacy: legacyView(tenantId),
  }
}

api.register('GET', '/admin/ai/tenants/:tenantId', ({ path }) => {
  requireOperator()
  return tenantPayload(path.tenantId ?? '')
})

api.register('PUT', '/admin/ai/tenants/:tenantId', ({ path, body: raw }) => {
  requireOperator()
  const tenantId = path.tenantId ?? ''
  if (!db().tenants.some((t) => t.id === tenantId)) throw notFound('Workspace not found.')
  const b = body(raw)
  const errors: Record<string, string> = {}
  const assignments = body(b.assignments)
  const next: Partial<Record<AiCapability, Id | null>> = {}
  for (const cap of CAPABILITIES) {
    if (!(cap in assignments)) continue
    const value = assignments[cap]
    if (value === null || value === '' || value === undefined) {
      next[cap] = null
      continue
    }
    const conn = db().aiConnections.find((c) => c.id === value)
    const current = db().aiAssignments.find((a) => a.client_id === tenantId && a.capability === cap)?.connection_id
    if (!conn || conn.capability !== cap) errors[`assignments.${cap}`] = 'Choose a connection for this capability.'
    else if (!conn.is_active && conn.id !== current) errors[`assignments.${cap}`] = 'That connection is inactive.'
    else next[cap] = conn.id
  }
  const l = body(b.legacy)
  const existing = db().aiLegacy.find((x) => x.client_id === tenantId)
  const enabled = l.enabled === true
  const provider = text(l.provider)
  const model = text(l.model)
  const apiKey = text(l.api_key)
  const baseUrl = baseUrlOf(l.base_url, errors)
  if (enabled) {
    if (!provider) errors['legacy.provider'] = 'Choose a provider.'
    if (!model) errors['legacy.model'] = 'Enter a model.'
    if (!apiKey && !existing?.has_key) errors['legacy.api_key'] = 'Add a key to enable the override.'
  }
  const notes = text(l.notes)
  if (notes.length > 500) errors['legacy.notes'] = 'Keep notes under 500 characters.'
  fail(errors)

  for (const cap of CAPABILITIES) {
    if (cap in next) ensureAssignment(tenantId, cap).connection_id = next[cap] ?? null
  }
  if (Object.keys(l).length) {
    const target: AiLegacyOverride =
      existing ?? { client_id: tenantId, enabled: false, provider: 'openai', model: '', base_url: null, has_key: false, notes: '', updated_at: null }
    if (!existing) db().aiLegacy.push(target)
    target.enabled = enabled
    target.provider = provider || target.provider
    target.model = model
    target.base_url = baseUrl
    target.notes = notes
    if (apiKey) target.has_key = true
    target.updated_at = nowIso()
  }
  store.notify()
  return tenantPayload(tenantId)
})

api.register('DELETE', '/admin/ai/tenants/:tenantId/legacy-key', ({ path }) => {
  requireOperator()
  const tenantId = path.tenantId ?? ''
  const l = db().aiLegacy.find((x) => x.client_id === tenantId)
  if (!l || !l.has_key) throw notFound('There is no stored key to remove.')
  l.has_key = false
  l.enabled = false
  l.updated_at = nowIso()
  store.notify()
  return tenantPayload(tenantId)
})

/* ----------------------------------------------------- integrations: text */

const INSTRUCTIONS_MAX = 4000

api.register('GET', '/admin/integrations/instructions', () => {
  requireOperator()
  return { instructions: db().settings.analysis_instructions, max_length: INSTRUCTIONS_MAX }
})

api.register('PUT', '/admin/integrations/instructions', ({ body: raw }) => {
  requireOperator()
  const value = typeof body(raw).instructions === 'string' ? (body(raw).instructions as string) : ''
  if (value.length > INSTRUCTIONS_MAX) throw DemoApiError.validation({ instructions: `Keep the instructions under ${INSTRUCTIONS_MAX} characters.` })
  db().settings.analysis_instructions = value.trim()
  store.notify()
  return { instructions: db().settings.analysis_instructions, max_length: INSTRUCTIONS_MAX }
})

/* ------------------------------------------------- integrations: self-test */

function usableSecret(i: Integration): boolean {
  const now = Date.now()
  return i.secrets.some((s) => !s.revoked_at && (!s.expires_at || Date.parse(s.expires_at) > now))
}

function connectionProbe(id: string, label: string, cap: AiCapability, deep: boolean): SelfTestProbe {
  const c = defaultConnection(cap)
  if (!c) return { id, label, ok: false, ms: 12, detail: 'No default connection' }
  const r = probeConnection(c)
  const ms = latency(id + c.id, deep ? 600 : 300, 800)
  const detail = r.ok && deep && cap === 'llm' ? `Completed a 24-token round trip in ${ms} ms` : r.detail
  return { id, label, ok: r.ok, ms, detail }
}

function runSelfTest(deep: boolean): SelfTestProbe[] {
  const data = db()
  const emb = data.settings.embeddings
  const embOk = emb.api_key_set || emb.provider === 'local'
  const probes: SelfTestProbe[] = [
    { id: 'database', label: 'Database', ok: true, ms: latency('db', 3, 6), detail: `Responded in ${latency('db', 3, 6)} ms` },
    {
      id: 'embeddings',
      label: 'Embeddings',
      ok: embOk,
      ms: latency('emb', 120, 300),
      detail: embOk ? `Returned a ${emb.dim}-dimension vector in ${latency('emb', 120, 300)} ms` : 'no key stored',
    },
    connectionProbe('llm', 'LLM', 'llm', deep),
    connectionProbe('stt', 'Transcription', 'stt', deep),
    connectionProbe('tts', 'Speech synthesis', 'tts', deep),
    { id: 'voice_tone', label: 'Voice tone', ok: true, ms: latency('tone', 200, 400), detail: `Classified the probe clip in ${latency('tone', 200, 400)} ms` },
    { id: 'storage', label: 'Storage', ok: true, ms: latency('storage', 18, 40), detail: `Wrote and read back a test object in ${latency('storage', 18, 40)} ms` },
  ]
  if (deep) {
    const credentials = data.integrations.filter((i) => i.is_active && usableSecret(i)).length
    const indexed = data.kbChunks.filter((c) => c.has_embedding).length
    probes.push(
      { id: 'kb_index', label: 'Knowledge-base index', ok: indexed > 0, ms: latency('kb', 60, 120), detail: `${indexed} chunks indexed` },
      {
        id: 'chat_gateway',
        label: 'Web chat credentials',
        ok: credentials > 0,
        ms: latency('chat', 30, 60),
        detail: credentials > 0 ? `${credentials} credentials accepted` : 'No active credential',
      },
      { id: 'job_queue', label: 'Job queue', ok: true, ms: latency('queue', 8, 20), detail: 'Queue idle, 0 waiting' },
    )
  }
  return probes
}

api.register('POST', '/admin/integrations/self-test', ({ body: raw }) => {
  requireOperator()
  const mode = body(raw).mode
  if (mode !== 'quick' && mode !== 'deep') throw DemoApiError.validation({ mode: 'Choose quick or deep.' })
  return runSelfTest(mode === 'deep')
})

/* ------------------------------------------- integrations: transcription */

const CODE_TRANSCRIPTION: TranscriptionSettings = { language_code: null, diarize: true, keyterms: [], audio_format: 'mp3_16k' }
const AUDIO_FORMATS: TranscriptionSettings['audio_format'][] = ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k']
const KEYTERM_MAX = 1000
const KEYTERM_CHARS = 50
const KEYTERM_WORDS = 5

function transcriptionDefault(): TranscriptionDefaultPayload {
  const rec = db().transcriptionConfigs.find((r) => r.client_id === null)
  return {
    settings: { ...CODE_TRANSCRIPTION, ...(rec?.override ?? {}) } as TranscriptionSettings,
    code_default: CODE_TRANSCRIPTION,
    updated_at: rec?.updated_at ?? null,
    updated_by: rec?.updated_by ?? null,
  }
}

api.register('GET', '/admin/transcription/default', () => {
  requireOperator()
  return transcriptionDefault()
})

api.register('PUT', '/admin/transcription/default', ({ body: raw }) => {
  requireOperator()
  const b = body(raw)
  const errors: Record<string, string> = {}
  const lang = b.language_code
  if (lang !== null && lang !== 'ka' && lang !== 'en' && lang !== 'ru') errors.language_code = 'Choose Georgian, English, Russian or automatic.'
  if (!AUDIO_FORMATS.includes(b.audio_format as TranscriptionSettings['audio_format'])) errors.audio_format = 'Choose an audio format.'
  const terms = Array.isArray(b.keyterms) ? b.keyterms.map((x) => String(x).trim()).filter(Boolean) : []
  const unique = [...new Set(terms)]
  if (unique.length > KEYTERM_MAX) errors.keyterms = `At most ${KEYTERM_MAX} key terms.`
  for (const term of unique) {
    if (/[<>{}[\]\\]/.test(term)) {
      errors.keyterms = `"${term}" contains a character that is not allowed.`
      break
    }
    if (term.length > KEYTERM_CHARS || term.split(/\s+/).length > KEYTERM_WORDS) {
      errors.keyterms = `"${term}" is too long (50 characters, 5 words).`
      break
    }
  }
  fail(errors)
  const override: Partial<TranscriptionSettings> = {
    language_code: lang as TranscriptionSettings['language_code'],
    diarize: b.diarize !== false,
    keyterms: unique,
    audio_format: b.audio_format as TranscriptionSettings['audio_format'],
  }
  let rec = db().transcriptionConfigs.find((r) => r.client_id === null)
  if (!rec) {
    rec = { client_id: null, override, updated_at: nowIso(), updated_by: actorName() }
    db().transcriptionConfigs.push(rec)
  } else {
    rec.override = override
    rec.updated_at = nowIso()
    rec.updated_by = actorName()
  }
  store.notify()
  return transcriptionDefault()
})

/* ------------------------------------------------------ chat credentials */

function findIntegration(id: string): Integration {
  const i = db().integrations.find((x) => x.id === id)
  if (!i) throw notFound('Integration not found.')
  return i
}

function grantsOf(raw: unknown, allowed: ChatScope[], errors: Record<string, string>): Integration['grants'] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Integration['grants'] = []
  for (const item of raw) {
    const g = body(item)
    const clientId = text(g.client_id)
    if (!db().tenants.some((t) => t.id === clientId)) {
      errors.grants = 'One of the workspaces does not exist.'
      continue
    }
    if (seen.has(clientId)) continue
    seen.add(clientId)
    out.push({ client_id: clientId, scopes: scopesOf(g.scopes).filter((s) => allowed.includes(s)), is_active: g.is_active !== false })
  }
  return out
}

function checkName(name: string, ignoreId?: string): void {
  if (name.length < 2) throw DemoApiError.validation({ name: 'Give the credential a name.' })
  if (name.length > 60) throw DemoApiError.validation({ name: 'Keep the name under 60 characters.' })
  if (db().integrations.some((i) => i.id !== ignoreId && i.name.toLowerCase() === name.toLowerCase()))
    throw DemoApiError.validation({ name: 'A credential with this name already exists.' })
}

const newSecret = (integration: Integration, label: string): { secret: IntegrationSecret; full: { key_id: string; secret: string } } => {
  const full = `snj_live_${randomToken(36)}`
  const key_id = `snjk_${integration.id.replace(/^int_/, '').slice(0, 4)}_${randomToken(4).toLowerCase()}`
  const secret: IntegrationSecret = {
    key_id,
    label,
    hint: `snj_live_...${full.slice(-4)}`,
    created_at: nowIso(),
    expires_at: null,
    revoked_at: null,
    last_used_at: null,
  }
  integration.secrets.push(secret)
  return { secret, full: { key_id, secret: full } }
}

api.register('GET', '/admin/chat/integrations', () => {
  requireOperator()
  return db().integrations
})

api.register('POST', '/admin/chat/integrations', ({ body: raw }) => {
  requireOperator()
  const b = body(raw)
  const name = text(b.name)
  checkName(name)
  const scopes = scopesOf(b.scopes)
  if (!scopes.length) throw DemoApiError.validation({ scopes: 'Pick at least one scope.' })
  const errors: Record<string, string> = {}
  const grants = grantsOf(b.grants, scopes, errors)
  fail(errors)
  const integration: Integration = {
    id: store.nextId('int_'),
    name,
    kind: 'chat_platform',
    scopes,
    is_active: true,
    created_at: nowIso(),
    grants,
    secrets: [],
  }
  const { full } = newSecret(integration, 'Initial secret')
  db().integrations.push(integration)
  store.notify()
  return { integration, secret: full }
})

api.register('PATCH', '/admin/chat/integrations/:id', ({ path, body: raw }) => {
  requireOperator()
  const i = findIntegration(path.id ?? '')
  const b = body(raw)
  if (typeof b.name === 'string') {
    const name = text(b.name)
    checkName(name, i.id)
    i.name = name
  }
  if (b.scopes !== undefined) {
    const scopes = scopesOf(b.scopes)
    if (!scopes.length) throw DemoApiError.validation({ scopes: 'Pick at least one scope.' })
    i.scopes = scopes
    for (const g of i.grants) g.scopes = g.scopes.filter((s) => scopes.includes(s))
  }
  if (typeof b.is_active === 'boolean') i.is_active = b.is_active
  if (b.grants !== undefined) {
    const errors: Record<string, string> = {}
    i.grants = grantsOf(b.grants, i.scopes, errors)
    fail(errors)
  }
  store.notify()
  return i
})

const OVERLAP_MS = 7 * 86_400_000

api.register('POST', '/admin/chat/integrations/:id/rotate', ({ path, body: raw }) => {
  requireOperator()
  const i = findIntegration(path.id ?? '')
  if (!i.is_active) throw conflict('Activate this credential before rotating its secret.')
  const until = new Date(Date.now() + OVERLAP_MS).toISOString()
  for (const s of i.secrets) {
    if (s.revoked_at) continue
    if (!s.expires_at || Date.parse(s.expires_at) > Date.parse(until)) s.expires_at = until
  }
  const label = text(body(raw).label) || 'Rotated secret'
  const { full } = newSecret(i, label.slice(0, 60))
  store.notify()
  return { integration: i, secret: full, overlap_until: until }
})

api.register('POST', '/admin/chat/integrations/:id/secrets/:keyId/revoke', ({ path }) => {
  requireOperator()
  const i = findIntegration(path.id ?? '')
  const s = i.secrets.find((x) => x.key_id === path.keyId)
  if (!s) throw notFound('Secret not found.')
  if (s.revoked_at) throw conflict('This secret is already revoked.')
  s.revoked_at = nowIso()
  store.notify()
  return i
})

api.register('POST', '/admin/chat/integrations/:id/diagnose', ({ path, body: raw }): DiagnoseResult => {
  requireOperator()
  const i = findIntegration(path.id ?? '')
  const b = body(raw)
  const keyId = text(b.key_id)
  const clientId = text(b.client_id)
  const scope = isScope(b.scope) ? b.scope : null
  const errors: Record<string, string> = {}
  if (!keyId) errors.key_id = 'Enter a key id.'
  if (!clientId) errors.client_id = 'Choose a workspace.'
  fail(errors)
  const tenant = db().tenants.find((t) => t.id === clientId)
  if (!tenant) throw notFound('Workspace not found.')

  const done = (verdict: DiagnoseVerdict, detail: string): DiagnoseResult => ({ verdict, detail })
  const secret = i.secrets.find((s) => s.key_id === keyId)
  if (!secret) return done('unknown_key_id', `No secret with id ${keyId} belongs to ${i.name}.`)
  if (secret.revoked_at) return done('secret_revoked', `${secret.key_id} was revoked.`)
  if (secret.expires_at && Date.parse(secret.expires_at) <= Date.now()) return done('secret_expired', `${secret.key_id} expired.`)
  if (!i.is_active) return done('integration_inactive', `${i.name} is switched off.`)
  const grant = i.grants.find((g) => g.client_id === clientId && g.is_active)
  if (!grant) return done('no_grant', `${i.name} has no active grant for ${tenant.name}.`)
  if (!tenant.is_active) return done('tenant_inactive', `${tenant.name} is deactivated.`)
  const granted = grant.scopes.filter((s) => i.scopes.includes(s))
  if (scope ? !granted.includes(scope) : granted.length === 0) {
    return done('scope_missing', scope ? `The grant for ${tenant.name} does not include ${scope}.` : `The grant for ${tenant.name} has no scopes.`)
  }
  return done('ok', `${secret.key_id} can call ${tenant.name} with ${granted.join(', ')}.`)
})

/* ------------------------------------------------------------- embeddings */

const EMBEDDING_PROVIDERS: EmbeddingsProviderOption[] = [
  { id: 'local', name: 'Self-hosted (OpenAI-compatible)', models: [{ id: 'bge-m3', dim: 1024 }], default_base_url: 'http://embed.sinji.example/v1' },
  { id: 'openai', name: 'OpenAI', models: [{ id: 'text-embedding-3-small', dim: 1536 }, { id: 'text-embedding-3-large', dim: 3072 }], default_base_url: null },
  { id: 'google', name: 'Google Gemini', models: [{ id: 'gemini-embedding-001', dim: 3072 }], default_base_url: null },
]

function embeddingsPayload(): EmbeddingsPayload {
  const e = db().settings.embeddings
  return { ...e, providers: EMBEDDING_PROVIDERS, indexed_chunks: db().kbChunks.filter((c) => c.has_embedding).length }
}

api.register('GET', '/admin/embeddings', () => {
  requireOperator()
  return embeddingsPayload()
})

api.register('PUT', '/admin/embeddings', ({ body: raw }) => {
  requireOperator()
  const b = body(raw)
  const e = db().settings.embeddings
  const errors: Record<string, string> = {}
  const provider = text(b.provider)
  const model = text(b.model)
  const dim = Number(b.dim)
  if (!EMBEDDING_PROVIDERS.some((p) => p.id === provider)) errors.provider = 'Choose a provider.'
  if (!model) errors.model = 'Choose or enter a model.'
  if (!Number.isInteger(dim) || dim < 8 || dim > 8192) errors.dim = 'The dimension is a whole number between 8 and 8192.'
  const base_url = baseUrlOf(b.base_url, errors)
  if (provider === 'local' && !base_url) errors.base_url = 'A self-hosted endpoint needs a base URL.'
  fail(errors)
  if (dim !== e.dim && b.acknowledge_reimport !== true) {
    throw conflict('Changing the dimension makes the stored vectors unusable. Confirm that you will re-import the knowledge base.')
  }
  e.provider = provider
  e.model = model
  e.base_url = base_url
  e.dim = dim
  const key = text(b.api_key)
  if (key) {
    e.api_key_set = true
    e.api_key_hint = maskKey(key)
  } else if (b.clear_key === true) {
    e.api_key_set = false
    e.api_key_hint = null
  }
  store.notify()
  return embeddingsPayload()
})

api.register('POST', '/admin/embeddings/test', ({ body: raw }) => {
  requireOperator()
  const b = body(raw)
  const e = db().settings.embeddings
  const provider = text(b.provider) || e.provider
  const model = text(b.model) || e.model
  const baseUrl = b.base_url === undefined ? e.base_url : text(b.base_url) || null
  const dim = Number(b.dim) || e.dim
  const keyed = e.api_key_set && b.clear_key !== true ? true : Boolean(text(b.api_key))
  return new Promise<{ ok: boolean; detail: string }>((resolve) => {
    setTimeout(() => {
      const ms = latency('emb-test' + model, 140, 360)
      if (provider === 'local' ? !baseUrl : !keyed) return resolve({ ok: false, detail: provider === 'local' ? 'No base URL' : 'no key stored' })
      const known = EMBEDDING_PROVIDERS.find((p) => p.id === provider)?.models.find((m) => m.id === model)
      if (known && known.dim !== dim) return resolve({ ok: false, detail: `Expected ${dim} dimensions, got ${known.dim}` })
      resolve({ ok: true, detail: `Returned a ${dim}-dimension vector in ${ms} ms` })
    }, 1000)
  })
})

/* ---------------------------------------------------------- live traffic */

/**
 * The newest valid secret of each active credential keeps getting used by the
 * web chat service; refresh `last_used_at` so the list looks alive. Pauses
 * while the tab is hidden (demo-kit `every`).
 */
every(15_000, () => {
  const now = nowIso()
  let changed = false
  for (const i of db().integrations) {
    if (!i.is_active) continue
    const live = i.secrets.filter((s) => !s.revoked_at && (!s.expires_at || Date.parse(s.expires_at) > Date.now()))
    const newest = live.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
    if (newest) {
      newest.last_used_at = now
      changed = true
    }
  }
  if (changed) store.notify()
})
