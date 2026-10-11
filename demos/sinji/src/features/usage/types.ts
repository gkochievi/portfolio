/**
 * Wire types for the usage group's endpoints (`/admin/usage/*`). Tokens only, never money.
 */
import type { ChatConversation, ChatTurn, Id, ISODate, LlmUsage, UsageFilters, UsageGroup } from '@/types'

/** The shared filter set. `feature` and `actor` are extra drill-down filters set by clicking breakdown rows. */
export type UsageQuery = UsageFilters & { feature?: string; actor?: string }

export interface PageQuery {
  q?: string
  sort?: string
  dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface UsageFacets {
  workspaces: Array<{ id: Id; name: string; name_ka: string }>
  groups: string[]
  providers: string[]
  models: string[]
  capabilities: string[]
  features: string[]
  actors: string[]
}

export interface UsageTotals {
  calls: number
  failed: number
  input: number
  output: number
  total: number
  cache_read: number
  cache_write: number
  audio_seconds: number
  characters: number
  byo_calls: number
  byo_tokens: number
}

export interface UsageBucket {
  /** Bucket start (ISO). */
  ts: ISODate
  input: number
  output: number
  calls: number
}

export interface BreakdownRow {
  key: string
  label: string
  label_ka?: string
  calls: number
  failed: number
  input: number
  output: number
  total: number
  cached: number
}

export type BreakdownDimension = 'workspace' | 'group' | 'provider' | 'model' | 'feature' | 'user'

export interface UsageOverview {
  window: { from: ISODate; to: ISODate; bucket: 'hour' | 'day' }
  totals: UsageTotals
  series: UsageBucket[]
  breakdown: Record<BreakdownDimension, BreakdownRow[]>
  byo_workspaces: Array<{ id: Id; name: string; name_ka: string; calls: number; tokens: number }>
}

export interface UsageRecordingRow {
  id: Id
  client_id: Id | null
  workspace: string
  workspace_ka: string
  filename: string
  created_at: ISODate
  created_by: string
  duration_s: number | null
  status: string
  calls: number
  failed: number
  input: number
  output: number
  total: number
  groups: Partial<Record<UsageGroup, number>>
}

export interface UsageGroupCard {
  group: UsageGroup
  calls: number
  failed: number
  input: number
  output: number
  cached: number
  total: number
  audio_seconds: number
  characters: number
  models: string[]
}

export interface UsageRecordingDetail {
  recording: {
    id: Id
    client_id: Id | null
    workspace: string
    workspace_ka: string
    filename: string
    created_at: ISODate
    created_by: string
    duration_s: number | null
    status: string
    language: string | null
  }
  totals: UsageTotals
  groups: UsageGroupCard[]
  calls: CallRow[]
  digests: Array<{ id: Id; title: string; title_en?: string; created_at: ISODate; recordings: number; tokens: number; calls: number }>
}

export interface UsageConversationRow {
  id: Id
  client_id: Id
  workspace: string
  workspace_ka: string
  subject: string
  channel: ChatConversation['channel']
  state: ChatConversation['state']
  mode: ChatConversation['mode']
  created_at: ISODate
  last_message_at: ISODate
  turns: number
  questions: number
  calls: number
  failed: number
  total: number
  features: Partial<Record<'triage' | 'autopilot' | 'handoff' | 'copilot', number>>
}

export interface UsageConversationTurn {
  id: Id
  role: ChatTurn['role']
  content: string
  grounded: boolean | null
  method: ChatTurn['method']
  top_score: number | null
  created_at: ISODate
  calls: CallRow[]
  tokens: number
}

export interface UsageConversationDetail {
  conversation: UsageConversationRow & { locale: string }
  totals: UsageTotals
  turns: UsageConversationTurn[]
  /** Calls that belong to the conversation but to no particular turn (handoff summaries). */
  extra_calls: CallRow[]
  features: Array<{ feature: string; calls: number; tokens: number }>
}

export interface CallTarget {
  kind: 'recording' | 'conversation' | 'digest'
  id: Id
  label: string | null
  /** False when the row points at something that no longer exists (archived). */
  exists: boolean
}

export interface CallRow extends LlmUsage {
  workspace: string | null
  workspace_ka: string | null
  target: CallTarget | null
}
