/**
 * Query hooks for the knowledge-base screens. Every key starts with `kb`
 * (see `queryKeys.kb`), so one `invalidate()` refreshes every screen that
 * shows documents, chunks or stats.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo'
import { del, get, patch, post } from '@/lib/api'
import { useTenantId } from '@/lib/session'
import type { KbChunk, KbDocument } from '@/types'
import type {
  KbBulkInput,
  KbDocumentFilters,
  KbDocumentPage,
  KbDocumentPatch,
  KbImportCsvInput,
  KbImportFilesInput,
  KbImportResult,
  KbImportTextInput,
  KbStatsView,
} from './types'

export const IN_FLIGHT = ['pending', 'processing'] as const
export const isInFlight = (status: string): boolean => (IN_FLIGHT as readonly string[]).includes(status)

/** Re-fetch kb queries whenever the simulated backend announces a change for this workspace. */
export function useKbLive(): void {
  const qc = useQueryClient()
  const tenantId = useTenantId()
  useEffect(
    () =>
      bus.on('kb:changed', ({ client_id }) => {
        if (tenantId && client_id !== tenantId) return
        void qc.invalidateQueries({ queryKey: queryKeys.kb.all })
        void qc.invalidateQueries({ queryKey: queryKeys['kb-quality'].curationSummary })
      }),
    [qc, tenantId],
  )
}

export function useKbInvalidate(): () => Promise<void> {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.kb.all })
    await qc.invalidateQueries({ queryKey: queryKeys['kb-quality'].all })
  }
}

export function useKbStats() {
  return useQuery({
    queryKey: queryKeys.kb.stats,
    queryFn: ({ signal }) => get<KbStatsView>('/kb/stats', undefined, signal),
    refetchInterval: (query) => ((query.state.data?.in_progress ?? 0) > 0 ? 2000 : false),
  })
}

export function useKbTags() {
  return useQuery({ queryKey: queryKeys.kb.tags, queryFn: ({ signal }) => get<string[]>('/kb/tags', undefined, signal) })
}

export function useKbDocuments(filters: KbDocumentFilters) {
  return useQuery({
    queryKey: queryKeys.kb.documents({ ...filters }),
    queryFn: ({ signal }) => get<KbDocumentPage>('/kb/documents', { ...filters }, signal),
    placeholderData: keepPreviousData,
    // Rows being ingested flip to ready on their own; poll while any are in flight.
    refetchInterval: (query) => (query.state.data?.items.some((d) => isInFlight(d.status)) ? 2000 : false),
  })
}

export function useKbDocument(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.kb.document(id ?? ''),
    queryFn: ({ signal }) => get<KbDocument>(`/kb/documents/${id}`, undefined, signal),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data && isInFlight(query.state.data.status) ? 2000 : false),
  })
}

export function useKbChunks(documentId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.kb.chunks(documentId ?? ''),
    queryFn: ({ signal }) => get<KbChunk[]>(`/kb/documents/${documentId}/chunks`, undefined, signal),
    enabled: Boolean(documentId),
  })
}

/* ------------------------------------------------------------ mutations */

export function useUpdateDocument() {
  const invalidate = useKbInvalidate()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & KbDocumentPatch) => patch<unknown>(`/kb/documents/${id}`, body),
    onSettled: () => invalidate(),
  })
}

export function useDeleteDocument() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (id: string) => del<{ ok: true }>(`/kb/documents/${id}`), onSettled: () => invalidate() })
}

export function useReembedDocument() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (id: string) => post<unknown>(`/kb/documents/${id}/reembed`), onSettled: () => invalidate() })
}

export function useBulkAction() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (input: KbBulkInput) => post<{ affected: number }>('/kb/documents/bulk', input), onSettled: () => invalidate() })
}

export function useImportFiles() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (input: KbImportFilesInput) => post<KbImportResult>('/kb/import/files', input), onSettled: () => invalidate() })
}

export function useImportText() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (input: KbImportTextInput) => post<KbImportResult>('/kb/import/text', input), onSettled: () => invalidate() })
}

export function useImportCsv() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (input: KbImportCsvInput) => post<KbImportResult>('/kb/import/csv', input), onSettled: () => invalidate() })
}

export function useUpdateChunk() {
  const invalidate = useKbInvalidate()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => patch<KbChunk>(`/kb/chunks/${id}`, { content }),
    onSettled: () => invalidate(),
  })
}

export function useDeleteChunk() {
  const invalidate = useKbInvalidate()
  return useMutation({ mutationFn: (id: string) => del<{ ok: true }>(`/kb/chunks/${id}`), onSettled: () => invalidate() })
}

/** Pending proposals for the "KB health" link (owned by kb-quality). */
export function useCurationSummary() {
  return useQuery({
    queryKey: queryKeys['kb-quality'].curationSummary,
    queryFn: ({ signal }) => get<{ pending: number; high_priority: number }>('/curation/summary', undefined, signal),
    retry: false,
  })
}
