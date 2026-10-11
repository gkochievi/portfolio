/**
 * Wire types for the staff group (My scores, Send survey SMS).
 *
 * Owner: feature group staff.
 */
import type {
  Branch,
  Campaign,
  Distribution,
  ISODate,
  KpiSet,
  QuestionStat,
  Recipient,
  Staff,
  Tenant,
  TrendPoint,
} from '@/types'

export interface MyOverview {
  staff: Staff
  branch: Branch
  tenant: Tenant
  /** Look-back window the numbers cover. */
  days: number
  kpis: KpiSet
  /** Responses submitted for this staff member inside the window. */
  responseCount: number
  trend: TrendPoint[]
  distribution: Distribution
  /** The campaign the per-question averages belong to (the one he sends most). */
  campaign: Campaign | null
  questions: QuestionStat[]
  myAvg: number | null
  branchAvg: number | null
  tenantAvg: number | null
  /** Position by average rating among the branch's staff (1 = best). */
  rank: { position: number; of: number }
}

export interface SendOptions {
  tenants: Tenant[]
  campaigns: Campaign[]
  branches: Branch[]
  staff: Staff[]
  recipients: Recipient[]
  /** True when branch and staff are fixed to the signed-in agent. */
  locked: boolean
}

export interface SendSurveyRequest {
  campaignId: string
  branchId: string
  staffId: string
  recipientId?: string
  /** National number, digits only, fake pattern 5XX 00 00 XX. */
  phone?: string
  interactionAt?: ISODate
}
