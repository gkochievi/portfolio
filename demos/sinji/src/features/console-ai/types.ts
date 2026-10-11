/**
 * Wire types shared by the console-ai screens and their mock handlers
 * (src/demo/handlers/console-ai.ts). Entities themselves live in `@/types`.
 */
import type {
  AiCapability,
  AiEffective,
  AiLegacyOverride,
  AiConnection,
  ChatScope,
  Id,
  TranscriptionSettings,
} from '@/types'

export const CAPABILITIES: readonly AiCapability[] = ['llm', 'stt', 'tts'] as const
export const CHAT_SCOPES: readonly ChatScope[] = ['chat:turn', 'chat:suggest', 'chat:answer', 'chat:sync'] as const

export type ConnectionSettingValue = string | number | boolean

export interface ConnectionInput {
  name: string
  capability: AiCapability
  provider: string
  model: string
  base_url: string | null
  /** Write-only. Omit on edit to keep the stored key. */
  api_key?: string
  /** Edit only: drop the stored key. */
  clear_key?: boolean
  settings: Record<string, ConnectionSettingValue>
}

export interface ConnectionPatch extends Partial<Omit<ConnectionInput, 'capability'>> {
  is_active?: boolean
}

export interface ConnectionTestResult {
  ok: boolean
  detail: string
  at: string
  connection: AiConnection
}

/** One cell of the AI setup matrix. */
export interface AssignmentCell extends AiEffective {
  /** True when an explicit connection is assigned to this workspace. */
  assigned: boolean
  /** True when the workspace brings its own key (BYO). */
  own_key: boolean
}

export interface AssignmentRow {
  tenant_id: Id
  name: string
  name_ka: string
  slug: string
  is_active: boolean
  cells: Record<AiCapability, AssignmentCell>
}

export interface AssignmentsPayload {
  defaults: Record<AiCapability, { connection_id: Id; name: string; provider: string; model: string } | null>
  rows: AssignmentRow[]
}

export interface LegacyView extends AiLegacyOverride {
  key_hint: string | null
  updated_by: string | null
}

export interface TenantAiPayload {
  tenant: { id: Id; name: string; name_ka: string; slug: string; is_active: boolean }
  assignments: Record<AiCapability, Id | null>
  effective: Record<AiCapability, AiEffective & { own_key: boolean }>
  connections: AiConnection[]
  legacy: LegacyView
}

export interface LegacyInput {
  enabled: boolean
  provider: string
  model: string
  base_url: string | null
  /** Write-only. */
  api_key?: string
  notes: string
}

export interface TenantAiInput {
  assignments: Record<AiCapability, Id | null>
  legacy: LegacyInput
}

export interface InstructionsPayload {
  instructions: string
  max_length: number
}

export type SelfTestMode = 'quick' | 'deep'

export interface TranscriptionDefaultPayload {
  /** What the operator layer holds (the full set once saved). */
  settings: TranscriptionSettings
  /** What applies before the operator layer (built-in values). */
  code_default: TranscriptionSettings
  updated_at: string | null
  updated_by: string | null
}

export interface IntegrationSecretOnce {
  key_id: string
  secret: string
}

export interface IntegrationGrantInput {
  client_id: Id
  scopes: ChatScope[]
  is_active: boolean
}

export interface IntegrationCreateInput {
  name: string
  scopes: ChatScope[]
  grants: IntegrationGrantInput[]
}

export interface IntegrationPatch {
  name?: string
  scopes?: ChatScope[]
  is_active?: boolean
  grants?: IntegrationGrantInput[]
}

export interface DiagnoseResult {
  verdict: import('@/types').DiagnoseVerdict
  detail: string
}

export interface EmbeddingsProviderOption {
  id: string
  name: string
  models: Array<{ id: string; dim: number }>
  default_base_url: string | null
}

export interface EmbeddingsPayload {
  provider: string
  model: string
  base_url: string | null
  dim: number
  api_key_set: boolean
  api_key_hint: string | null
  providers: EmbeddingsProviderOption[]
  indexed_chunks: number
}

export interface EmbeddingsInput {
  provider: string
  model: string
  base_url: string | null
  dim: number
  /** Write-only. */
  api_key?: string
  clear_key?: boolean
  /** Required when `dim` differs from the stored dimension. */
  acknowledge_reimport?: boolean
}

export interface EmbeddingsTestResult {
  ok: boolean
  detail: string
}
