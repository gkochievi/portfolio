/** Response DTOs of the ops endpoints (shared by the mock handler and the UI). */
import type {
  ActivityLog,
  BillingDetails,
  HealthHistoryPoint,
  HealthIncident,
  HealthSnapshot,
  MailBackfillRun,
  SchedulerJobName,
  SchedulerRun,
  StaffRole,
  SystemLog,
  SystemSettings,
} from '@/types'

export interface NamedRef {
  id: string
  name: string
}

export interface AuditRow extends ActivityLog {
  actorNameKa: string | null
  partnerName: string | null
}

export interface AuditPage {
  items: AuditRow[]
  total: number
  page: number
  pageSize: number
  facets: {
    actors: (NamedRef & { nameKa: string | null; role: StaffRole })[]
    partners: NamedRef[]
  }
}

export interface AuditFilters {
  entityType?: string
  actorId?: string
  partnerId?: string
  since?: string
  until?: string
  page?: number
}

export interface SystemLogRow extends SystemLog {
  partnerName: string | null
}

export interface SystemLogPage {
  items: SystemLogRow[]
  total: number
  page: number
  pageSize: number
  facets: { partners: NamedRef[]; sources: string[] }
}

export interface SystemLogFilters {
  level?: string
  source?: string
  partnerId?: string
  requestId?: string
  since?: string
  until?: string
  q?: string
}

export interface RetentionDto {
  days: number
}

export interface HealthSnapshotDto extends HealthSnapshot {
  retentionDays: number
}

export type HealthHistoryDto = HealthHistoryPoint[]

export type IncidentDto = HealthIncident & { durationSec: number | null }

/** Settings as served: passwords are never sent back, only whether one is set. */
export interface MailSettingsDto {
  imap: Omit<SystemSettings['imap'], 'password'> & { hasPassword: boolean }
  smtp: Omit<SystemSettings['smtp'], 'password'> & { hasPassword: boolean }
  appBaseUrl: string
}

export interface MailSettingsInput {
  imap: SystemSettings['imap']
  smtp: SystemSettings['smtp']
  appBaseUrl: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  latencyMs: number
}

export type BillingDto = BillingDetails

export interface BackfillDto {
  latest: MailBackfillRun | null
  history: MailBackfillRun[]
}

export interface SchedulerJobDto {
  name: SchedulerJobName
  cron: string
  registered: boolean
  lastRun: SchedulerRun | null
}

export interface SchedulerJobsDto {
  jobs: SchedulerJobDto[]
  recent: SchedulerRun[]
}

export interface PurgeResult {
  purgedMails: number
  purgedAttachments: number
}
