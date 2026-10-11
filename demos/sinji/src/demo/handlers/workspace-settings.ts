/**
 * Mock handlers for the `workspace-settings` group: rubric + score bands,
 * sentiment, transcription, own AI keys and the operator's global default
 * rubric. OWNED BY: workspace-settings.
 *
 * Inheritance is plain object spread (code < operator default < workspace <
 * per-file); every write needs workspace-editor rights (members read).
 */
import { DemoApiError, forbidden, notFound } from '@portfolio/demo-kit'

import { checkKeytermList } from '@/features/workspace-settings/lib/keyterms'
import { DEFAULT_BANDS, normaliseWeights, validateRubric, weightSum } from '@/lib/scoring'
import type {
  AiByoOverride,
  AiCapability,
  AiEffective,
  AiProviderEntry,
  AudioFormat,
  ContentLang,
  Id,
  RubricDimension,
  RubricImportJob,
  RubricSource,
  ScoreBands,
  ScoringConfig,
  SentimentConfig,
  TranscriptionConfigView,
  TranscriptionSettings,
} from '@/types'
import { api, store } from '../core'
import { DEMO_PASSWORD } from '../accounts'
import { actorName, canEditWorkspace, currentAccount, requireOperator, requireWorkspaceEditor, tenantScope } from '../guards'
import { seed } from '../seed'
import { demoEpoch } from '../store'

const nowIso = () => new Date().toISOString()
const db = () => store.data
const CAPABILITIES: AiCapability[] = ['llm', 'stt', 'tts']

const asRecord = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {})

/* ------------------------------------------------------------------ rubric */

const defaultConfig = (): ScoringConfig => {
  const found = db().scoringConfigs.find((c) => c.client_id === null)
  if (!found) throw notFound('The default rubric is missing.')
  return found
}

const ownConfig = (tenantId: Id): ScoringConfig | undefined => db().scoringConfigs.find((c) => c.client_id === tenantId)

/** What the workspace is scored with: its own rubric, else the shared default. */
function effectiveConfig(tenantId: Id): ScoringConfig {
  const own = ownConfig(tenantId)
  if (own) return own
  return { ...defaultConfig(), is_default: true }
}

const SOURCES: RubricSource[] = ['model', 'factcheck', 'sentiment']

/** Normalise the dimension list from a request body. Measured dimensions keep everything but their weight. */
function readDimensions(raw: unknown, base: readonly RubricDimension[]): RubricDimension[] {
  if (!Array.isArray(raw)) throw DemoApiError.validation({ dimensions: ['empty'] })
  const used = new Set<string>()
  return raw.map((item, index) => {
    const d = asRecord(item)
    const source = SOURCES.includes(d.source as RubricSource) ? (d.source as RubricSource) : 'model'
    let key = typeof d.key === 'string' && d.key.trim() ? d.key.trim() : `dim_${index + 1}`
    if (used.has(key)) key = `${key}_${index + 1}`
    used.add(key)
    const weight = Number(d.weight)
    const incoming: RubricDimension = {
      key,
      name: typeof d.name === 'string' ? d.name.trim() : '',
      description: typeof d.description === 'string' ? d.description : '',
      guidance: typeof d.guidance === 'string' ? d.guidance : '',
      weight: Number.isFinite(weight) ? Math.round(weight * 10) / 10 : 0,
      source,
      ...(typeof d.name_en === 'string' && d.name_en.trim() ? { name_en: d.name_en.trim() } : {}),
      ...(typeof d.description_en === 'string' && d.description_en.trim() ? { description_en: d.description_en.trim() } : {}),
    }
    if (source !== 'model') {
      const ref = base.find((b) => b.key === key) ?? seedMeasured(key)
      if (ref) return { ...ref, weight: incoming.weight }
    }
    return incoming
  })
}

const seedMeasured = (key: string): RubricDimension | undefined => {
  const cfg = seed.scoringConfigs.find((c) => c.client_id === null)
  return cfg?.dimensions.find((d) => d.key === key && d.source !== 'model')
}

function assertValid(dimensions: RubricDimension[]): void {
  const errors = validateRubric(dimensions)
  if (errors.length) throw DemoApiError.validation({ dimensions: errors })
}

const readRubricText = (raw: unknown): string => (typeof raw === 'string' ? raw : '')

interface RubricPayload extends ScoringConfig {
  can_edit: boolean
  default_version: number
}

const rubricPayload = (tenantId: Id): RubricPayload => ({
  ...effectiveConfig(tenantId),
  can_edit: canEditWorkspace(),
  default_version: defaultConfig().version,
})

api.register('GET', '/settings/rubric', () => rubricPayload(tenantScope()))

api.register('PUT', '/settings/rubric', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = asRecord(body)
  const current = effectiveConfig(tenantId)
  const dimensions = readDimensions(input.dimensions, current.dimensions)
  assertValid(dimensions)
  const rubric = readRubricText(input.rubric)
  const own = ownConfig(tenantId)
  if (own) {
    own.dimensions = dimensions
    own.rubric = rubric
    own.version = own.version + 1
    own.is_default = false
    own.updated_at = nowIso()
    own.updated_by = actorName()
  } else {
    db().scoringConfigs.push({
      id: `rub_${tenantId.replace(/^tn_/, '')}`,
      client_id: tenantId,
      version: defaultConfig().version + 1,
      dimensions,
      rubric,
      is_default: false,
      updated_at: nowIso(),
      updated_by: actorName(),
    })
  }
  store.notify()
  return rubricPayload(tenantId)
})

api.register('POST', '/settings/rubric/reset', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const password = asRecord(body).password
  if (typeof password !== 'string' || password !== DEMO_PASSWORD) {
    throw forbidden('Wrong password. The rubric was not reset.')
  }
  const index = db().scoringConfigs.findIndex((c) => c.client_id === tenantId)
  if (index >= 0) db().scoringConfigs.splice(index, 1)
  store.notify()
  return rubricPayload(tenantId)
})

/* --------------------------------------------------------- AI rubric import */

const IMPORT_TIMELINE = { upload: 1200, queued: 700, extracting: 1300, analysing: 1800 }

interface DraftSeed {
  key: string
  name: string
  name_en: string
  description: string
  description_en: string
  guidance: string
  weight: number
}

const IMPORT_DRAFT: DraftSeed[] = [
  {
    key: 'greeting',
    name: 'მისალმება და წარდგენა',
    name_en: 'Greeting and introduction',
    description: 'ოპერატორი მოიკითხავს, წარადგენს კომპანიას და საკუთარ თავს.',
    description_en: 'The agent greets, names the company and introduces themselves.',
    guidance: 'სრული მისალმება სახელით: 90+. მისალმების გარეშე: 50-ზე ნაკლები.',
    weight: 10,
  },
  {
    key: 'needs',
    name: 'მოთხოვნის გარკვევა',
    name_en: 'Clarifying the request',
    description: 'დამაზუსტებელი კითხვები სანამ პასუხი გაიცემა; მომხმარებლის სიტყვების გამეორება.',
    description_en: 'Asks clarifying questions before answering and plays the request back.',
    guidance: 'ორი და მეტი დაზუსტება: 85+. ვარაუდით პასუხი: მაქსიმუმ 60.',
    weight: 15,
  },
  {
    key: 'accuracy',
    name: 'ინფორმაციის სისწორე',
    name_en: 'Accuracy of information',
    description: 'ტარიფები, ვადები და პირობები ემთხვევა ცოდნის ბაზას.',
    description_en: 'Rates, deadlines and terms match the knowledge base.',
    guidance: 'ერთი უზუსტობა: მაქსიმუმ 70. შეცდომაში შეყვანა: მაქსიმუმ 40.',
    weight: 20,
  },
  {
    key: 'empathy',
    name: 'ემპათია და მოსმენა',
    name_en: 'Empathy and listening',
    description: 'ოპერატორი აღიარებს მომხმარებლის განცდას და არ აწყვეტინებს.',
    description_en: 'Acknowledges how the customer feels and does not interrupt.',
    guidance: 'მკაფიო თანაგრძნობა: 85+. გაწყვეტინება: მაქსიმუმ 60.',
    weight: 15,
  },
  {
    key: 'resolution',
    name: 'გადაწყვეტა და შემდეგი ნაბიჯი',
    name_en: 'Resolution and next step',
    description: 'საკითხი გადაწყდა ან მომხმარებელმა იცის რა მოხდება შემდეგ და როდის.',
    description_en: 'Solved, or the customer knows what happens next and when.',
    guidance: 'გადაწყდა ზარზე: 90+. მკაფიო ვადა: 70. ღია დარჩა: 50-ზე ნაკლები.',
    weight: 20,
  },
  {
    key: 'compliance',
    name: 'პროცედურის დაცვა',
    name_en: 'Procedure and compliance',
    description: 'იდენტიფიკაცია, სავალდებულო გაფრთხილებები და შიდა წესები დაცულია.',
    description_en: 'Identity check, mandatory disclosures and internal rules are followed.',
    guidance: 'იდენტიფიკაციის გამოტოვება: მაქსიმუმ 40.',
    weight: 10,
  },
  {
    key: 'closing',
    name: 'დამშვიდობება და შეჯამება',
    name_en: 'Closing and recap',
    description: 'შეთანხმებულის შეჯამება და მადლობა ზარისთვის.',
    description_en: 'Recaps what was agreed and thanks the customer.',
    guidance: 'შეჯამების გარეშე: მაქსიმუმ 70.',
    weight: 10,
  },
]

function buildDraft(tenantId: Id, filename: string): NonNullable<RubricImportJob['draft']> {
  const measured = effectiveConfig(tenantId).dimensions.filter((d) => d.source !== 'model')
  const target = Math.max(0, 100 - weightSum(measured))
  const scaled = normaliseWeights(IMPORT_DRAFT.map((d) => ({ weight: d.weight }))).map((d) => Math.round((d.weight * target) / 100))
  scaled[scaled.length - 1] = (scaled[scaled.length - 1] ?? 0) + (target - scaled.reduce((a, b) => a + b, 0))
  const model: RubricDimension[] = IMPORT_DRAFT.map((d, i) => ({
    key: d.key,
    name: d.name,
    name_en: d.name_en,
    description: d.description,
    description_en: d.description_en,
    guidance: d.guidance,
    weight: scaled[i] ?? 0,
    source: 'model',
  }))
  return {
    dimensions: [...model, ...measured.map((d) => ({ ...d }))],
    rubric:
      'შეაფასე ოპერატორი და არა მომხმარებელი. ყოველი ქულა დაასაბუთე ციტატით ზარიდან. ' +
      'პასუხები შეადარე სამუშაო სივრცის ცოდნის ბაზას. თუ კრიტერიუმი ამ ზარს არ ეხება, დატოვე შეუფასებელი. ' +
      `(შედგენილია დოკუმენტიდან: ${filename})`,
  }
}

function runImport(jobId: Id, tenantId: Id, filename: string): void {
  const epoch = demoEpoch()
  const find = () => (demoEpoch() === epoch ? db().rubricImportJobs.find((j) => j.id === jobId) : undefined)
  const set = (patch: Partial<RubricImportJob>) => {
    const job = find()
    if (!job) return false
    Object.assign(job, patch)
    store.notify()
    return true
  }
  const ramp = (stage: RubricImportJob['stage'], ms: number, then: () => void) => {
    const steps = 6
    let n = 0
    const tick = () => {
      n += 1
      if (!set({ stage, progress: Math.min(100, Math.round((n / steps) * 100)) })) return
      if (n < steps) setTimeout(tick, ms / steps)
      else then()
    }
    setTimeout(tick, ms / steps)
  }
  ramp('uploading', IMPORT_TIMELINE.upload, () => {
    set({ stage: 'queued', progress: 0 })
    setTimeout(() => {
      if (!set({ stage: 'extracting', progress: 0 })) return
      setTimeout(() => {
        if (!set({ stage: 'analysing', progress: 0 })) return
        ramp('analysing', IMPORT_TIMELINE.analysing, () => {
          set({ stage: 'done', progress: 100, draft: buildDraft(tenantId, filename) })
        })
      }, IMPORT_TIMELINE.extracting)
    }, IMPORT_TIMELINE.queued)
  })
}

api.register('POST', '/settings/rubric/import', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = asRecord(body)
  const filename = typeof input.filename === 'string' && input.filename.trim() ? input.filename.trim() : 'document'
  const size = Number(input.size)
  if (!Number.isFinite(size) || size <= 0) throw DemoApiError.validation({ file: 'The file is empty.' })
  if (size > 10 * 1024 * 1024) throw DemoApiError.validation({ file: 'The file is larger than 10 MB.' })
  const job: RubricImportJob = { id: store.nextId('rij_'), stage: 'uploading', progress: 0, draft: null, error: null }
  db().rubricImportJobs.push(job)
  runImport(job.id, tenantId, filename)
  return job
})

api.register('GET', '/settings/rubric/import/:jobId', ({ path }) => {
  requireWorkspaceEditor()
  const job = db().rubricImportJobs.find((j) => j.id === path.jobId)
  if (!job) throw notFound('Import job not found.')
  return job
})

/* ------------------------------------------------------------------ bands */

const bandsFor = (tenantId: Id): ScoreBands => db().scoreBands[tenantId] ?? { ...DEFAULT_BANDS }

api.register('GET', '/settings/bands', () => bandsFor(tenantScope()))

api.register('PUT', '/settings/bands', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = asRecord(body)
  const amber = Number(input.amber_from)
  const green = Number(input.green_from)
  const errors: Record<string, string> = {}
  if (!Number.isInteger(amber) || amber < 1 || amber > 99) errors.amber_from = 'Enter a whole number from 1 to 99.'
  if (!Number.isInteger(green) || green < 2 || green > 100) errors.green_from = 'Enter a whole number from 2 to 100.'
  if (!errors.amber_from && !errors.green_from && amber >= green) errors.green_from = 'Green must start above amber.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
  db().scoreBands[tenantId] = { amber_from: amber, green_from: green }
  store.notify()
  return bandsFor(tenantId)
})

api.register('DELETE', '/settings/bands', () => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  db().scoreBands[tenantId] = { ...DEFAULT_BANDS }
  store.notify()
  return bandsFor(tenantId)
})

/* --------------------------------------------------------------- sentiment */

const warming = new Map<Id, number>()

/** The voice-tone service takes a few seconds to warm up after it is switched on. */
function scheduleWarmUp(tenantId: Id): void {
  if (warming.has(tenantId)) return
  const epoch = demoEpoch()
  const handle = window.setTimeout(() => {
    warming.delete(tenantId)
    if (demoEpoch() !== epoch) return
    const cfg = db().sentimentConfigs.find((c) => c.client_id === tenantId)
    if (cfg && cfg.enabled && cfg.voice_tone === 'warming') {
      cfg.voice_tone = 'ok'
      store.notify()
    }
  }, 6000)
  warming.set(tenantId, handle)
}

function sentimentFor(tenantId: Id): SentimentConfig {
  let cfg = db().sentimentConfigs.find((c) => c.client_id === tenantId)
  if (!cfg) {
    cfg = { client_id: tenantId, enabled: true, guidance: '', voice_tone: 'ok', updated_at: nowIso(), updated_by: null }
    db().sentimentConfigs.push(cfg)
  }
  if (cfg.enabled && cfg.voice_tone === 'warming') scheduleWarmUp(tenantId)
  return cfg
}

api.register('GET', '/settings/sentiment', () => sentimentFor(tenantScope()))

api.register('PUT', '/settings/sentiment', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = asRecord(body)
  const cfg = sentimentFor(tenantId)
  const enabled = Boolean(input.enabled)
  const guidance = typeof input.guidance === 'string' ? input.guidance : ''
  if (guidance.length > 2000) throw DemoApiError.validation({ guidance: 'Guidance is limited to 2000 characters.' })
  const wasEnabled = cfg.enabled
  cfg.enabled = enabled
  cfg.guidance = guidance
  if (!enabled) cfg.voice_tone = 'disabled'
  else if (!wasEnabled || cfg.voice_tone === 'disabled') {
    cfg.voice_tone = 'warming'
    scheduleWarmUp(tenantId)
  }
  cfg.updated_at = nowIso()
  cfg.updated_by = actorName()
  store.notify()
  return cfg
})

/* ----------------------------------------------------------- transcription */

const CODE_DEFAULTS: TranscriptionSettings = { language_code: null, diarize: true, keyterms: [], audio_format: 'original' }
const FORMATS: AudioFormat[] = ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k']
const LANGS: ContentLang[] = ['ka', 'en', 'ru']

function transcriptionView(tenantId: Id): TranscriptionConfigView {
  const layers = db().transcriptionConfigs
  const operator = layers.find((c) => c.client_id === null)
  const tenant = layers.find((c) => c.client_id === tenantId)
  const operatorOverride = operator?.override ?? {}
  const inherited = {
    ...CODE_DEFAULTS,
    ...operatorOverride,
    source: Object.keys(operatorOverride).length ? ('operator' as const) : ('code' as const),
  }
  const { source: _source, ...inheritedValues } = inherited
  return {
    effective: { ...inheritedValues, ...(tenant?.override ?? {}) },
    inherited,
    override: tenant ? { ...tenant.override } : null,
    is_default: !tenant,
    can_edit: canEditWorkspace(),
    updated_at: tenant?.updated_at ?? null,
    updated_by: tenant?.updated_by ?? null,
  }
}

api.register('GET', '/settings/transcription', () => transcriptionView(tenantScope()))

api.register('PUT', '/settings/transcription', ({ body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const input = asRecord(body)
  const override: Partial<TranscriptionSettings> = {}
  const errors: Record<string, string> = {}

  if ('language_code' in input) {
    const lang = input.language_code
    if (lang === null || lang === '') override.language_code = null
    else if (LANGS.includes(lang as ContentLang)) override.language_code = lang as ContentLang
    else errors.language_code = 'Choose auto, Georgian, English or Russian.'
  }
  if ('diarize' in input) override.diarize = Boolean(input.diarize)
  if ('audio_format' in input) {
    if (FORMATS.includes(input.audio_format as AudioFormat)) override.audio_format = input.audio_format as AudioFormat
    else errors.audio_format = 'Unknown audio format.'
  }
  if ('keyterms' in input) {
    const raw = Array.isArray(input.keyterms) ? input.keyterms.filter((k): k is string => typeof k === 'string') : []
    const check = checkKeytermList(raw)
    if (!check.valid) {
      errors.keyterms = check.tooMany
        ? 'At most 1000 keyterms.'
        : check.lineErrors.map((e) => `Line ${e.line}: ${e.issue === 'too_long' ? 'under 50 characters' : 'at most 5 words'}`).join('; ')
    } else override.keyterms = check.terms
  }
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)

  const layers = db().transcriptionConfigs
  const existing = layers.find((c) => c.client_id === tenantId)
  if (existing) {
    existing.override = override
    existing.updated_at = nowIso()
    existing.updated_by = actorName()
  } else {
    layers.push({ client_id: tenantId, override, updated_at: nowIso(), updated_by: actorName() })
  }
  store.notify()
  return transcriptionView(tenantId)
})

api.register('DELETE', '/settings/transcription', () => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const layers = db().transcriptionConfigs
  const index = layers.findIndex((c) => c.client_id === tenantId)
  if (index >= 0) layers.splice(index, 1)
  store.notify()
  return transcriptionView(tenantId)
})

/* -------------------------------------------------------------- own AI keys */

interface AiCapabilityView {
  capability: AiCapability
  effective: AiEffective
  /** What applies when there is no own key (the assigned or default connection). */
  fallback: AiEffective
  override: AiByoOverride | null
}

const providerOf = (id: string): AiProviderEntry | undefined => db().aiProviders.find((p) => p.id === id)

function inheritedEffective(tenantId: Id, capability: AiCapability): AiEffective {
  const legacy = capability === 'llm' ? db().aiLegacy.find((l) => l.client_id === tenantId && l.enabled && l.has_key) : undefined
  if (legacy) {
    return { capability, source: 'legacy', connection_id: null, name: 'Legacy workspace key', provider: legacy.provider, model: legacy.model }
  }
  const assignedId = db().aiAssignments.find((a) => a.client_id === tenantId && a.capability === capability)?.connection_id
  const assigned = assignedId ? db().aiConnections.find((c) => c.id === assignedId && c.is_active) : undefined
  if (assigned) {
    return { capability, source: 'assigned', connection_id: assigned.id, name: assigned.name, provider: assigned.provider, model: assigned.model }
  }
  const fallback = db().aiConnections.find((c) => c.capability === capability && c.is_default && c.is_active)
  if (fallback) {
    return { capability, source: 'default', connection_id: fallback.id, name: fallback.name, provider: fallback.provider, model: fallback.model }
  }
  return { capability, source: 'default', connection_id: null, name: '', provider: '', model: '' }
}

function aiView(tenantId: Id, capability: AiCapability): AiCapabilityView {
  const override = db().aiByo.find((o) => o.client_id === tenantId && o.capability === capability) ?? null
  const fallback = inheritedEffective(tenantId, capability)
  const effective: AiEffective =
    override && override.enabled && override.has_key
      ? {
          capability,
          source: 'byo',
          connection_id: null,
          name: 'Own key',
          provider: override.provider,
          model: override.model,
        }
      : fallback
  return { capability, effective, fallback, override: override ? { ...override } : null }
}

const aiPayload = (tenantId: Id) => ({
  providers: db().aiProviders,
  capabilities: CAPABILITIES.map((cap) => aiView(tenantId, cap)),
  can_edit: canEditWorkspace(),
})

function readCapability(raw: unknown): AiCapability {
  if (CAPABILITIES.includes(raw as AiCapability)) return raw as AiCapability
  throw notFound('Unknown capability.')
}

api.register('GET', '/settings/ai', () => aiPayload(tenantScope()))

api.register('PUT', '/settings/ai/:capability', ({ path, body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const capability = readCapability(path.capability)
  const input = asRecord(body)
  const errors: Record<string, string> = {}

  const provider = typeof input.provider === 'string' ? providerOf(input.provider) : undefined
  if (!provider) errors.provider = 'Choose a provider.'
  else if (!provider.capabilities.includes(capability)) errors.provider = 'This provider does not offer this capability.'
  const model = typeof input.model === 'string' ? input.model.trim() : ''
  if (!model) errors.model = 'Choose a model.'
  const notes = typeof input.notes === 'string' ? input.notes : ''
  if (notes.length > 500) errors.notes = 'Notes are limited to 500 characters.'
  const enabled = Boolean(input.enabled)
  const apiKey = typeof input.api_key === 'string' ? input.api_key.trim() : ''
  if (apiKey && apiKey.length < 8) errors.api_key = 'That key looks too short.'

  const existing = db().aiByo.find((o) => o.client_id === tenantId && o.capability === capability)
  const hasKey = Boolean(apiKey) || Boolean(existing?.has_key)
  if (enabled && !hasKey && !errors.api_key) errors.api_key = 'Add a key before switching the override on.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)

  const next: AiByoOverride = {
    client_id: tenantId,
    capability,
    provider: provider!.id,
    model,
    has_key: hasKey,
    key_hint: apiKey ? `••••${apiKey.slice(-4).toUpperCase()}` : (existing?.key_hint ?? null),
    enabled,
    notes,
    updated_at: nowIso(),
  }
  if (existing) Object.assign(existing, next)
  else db().aiByo.push(next)
  store.notify()
  return aiView(tenantId, capability)
})

api.register('DELETE', '/settings/ai/:capability', ({ path, body }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const capability = readCapability(path.capability)
  const index = db().aiByo.findIndex((o) => o.client_id === tenantId && o.capability === capability)
  if (index < 0) throw notFound('There is no override to remove.')
  if (asRecord(body).key_only) {
    const override = db().aiByo[index]!
    override.has_key = false
    override.key_hint = null
    override.enabled = false
    override.updated_at = nowIso()
  } else {
    db().aiByo.splice(index, 1)
  }
  store.notify()
  return aiView(tenantId, capability)
})

api.register('POST', '/settings/ai/:capability/test', ({ path }) => {
  requireWorkspaceEditor()
  const tenantId = tenantScope()
  const capability = readCapability(path.capability)
  const epoch = demoEpoch()
  return new Promise((resolve) => {
    setTimeout(() => {
      const override = demoEpoch() === epoch ? db().aiByo.find((o) => o.client_id === tenantId && o.capability === capability) : undefined
      if (!override?.has_key) {
        resolve({ ok: false, detail: 'no key stored', latency_ms: null })
        return
      }
      const latency = 480 + ((override.model.length * 97 + capability.length * 31) % 700)
      resolve({ ok: true, detail: `Responded in ${latency} ms`, latency_ms: latency })
    }, 1000)
  })
})

/* ------------------------------------------------------- operator default */

const isBuiltIn = (cfg: ScoringConfig): boolean => {
  const pristine = seed.scoringConfigs.find((c) => c.client_id === null)
  if (!pristine) return false
  return (
    pristine.version === cfg.version &&
    pristine.rubric === cfg.rubric &&
    JSON.stringify(pristine.dimensions) === JSON.stringify(cfg.dimensions)
  )
}

const defaultPayload = () => {
  const cfg = defaultConfig()
  return { ...cfg, source: isBuiltIn(cfg) ? ('built-in' as const) : ('saved' as const), can_edit: true }
}

api.register('GET', '/admin/rubric/default', () => {
  requireOperator()
  return defaultPayload()
})

api.register('PUT', '/admin/rubric/default', ({ body }) => {
  requireOperator()
  currentAccount()
  const input = asRecord(body)
  const cfg = defaultConfig()
  const dimensions = readDimensions(input.dimensions, cfg.dimensions)
  assertValid(dimensions)
  cfg.dimensions = dimensions
  cfg.rubric = readRubricText(input.rubric)
  cfg.version += 1
  cfg.is_default = true
  cfg.updated_at = nowIso()
  cfg.updated_by = actorName()
  store.notify()
  return defaultPayload()
})
