/**
 * Ops: React Query hooks. Every key starts with a ChangedEntity, so the
 * shell's bus listener refetches after any mutation (or simulator tick).
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { ApiError, http } from '@/lib/api'
import type { MailBackfillRun, SchedulerRun } from '@/types'

import type { HistoryRange } from './lib/metrics'
import type {
  AuditFilters,
  AuditPage,
  BackfillDto,
  BillingDto,
  ConnectionTestResult,
  HealthHistoryDto,
  HealthSnapshotDto,
  IncidentDto,
  MailSettingsDto,
  MailSettingsInput,
  PurgeResult,
  RetentionDto,
  SchedulerJobsDto,
  SystemLogFilters,
  SystemLogPage,
} from './lib/types'

/** First message per field from a mock validation error, keyed by field name. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? '']))
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function clean<T extends object>(filters: T): Record<string, string | number> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Record<string, string | number>
}

/* ------------------------------------------------------------------ audit */

export function useAuditLog(filters: AuditFilters) {
  return useQuery({
    queryKey: ['audit', 'list', filters],
    queryFn: () => http.get<AuditPage>('/audit', clean(filters)),
    placeholderData: keepPreviousData,
  })
}

/* ------------------------------------------------------------ system logs */

export type SystemLogQuery = SystemLogFilters & { page?: number }

export function useSystemLogs(query: SystemLogQuery) {
  return useQuery({
    queryKey: ['system-logs', 'list', query],
    queryFn: () => http.get<SystemLogPage>('/system-logs', clean(query)),
    placeholderData: keepPreviousData,
  })
}

/** Every row matching the filters (for the CSV export). */
export function fetchAllSystemLogs(filters: SystemLogFilters) {
  return http.get<SystemLogPage>('/system-logs', { ...clean(filters), all: 1 })
}

export function useLogRetention() {
  return useQuery({ queryKey: ['system-logs', 'retention'], queryFn: () => http.get<RetentionDto>('/system-logs/retention') })
}

export function useSaveLogRetention() {
  return useMutation({ mutationFn: (days: number) => http.put<RetentionDto>('/system-logs/retention', { days }) })
}

/* ----------------------------------------------------------------- health */

export function useHealthSnapshot(autoRefresh: boolean) {
  return useQuery({
    queryKey: ['health', 'snapshot'],
    queryFn: () => http.get<HealthSnapshotDto>('/system-health/snapshot'),
    refetchInterval: autoRefresh ? 5000 : false,
    placeholderData: keepPreviousData,
  })
}

export function useHealthHistory(metric: string, range: HistoryRange, autoRefresh: boolean) {
  return useQuery({
    queryKey: ['health', 'history', metric, range],
    queryFn: () => http.get<HealthHistoryDto>('/system-health/history', { metric, range }),
    refetchInterval: autoRefresh ? 5000 : false,
    placeholderData: keepPreviousData,
  })
}

export function useIncidents() {
  return useQuery({ queryKey: ['health', 'incidents'], queryFn: () => http.get<IncidentDto[]>('/system-health/incidents') })
}

export function useSaveHealthRetention() {
  return useMutation({ mutationFn: (days: number) => http.put<RetentionDto>('/system-health/retention', { days }) })
}

/* --------------------------------------------------------------- settings */

export function useMailSettings() {
  return useQuery({ queryKey: ['settings', 'mail'], queryFn: () => http.get<MailSettingsDto>('/settings') })
}

export function useSaveMailSettings() {
  return useMutation({ mutationFn: (input: MailSettingsInput) => http.put<MailSettingsDto>('/settings', input) })
}

export function useConnectionTest(kind: 'imap' | 'smtp') {
  return useMutation({
    mutationFn: (input: { host: string; port: number; user: string; password: string }) =>
      http.post<ConnectionTestResult>(`/settings/test-${kind}`, input),
  })
}

export function useBillingDetails() {
  return useQuery({ queryKey: ['settings', 'billing'], queryFn: () => http.get<BillingDto>('/settings/billing') })
}

export function useSaveBilling() {
  return useMutation({ mutationFn: (input: BillingDto) => http.put<BillingDto>('/settings/billing', input) })
}

/* ---------------------------------------------------------------- backfill */

export function useBackfill() {
  return useQuery({ queryKey: ['backfill', 'runs'], queryFn: () => http.get<BackfillDto>('/mail-backfill') })
}

export function useStartBackfill() {
  return useMutation({ mutationFn: (limit: number | null) => http.post<MailBackfillRun>('/mail-backfill', { limit }) })
}

export function useCancelBackfill() {
  return useMutation({ mutationFn: () => http.post<MailBackfillRun>('/mail-backfill/cancel') })
}

export function usePurgeStorage() {
  return useMutation({ mutationFn: () => http.post<PurgeResult>('/mail/purge-storage') })
}

/* -------------------------------------------------------------- scheduler */

export function useSchedulerJobs() {
  return useQuery({ queryKey: ['scheduler', 'jobs'], queryFn: () => http.get<SchedulerJobsDto>('/scheduler/jobs') })
}

export function useRunJob() {
  return useMutation({ mutationFn: (name: string) => http.post<SchedulerRun>(`/scheduler/jobs/${name}/run`) })
}
