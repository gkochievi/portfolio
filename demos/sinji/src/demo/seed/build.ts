/**
 * Seed builders: compact authoring formats in, wire-format entities out.
 * Everything derived (timings, claim spans, accuracy, weighted totals, tone
 * shares) is computed here so precomputed results stay internally consistent
 * with `src/lib/scoring.ts`. Deterministic: no Math.random, no Date.now.
 */
import { createRandom } from '@portfolio/demo-kit'

import { computeTotals, factcheckAccuracy } from '@/lib/scoring'
import type {
  CallAnalysis,
  CannedCall,
  Claim,
  ClaimEvidence,
  ContentLang,
  FactCheck,
  Id,
  KbChunk,
  KbDocType,
  KbDocument,
  Polarity,
  RubricDimension,
  ScoreDimension,
  ScoreEvidence,
  Scorecard,
  Segment,
  SegmentTone,
  Semantic,
  Sentiment,
  SpanLevel,
  SpeakerTone,
  TextTone,
  Verdict,
  VoiceEmotion,
  VoiceToneStatus,
} from '@/types'
import { checksum, estimateTokens, snippetFor } from '../lib/text'

/** The instant every seed timestamp is authored against (rebased to "now" on load). */
export const SEED_DATE = '2026-10-01T09:00:00Z'
const BASE = Date.parse(SEED_DATE)
const MINUTE = 60_000

/** ISO timestamp `days` (+ hours, minutes) before SEED_DATE. Fractions allowed. */
export function ago(days: number, hours = 0, minutes = 0): string {
  return new Date(BASE - ((days * 24 + hours) * 60 + minutes) * MINUTE).toISOString()
}

/** ISO timestamp `ms` after another one. */
export function after(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString()
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** Masked secret hint in the product's format. */
export const keyHint = (tail: string): string => `snj_live_...${tail}`

/* ------------------------------------------------------------------ KB */

export interface DocSpec {
  slug: string
  title: string
  title_en?: string
  doc_type: KbDocType
  tags: string[]
  visibility?: 'public' | 'internal'
  source_type?: KbDocument['source_type']
  /** undefined = `<slug>.docx`; null = pasted / API. */
  filename?: string | null
  chunks: string[]
  /** Created this many days before SEED_DATE. */
  days: number
  /** Last updated this many days before SEED_DATE (default: `days`). */
  updated?: number
  status?: KbDocument['status']
  error?: string | null
  actor?: string
  metadata?: Record<string, string>
}

export interface KbBundle {
  documents: KbDocument[]
  chunks: KbChunk[]
}

/** Documents + deterministic chunks: `doc_<prefix>_<slug>` / `chk_<prefix>_<slug>_<n>`. */
export function buildKb(prefix: string, clientId: Id, specs: readonly DocSpec[], defaultActor: string): KbBundle {
  const documents: KbDocument[] = []
  const chunks: KbChunk[] = []
  for (const spec of specs) {
    const id = `doc_${prefix}_${spec.slug}`
    const status = spec.status ?? 'ready'
    const content_text = spec.chunks.join('\n\n')
    const ready = status === 'ready'
    documents.push({
      id,
      client_id: clientId,
      title: spec.title,
      ...(spec.title_en ? { title_en: spec.title_en } : {}),
      doc_type: spec.doc_type,
      tags: spec.tags,
      content_text,
      char_count: content_text.length,
      chunk_count: ready ? spec.chunks.length : 0,
      status,
      error: spec.error ?? null,
      source_type: spec.source_type ?? 'file',
      filename: spec.filename === undefined ? `${spec.slug.replace(/_/g, '-')}.docx` : spec.filename,
      visibility: spec.visibility ?? 'public',
      checksum: checksum(content_text),
      actor: spec.actor ?? defaultActor,
      ingest_ms: ready ? 700 + Math.round(content_text.length * 1.7) : null,
      metadata: spec.metadata ?? {},
      restructure: 'none',
      created_at: ago(spec.days, 3),
      updated_at: ago(spec.updated ?? spec.days, 3),
    })
    if (!ready) continue
    spec.chunks.forEach((content, n) => {
      chunks.push({
        id: `chk_${prefix}_${spec.slug}_${n}`,
        client_id: clientId,
        document_id: id,
        chunk_index: n,
        content,
        token_count: estimateTokens(content),
        has_embedding: true,
        metadata: { section: String(n + 1) },
      })
    })
  }
  return { documents, chunks }
}

/* ------------------------------------------------------------- segments */

/** [speaker (0 = agent, 1 = customer), text, English gloss]. */
export type Line = readonly [who: 0 | 1, text: string, en?: string]

/** Placeholder timings from text length (the media manifest replaces them with measured ones). */
export function buildSegments(lines: readonly Line[], timed: boolean, key: string): Segment[] {
  const random = createRandom(`segments:${key}`)
  let t = 0.6
  return lines.map(([who, text, en], i) => {
    const segment: Segment = { i, speaker: who === 0 ? 'speaker_0' : 'speaker_1', start: null, end: null, text }
    if (en) segment.text_en = en
    if (timed) {
      const georgian = /[Ⴀ-ჿ]/.test(text)
      const duration = Math.min(11, Math.max(1.2, 0.5 + text.length * (georgian ? 0.06 : 0.056)))
      segment.start = round2(t)
      segment.end = round2(t + duration)
      t += duration + 0.3 + random.next() * 0.3
    }
    return segment
  })
}

/** About 600 peaks (0..1) shaped by the speech regions; replaced by measured peaks when media exists. */
export function placeholderPeaks(segments: readonly Segment[], duration: number, key: string, count = 600): number[] {
  const random = createRandom(`peaks:${key}`)
  const peaks: number[] = []
  let index = 0
  for (let k = 0; k < count; k++) {
    const t = ((k + 0.5) * duration) / count
    while (index < segments.length && (segments[index]?.end ?? 0) < t) index++
    const segment = segments[index]
    const speaking = segment !== undefined && segment.start !== null && segment.start <= t
    const base = speaking ? (segment.speaker === 'speaker_0' ? 0.5 : 0.62) : 0.03
    peaks.push(round2(Math.min(1, base * (0.45 + random.next() * 0.95))))
  }
  return peaks
}

/* ------------------------------------------------------------ sentiment */

const EMOTION: Record<VoiceEmotion, { polarity: number; arousal: number; valence: number; dominance: number }> = {
  calm: { polarity: 0.1, arousal: 0.24, valence: 0.6, dominance: 0.52 },
  happy: { polarity: 0.68, arousal: 0.58, valence: 0.84, dominance: 0.6 },
  neutral: { polarity: 0, arousal: 0.4, valence: 0.5, dominance: 0.5 },
  sad: { polarity: -0.48, arousal: 0.22, valence: 0.24, dominance: 0.3 },
  frustrated: { polarity: -0.46, arousal: 0.66, valence: 0.3, dominance: 0.56 },
  angry: { polarity: -0.74, arousal: 0.86, valence: 0.14, dominance: 0.76 },
}

const polarityClass = (p: number): Polarity => (p > 0.15 ? 'positive' : p < -0.15 ? 'negative' : 'neutral')

/** Two-sided sentiment; agreement derived, the two reads are never averaged. */
export function buildSentiment(
  text: { label: Polarity; polarity: number; rationale: string } | null,
  voice: VoiceEmotion | null,
  confidence = 0.84,
): Sentiment {
  const prosody = voice ? { label: voice, ...EMOTION[voice], confidence } : null
  if (!text && !prosody) return { overall: 'neutral', agreement: 'unknown', text: null, prosody: null }
  if (text && !prosody) return { overall: text.label, agreement: 'text_only', text, prosody: null }
  if (!text && prosody) {
    return { overall: polarityClass(prosody.polarity), agreement: 'prosody_only', text: null, prosody }
  }
  const a = text!.label
  const b = polarityClass(prosody!.polarity)
  if (a === b) return { overall: a, agreement: 'agree', text, prosody }
  if (a === 'neutral' || b === 'neutral') return { overall: a === 'neutral' ? b : a, agreement: 'partial', text, prosody }
  return { overall: 'negative', agreement: 'conflict', text, prosody }
}

/* ---------------------------------------------------------------- calls */

export interface ClaimSpec {
  seg: number[]
  v: Verdict
  cat: string
  c: string
  c_en?: string
  r: string
  r_en?: string
  conf: number
  /** Evidence chunk id (null / absent for NOT_IN_KB). */
  chunk?: Id | null
  score?: number
  /** Query used to cut the evidence snippet out of the chunk. */
  q?: string
  who?: Claim['speaker']
}

export interface DimSpec {
  s: number | null
  r: string
  r_en?: string
  /** Evidence quotes as groups of segment indices. */
  ev?: number[][]
  na?: boolean
}

export interface ToneSide {
  politeness: number
  overall: TextTone
  flags: string[]
  rationale: string
  /** Default voice emotion for this speaker's segments. */
  voice: VoiceEmotion
}

export interface ToneOverride {
  t?: TextTone
  v?: VoiceEmotion
  note?: string
  en?: string
}

export interface CallSpec {
  id: Id
  client_id: Id
  title: string
  language: ContentLang
  /** Audio call (timed segments) or a text transcript (null times). */
  timed: boolean
  lines: Line[]
  analysis: Omit<CallAnalysis, 'language' | 'quality_score'>
  claims: ClaimSpec[]
  tone: {
    agent: ToneSide
    customer: ToneSide
    overrides: Record<number, ToneOverride>
    summary: string
    summary_en?: string
    voice_status?: VoiceToneStatus
  }
  sentiment: { label: Polarity; polarity: number; rationale: string; voice: VoiceEmotion | null }
  dims: Record<string, DimSpec>
}

export interface ChunkRef {
  chunk: KbChunk
  doc: KbDocument
}

export interface RubricRef {
  version: number
  dimensions: RubricDimension[]
}

export interface CallMedia {
  audio_url: string | null
  duration_s: number | null
  peaks: number[] | null
}

const TEXT_LEVEL: Record<TextTone, SpanLevel> = {
  polite: 'good',
  neutral: 'good',
  curt: 'mid',
  impolite: 'bad',
  rude: 'bad',
  aggressive: 'bad',
}
const VOICE_LEVEL: Record<VoiceEmotion, SpanLevel> = {
  calm: 'good',
  happy: 'good',
  neutral: 'good',
  sad: 'mid',
  frustrated: 'mid',
  angry: 'bad',
}

function clip(text: string, max = 170): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function quoteFrom(segments: readonly Segment[], indices: readonly number[]): ScoreEvidence {
  const picked = indices.map((i) => segments[i]).filter((s): s is Segment => s !== undefined)
  const first = picked[0]
  const last = picked[picked.length - 1]
  const quote: ScoreEvidence = {
    quote: clip(picked.map((s) => s.text).join(' … ')),
    segments: [...indices],
    start: first?.start ?? null,
    end: last?.end ?? null,
  }
  const glosses = picked.map((s) => s.text_en).filter((t): t is string => Boolean(t))
  if (glosses.length === picked.length && glosses.length > 0) quote.quote_en = clip(glosses.join(' … '))
  return quote
}

/** Turn a call spec into a fully precomputed CannedCall (claims, tone, sentiment, scorecard). */
export function buildCall(
  spec: CallSpec,
  segments: Segment[],
  media: CallMedia,
  rubric: RubricRef,
  lookup: (id: Id) => ChunkRef | undefined,
  ranAt: string,
): CannedCall {
  const ka = spec.language !== 'en'
  const bySegment = (i: number) => segments[i]

  /* fact-check */
  const claims: Claim[] = spec.claims.map((c, n) => {
    const picked = c.seg.map(bySegment).filter((s): s is Segment => s !== undefined)
    if (picked.length !== c.seg.length) throw new Error(`seed: ${spec.id} claim ${n + 1} cites a missing segment`)
    let evidence: ClaimEvidence | null = null
    if (c.chunk) {
      const ref = lookup(c.chunk)
      if (!ref) throw new Error(`seed: ${spec.id} claim ${n + 1} cites unknown chunk ${c.chunk}`)
      evidence = {
        document_id: ref.doc.id,
        chunk_id: ref.chunk.id,
        title: ref.doc.title,
        doc_type: ref.doc.doc_type,
        snippet: snippetFor(ref.chunk.content, c.q ?? c.c, 220),
        score: c.score ?? 0.8,
      }
    }
    const claim: Claim = {
      id: `clm_${spec.id.replace(/^cc_/, '')}_${n + 1}`,
      claim: c.c,
      speaker: c.who ?? 'agent',
      category: c.cat,
      segments: [...c.seg],
      start: picked[0]?.start ?? null,
      end: picked[picked.length - 1]?.end ?? null,
      verdict: c.v,
      rationale: c.r,
      confidence: c.conf,
      evidence,
    }
    if (c.c_en) claim.claim_en = c.c_en
    if (c.r_en) claim.rationale_en = c.r_en
    return claim
  })
  const count = (v: Verdict) => claims.filter((c) => c.verdict === v).length
  const counts: FactCheck['counts'] = {
    supported: count('SUPPORTED'),
    partially_supported: count('PARTIALLY_SUPPORTED'),
    contradicted: count('CONTRADICTED'),
    not_in_kb: count('NOT_IN_KB'),
    total: claims.length,
  }
  const kb_check: FactCheck = { accuracy_score: factcheckAccuracy(counts), counts, claims, ran_at: ranAt }

  /* tone */
  const random = createRandom(`tone:${spec.id}`)
  const toneSegments: SegmentTone[] = segments.map((s) => {
    const side = s.speaker === 'speaker_0' ? spec.tone.agent : spec.tone.customer
    const o = spec.tone.overrides[s.i] ?? {}
    const textTone: TextTone = o.t ?? (side.overall === 'polite' ? 'polite' : 'neutral')
    const voice: VoiceEmotion | null = spec.timed ? (o.v ?? side.voice) : null
    const tone: SegmentTone = {
      i: s.i,
      text_tone: textTone,
      text_level: TEXT_LEVEL[textTone],
      text_note: o.note ?? null,
      voice_label: voice,
      voice_level: voice ? VOICE_LEVEL[voice] : null,
      voice_confidence: voice ? round2(0.62 + random.next() * 0.33) : null,
    }
    if (o.en) tone.text_note_en = o.en
    return tone
  })
  const speakerTone = (speaker: 'speaker_0' | 'speaker_1', side: ToneSide): SpeakerTone => {
    const mine = toneSegments.filter((t) => segments[t.i]?.speaker === speaker)
    const share = (level: SpanLevel) =>
      mine.length ? round2(mine.filter((t) => t.voice_level === level).length / mine.length) : 0
    return {
      speaker,
      role: speaker === 'speaker_0' ? 'agent' : 'customer',
      text: { politeness: side.politeness, overall: side.overall, flags: side.flags, rationale: side.rationale },
      voice: spec.timed ? { voice: side.voice, share_bad: share('bad'), share_good: share('good') } : null,
    }
  }
  const semantic: Semantic = {
    modes: spec.timed ? ['text', 'voice'] : ['text'],
    language: spec.language,
    speakers: [speakerTone('speaker_0', spec.tone.agent), speakerTone('speaker_1', spec.tone.customer)],
    segments: toneSegments,
    summary: spec.tone.summary,
    voice_available: spec.timed,
    voice_status: spec.tone.voice_status ?? 'ok',
    ran_at: ranAt,
  }
  if (spec.tone.summary_en) semantic.summary_en = spec.tone.summary_en

  /* sentiment */
  const { voice, ...text } = spec.sentiment
  const sentiment = buildSentiment(text, spec.timed ? voice : null)

  /* scorecard */
  const flagged = claims.filter((c) => c.verdict === 'CONTRADICTED' || c.verdict === 'PARTIALLY_SUPPORTED')
  const dimensions: ScoreDimension[] = rubric.dimensions.map((d) => {
    let score: number | null
    let rationale: string
    let rationale_en: string | undefined
    let evidence: ScoreEvidence[]
    let applicable = true
    if (d.source === 'factcheck') {
      score = kb_check.accuracy_score
      const checked = counts.supported + counts.partially_supported + counts.contradicted
      rationale = ka
        ? `${checked} შემოწმებადი მტკიცებიდან ${counts.supported} დასტურდება, ${counts.partially_supported} ნაწილობრივ, ${counts.contradicted} ეწინააღმდეგება ცოდნის ბაზას.`
        : `${counts.supported} of ${checked} checkable claims supported, ${counts.partially_supported} partially, ${counts.contradicted} contradicted by the knowledge base.`
      rationale_en = `${counts.supported} of ${checked} checkable claims supported, ${counts.partially_supported} partially, ${counts.contradicted} contradicted by the knowledge base.`
      evidence = flagged.map((c) => {
        const q = quoteFrom(segments, c.segments)
        return { ...q, quote: clip(c.claim), ...(c.claim_en ? { quote_en: clip(c.claim_en) } : {}) }
      })
      if (score === null) applicable = false
    } else if (d.source === 'sentiment') {
      score = spec.tone.agent.politeness
      rationale = ka
        ? `ოპერატორის თავაზიანობა ტექსტის მიხედვით: ${score}/100 (${spec.tone.agent.overall}).`
        : `Agent politeness from the words: ${score}/100 (${spec.tone.agent.overall}).`
      rationale_en = `Agent politeness from the words: ${score}/100 (${spec.tone.agent.overall}).`
      evidence = Object.entries(spec.tone.overrides)
        .filter(([i]) => segments[Number(i)]?.speaker === 'speaker_0')
        .slice(0, 3)
        .map(([i]) => quoteFrom(segments, [Number(i)]))
    } else {
      const ds = spec.dims[d.key]
      if (!ds) throw new Error(`seed: ${spec.id} has no score for dimension ${d.key}`)
      score = ds.s
      rationale = ds.r
      rationale_en = ds.r_en
      evidence = (ds.ev ?? []).map((group) => quoteFrom(segments, group))
      applicable = !ds.na
    }
    const dimension: ScoreDimension = {
      key: d.key,
      name: d.name,
      weight: d.weight,
      score,
      max: 100,
      contribution: 0,
      rationale,
      evidence,
      source: d.source,
      applicable,
      edited: false,
      ai_score: null,
    }
    if (d.name_en) dimension.name_en = d.name_en
    if (rationale_en && ka) dimension.rationale_en = rationale_en
    return dimension
  })
  const totals = computeTotals(dimensions)
  const scoring: Scorecard = {
    config_version: rubric.version,
    operator_speaker: 'speaker_0',
    dimensions: totals.dimensions,
    weighted_total: totals.weighted_total,
    max_total: 100,
    scored_weight: totals.scored_weight,
    unscored: totals.unscored,
    manually_edited: false,
    edited_by: null,
    revision: 1,
    scored_at: ranAt,
  }

  const analysis: CallAnalysis = { language: spec.language, ...spec.analysis, quality_score: totals.weighted_total }

  return {
    id: spec.id,
    client_id: spec.client_id,
    title: spec.title,
    language: spec.language,
    duration_s: media.duration_s,
    audio_url: media.audio_url,
    peaks: media.peaks,
    segments,
    analysis,
    kb_check,
    semantic,
    sentiment,
    scoring,
  }
}

/** Apply a reviewer's manual edit: edited dims keep the model's score in `ai_score`; totals recomputed. */
export function applyScoreEdit(card: Scorecard, scores: Record<string, number>, editedBy: string, at: string): Scorecard {
  const dimensions = card.dimensions.map((d) => {
    const next = scores[d.key]
    if (next === undefined || next === d.score) return d
    return { ...d, score: next, edited: true, ai_score: d.ai_score ?? d.score }
  })
  const totals = computeTotals(dimensions)
  return {
    ...card,
    dimensions: totals.dimensions,
    weighted_total: totals.weighted_total,
    scored_weight: totals.scored_weight,
    unscored: totals.unscored,
    manually_edited: true,
    edited_by: editedBy,
    revision: card.revision + 1,
    scored_at: at,
  }
}

/** Transcript text in the product's "Speaker: line" form. */
export function transcriptOf(segments: readonly Segment[], language: ContentLang | null): string {
  const agent = language === 'en' ? 'Agent' : language === 'ru' ? 'Оператор' : 'ოპერატორი'
  const customer = language === 'en' ? 'Customer' : language === 'ru' ? 'Клиент' : 'მომხმარებელი'
  return segments.map((s) => `${s.speaker === 'speaker_0' ? agent : customer}: ${s.text}`).join('\n')
}
