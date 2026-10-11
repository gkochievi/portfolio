/** Query hooks for the health group. Keys all start with 'health'. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { queryKeys } from '@/api/queryKeys'
import { errorMessage, http } from '@/lib/api'
import { useInvalidateOn } from '@/lib/live'
import type {
  BackupRun,
  CcActivity,
  HealthSnapshot,
  HostLiveSample,
  HostMetricRow,
  LogEvent,
  LogLevel,
  MirrorSyncRun,
  Paged,
  PingRow,
  SelfTestOverview,
  SyncRunsResponse,
  TestRun,
} from '@/types'

export const healthKeys = {
  all: queryKeys.health.all,
  metrics: (hours: number) => [...queryKeys.health.all, 'metrics', hours] as const,
  live: [...queryKeys.health.all, 'live'] as const,
  pings: (hours: number) => [...queryKeys.health.all, 'pings', hours] as const,
  snapshot: (at: string) => [...queryKeys.health.all, 'snapshot', at] as const,
  selftest: (page: number, pageSize: number) => [...queryKeys.health.all, 'selftest', page, pageSize] as const,
  selftestAll: [...queryKeys.health.all, 'selftest'] as const,
  activity: [...queryKeys.health.all, 'activity'] as const,
}

/* ------------------------------------------------------------------- status */

export function useHostMetrics(hours = 24) {
  return useQuery({
    queryKey: healthKeys.metrics(hours),
    queryFn: ({ signal }) => http.get<HostMetricRow[]>('/health/metrics', { hours }, signal),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useHostLive() {
  return useQuery({
    queryKey: healthKeys.live,
    queryFn: ({ signal }) => http.get<HostLiveSample>('/health/live', undefined, signal),
    refetchInterval: 5_000,
    placeholderData: keepPreviousData,
  })
}

export function usePings(hours = 24) {
  return useQuery({
    queryKey: healthKeys.pings(hours),
    queryFn: ({ signal }) => http.get<PingRow[]>('/health/pings', { hours }, signal),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useSnapshot(at: string | null) {
  return useQuery({
    queryKey: healthKeys.snapshot(at ?? ''),
    queryFn: ({ signal }) => http.get<HealthSnapshot>('/health/snapshot', { at: at ?? '' }, signal),
    enabled: !!at,
    retry: false,
  })
}

export function useSelfTest(page: number, pageSize: number) {
  useInvalidateOn('selftest:completed', healthKeys.selftestAll)
  return useQuery({
    queryKey: healthKeys.selftest(page, pageSize),
    queryFn: ({ signal }) => http.get<SelfTestOverview>('/selftest', { page, pageSize }, signal),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useRunSelfTest(onDone?: (run: TestRun) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => http.post<TestRun>('/selftest'),
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: healthKeys.selftestAll })
      onDone?.(run)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

/* ----------------------------------------------------------------- activity */

const POLL = 30_000

interface PageOpts {
  page: number
  pageSize: number
}

/** Core Cluster import runs; `type: 'reconcile'` narrows to reconcile runs. */
export function useSyncRuns({ page, pageSize, type }: PageOpts & { type?: 'reconcile' }) {
  return useQuery({
    queryKey: [...healthKeys.activity, 'sync', type ?? 'all', page, pageSize],
    queryFn: ({ signal }) => http.get<SyncRunsResponse>('/archive/core/runs', { page, pageSize, type }, signal),
    refetchInterval: POLL,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useCcActivity({ page, pageSize }: PageOpts) {
  return useQuery({
    queryKey: [...healthKeys.activity, 'cc', page, pageSize],
    queryFn: ({ signal }) => http.get<Paged<CcActivity>>('/cc/activity', { page, pageSize }, signal),
    refetchInterval: POLL,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useBackupRuns({ page, pageSize }: PageOpts) {
  return useQuery({
    queryKey: [...healthKeys.activity, 'backup-runs', page, pageSize],
    queryFn: ({ signal }) => http.get<Paged<BackupRun>>('/archive/backup/runs', { page, pageSize }, signal),
    refetchInterval: POLL,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useBackupEvents(minLevel: LogLevel | 'all', limit = 200) {
  return useQuery({
    queryKey: [...healthKeys.activity, 'backup-events', minLevel, limit],
    queryFn: ({ signal }) =>
      http.get<LogEvent[]>('/archive/backup/events', { minLevel: minLevel === 'all' ? undefined : minLevel, limit }, signal),
    refetchInterval: POLL,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useMirrorRuns({ page, pageSize }: PageOpts) {
  return useQuery({
    queryKey: [...healthKeys.activity, 'mirror', page, pageSize],
    queryFn: ({ signal }) => http.get<Paged<MirrorSyncRun>>('/archive/edge/mirror/runs', { page, pageSize }, signal),
    refetchInterval: POLL,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
