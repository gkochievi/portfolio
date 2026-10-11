/** View models and small shared types of the admin-integrations feature. */
import type { AiLinkStatus, ChannelFeatures, FaqTree, MetaAuthStatus, TenantIntegrations } from '@/types'

export type MetaChannel = 'facebook_messenger' | 'instagram' | 'whatsapp'
export const META_CHANNELS: readonly MetaChannel[] = ['facebook_messenger', 'instagram', 'whatsapp']

/** GET /api/admin/integrations: the tenant's integrations plus the platform's channel switches. */
export interface IntegrationsView extends TenantIntegrations {
  features: ChannelFeatures
  /** The TikTok authorise popup is open and the platform has not answered yet. */
  tiktokPending: boolean
}

export interface FaqState {
  faqEnabled: boolean
  faqShowOperatorButton: boolean
  tree: FaqTree
}

export interface MetaTestResult {
  ok: boolean
  status: MetaAuthStatus
  message: string
  testedAt: string
}

export interface SimpleTestResult {
  ok: boolean
  message: string
  testedAt: string
}

export interface TikTokCheckResult {
  state: TenantIntegrations['tiktok']['state']
  changed: boolean
}

export type AiReason = 'server_not_configured' | 'no_client_id' | 'switch_off' | 'autopilot_off' | 'circuit_open' | 'bot_paused'

/** GET /api/admin/ai-link: the stored link plus what the console derives from it. */
export interface AiLinkView extends AiLinkStatus {
  live: boolean
  reasons: AiReason[]
  baseUrl: string
}

export interface AiTestResult {
  ok: boolean
  lines: string[]
  link: AiLinkView
}

export type FaqIssueCode =
  | 'no_root'
  | 'unreachable'
  | 'no_options'
  | 'option_no_target'
  | 'dangling_target'
  | 'empty_text'
  | 'empty_label'

export interface FaqIssue {
  nodeId: string
  optionId?: string
  code: FaqIssueCode
}
