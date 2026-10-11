/**
 * Query hooks for the kb-quality screens. Query keys start with `kb-quality`;
 * anything that changes the knowledge base itself also invalidates `kb`.
 * OWNED BY: kb-quality.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { bus } from '@/demo'
import { del, get, post } from '@/lib/api'
import { useTenantId } from '@/lib/session'
import type { CurationProposal, DuplicateReport, KbEvent, KbEventAction, ReembedJob, RetrievalHit, RetrievalResult } from '@/types'

export const qk = {
  duplicates: ['kb-quality', 'duplicates'] as const,
  events: (action: string) => ['kb-quality', 'events', action] as const,
  reembed: ['kb-quality', 'reembed'] as const,
  search: (q: string) => ['kb-quality', 'search', q] as const,
  proposals: (state: string) => ['kb-quality', 'curation', 'proposals', state] as const,
  curation: ['kb-quality', 'curation'] as const,
  summary: ['kb-quality', 'curation', 'summary'] as const,
}

export interface QuickSearchResult {
  query: string
  method: 'keyword'
  hits: RetrievalHit[]
}

export interface ExportPayload {
  filename: string
  mime: string
  content: string
}

export interface CurationSummary {
  pending: number
  high_priority: number
}

export const KB_EVENT_ACTIONS: KbEventAction[] = [
  'import',
  'edit',
  'delete',
  'reembed',
  'chunk_edit',
  'chunk_delete',
  'bulk',
  'export',
  'curation',
]

const invalidateKb = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['kb'] })
  void qc.invalidateQueries({ queryKey: ['kb-quality'] })
}

/* ---------------------------------------------------------------- retrieval */

export interface RetrieveInput {
  query: string
  top_k: number
  threshold: number
}

export const useRetrieve = () =>
  useMutation({ mutationFn: (input: RetrieveInput) => post<RetrievalResult>('/kb/retrieve', input) })

export const useQuickSearch = (q: string) =>
  useQuery({
    queryKey: qk.search(q),
    queryFn: () => get<QuickSearchResult>('/kb/search', { q }),
    enabled: q.trim().length > 0,
    staleTime: 0,
  })

/* --------------------------------------------------------------- duplicates */

export const useDuplicates = () =>
  useQuery({ queryKey: qk.duplicates, queryFn: () => get<DuplicateReport>('/kb/duplicates'), staleTime: 0 })

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<unknown>(`/kb/documents/${id}`),
    onSuccess: () => invalidateKb(qc),
  })
}

/* ----------------------------------------------------------------- activity */

export const useKbEvents = (action: string) =>
  useQuery({
    queryKey: qk.events(action),
    queryFn: () => get<KbEvent[]>('/kb/events', action ? { action } : undefined),
    staleTime: 0,
  })

/* ------------------------------------------------------------- maintenance */

export function useExport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (format: 'json' | 'csv') => get<ExportPayload>('/kb/export', { format }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kb-quality', 'events'] }),
  })
}

/** The current / last re-embed job; live-updated from the `reembed:progress` bus event. */
export function useReembedJob() {
  const qc = useQueryClient()
  const tenantId = useTenantId()
  const query = useQuery({
    queryKey: qk.reembed,
    queryFn: () => get<ReembedJob | null>('/kb/reembed-jobs/current'),
    staleTime: 0,
  })
  useEffect(
    () =>
      bus.on('reembed:progress', ({ job }) => {
        if (job.client_id !== tenantId) return
        qc.setQueryData(qk.reembed, job)
        if (job.state !== 'running') {
          invalidateKb(qc)
        }
      }),
    [qc, tenantId],
  )
  return query
}

export function useStartReembed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => post<ReembedJob>('/kb/reembed-jobs'),
    onSuccess: (job) => qc.setQueryData(qk.reembed, job),
    onError: () => void qc.invalidateQueries({ queryKey: qk.reembed }),
  })
}

/* ----------------------------------------------------------------- curation */

export const useProposals = (state: CurationProposal['state']) =>
  useQuery({
    queryKey: qk.proposals(state),
    queryFn: () => get<CurationProposal[]>('/curation/proposals', { state }),
    staleTime: 0,
  })

export const useCurationSummary = () =>
  useQuery({ queryKey: qk.summary, queryFn: () => get<CurationSummary>('/curation/summary'), staleTime: 0 })

/** Keep the queue (and the KB screens) fresh when the mock "backend" announces a change. */
export function useCurationLive(): void {
  const qc = useQueryClient()
  const tenantId = useTenantId()
  useEffect(() => {
    const refresh = ({ client_id }: { client_id: string }) => {
      if (client_id !== tenantId) return
      void qc.invalidateQueries({ queryKey: qk.curation })
    }
    const offA = bus.on('curation:changed', refresh)
    const offB = bus.on('kb:changed', ({ client_id }) => {
      if (client_id === tenantId) void qc.invalidateQueries({ queryKey: ['kb-quality', 'events'] })
    })
    return () => {
      offA()
      offB()
    }
  }, [qc, tenantId])
}

export function useAcceptProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content?: string }) =>
      post<CurationProposal>(`/curation/proposals/${id}/accept`, content === undefined ? {} : { content }),
    onSettled: () => invalidateKb(qc),
  })
}

export function useDeclineProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      post<CurationProposal>(`/curation/proposals/${id}/decline`, { reason }),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.curation }),
  })
}

export function useBulkAccept() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => post<{ accepted: number; skipped: number }>('/curation/proposals/bulk-accept', { ids }),
    onSettled: () => invalidateKb(qc),
  })
}

export const useRunCuration = () =>
  useMutation({ mutationFn: () => post<{ queued: boolean; added: number }>('/curation/run') })

/* --------------------------------------------------------------- utilities */

/** Hand a text payload to the browser as a file download (no network involved). */
export function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
