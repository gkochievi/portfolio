/**
 * Mock handlers for the `voice-tools` group: the public voice tools (API status,
 * daily allowances, text to speech, quick transcription, sentiment read and the
 * bulk telephony converter). Registered on import. OWNED BY: voice-tools.
 *
 * Quotas live in `store.data.quotaUsed` (memory only; a reload restores the seed).
 */
import { createRandom, DemoApiError } from '@portfolio/demo-kit'

import type {
  CannedTranscript,
  ContentLang,
  ConversionBatch,
  LimitsConfig,
  LimitsSnapshot,
  QuotaKind,
  Sentiment,
  TtsClip,
  Voice,
} from '@/types'
import { currentAccount } from '../guards'
import { bus, session, store } from '../core'
import { demoEpoch } from '../store'
import { hashString } from '../lib/text'
import { logUsage } from '../lib/usage-log'
import { mockApi as api } from '../api'

const BOOT = Date.now()

/* ----------------------------------------------------------------- quotas */

const principalKey = (): string => session.current()?.id ?? 'guest'
const config = (): LimitsConfig => (session.current() ? store.data.limits.registered : store.data.limits.anonymous)

function used(): Record<QuotaKind, number> {
  const key = principalKey()
  const bucket = (store.data.quotaUsed[key] ??= { analyses: 0, tts: 0, conversions: 0 })
  return bucket
}

const maxOf = (cfg: LimitsConfig): Record<QuotaKind, number> => ({
  analyses: cfg.max_analyses_per_day,
  tts: cfg.max_tts_per_day,
  conversions: cfg.max_conversions_per_day,
})

function snapshot(): LimitsSnapshot {
  const cfg = config()
  const max = maxOf(cfg)
  const u = used()
  return {
    anonymous: !session.current(),
    enabled: cfg.enabled,
    visitor_identified: true,
    max,
    used: { ...u },
    remaining: {
      analyses: Math.max(0, max.analyses - u.analyses),
      tts: Math.max(0, max.tts - u.tts),
      conversions: Math.max(0, max.conversions - u.conversions),
    },
    max_audio_mb: cfg.max_audio_mb,
    features: { ...cfg.features },
  }
}

type FeatureKey = 'analyze' | 'tts' | 'convert'

/** Refuse (403/429) when the tool is off or the daily allowance is spent; otherwise count one use. */
function spend(kind: QuotaKind, feature: FeatureKey, count = 1): void {
  const cfg = config()
  if (!cfg.enabled) throw new DemoApiError(403, 'The public voice tools are switched off for now.')
  if (!cfg.features[feature]) throw new DemoApiError(403, 'This tool is not available on your plan.')
  const u = used()
  if (u[kind] + count > maxOf(cfg)[kind]) {
    throw new DemoApiError(429, 'Daily allowance used up. It renews tomorrow.')
  }
  u[kind] += count
  store.notify()
}

const requireSignedIn = () => currentAccount()

const delay = <T>(ms: number, value: () => T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value()), ms))

/* ----------------------------------------------------------------- health */

api.register('GET', '/public/health', () => ({
  ok: true,
  version: '2.14.0',
  uptime_s: Math.round((Date.now() - BOOT) / 1000) + 86_400 * 6 + 3600 * 5,
}))

api.register('GET', '/public/limits', () => snapshot())

/* -------------------------------------------------------------------- TTS */

function allowedVoices(): Voice[] {
  const { mode, voice_ids } = store.data.settings.voices
  return mode === 'allowlist' ? store.data.voices.filter((v) => voice_ids.includes(v.voice_id)) : store.data.voices
}

api.register('GET', '/public/tts/catalog', () => ({
  languages: store.data.ttsLanguages,
  voices: allowedVoices(),
  models: store.data.ttsModels,
}))

interface TtsBody {
  text?: string
  language_code?: ContentLang
  voice_id?: string
  model_id?: string
  settings?: Record<string, unknown>
}

api.register('POST', '/public/tts', ({ body }) => {
  const input = (body ?? {}) as TtsBody
  const text = (input.text ?? '').trim()
  const errors: Record<string, string> = {}
  if (!text) errors.text = 'Type some text to speak.'
  else if (text.length > 2500) errors.text = 'Text can be at most 2,500 characters.'
  const language = input.language_code
  if (!language || !store.data.ttsLanguages.some((l) => l.code === language)) errors.language_code = 'Choose a language.'
  const voice = allowedVoices().find((v) => v.voice_id === input.voice_id)
  if (!voice) errors.voice_id = 'Choose a voice.'
  else if (language && voice.language !== language) errors.voice_id = 'This voice does not speak the chosen language.'
  const model = store.data.ttsModels.find((m) => m.model_id === input.model_id)
  if (!model) errors.model_id = 'Choose a model.'
  else if (language && !model.supports.includes(language)) errors.model_id = 'This model does not support the chosen language.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)

  spend('tts', 'tts')
  const v = voice as Voice
  const pool = store.data.ttsClips.filter((c) => c.voice_id === v.voice_id)
  const exact = pool.find((c) => c.text.trim() === text)
  const picked = exact ?? pool[hashString(text) % Math.max(1, pool.length)]
  const clip: TtsClip = {
    id: store.nextId('clip_'),
    text,
    language_code: language as ContentLang,
    voice_id: v.voice_id,
    model_id: (model as { model_id: string }).model_id,
    audio_url: picked?.audio_url ?? v.preview_url,
    duration_s: picked?.duration_s ?? Math.min(24, Math.max(2.5, Math.round(text.length * 0.068 * 10) / 10)),
    created_at: new Date().toISOString(),
  }
  logUsage({
    feature: 'tts',
    group: 'voice',
    capability: 'tts',
    characters: text.length,
    provider: 'sinji-voice',
    model: clip.model_id,
    latency_ms: 700,
  })
  return clip
})

/* ------------------------------------------- transcription and sentiment */

interface AudioBody {
  name?: string
  size?: number
  /** Index into the canned transcripts (the "use a sample" button). */
  sample?: number
  canned_id?: string
}

function checkAudio(input: AudioBody): void {
  const errors: Record<string, string> = {}
  if (!input.name) errors.name = 'Choose an audio file or record one.'
  const maxBytes = config().max_audio_mb * 1024 * 1024
  if ((input.size ?? 0) > maxBytes) errors.size = `The file is larger than ${config().max_audio_mb} MB.`
  if ((input.size ?? 0) <= 0 && !input.sample && input.sample !== 0 && !input.canned_id) errors.size = 'The file is empty.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)
}

function pickCanned(input: AudioBody): CannedTranscript {
  const list = store.data.cannedTranscripts
  if (input.canned_id) {
    const hit = list.find((c) => c.id === input.canned_id)
    if (hit) return hit
  }
  if (typeof input.sample === 'number') return list[((input.sample % list.length) + list.length) % list.length] as CannedTranscript
  return list[hashString(`${input.name ?? ''}${input.size ?? 0}`) % list.length] as CannedTranscript
}

api.register('POST', '/public/transcribe', ({ body }) => {
  requireSignedIn()
  const input = (body ?? {}) as AudioBody
  checkAudio(input)
  spend('analyses', 'analyze')
  const canned = pickCanned(input)
  const wait = 1000 + Math.round(Math.random() * 2000)
  return delay(wait, () => {
    logUsage({
      feature: 'transcribe',
      group: 'transcription',
      capability: 'stt',
      provider: 'sinji-stt',
      model: 'sinji-listen-2',
      audio_seconds: canned.duration_s,
      latency_ms: wait,
    })
    return {
      id: store.nextId('tr_'),
      name: input.name,
      language: canned.language,
      duration_s: canned.duration_s,
      transcript: canned.transcript,
      model: 'sinji-listen-2',
      processing_ms: wait,
    }
  })
})

api.register('POST', '/public/sentiment', ({ body }) => {
  requireSignedIn()
  if (!store.data.settings.public_sentiment.enabled) {
    throw new DemoApiError(403, 'The public sentiment read is switched off.')
  }
  const input = (body ?? {}) as AudioBody
  checkAudio(input)
  spend('analyses', 'analyze')
  const canned = pickCanned(input)
  const wait = 1200 + Math.round(Math.random() * 1800)
  return delay(wait, () => {
    logUsage({
      feature: 'voice_tone',
      group: 'tone',
      capability: 'voice_tone',
      provider: 'sinji-voice',
      model: 'sinji-prosody-1',
      audio_seconds: canned.duration_s,
      latency_ms: wait,
    })
    return {
      id: store.nextId('sn_'),
      name: input.name,
      language: canned.language,
      duration_s: canned.duration_s,
      transcript: canned.transcript,
      sentiment: canned.sentiment as Sentiment,
      guidance: store.data.settings.public_sentiment.guidance,
    }
  })
})

/* -------------------------------------------------------------- converter */

api.register('GET', '/public/convert/formats', () => ({
  formats: store.data.convertFormats,
  limits: store.data.convertLimits,
}))

interface BatchBody {
  format?: string
  files?: Array<{ name?: string; bytes?: number }>
}

const FAILURES = [
  'The file ends before the audio header is complete.',
  'The audio stream uses a codec this converter cannot read.',
  'The file is empty or contains only silence.',
]

api.register('POST', '/public/convert/batches', ({ body }) => {
  const input = (body ?? {}) as BatchBody
  const limits = store.data.convertLimits
  const files = (input.files ?? []).filter((f) => f && f.name)
  const errors: Record<string, string> = {}
  if (!store.data.convertFormats.some((f) => f.id === input.format)) errors.format = 'Choose a target format.'
  if (!files.length) errors.files = 'Add at least one file.'
  else if (files.length > limits.max_files) errors.files = `At most ${limits.max_files} files per batch.`
  else if (files.some((f) => (f.bytes ?? 0) > limits.max_file_bytes)) errors.files = 'One of the files is larger than the per-file limit.'
  else if (files.reduce((sum, f) => sum + (f.bytes ?? 0), 0) > limits.max_batch_bytes) errors.files = 'The batch is larger than the total limit.'
  if (Object.keys(errors).length) throw DemoApiError.validation(errors)

  spend('conversions', 'convert')
  const id = store.nextId('cvb_')
  const batch: ConversionBatch = {
    id,
    token: `cvt_${Math.abs(hashString(id + Date.now())).toString(16).padStart(8, '0')}${Math.random().toString(16).slice(2, 6)}`,
    format: input.format as string,
    rows: files.map((f, index) => ({ index, name: f.name as string, bytes: f.bytes ?? 0, state: 'queued', error: null })),
    file_count: files.length,
    ok: 0,
    failed: 0,
    total_bytes: files.reduce((sum, f) => sum + (f.bytes ?? 0), 0),
    state: 'running',
    created_at: new Date().toISOString(),
    expires_at: null,
  }
  store.data.conversionBatches.unshift(batch)
  store.notify()
  runBatch(id)
  return structuredClone(batch)
})

const find = (id: string): ConversionBatch | undefined => store.data.conversionBatches.find((b) => b.id === id)

/** Stream frames: each row goes queued -> converting -> done|failed, one frame every 400-800 ms. */
function runBatch(id: string): void {
  const epoch = demoEpoch()
  const rnd = createRandom(id)
  // ~10% failures, but a single-file batch only fails rarely so the happy path is easy to show.
  let step = 0
  const frames: Array<() => void> = []
  const batch = find(id)
  if (!batch) return
  const total = batch.rows.length
  for (let i = 0; i < total; i += 1) {
    frames.push(() => {
      const row = find(id)?.rows[i]
      if (row) row.state = 'converting'
    })
    frames.push(() => {
      const current = find(id)
      const row = current?.rows[i]
      if (!current || !row) return
      const fail = total > 1 ? rnd.chance(0.1) : rnd.chance(0.04)
      row.state = fail ? 'failed' : 'done'
      row.error = fail ? rnd.pick(FAILURES) : null
      current.ok = current.rows.filter((r) => r.state === 'done').length
      current.failed = current.rows.filter((r) => r.state === 'failed').length
    })
  }
  frames.push(() => {
    const current = find(id)
    if (!current) return
    current.state = 'done'
    current.expires_at = new Date(Date.now() + store.data.convertLimits.download_ttl_seconds * 1000).toISOString()
  })
  const tick = () => {
    if (epoch !== demoEpoch()) return
    const frame = frames[step]
    if (!frame) return
    frame()
    step += 1
    store.notify()
    const current = find(id)
    if (current) bus.emit('convert:progress', { batch: structuredClone(current) })
    if (step < frames.length) setTimeout(tick, 400 + Math.round(Math.random() * 400))
  }
  setTimeout(tick, 400 + Math.round(Math.random() * 400))
}

api.register('GET', '/public/convert/batches/:id', ({ path }) => {
  const batch = find(path.id ?? '')
  if (!batch) throw new DemoApiError(404, 'This conversion was not found or has expired.')
  return structuredClone(batch)
})
