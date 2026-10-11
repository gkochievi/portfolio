/**
 * Wire types for the campaigns group (admin campaigns + SMS dispatch log).
 * Owner: feature group campaigns.
 */
import type {
  Campaign,
  Distribution,
  KpiSet,
  LinkRow,
  LinkStatus,
  LocalizedText,
  Page,
  QuestionStat,
  ResponseRow,
  Tenant,
  TrendPoint,
} from '@/types'

/** GET /api/console/campaigns -> CampaignSummary[] */
export interface CampaignSummary {
  campaign: Campaign
  tenant: Tenant
  questionCount: number
  kpis: KpiSet
  /** Always the last 14 days. */
  trend: TrendPoint[]
}

export interface BranchBreakdown {
  branchId: string
  name: LocalizedText
  sent: number
  completed: number
  avgRating: number | null
}

/** GET /api/console/campaigns/:campaignId -> CampaignDetail */
export interface CampaignDetail {
  campaign: Campaign
  tenant: Tenant
  questions: QuestionStat[]
  kpis: KpiSet
  trend: TrendPoint[]
  distribution: Distribution
  byBranch: BranchBreakdown[]
  latestComments: ResponseRow[]
  /** First still-pending persona link of this campaign (for "Open a sample link"), or null. */
  sampleLinkId: string | null
}

export type LinkStatusFilter = LinkStatus | 'all'

export interface LinkCounts {
  all: number
  pending: number
  completed: number
  expired: number
}

/** GET /api/console/links -> Page<LinkRow> plus per-status counts for the tabs. */
export interface LinksPage extends Page<LinkRow> {
  counts: LinkCounts
}

export interface LinksQuery {
  status?: LinkStatusFilter
  tenantId?: string
  campaignId?: string
  branchId?: string
  q?: string
  page?: number
  pageSize?: number
}
