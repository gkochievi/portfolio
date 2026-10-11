/**
 * Mock handlers for the `workbench` group: the recordings list, the upload
 * pipeline (upload -> transcribing -> ready), pasted-text calls, the analyser
 * simulator (fact-check, tone, score, call summary) and deletion.
 * OWNED BY: workbench.
 */
import { DemoApiError, forbidden, notFound } from '@portfolio/demo-kit'

import { computeTotals, factcheckAccuracy } from '@/lib/scoring'
import type {
  Analyser,
  CallAnalysis,
  CannedCall,
  Claim,
  ContentLang,
  FactCheck,
  Id,
  KbChunk,
  Recording,
  RecordingRow,
  ScoreDimension,
  ScoreRevision,
  Scorecard,
  Segment,
  SegmentTone,
  Semantic,
  Sentiment,
  SpeakerTone,
  SpanLevel,
  TextTone,
  TranscriptionSettings,
  Verdict,
} from '@/types'
import { bus, store } from '../core'
import { actorName, requireRole, tenantScope } from '../guards'
import { estimateTokens, hashString, rankByText, snippetFor, tokenize } from '../lib/text'
import { logUsage } from '../lib/usage-log'
import { demoEpoch } from '../store'
import { api } from '../api'

/* ------------------------------------------------------------------ utils */

type RunKey = Analyser | 'summary'
const RUN_KEYS: RunKey[] = ['transcribe', 'factcheck', 'score', 'semantic', 'summary']
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|amr|wma|webm|mp4|3gp|gsm|g722)$/i
const MB = 1024 * 1024
const MAX_FILES = 10
const MAX_FILE = 100 * MB
const MAX_TOTAL = 300 * MB

const clone = <T>(value: T): T => structuredClone(value)
const nowIso = () => new Date().toISOString()
const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}...` : text)
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const isKa = (lang: ContentLang | null | undefined) => lang === 'ka'

function recordingsOfTenant(): Recording[] {
  const tenant = tenantScope()
  return store.data.recordings.filter((r) => r.client_id === tenant)
}

function findRecording(id: Id): Recording {
  const rec = recordingsOfTenant().find((r) => r.id === id)
  if (!rec) throw notFound()
  return rec
}

function toRow(r: Recording): RecordingRow {
  return {
    id: r.id,
    client_id: r.client_id,
    filename: r.filename,
    source: r.source,
    status: r.status,
    language: r.language,
    duration_s: r.duration_s,
    ran: r.ran,
    running: r.running,
    created_by: r.created_by,
    created_at: r.created_at,
    score: r.scoring?.weighted_total ?? null,
    accuracy: r.kb_check?.accuracy_score ?? null,
    agreement: r.sentiment?.agreement ?? null,
  }
}

function touch(id: Id): void {
  store.notify()
  bus.emit('recording:updated', { id })
}

function liveRecording(id: Id): Recording | undefined {
  return store.data.recordings.find((r) => r.id === id)
}

function settleStatus(rec: Recording): void {
  if (rec.running.length > 0) {
    rec.status = 'analyzing'
    return
  }
  const any = rec.ran.factcheck || rec.ran.score || rec.ran.semantic || rec.ran.summary
  rec.status = any ? 'done' : 'ready'
}

/* ------------------------------------------------------- audio synthesis */

/** Deterministic pseudo-random 0..1 from a seed string and an index. */
const noise = (seed: string, i: number) => (hashString(`${seed}:${i}`) % 1000) / 1000

/** Times for a call whose canned source has no audio (text-only seed): speech rate of about 14 characters/s. */
function synthTimes(segments: Segment[]): { segments: Segment[]; duration: number } {
  let t = 0.6
  const out = segments.map((s) => {
    const len = Math.max(1.4, s.text.length / 14)
    const start = Math.round(t * 100) / 100
    const end = Math.round((t + len) * 100) / 100
    t = end + 0.35
    return { ...s, start, end }
  })
  return { segments: out, duration: Math.round(t * 10) / 10 }
}

function synthPeaks(segments: Segment[], duration: number, seed: string): number[] {
  const n = 600
  return Array.from({ length: n }, (_, i) => {
    const time = (i / n) * duration
    const seg = segments.find((s) => s.start !== null && s.end !== null && time >= s.start && time <= s.end)
    if (!seg) return 0.04 + noise(seed, i) * 0.04
    return Math.round((0.25 + noise(seed, i) * 0.7) * 100) / 100
  })
}

/* ----------------------------------------------------- upload + transcribe */

interface UploadFile {
  name: string
  size: number
  type?: string
}

function cannedFor(tenant: Id, key: string): CannedCall | undefined {
  const own = store.data.cannedCalls.filter((c) => c.client_id === tenant)
  const timed = own.filter((c) => c.audio_url)
  const pool = timed.length > 0 ? timed : own
  if (pool.length === 0) return undefined
  return pool[hashString(key) % pool.length]
}

function transcribeInto(rec: Recording, canned: CannedCall, override: Partial<TranscriptionSettings> | null): void {
  let segments = clone(canned.segments)
  let duration = canned.duration_s
  let peaks = canned.peaks ? clone(canned.peaks) : null
  if (segments.some((s) => s.start === null)) {
    const timed = synthTimes(segments)
    segments = timed.segments
    duration = timed.duration
    peaks = synthPeaks(segments, timed.duration, rec.id)
  }
  const language = override?.language_code ?? canned.language
  const agent = isKa(language) ? 'ოპერატორი' : language === 'ru' ? 'Оператор' : 'Agent'
  const customer = isKa(language) ? 'მომხმარებელი' : language === 'ru' ? 'Клиент' : 'Customer'
  rec.segments = segments
  rec.transcript = segments.map((s) => `${s.speaker === 'speaker_0' ? agent : customer}: ${s.text}`).join('\n')
  rec.language = language
  rec.duration_s = duration
  rec.audio_url = canned.audio_url
  rec.peaks = peaks
  rec.stt_model = 'scribe_v1'
  rec.processing_ms = 9000 + Math.round((duration ?? 0) * 380)
  rec.error = null
  rec.status = 'ready'
  rec.canned_id = canned.id
}

function scheduleTranscription(recId: Id, tenant: Id, hashKey: string, actor: string): void {
  const epoch = demoEpoch()
  setTimeout(() => {
    if (epoch !== demoEpoch()) return
    const rec = liveRecording(recId)
    if (!rec) return
    rec.running = rec.running.filter((k) => k !== 'transcribe')
    const canned = cannedFor(tenant, hashKey)
    if (/broken/i.test(rec.filename) || !canned) {
      rec.status = 'error'
      rec.error = 'The audio could not be decoded.'
      touch(recId)
      return
    }
    transcribeInto(rec, canned, rec.transcription_override)
    logUsage({
      feature: 'transcribe',
      group: 'transcription',
      capability: 'stt',
      client_id: tenant,
      actor,
      provider: 'elevenlabs',
      model: 'scribe_v1',
      audio_seconds: rec.duration_s,
      latency_ms: 1500,
      job_id: recId,
    })
    touch(recId)
  }, 1500)
}

function blankRecording(id: Id, tenant: Id, filename: string, source: Recording['source']): Recording {
  return {
    id,
    client_id: tenant,
    user_id: null,
    created_by: actorName(),
    filename,
    source,
    status: 'pending',
    error: null,
    language: null,
    duration_s: null,
    audio_url: null,
    peaks: null,
    segments: [],
    transcript: '',
    analysis: null,
    kb_used: [],
    kb_check: null,
    semantic: null,
    sentiment: null,
    scoring: null,
    revisions: [],
    ran: { factcheck: false, score: false, semantic: false, summary: false },
    running: [],
    transcription_override: null,
    stt_model: null,
    llm_model: null,
    processing_ms: null,
    canned_id: null,
    created_at: nowIso(),
  }
}

function sanitiseOverride(raw: unknown): Partial<TranscriptionSettings> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Partial<TranscriptionSettings> = {}
  if (o.language_code === null || o.language_code === 'ka' || o.language_code === 'en' || o.language_code === 'ru') {
    out.language_code = o.language_code
  }
  if (typeof o.diarize === 'boolean') out.diarize = o.diarize
  if (Array.isArray(o.keyterms)) out.keyterms = o.keyterms.filter((k): k is string => typeof k === 'string').slice(0, 1000)
  if (typeof o.audio_format === 'string' && ['original', 'flac_full', 'flac_16k', 'wav_16k', 'mp3_16k'].includes(o.audio_format)) {
    out.audio_format = o.audio_format as TranscriptionSettings['audio_format']
  }
  return Object.keys(out).length > 0 ? out : null
}

/* --------------------------------------------------------- pasted text */

const AGENT_PREFIX = /^\s*(agent|operator|support|rep|ოპერატორი|აგენტი|ოპ|სპეციალისტი|оператор|агент)\s*[:：]\s*(.*)$/i
const CUSTOMER_PREFIX = /^\s*(customer|client|caller|user|მომხმარებელი|კლიენტი|კლ|ზარის განმხორციელებელი|клиент|покупатель)\s*[:：]\s*(.*)$/i

export function parseTranscript(text: string): Segment[] {
  const segments: Segment[] = []
  let current: Segment['speaker'] = 'speaker_0'
  let first = true
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    let body = line
    const a = AGENT_PREFIX.exec(line)
    const c = a ? null : CUSTOMER_PREFIX.exec(line)
    if (a) {
      current = 'speaker_0'
      body = (a[2] ?? '').trim()
    } else if (c) {
      current = 'speaker_1'
      body = (c[2] ?? '').trim()
    } else if (first) {
      current = 'speaker_1'
    }
    first = false
    if (!body) continue
    segments.push({ i: segments.length, speaker: current, start: null, end: null, text: body })
  }
  return segments
}

/* ------------------------------------------------------------ simulators */

const POLITE = {
  en: ['please', 'thank', 'sorry', 'apolog', 'happy to help', 'glad', 'welcome', 'appreciate', 'certainly', 'of course', 'good morning', 'good afternoon', 'hello'],
  ka: ['გთხოვთ', 'გთხოვ', 'გმადლობთ', 'მადლობა', 'ბოდიში', 'სიამოვნებით', 'მოხარული', 'გამარჯობა', 'კეთილი', 'დილა მშვიდობისა', 'საღამო მშვიდობისა', 'რა თქმა უნდა'],
  ru: ['пожалуйста', 'спасибо', 'извините', 'здравствуйте', 'добрый'],
}
const RUDE = {
  en: ['stupid', 'idiot', 'shut up', 'ridiculous', 'useless', 'whatever', 'hate', 'incompetent', 'nonsense'],
  ka: ['სულელ', 'იდიოტ', 'გაჩუმდ', 'უაზრო', 'აბსურდ', 'უვიცი', 'სისულელე', 'ბრიყვ'],
  ru: ['идиот', 'глуп', 'чушь', 'бред'],
}
const AGGRESSIVE = {
  en: ['scam', 'sue ', 'lawyer', 'fraud', 'thieves', 'furious', 'unacceptable'],
  ka: ['თაღლით', 'სასამართლო', 'იურისტ', 'მოტყუებ', 'მიუღებელია', 'გაბრაზებული ვარ'],
  ru: ['мошенник', 'суд', 'обман', 'недопустимо'],
}

const matchAny = (text: string, lists: string[][]) => {
  const lower = text.toLowerCase()
  return lists.some((list) => list.some((w) => lower.includes(w)))
}
const allLists = (m: typeof POLITE) => [m.en, m.ka, m.ru]

const TONE_SCORE: Record<TextTone, number> = { polite: 95, neutral: 72, curt: 45, impolite: 30, rude: 15, aggressive: 8 }

function toneOfLine(text: string, speaker: 'agent' | 'customer'): { tone: TextTone; level: SpanLevel } {
  if (matchAny(text, allLists(AGGRESSIVE)) || (text.match(/!/g) ?? []).length >= 3) return { tone: 'aggressive', level: 'bad' }
  if (matchAny(text, allLists(RUDE))) return { tone: 'rude', level: 'bad' }
  if (matchAny(text, allLists(POLITE))) return { tone: 'polite', level: 'good' }
  if (speaker === 'agent' && text.trim().split(/\s+/).length < 4) return { tone: 'curt', level: 'mid' }
  return { tone: 'neutral', level: 'good' }
}

function overallTone(avg: number): TextTone {
  if (avg >= 85) return 'polite'
  if (avg >= 65) return 'neutral'
  if (avg >= 50) return 'curt'
  if (avg >= 35) return 'impolite'
  if (avg >= 20) return 'rude'
  return 'aggressive'
}

const toneNote = (tone: TextTone, ka: boolean): string | null => {
  if (tone === 'polite' || tone === 'neutral') return null
  const en: Record<string, string> = {
    curt: 'Very short reply without courtesy words.',
    impolite: 'Dismissive wording.',
    rude: 'Rude wording.',
    aggressive: 'Aggressive wording.',
  }
  const kaNotes: Record<string, string> = {
    curt: 'ძალიან მოკლე პასუხი, თავაზიანი ფორმულების გარეშე.',
    impolite: 'უარმყოფელი ფორმულირება.',
    rude: 'უხეში ფორმულირება.',
    aggressive: 'აგრესიული ფორმულირება.',
  }
  return (ka ? kaNotes : en)[tone] ?? null
}

function operatorSpeaker(rec: Recording): Segment['speaker'] {
  return rec.scoring?.operator_speaker ?? 'speaker_0'
}

function computeSemantic(rec: Recording): { semantic: Semantic; sentiment: Sentiment } {
  const lang = rec.language ?? 'en'
  const ka = isKa(lang)
  const agentSpeaker = operatorSpeaker(rec)
  const segs: SegmentTone[] = rec.segments.map((s) => {
    const who = s.speaker === agentSpeaker ? 'agent' : 'customer'
    const { tone, level } = toneOfLine(s.text, who)
    return {
      i: s.i,
      text_tone: tone,
      text_level: level,
      text_note: toneNote(tone, ka),
      voice_label: null,
      voice_level: null,
      voice_confidence: null,
    }
  })
  const speakers: SpeakerTone[] = (['agent', 'customer'] as const).map((role) => {
    const speaker: Segment['speaker'] = role === 'agent' ? agentSpeaker : agentSpeaker === 'speaker_0' ? 'speaker_1' : 'speaker_0'
    const mine = rec.segments.filter((s) => s.speaker === speaker)
    const tones = mine.map((s) => segs.find((x) => x.i === s.i)?.text_tone ?? 'neutral')
    const avg = tones.length ? tones.reduce((sum, t) => sum + TONE_SCORE[t], 0) / tones.length : 70
    const flags = [...new Set(tones.filter((t) => t !== 'polite' && t !== 'neutral'))]
    const overall = overallTone(avg)
    return {
      speaker,
      role,
      text: {
        politeness: Math.round(avg),
        overall,
        flags,
        rationale: ka
          ? `${tones.length} რეპლიკის ანალიზი: საშუალო თავაზიანობა ${Math.round(avg)}/100.`
          : `Across ${tones.length} turns the average politeness is ${Math.round(avg)}/100.`,
      },
      voice: null,
    }
  })
  const customer = speakers.find((s) => s.role === 'customer')
  const cAvg = customer?.text.politeness ?? 70
  const label = cAvg >= 80 ? 'positive' : cAvg < 55 ? 'negative' : 'neutral'
  const agent = speakers.find((s) => s.role === 'agent')
  const semantic: Semantic = {
    modes: ['text'],
    language: lang,
    speakers,
    segments: segs,
    summary: ka
      ? `ოპერატორის თავაზიანობა ${agent?.text.politeness ?? 0}/100, მომხმარებლის ტონი: ${label === 'positive' ? 'დადებითი' : label === 'negative' ? 'უარყოფითი' : 'ნეიტრალური'}. ხმოვანი ტონი ტექსტურ რეჟიმში არ იზომება.`
      : `Agent politeness ${agent?.text.politeness ?? 0}/100; customer tone ${label}. Voice tone is not measured for pasted text.`,
    voice_available: false,
    voice_status: 'disabled',
    ran_at: nowIso(),
  }
  const sentiment: Sentiment = {
    overall: label,
    agreement: 'text_only',
    text: {
      label,
      polarity: Math.round(clamp((cAvg - 60) / 40, -1, 1) * 100) / 100,
      rationale: ka ? `მომხმარებლის რეპლიკების საშუალო თავაზიანობა ${cAvg}/100.` : `Customer turns average ${cAvg}/100 politeness.`,
    },
    prosody: null,
  }
  return { semantic, sentiment }
}

function categoryOf(text: string): string {
  const t = text.toLowerCase()
  if (/საკომისი|fee|charge|გადასახად|ღირს|cost|price/.test(t)) return 'fees'
  if (/პროცენტ|%|rate|interest|განაკვეთ/.test(t)) return 'rates'
  if (/ლიმიტ|limit|maximum|მაქსიმ|minimum|მინიმ/.test(t)) return 'limits'
  if (/ვადა|დღე|დღის|თვე|თვის|days|months|years|hours|სთ/.test(t)) return 'terms'
  return 'general'
}

const numbersOf = (text: string) => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'))

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function computeFactcheck(rec: Recording, tenant: Id): FactCheck {
  const ka = isKa(rec.language)
  const chunks: KbChunk[] = store.data.kbChunks.filter((c) => c.client_id === tenant)
  const docs = new Map(store.data.kbDocuments.filter((d) => d.client_id === tenant).map((d) => [d.id, d]))
  const agent = operatorSpeaker(rec)
  const candidates: Array<{ text: string; seg: Segment }> = []
  for (const seg of rec.segments) {
    if (seg.speaker !== agent) continue
    for (const sentence of sentencesOf(seg.text)) {
      if (sentence.length >= 12 && /\d|%/.test(sentence)) candidates.push({ text: sentence, seg })
    }
  }
  const claims: Claim[] = candidates.slice(0, 8).map((cand, n) => {
    const ranked = rankByText(cand.text, chunks.map((c) => ({ ...c })))
    const top = ranked[0]
    const score = top?.score ?? 0.35
    let verdict: Verdict = score >= 0.7 ? 'SUPPORTED' : score >= 0.55 ? 'PARTIALLY_SUPPORTED' : 'NOT_IN_KB'
    const chunk = top?.item
    if (chunk && score >= 0.6) {
      const claimNums = numbersOf(cand.text)
      const chunkNums = new Set(numbersOf(chunk.content))
      if (claimNums.length > 0 && chunkNums.size > 0 && claimNums.every((x) => !chunkNums.has(x))) verdict = 'CONTRADICTED'
    }
    const doc = chunk ? docs.get(chunk.document_id) : undefined
    const evidence =
      verdict !== 'NOT_IN_KB' && chunk && doc
        ? {
            document_id: doc.id,
            chunk_id: chunk.id,
            title: doc.title,
            doc_type: doc.doc_type,
            snippet: snippetFor(chunk.content, cand.text),
            score,
          }
        : null
    const rationale = {
      SUPPORTED: ka ? 'განცხადება ემთხვევა ცოდნის ბაზის შესაბამის მონაკვეთს.' : 'The statement matches the knowledge-base passage.',
      PARTIALLY_SUPPORTED: ka ? 'ბაზა ნაწილობრივ ადასტურებს; დეტალები არ ემთხვევა სრულად.' : 'The knowledge base supports it only in part; details differ.',
      CONTRADICTED: ka ? 'ბაზაში მითითებული მაჩვენებლები განსხვავდება ნათქვამისგან.' : 'The figures in the knowledge base differ from what was said.',
      NOT_IN_KB: ka ? 'ცოდნის ბაზაში საკმარისად ახლო მონაკვეთი ვერ მოიძებნა.' : 'No sufficiently close passage was found in the knowledge base.',
    }[verdict]
    return {
      id: `clm_${n + 1}`,
      claim: cand.text,
      speaker: 'agent' as const,
      category: categoryOf(cand.text),
      segments: [cand.seg.i],
      start: cand.seg.start,
      end: cand.seg.end,
      verdict,
      rationale,
      confidence: Math.round(score * 100) / 100,
      evidence,
    }
  })
  const counts = {
    supported: claims.filter((c) => c.verdict === 'SUPPORTED').length,
    partially_supported: claims.filter((c) => c.verdict === 'PARTIALLY_SUPPORTED').length,
    contradicted: claims.filter((c) => c.verdict === 'CONTRADICTED').length,
    not_in_kb: claims.filter((c) => c.verdict === 'NOT_IN_KB').length,
    total: claims.length,
  }
  return { accuracy_score: factcheckAccuracy(counts), counts, claims, ran_at: nowIso() }
}

function computeScoring(rec: Recording, tenant: Id, fc: FactCheck | null, sem: Semantic): Scorecard {
  const ka = isKa(rec.language)
  const rubric =
    store.data.scoringConfigs.find((c) => c.client_id === tenant) ?? store.data.scoringConfigs.find((c) => c.client_id === null)
  const agent = operatorSpeaker(rec)
  const agentSegs = rec.segments.filter((s) => s.speaker === agent)
  const politeness = sem.speakers.find((s) => s.role === 'agent')?.text.politeness ?? 70
  const acc = fc?.accuracy_score ?? null
  const dims: ScoreDimension[] = (rubric?.dimensions ?? []).map((d) => {
    let score: number | null
    let rationale: string
    if (d.source === 'factcheck') {
      score = acc
      rationale =
        acc === null
          ? ka ? 'შესამოწმებელი მტკიცება არ იყო; განზომილება არ ფასდება.' : 'No checkable claims; this dimension is not scored.'
          : ka ? `ფაქტების სიზუსტე ცოდნის ბაზასთან: ${acc}%.` : `Fact accuracy against the knowledge base: ${acc}%.`
    } else if (d.source === 'sentiment') {
      score = politeness
      rationale = ka ? `ოპერატორის საშუალო თავაზიანობა: ${politeness}/100.` : `Average agent politeness: ${politeness}/100.`
    } else {
      const base = 0.5 * politeness + 0.5 * (acc ?? 78)
      const jitter = (hashString(`${d.key}:${rec.id}`) % 15) - 7
      score = clamp(Math.round(base + jitter), 20, 98)
      rationale = ka
        ? `შეფასებულია ${agentSegs.length} ოპერატორის რეპლიკით; ტონი: ${sem.speakers.find((s) => s.role === 'agent')?.text.overall ?? 'neutral'}.`
        : `Assessed from ${agentSegs.length} agent turns; tone ${sem.speakers.find((s) => s.role === 'agent')?.text.overall ?? 'neutral'}.`
    }
    const key = d.key.toLowerCase()
    const pick =
      /greet|open|intro/.test(key) ? agentSegs[0] : /clos|end|wrap/.test(key) ? agentSegs[agentSegs.length - 1] : agentSegs[hashString(`${d.key}${rec.id}`) % Math.max(1, agentSegs.length)]
    const evidence =
      d.source === 'model' && pick
        ? [{ quote: clip(pick.text, 140), segments: [pick.i], start: pick.start, end: pick.end }]
        : []
    const dim: ScoreDimension = {
      key: d.key,
      name: d.name,
      weight: d.weight,
      score,
      max: 100,
      contribution: 0,
      rationale,
      evidence,
      source: d.source,
      applicable: true,
      edited: false,
      ai_score: null,
    }
    if (d.name_en) dim.name_en = d.name_en
    return dim
  })
  const totals = computeTotals(dims)
  const revision = (rec.revisions[rec.revisions.length - 1]?.revision ?? 0) + 1
  return {
    config_version: rubric?.version ?? 1,
    operator_speaker: agent,
    dimensions: totals.dimensions,
    weighted_total: totals.weighted_total,
    max_total: 100,
    scored_weight: totals.scored_weight,
    unscored: totals.unscored,
    manually_edited: false,
    edited_by: null,
    revision,
    scored_at: nowIso(),
  }
}

function computeAnalysis(rec: Recording, scoring: Scorecard | null, sentiment: Sentiment | null, sem: Semantic): CallAnalysis {
  const ka = isKa(rec.language)
  const agent = operatorSpeaker(rec)
  const first = rec.segments.find((s) => s.speaker !== agent) ?? rec.segments[0]
  const agentTurns = rec.segments.filter((s) => s.speaker === agent)
  const freq = new Map<string, number>()
  for (const t of tokenize(rec.transcript)) if (t.length > 3) freq.set(t, (freq.get(t) ?? 0) + 1)
  const topics = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w)
  const withFigures = agentTurns.flatMap((s) => sentencesOf(s.text)).filter((s) => /\d/.test(s))
  const keyPoints = (withFigures.length ? withFigures : agentTurns.flatMap((s) => sentencesOf(s.text))).slice(0, 4).map((s) => clip(s, 160))
  const polarity = sentiment?.overall ?? 'neutral'
  return {
    language: rec.language ?? 'en',
    summary: ka
      ? `მომხმარებლის მიმართვა: „${clip(first?.text ?? '', 120)}“. ოპერატორმა უპასუხა ${agentTurns.length} რეპლიკით; სულ ${rec.segments.length} რეპლიკა.`
      : `Customer opened with: "${clip(first?.text ?? '', 120)}". The agent replied in ${agentTurns.length} turns across ${rec.segments.length} lines.`,
    sentiment: polarity,
    topics,
    key_points: keyPoints,
    quality_score: scoring?.weighted_total ?? sem.speakers.find((s) => s.role === 'agent')?.text.politeness ?? 0,
  }
}

/* ---------------------------------------------------- applying a result */

const scoreMap = (card: Scorecard): Record<string, number | null> => Object.fromEntries(card.dimensions.map((d) => [d.key, d.score]))

function pushRevision(rec: Recording, card: Scorecard, actor: string): void {
  const revision: ScoreRevision = {
    revision: (rec.revisions[rec.revisions.length - 1]?.revision ?? 0) + 1,
    scores: scoreMap(card),
    note: rec.revisions.length ? 'Re-run by the model.' : '',
    edited_by: 'Sinji model',
    created_at: nowIso(),
    weighted_total: card.weighted_total,
  }
  void actor
  card.revision = revision.revision
  rec.revisions.push(revision)
}

function cannedOf(rec: Recording): CannedCall | undefined {
  if (!rec.canned_id) return undefined
  return store.data.cannedCalls.find((c) => c.id === rec.canned_id)
}

function applyVoiceAvailability(sem: Semantic, sent: Sentiment, tenant: Id): void {
  const cfg = store.data.sentimentConfigs.find((c) => c.client_id === tenant)
  if (!cfg || cfg.voice_tone === 'ok') return
  sem.voice_available = false
  sem.voice_status = cfg.voice_tone
  sem.modes = ['text']
  sem.segments = sem.segments.map((s) => ({ ...s, voice_label: null, voice_level: null, voice_confidence: null }))
  sem.speakers = sem.speakers.map((s) => ({ ...s, voice: null }))
  sent.prosody = null
  sent.agreement = 'text_only'
}

function applyResult(rec: Recording, key: RunKey, tenant: Id, actor: string, delay: number): void {
  const canned = cannedOf(rec)
  const pasted = rec.source === 'text' && !canned
  const useCanned = Boolean(canned) && !pasted
  const tokens = estimateTokens(rec.transcript)
  const base = { client_id: tenant, actor, job_id: rec.id, latency_ms: delay }

  if (key === 'factcheck') {
    const fc = useCanned && canned ? { ...clone(canned.kb_check), ran_at: nowIso() } : computeFactcheck(rec, tenant)
    rec.kb_check = fc
    rec.kb_used = [...new Set(fc.claims.map((c) => c.evidence?.document_id).filter((id): id is Id => Boolean(id)))]
    rec.ran.factcheck = true
    logUsage({ ...base, feature: 'factcheck_extract', group: 'factcheck', capability: 'llm', input_tokens: tokens + 300, output_tokens: 60 * fc.claims.length })
    logUsage({ ...base, feature: 'factcheck_verify', group: 'factcheck', capability: 'llm', input_tokens: 500 * Math.max(1, fc.claims.length), output_tokens: 90 * fc.claims.length })
  } else if (key === 'semantic') {
    let sem: Semantic
    let sent: Sentiment
    if (useCanned && canned) {
      sem = { ...clone(canned.semantic), ran_at: nowIso() }
      sent = clone(canned.sentiment)
      applyVoiceAvailability(sem, sent, tenant)
    } else {
      ;({ semantic: sem, sentiment: sent } = computeSemantic(rec))
    }
    rec.semantic = sem
    rec.sentiment = sent
    rec.ran.semantic = true
    logUsage({ ...base, feature: 'semantic', group: 'tone', capability: 'llm', input_tokens: tokens + 200, output_tokens: 20 * rec.segments.length })
    if (sem.voice_available) logUsage({ ...base, feature: 'voice_tone', group: 'tone', capability: 'voice_tone', audio_seconds: rec.duration_s })
  } else if (key === 'score') {
    let card: Scorecard
    if (useCanned && canned) {
      card = clone(canned.scoring)
      card.scored_at = nowIso()
    } else {
      const sem = rec.semantic ?? computeSemantic(rec).semantic
      const fc = rec.kb_check ?? computeFactcheck(rec, tenant)
      card = computeScoring(rec, tenant, fc, sem)
    }
    pushRevision(rec, card, actor)
    rec.scoring = card
    rec.ran.score = true
    if (rec.analysis) rec.analysis = { ...rec.analysis, quality_score: card.weighted_total }
    logUsage({ ...base, feature: 'score', group: 'scoring', capability: 'llm', input_tokens: tokens + 900, output_tokens: 140 * card.dimensions.length })
  } else if (key === 'summary') {
    if (useCanned && canned) {
      rec.analysis = { ...clone(canned.analysis), quality_score: rec.scoring?.weighted_total ?? canned.analysis.quality_score }
    } else {
      const sem = rec.semantic ?? computeSemantic(rec).semantic
      const sent = rec.sentiment ?? computeSemantic(rec).sentiment
      rec.analysis = computeAnalysis(rec, rec.scoring, sent, sem)
    }
    rec.ran.summary = true
    logUsage({ ...base, feature: 'analyze', group: 'analysis', capability: 'llm', input_tokens: tokens + 150, output_tokens: 220 })
  }
  rec.llm_model = 'claude-sonnet-4-5'
}

function startRun(rec: Recording, keys: RunKey[], tenant: Id, actor: string): void {
  const epoch = demoEpoch()
  for (const key of keys) {
    if (rec.running.includes(key as Analyser)) continue
    rec.running.push(key as Analyser)
    const delay = 1000 + Math.floor(Math.random() * 2000)
    setTimeout(() => {
      if (epoch !== demoEpoch()) return
      const live = liveRecording(rec.id)
      if (!live) return
      live.running = live.running.filter((k) => k !== (key as Analyser))
      applyResult(live, key, tenant, actor, delay)
      settleStatus(live)
      touch(live.id)
    }, delay)
  }
  settleStatus(rec)
  touch(rec.id)
}

/* ------------------------------------------------------------- handlers */

api.register('GET', '/recordings', ({ params }) => {
  const q = (params.q ?? '').trim().toLowerCase()
  const status = params.status
  const source = params.source
  return recordingsOfTenant()
    .filter((r) => (!q || r.filename.toLowerCase().includes(q) || r.created_by.toLowerCase().includes(q)) && (!status || r.status === status) && (!source || r.source === source))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toRow)
})

api.register('GET', '/recordings/:id', ({ path }) => findRecording(path.id ?? ''))

api.register('POST', '/recordings/upload', ({ body }) => {
  const tenant = tenantScope()
  const input = (body ?? {}) as { files?: UploadFile[]; override?: unknown }
  const files = Array.isArray(input.files) ? input.files : []
  if (files.length === 0) throw DemoApiError.validation({ files: 'Add at least one audio file.' })
  if (files.length > MAX_FILES) throw DemoApiError.validation({ files: `You can upload up to ${MAX_FILES} files at once.` })
  const total = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0)
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || !f.name.trim()) throw DemoApiError.validation({ files: 'Every file needs a name.' })
    if (!AUDIO_EXT.test(f.name)) throw DemoApiError.validation({ files: `${f.name}: unsupported audio format.` })
    if (!(Number(f.size) > 0)) throw DemoApiError.validation({ files: `${f.name}: the file is empty.` })
    if (Number(f.size) > MAX_FILE) throw DemoApiError.validation({ files: `${f.name}: larger than 100 MB.` })
  }
  if (total > MAX_TOTAL) throw DemoApiError.validation({ files: 'The files add up to more than 300 MB.' })
  const override = sanitiseOverride(input.override)
  const actor = actorName()
  const created = files.map((f) => {
    const rec = blankRecording(store.nextId('rec_'), tenant, f.name.trim(), 'audio')
    rec.status = 'transcribing'
    rec.running = ['transcribe']
    rec.transcription_override = override
    store.data.recordings.unshift(rec)
    scheduleTranscription(rec.id, tenant, `${f.name}${f.size}`, actor)
    return clone(rec)
  })
  store.notify()
  for (const rec of created) bus.emit('recording:updated', { id: rec.id })
  return created
})

api.register('POST', '/recordings/text', ({ body }) => {
  const tenant = tenantScope()
  const input = (body ?? {}) as { title?: string; language?: string; text?: string }
  const title = (input.title ?? '').trim()
  const text = (input.text ?? '').trim()
  const errors: Record<string, string> = {}
  if (!title) errors.title = 'Give the conversation a title.'
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters.'
  if (!['ka', 'en', 'ru'].includes(input.language ?? '')) errors.language = 'Pick a language.'
  if (text.length < 10) errors.text = 'Paste the transcript (at least a couple of lines).'
  else if (text.length > 20000) errors.text = 'The transcript is longer than 20,000 characters.'
  const segments = text.length >= 10 ? parseTranscript(text) : []
  if (!errors.text && segments.length === 0) errors.text = 'No lines could be read from the transcript.'
  if (Object.keys(errors).length > 0) throw DemoApiError.validation(errors)
  if (segments.length > 400) throw DemoApiError.validation({ text: 'A transcript can have at most 400 lines.' })

  const rec = blankRecording(store.nextId('rec_'), tenant, /\.\w{2,4}$/.test(title) ? title : `${title}.txt`, 'text')
  const language = input.language as ContentLang
  const agent = isKa(language) ? 'ოპერატორი' : language === 'ru' ? 'Оператор' : 'Agent'
  const customer = isKa(language) ? 'მომხმარებელი' : language === 'ru' ? 'Клиент' : 'Customer'
  rec.segments = segments
  rec.transcript = segments.map((s) => `${s.speaker === 'speaker_0' ? agent : customer}: ${s.text}`).join('\n')
  rec.language = language
  rec.status = 'ready'
  rec.processing_ms = 40
  store.data.recordings.unshift(rec)
  touch(rec.id)
  return clone(rec)
})

api.register('POST', '/recordings/:id/run', ({ path, body }) => {
  const tenant = tenantScope()
  const rec = findRecording(path.id ?? '')
  const input = (body ?? {}) as { analysers?: string[] }
  const wanted = Array.isArray(input.analysers) ? input.analysers : []
  if (wanted.length === 0 || wanted.some((k) => !RUN_KEYS.includes(k as RunKey))) {
    throw DemoApiError.validation({ analysers: 'Choose at least one valid analyser.' })
  }
  const keys = [...new Set(wanted)] as RunKey[]
  const actor = actorName()

  if (keys.includes('transcribe')) {
    if (keys.length > 1) throw DemoApiError.validation({ analysers: 'Transcription runs on its own.' })
    if (rec.source !== 'audio') throw DemoApiError.validation({ analysers: 'Pasted text has nothing to transcribe.' })
    if (rec.status === 'transcribing') throw new DemoApiError(409, 'This recording is already being transcribed.')
    rec.status = 'transcribing'
    rec.running = ['transcribe']
    rec.error = null
    scheduleTranscription(rec.id, tenant, `${rec.filename}${rec.id}`, actor)
    touch(rec.id)
    return clone(rec)
  }
  if (rec.status === 'transcribing' || rec.status === 'pending') throw new DemoApiError(409, 'Wait for the transcription to finish.')
  if (rec.status === 'error' || rec.segments.length === 0) throw new DemoApiError(409, 'This recording has no transcript yet. Transcribe it first.')
  const fresh = keys.filter((k) => !rec.running.includes(k as Analyser))
  if (fresh.length === 0) throw new DemoApiError(409, 'These analysers are already running.')
  if (fresh.includes('semantic')) {
    const cfg = store.data.sentimentConfigs.find((c) => c.client_id === tenant)
    if (cfg && !cfg.enabled) throw new DemoApiError(409, 'Tone analysis is switched off for this workspace.')
  }
  startRun(rec, fresh, tenant, actor)
  return clone(rec)
})

api.register('DELETE', '/recordings/:id', ({ path }) => {
  requireRole('owner', 'operator')
  const id = path.id ?? ''
  const rec = findRecording(id)
  if (rec.client_id !== tenantScope()) throw forbidden()
  store.data.recordings = store.data.recordings.filter((r) => r.id !== id)
  store.notify()
  bus.emit('recording:updated', { id })
  return { deleted: id }
})
