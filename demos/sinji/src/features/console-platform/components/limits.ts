import type { LimitsConfig } from '@/types'

export interface LimitsDraft {
  enabled: boolean
  analyses: string
  tts: string
  conversions: string
  audioMb: string
  features: LimitsConfig['features']
}

export const FEATURE_KEYS = ['analyze', 'tts', 'convert', 'score', 'semantic', 'summarise'] as const

export const toDraft = (limits: LimitsConfig): LimitsDraft => ({
  enabled: limits.enabled,
  analyses: String(limits.max_analyses_per_day),
  tts: String(limits.max_tts_per_day),
  conversions: String(limits.max_conversions_per_day),
  audioMb: String(limits.max_audio_mb),
  features: { ...limits.features },
})

/** A whole number within [min, max], or null. */
export function parseWhole(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const n = Number(value)
  return n >= min && n <= max ? n : null
}

/** Draft -> wire config, or the field errors (error codes, translated by the caller). */
export function fromDraft(draft: LimitsDraft): { config: LimitsConfig | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const analyses = parseWhole(draft.analyses, 0, 10_000)
  const tts = parseWhole(draft.tts, 0, 10_000)
  const conversions = parseWhole(draft.conversions, 0, 10_000)
  const audio = parseWhole(draft.audioMb, 1, 500)
  if (analyses === null) errors.analyses = 'range_0_10000'
  if (tts === null) errors.tts = 'range_0_10000'
  if (conversions === null) errors.conversions = 'range_0_10000'
  if (audio === null) errors.audioMb = 'range_1_500'
  if (analyses === null || tts === null || conversions === null || audio === null) return { config: null, errors }
  return {
    config: {
      enabled: draft.enabled,
      max_analyses_per_day: analyses,
      max_tts_per_day: tts,
      max_conversions_per_day: conversions,
      max_audio_mb: audio,
      features: draft.features,
    },
    errors,
  }
}

/** Server field names -> draft field names. */
export const serverToDraftField: Record<string, string> = {
  max_analyses_per_day: 'analyses',
  max_tts_per_day: 'tts',
  max_conversions_per_day: 'conversions',
  max_audio_mb: 'audioMb',
}
