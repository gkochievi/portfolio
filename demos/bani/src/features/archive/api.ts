/**
 * Query + mutation hooks for the archive group. Every key starts with 'archive'.
 * Panels poll (30 s idle, 5 s while a job runs; react-query pauses polling in hidden tabs)
 * and are also nudged by the in-browser bus so progress moves each second.
 */
import { useEffect, useRef } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import { useDemoEvent } from '@/lib/live'
import type {
  BackupFlow,
  BackupOverview,
  BackupRun,
  BackupSourceKey,
  CoreImportStatus,
  EdgeMirrorStatus,
  HangupBackfillStatus,
  LogEvent,
  LogLevel,
  MirrorCheckResult,
  MirrorSyncRun,
  Paged,
  SyncRun,
  VerifyRun,
} from '@/types'

const A = queryKeys.archive

export const archiveKeys = {
  all: A.all,
  core: A.key('core'),
  coreStatus: A.key('core', 'status'),
  mirror: A.key('mirror'),
  mirrorStatus: A.key('mirror', 'status'),
  mirrorRuns: (page: number, pageSize: number) => A.key('mirror', 'runs', page, pageSize),
  hangup: A.key('hangup'),
  backup: A.key('backup'),
  backupOverview: A.key('backup', 'overview'),
  backupRuns: (page: number, pageSize: number) => A.key('backup', 'runs', page, pageSize),
  backupRun: (id: string | null) => A.key('backup', 'run', id),
  events: (flow: string, minLevel: LogLevel, limit: number) => A.key('events', flow, minLevel, limit),
  verify: A.key('verify'),
  verifyList: A.key('verify', 'list'),
  verifyRun: (id: string) => A.key('verify', 'run', id),
}

const POLL_IDLE = 30_000
const POLL_BUSY = 5_000

/* ------------------------------------------------------- shared helpers */

export type SourceChoice = 'all' | 'voice_archive' | 'edge_primary' | 'edge_secondary'

export interface SourceBody {
  flow: BackupFlow | 'all'
  sourceKey?: BackupSourceKey
}

export function sourceBody(choice: SourceChoice): SourceBody {
  switch (choice) {
    case 'all':
      return { flow: 'all' }
    case 'voice_archive':
      return { flow: 'voice_archive', sourceKey: 'primary' }
    case 'edge_primary':
      return { flow: 'edge_pbx', sourceKey: 'primary' }
    default:
      return { flow: 'edge_pbx', sourceKey: 'secondary' }
  }
}

/** Fires `onDone` once when `running` goes from true to false. */
export function useOnFinished(running: boolean | undefined, onDone: () => void): void {
  const prev = useRef<boolean | undefined>(undefined)
  const cb = useRef(onDone)
  cb.current = onDone
  useEffect(() => {
    if (prev.current === true && running === false) cb.current()
    if (running !== undefined) prev.current = running
  }, [running])
}

/** Keeps the right slice of the cache fresh while jobs tick on the bus. */
export function useArchiveBus(): void {
  const qc = useQueryClient()
  useDemoEvent('archive:changed', ({ kind }) => {
    const roots: Record<typeof kind, readonly unknown[]> = {
      'core-sync': archiveKeys.core,
      mirror: archiveKeys.mirror,
      hangup: archiveKeys.hangup,
      backup: archiveKeys.backup,
      verify: archiveKeys.verify,
    }
    void qc.invalidateQueries({ queryKey: roots[kind] })
    if (kind === 'backup') void qc.invalidateQueries({ queryKey: A.key('events') })
  })
  useDemoEvent('archive:event', () => {
    void qc.invalidateQueries({ queryKey: A.key('events') })
  })
}

/* -------------------------------------------------------------- core */

export function useCoreStatus() {
  return useQuery({
    queryKey: archiveKeys.coreStatus,
    queryFn: ({ signal }) => http.get<CoreImportStatus>('/archive/core/status', undefined, signal),
    refetchInterval: (q) => (q.state.data?.isRunning ? POLL_BUSY : POLL_IDLE),
  })
}

export type CoreSyncMode = 'local' | 'reconcile' | 'full' | 'reset'

export function useCoreSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: CoreSyncMode) => http.post<SyncRun | { ok: true; status: CoreImportStatus }>('/archive/core/sync', { mode }),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.core }),
  })
}

export function usePurgeArchive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => http.del<{ deleted: number }>('/archive/core/records'),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.core }),
  })
}

export function useVerifyPassword() {
  return useMutation({
    mutationFn: (password: string) => http.post<{ ok: true }>('/auth/verify-password', { password }),
  })
}

/* ------------------------------------------------------------ mirror */

export function useMirrorStatus() {
  return useQuery({
    queryKey: archiveKeys.mirrorStatus,
    queryFn: ({ signal }) => http.get<EdgeMirrorStatus>('/archive/edge/mirror', undefined, signal),
    refetchInterval: POLL_IDLE,
  })
}

export function useMirrorRuns(page: number, pageSize: number) {
  return useQuery({
    queryKey: archiveKeys.mirrorRuns(page, pageSize),
    queryFn: ({ signal }) => http.get<Paged<MirrorSyncRun>>('/archive/edge/mirror/runs', { page, pageSize }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'running' && r.trigger !== 'interval') ? POLL_BUSY : POLL_IDLE),
  })
}

export interface RangeBody {
  fromDate: string
  toDate: string
}

export function useMirrorCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RangeBody) => http.post<MirrorCheckResult>('/archive/edge/mirror/check', body),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.mirror }),
  })
}

export function useMirrorReconcile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RangeBody) => http.post<MirrorSyncRun>('/archive/edge/mirror/reconcile', body),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.mirror }),
  })
}

/* ------------------------------------------------------------ hangup */

export function useHangupStatus() {
  return useQuery({
    queryKey: archiveKeys.hangup,
    queryFn: ({ signal }) => http.get<HangupBackfillStatus>('/archive/hangup', undefined, signal),
    refetchInterval: (q) => (q.state.data?.running ? POLL_BUSY : 20_000),
  })
}

export function useHangupBackfill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RangeBody) => http.post<HangupBackfillStatus>('/archive/hangup/backfill', body),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.hangup }),
  })
}

/** The Calls screen shows Hangup by from the same legs: refresh it when a backfill ends. */
export function useInvalidateCalls(): () => void {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: queryKeys.calls.all })
}

/* ------------------------------------------------------------ backup */

export function useBackupOverview() {
  return useQuery({
    queryKey: archiveKeys.backupOverview,
    queryFn: ({ signal }) => http.get<BackupOverview>('/archive/backup', undefined, signal),
    refetchInterval: (q) => (q.state.data?.flows.some((f) => f.lastRun?.status === 'running') ? POLL_BUSY : POLL_IDLE),
  })
}

export function useBackupRuns(page: number, pageSize: number) {
  return useQuery({
    queryKey: archiveKeys.backupRuns(page, pageSize),
    queryFn: ({ signal }) => http.get<Paged<BackupRun>>('/archive/backup/runs', { page, pageSize }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'running') ? POLL_BUSY : POLL_IDLE),
  })
}

export function useBackupRun(id: string | null) {
  return useQuery({
    queryKey: archiveKeys.backupRun(id),
    enabled: id !== null,
    queryFn: ({ signal }) => http.get<BackupRun>(`/archive/backup/runs/${encodeURIComponent(id ?? '')}`, undefined, signal),
    refetchInterval: (q) => (!q.state.data || q.state.data.status === 'running' ? 2_000 : false),
  })
}

export function useStartBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SourceBody & RangeBody) => http.post<BackupRun[]>('/archive/backup/runs', body),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.backup }),
  })
}

export function useCancelBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.post<BackupRun>(`/archive/backup/runs/${encodeURIComponent(id)}/cancel`),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.backup }),
  })
}

export function useBackupEvents(flow: string, minLevel: LogLevel, limit: number, paused: boolean) {
  return useQuery({
    queryKey: archiveKeys.events(flow, minLevel, limit),
    queryFn: ({ signal }) => http.get<LogEvent[]>('/archive/backup/events', { flow, minLevel, limit }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: paused ? false : 5_000,
  })
}

/* ------------------------------------------------------------ verify */

export function useVerifyList() {
  return useQuery({
    queryKey: archiveKeys.verifyList,
    queryFn: ({ signal }) => http.get<VerifyRun[]>('/archive/verify', undefined, signal),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'running') ? 2_000 : POLL_IDLE),
  })
}

export function useVerifyRun(id: string) {
  return useQuery({
    queryKey: archiveKeys.verifyRun(id),
    queryFn: ({ signal }) => http.get<VerifyRun>(`/archive/verify/${encodeURIComponent(id)}`, undefined, signal),
    refetchInterval: (q) => (!q.state.data || q.state.data.status === 'running' ? 2_000 : POLL_IDLE),
  })
}

export function useStartVerify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SourceBody & RangeBody) => http.post<VerifyRun[]>('/archive/verify', body),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.verify }),
  })
}

export function useCancelVerify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.post<VerifyRun>(`/archive/verify/${encodeURIComponent(id)}/cancel`),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.verify }),
  })
}

export function useVerifyBackfill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.post<BackupRun>(`/archive/verify/${encodeURIComponent(id)}/backfill`),
    onSettled: () => qc.invalidateQueries({ queryKey: archiveKeys.all }),
  })
}
