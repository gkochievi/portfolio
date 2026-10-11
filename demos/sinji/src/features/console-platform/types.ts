/** Wire types local to the console-platform group (the shared entities live in `@/types`). */
import type { HealthSample, HealthSettings, LimitsConfig, Tenant, TtsLanguage, Voice } from '@/types'

export interface ConsoleSummary {
  tenants: number
  active_tenants: number
  tenant_users: number
  registered_users: number
  retention_days: number
  voices: { mode: 'all' | 'allowlist'; voice_ids: string[] }
  health: HealthSettings
  public_sentiment: { enabled: boolean; guidance: string }
}

export interface TenantInput {
  name: string
  name_ka: string
  slug: string
  industry: Tenant['industry']
  region: string
}

/** A create / rotate response: the full key exists only here. */
export interface TenantWithKey {
  tenant: Tenant
  api_key: string
}

export interface TenantUserInput {
  username: string
  display_name: string
  role: 'owner' | 'member'
  password?: string
}

export interface PasswordResult {
  password: string
}

export interface HealthOverview {
  sample: HealthSample
  /** The sample five minutes earlier, for the KPI deltas. */
  previous: HealthSample
  settings: HealthSettings
}

export interface AnonymousPayload {
  limits: LimitsConfig
  public_sentiment: { enabled: boolean; guidance: string }
}

export interface VoicesPayload {
  mode: 'all' | 'allowlist'
  voice_ids: string[]
  voices: Voice[]
  languages: TtsLanguage[]
}

export interface UserPatch {
  is_active?: boolean
  /** `null` clears one override (back to the tier default). */
  limits?: Partial<Record<'analyses' | 'tts' | 'conversions' | 'max_audio_mb', number | null>>
}

export const INDUSTRIES: Tenant['industry'][] = ['bank', 'insurance', 'clinic', 'telecom', 'hotel', 'delivery']

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
