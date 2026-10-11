/**
 * Wire types local to the insights group (admin overview + responses feed).
 * Owner: feature group insights.
 */
import type { KpiSet, LocalizedText, QuestionStat, ResponseRow, TrendPoint, Distribution } from '@/types'

/** One row of the per-tenant (or, once a tenant is chosen, per-branch) table. */
export interface BreakdownRow {
  id: string
  name: LocalizedText
  /** Tenant id the row belongs to (the row itself for the tenant level). */
  tenantId: string
  sent: number
  responses: number
  avgRating: number | null
  responseRate: number
}

export interface Overview {
  /** Window length the numbers cover. */
  days: number
  kpis: KpiSet
  /** The same KPIs over the window before this one (for deltas). */
  previous: KpiSet
  /** Responses submitted in the window / in the previous window. */
  responses: number
  previousResponses: number
  trend: TrendPoint[]
  distribution: Distribution
  breakdown: { level: 'tenant' | 'branch'; rows: BreakdownRow[] }
  /** Only when a campaign is selected. */
  questions: QuestionStat[]
  /** 8 newest responses with a comment. */
  latestComments: ResponseRow[]
}

/** Filters the overview and responses pages keep in the URL. */
export interface InsightsFilters {
  tenantId: string
  branchId: string
  staffId: string
  campaignId: string
  days: number
}

export interface ResponsesQuery extends InsightsFilters {
  rating: string
  hasComment: boolean
  q: string
  page: number
  pageSize: number
}
