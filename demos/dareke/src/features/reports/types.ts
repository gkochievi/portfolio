/** Types used only by the reports feature (handler + UI). */
import type { CallOutcome, CallRecordView, CampaignStatus, Localized, Tone } from '@/types'

export interface ReportFilters {
  campaigns: Array<{ id: string; name: Localized; status: CampaignStatus }>
  agents: Array<{ id: string; name: Localized; isActive: boolean }>
  dispositions: Array<{ code: string; name: Localized; color: Tone }>
}

export interface DateRange {
  /** ISO, inclusive. */
  from: string
  /** ISO, inclusive. */
  to: string
}

export interface CallDetailParams extends DateRange {
  campaignId?: string
  agentId?: string
}

export interface CallListFilters {
  campaignId?: string
  agentId?: string
  disposition?: string
  outcome?: CallOutcome
  from?: string
  to?: string
  phone?: string
  page: number
  pageSize: number
}

/** GET /calls/:id: the call plus every other call to the same phone. */
export interface CallDetail extends CallRecordView {
  otherCalls: CallRecordView[]
}
