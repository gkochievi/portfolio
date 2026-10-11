/**
 * Pure scoring maths shared by the mock handlers and the UI. Architect-owned;
 * workbench, analysis and workspace-settings import it - request changes.
 */
import type { FactCheck, RubricDimension, ScoreBands, ScoreDimension, Scorecard, Segment, SpanLevel } from '@/types'

export const DEFAULT_BANDS: ScoreBands = { amber_from: 50, green_from: 80 }

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * weighted_total = sum(score * w) / sum(w) over scored, applicable dimensions.
 * Unscored dimensions are excluded, never counted as zero.
 */
export function computeTotals(dimensions: readonly ScoreDimension[]): {
  weighted_total: number
  scored_weight: number
  unscored: string[]
  dimensions: ScoreDimension[]
} {
  const scored = dimensions.filter((d) => d.applicable && d.score !== null && d.weight > 0)
  const scored_weight = scored.reduce((sum, d) => sum + d.weight, 0)
  const total = scored.reduce((sum, d) => sum + (d.score ?? 0) * d.weight, 0)
  const weighted_total = scored_weight > 0 ? Math.round(total / scored_weight) : 0
  return {
    weighted_total,
    scored_weight,
    unscored: dimensions.filter((d) => d.applicable && d.score === null).map((d) => d.key),
    dimensions: dimensions.map((d) => ({
      ...d,
      contribution: scored_weight > 0 && d.score !== null && d.applicable ? round1((d.score * d.weight) / scored_weight) : 0,
    })),
  }
}

/** Return a scorecard with totals and contributions recomputed. */
export function recomputeScorecard(card: Scorecard): Scorecard {
  const totals = computeTotals(card.dimensions)
  return { ...card, ...totals }
}

/** round(100 * (supported + 0.5 * partial) / (supported + partial + contradicted)); NOT_IN_KB excluded. */
export function factcheckAccuracy(counts: FactCheck['counts']): number | null {
  const denominator = counts.supported + counts.partially_supported + counts.contradicted
  if (denominator === 0) return null
  return Math.round((100 * (counts.supported + 0.5 * counts.partially_supported)) / denominator)
}

/** Workspace colour band for a score (UI colours; default 50 / 80). */
export function scoreBand(score: number | null, bands: ScoreBands = DEFAULT_BANDS): SpanLevel | null {
  if (score === null) return null
  if (score >= bands.green_from) return 'good'
  if (score >= bands.amber_from) return 'mid'
  return 'bad'
}

/** Span level the analysers use for timeline lanes (70 / 40, as in the product). */
export function spanLevel(score: number): SpanLevel {
  return score >= 70 ? 'good' : score >= 40 ? 'mid' : 'bad'
}

/** Brand score-pill tone: >=85 success, 70-84 primary, 50-69 warning, <50 danger. */
export function pillTone(score: number | null): 'success' | 'primary' | 'warning' | 'danger' | 'muted' {
  if (score === null) return 'muted'
  if (score >= 85) return 'success'
  if (score >= 70) return 'primary'
  if (score >= 50) return 'warning'
  return 'danger'
}

export interface TimeSpan {
  segments: number[]
  start: number
  end: number
}

/**
 * Merge segment indices into contiguous time spans (first start, last end).
 * Indices without times (text mode) are skipped.
 */
export function segmentsToSpans(segments: readonly Segment[], indices: readonly number[]): TimeSpan[] {
  const byIndex = new Map(segments.map((s) => [s.i, s]))
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  const spans: TimeSpan[] = []
  for (const index of sorted) {
    const segment = byIndex.get(index)
    if (!segment || segment.start === null || segment.end === null) continue
    const last = spans[spans.length - 1]
    if (last && last.segments[last.segments.length - 1] === index - 1) {
      last.segments.push(index)
      last.end = segment.end
    } else {
      spans.push({ segments: [index], start: segment.start, end: segment.end })
    }
  }
  return spans
}

/* ------------------------------------------------------------ rubric math */

export const isMeasured = (d: Pick<RubricDimension, 'source'>) => d.source !== 'model'

export function weightSum(dimensions: readonly Pick<RubricDimension, 'weight'>[]): number {
  return dimensions.reduce((sum, d) => sum + (Number.isFinite(d.weight) ? d.weight : 0), 0)
}

/** Scale weights to sum to 100 (integers); rounding drift goes on the last dimension. */
export function normaliseWeights<T extends Pick<RubricDimension, 'weight'>>(dimensions: readonly T[]): T[] {
  const sum = weightSum(dimensions)
  if (dimensions.length === 0) return []
  if (sum <= 0) {
    const even = Math.floor(100 / dimensions.length)
    return dimensions.map((d, i) => ({ ...d, weight: i === dimensions.length - 1 ? 100 - even * (dimensions.length - 1) : even }))
  }
  const scaled = dimensions.map((d) => ({ ...d, weight: Math.round((d.weight / sum) * 100) }))
  const drift = 100 - weightSum(scaled)
  const last = scaled[scaled.length - 1]
  if (last) last.weight += drift
  return scaled
}

export type RubricError = 'empty' | 'unnamed' | 'sum' | 'negative' | 'duplicate_key'

/** Validation: at least one dimension, all named, weights >= 0, unique keys, sum = 100. */
export function validateRubric(dimensions: readonly RubricDimension[]): RubricError[] {
  const errors: RubricError[] = []
  if (dimensions.length === 0) errors.push('empty')
  if (dimensions.some((d) => !d.name.trim())) errors.push('unnamed')
  if (dimensions.some((d) => d.weight < 0)) errors.push('negative')
  if (new Set(dimensions.map((d) => d.key)).size !== dimensions.length) errors.push('duplicate_key')
  if (dimensions.length > 0 && weightSum(dimensions) !== 100) errors.push('sum')
  return errors
}
