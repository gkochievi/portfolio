import type { SpanLevel, TextTone, VoiceEmotion } from '@/types'
import type { Tone } from '@/components/ui'

/** Badge tone for a text tone. */
export const textToneBadge: Record<TextTone, Exclude<Tone, never>> = {
  polite: 'success',
  neutral: 'neutral',
  curt: 'warning',
  impolite: 'danger',
  rude: 'danger',
  aggressive: 'danger',
}

/** Badge tone for a voice emotion. */
export const voiceBadge: Record<VoiceEmotion, Exclude<Tone, never>> = {
  calm: 'success',
  happy: 'success',
  neutral: 'neutral',
  sad: 'warning',
  frustrated: 'warning',
  angry: 'danger',
}

/** Literal class names (Tailwind scans source, so no string building). */
export const levelBorder: Record<SpanLevel, string> = {
  good: 'border-l-success/60',
  mid: 'border-l-warning',
  bad: 'border-l-danger',
}

export const levelText: Record<SpanLevel, string> = {
  good: 'text-success',
  mid: 'text-warning',
  bad: 'text-danger',
}

export const levelMeterTone: Record<SpanLevel, 'success' | 'warning' | 'danger'> = {
  good: 'success',
  mid: 'warning',
  bad: 'danger',
}

export const worstLevel = (...levels: Array<SpanLevel | null | undefined>): SpanLevel => {
  const present = levels.filter((l): l is SpanLevel => !!l)
  if (present.includes('bad')) return 'bad'
  if (present.includes('mid')) return 'mid'
  return 'good'
}

/** 0..1 ratios and 0..100 percentages both appear in seeds; normalise to 0..100. */
export const toPercent = (value: number): number => Math.round(value <= 1 ? value * 100 : value)
