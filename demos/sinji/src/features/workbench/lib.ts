/**
 * Pure helpers for the call-detail timeline: finding lanes, per-segment worst
 * level, inline claim marks. OWNED BY: workbench.
 */
import { segmentsToSpans, spanLevel } from '@/lib/scoring'
import type { Claim, Recording, Segment, SpanLevel, Verdict } from '@/types'

export type LaneKind = 'dimension' | 'factcheck' | 'text_tone' | 'voice_tone'

export interface LaneSpan {
  start: number
  end: number
  segments: number[]
  level: SpanLevel
  label: string
  detail?: string
}

export interface Lane {
  id: string
  kind: LaneKind
  name: string
  name_en?: string
  spans: LaneSpan[]
}

const LEVEL_RANK: Record<SpanLevel, number> = { good: 0, mid: 1, bad: 2 }
export const worseLevel = (a: SpanLevel | null, b: SpanLevel): SpanLevel => (a === null || LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a)

export const verdictLevel = (v: Verdict): SpanLevel => (v === 'SUPPORTED' ? 'good' : v === 'CONTRADICTED' ? 'bad' : 'mid')

/** Spans for runs of segments sharing a level (contiguous indices merge). */
function levelSpans(
  segments: readonly Segment[],
  entries: Array<{ i: number; level: SpanLevel; label: string; detail?: string }>,
): LaneSpan[] {
  const out: LaneSpan[] = []
  for (const level of ['bad', 'mid', 'good'] as const) {
    const mine = entries.filter((e) => e.level === level)
    for (const span of segmentsToSpans(segments, mine.map((e) => e.i))) {
      const first = mine.find((e) => e.i === span.segments[0])
      const detail = mine.find((e) => e.detail && span.segments.includes(e.i))?.detail
      out.push({
        ...span,
        level,
        label: first?.label ?? '',
        ...(detail ? { detail } : {}),
      })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** All lanes of a call (empty for text mode: spans need times). */
export function buildLanes(rec: Recording): Lane[] {
  const lanes: Lane[] = []
  const segs = rec.segments

  for (const d of rec.scoring?.dimensions ?? []) {
    if (d.source !== 'model' || d.score === null || !d.applicable) continue
    const indices = d.evidence.flatMap((e) => e.segments)
    const spans = segmentsToSpans(segs, indices).map<LaneSpan>((s) => ({
      ...s,
      level: spanLevel(d.score ?? 0),
      label: `${d.score}/${d.max}`,
      detail: d.rationale,
    }))
    if (spans.length > 0) {
      lanes.push({ id: `dim:${d.key}`, kind: 'dimension', name: d.name, ...(d.name_en ? { name_en: d.name_en } : {}), spans })
    }
  }

  if (rec.kb_check && rec.kb_check.claims.length > 0) {
    const spans: LaneSpan[] = []
    for (const claim of rec.kb_check.claims) {
      for (const s of segmentsToSpans(segs, claim.segments)) {
        spans.push({ ...s, level: verdictLevel(claim.verdict), label: claim.verdict, detail: claim.claim })
      }
    }
    if (spans.length > 0) lanes.push({ id: 'factcheck', kind: 'factcheck', name: 'factcheck', spans: spans.sort((a, b) => a.start - b.start) })
  }

  if (rec.semantic) {
    const text = levelSpans(
      segs,
      rec.semantic.segments.map((s) => ({ i: s.i, level: s.text_level, label: s.text_tone, ...(s.text_note ? { detail: s.text_note } : {}) })),
    )
    if (text.length > 0) lanes.push({ id: 'text_tone', kind: 'text_tone', name: 'text_tone', spans: text })
    const voice = levelSpans(
      segs,
      rec.semantic.segments
        .filter((s) => s.voice_level && s.voice_label)
        .map((s) => ({ i: s.i, level: s.voice_level as SpanLevel, label: s.voice_label as string })),
    )
    if (voice.length > 0) lanes.push({ id: 'voice_tone', kind: 'voice_tone', name: 'voice_tone', spans: voice })
  }
  return lanes
}

/** Worst finding level per segment index across every lane (text mode: from claims and tone only). */
export function worstLevels(rec: Recording): Map<number, SpanLevel> {
  const map = new Map<number, SpanLevel>()
  const mark = (i: number, level: SpanLevel) => map.set(i, worseLevel(map.get(i) ?? null, level))
  for (const claim of rec.kb_check?.claims ?? []) for (const i of claim.segments) mark(i, verdictLevel(claim.verdict))
  for (const s of rec.semantic?.segments ?? []) {
    mark(s.i, s.text_level)
    if (s.voice_level) mark(s.i, s.voice_level)
  }
  for (const d of rec.scoring?.dimensions ?? []) {
    if (d.source !== 'model' || d.score === null) continue
    const level = spanLevel(d.score)
    if (level === 'good') continue
    for (const e of d.evidence) for (const i of e.segments) mark(i, level)
  }
  return map
}

/** Sentiment ribbon parts (voice level when known, otherwise text level). */
export function buildRibbon(rec: Recording): Array<{ start: number; end: number; sentiment: 'negative' | 'neutral' | 'positive' }> {
  if (!rec.semantic) return []
  const map = { good: 'positive', mid: 'neutral', bad: 'negative' } as const
  const parts: Array<{ start: number; end: number; sentiment: 'negative' | 'neutral' | 'positive' }> = []
  for (const st of rec.semantic.segments) {
    const seg = rec.segments.find((s) => s.i === st.i)
    if (!seg || seg.start === null || seg.end === null) continue
    const sentiment = map[st.voice_level ?? st.text_level]
    const last = parts[parts.length - 1]
    if (last && last.sentiment === sentiment && seg.start - last.end < 1.5) last.end = seg.end
    else parts.push({ start: seg.start, end: seg.end, sentiment })
  }
  return parts
}

/* --------------------------------------------------------- claim marks */

const VERDICT_RANK: Record<Verdict, number> = { CONTRADICTED: 3, PARTIALLY_SUPPORTED: 2, NOT_IN_KB: 1, SUPPORTED: 0 }
export const worstVerdict = (claims: readonly Claim[]): Verdict =>
  claims.reduce<Verdict>((acc, c) => (VERDICT_RANK[c.verdict] > VERDICT_RANK[acc] ? c.verdict : acc), 'SUPPORTED')

const words = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).map((w) => w.slice(0, 6)))

export const sentencesOf = (text: string): string[] => {
  const parts = text.split(/(?<=[.!?…])\s+/).filter(Boolean)
  return parts.length > 0 ? parts : [text]
}

export interface TextPiece {
  text: string
  claims: Claim[]
}

/** Split a segment into sentences and attach each claim to the sentence it overlaps most. */
export function piecesFor(text: string, claims: readonly Claim[], claimText: (c: Claim) => string): TextPiece[] {
  const sentences = sentencesOf(text)
  const pieces: TextPiece[] = sentences.map((s) => ({ text: s, claims: [] }))
  for (const claim of claims) {
    const cw = words(claimText(claim))
    let best = 0
    let bestScore = -1
    sentences.forEach((s, idx) => {
      const sw = words(s)
      let shared = 0
      for (const w of cw) if (sw.has(w)) shared += 1
      if (shared > bestScore) {
        bestScore = shared
        best = idx
      }
    })
    pieces[best]?.claims.push(claim)
  }
  // Re-join with spaces so copy/paste keeps the original text.
  return pieces.map((p, idx) => ({ ...p, text: idx < pieces.length - 1 ? `${p.text} ` : p.text }))
}

export const claimClass: Record<Verdict, string> = {
  SUPPORTED: 'claim-supported',
  PARTIALLY_SUPPORTED: 'claim-partial',
  CONTRADICTED: 'claim-contradicted',
  NOT_IN_KB: 'claim-not-in-kb',
}
