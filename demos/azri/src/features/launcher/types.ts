/**
 * Wire types of the launcher group (SMS inbox + API playground).
 * Owner: feature group launcher. Anyone may import; only the owner edits.
 */
import type { HttpMethod } from '@portfolio/demo-kit'

import type { ISODate, LinkStatus, LocalizedText, SmsMessage, Tenant } from '@/types'

/** Live status of the link an SMS carries. */
export type InboxLinkStatus = LinkStatus | 'unknown' | 'missing'

/** Just enough of a tenant to draw its monogram and colours in the inbox. */
export type TenantBrandingLite = Pick<
  Tenant,
  'id' | 'name' | 'monogram' | 'smsSender' | 'primary' | 'onPrimary' | 'tint' | 'primaryDark'
>

export interface RecipientSummary {
  id: string
  name: LocalizedText
  phoneMasked: string
  avatarColor: string
  /** Demo account that plays this persona (Mariam), else null. */
  accountId: string | null
  counts: { pending: number; completed: number; expired: number; total: number }
}

export type InboxMessage = SmsMessage & {
  linkStatus: InboxLinkStatus
  tenant: TenantBrandingLite
  campaignId: string | null
  campaignTitle: LocalizedText | null
  expiresAt: ISODate | null
  completedAt: ISODate | null
}

export type BranchKind = 'valid' | 'completed' | 'expired' | 'unknown' | 'missing'

export interface BranchSample {
  kind: BranchKind
  surveyId: string | null
  /** In-app target; '' when no link of this kind is left (e.g. every link expired). */
  href: string
  tenantId: string | null
  recipientId: string | null
}

export interface ClockState {
  offsetMs: number
  now: ISODate
}

export interface PlaygroundRoute {
  method: HttpMethod
  /** Full path including the /api prefix. */
  path: string
  requiresAuth: boolean
}
