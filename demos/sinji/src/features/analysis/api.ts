/**
 * Query hooks for the analysis group. Keys start with `analysis` (digests) or
 * reuse the owner groups' keys (`workbench` recordings, `workspace-settings`
 * bands / sentiment) so an edit refreshes every screen that shows the data.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { get, patch, post, put } from '@/lib/api'
import { DEFAULT_BANDS } from '@/lib/scoring'
import type { CallSummary, Id, Recording, ScoreBands, SentimentConfig } from '@/types'

/** Workspace colour bands (falls back to 50 / 80 while loading or if unavailable). */
export function useBands(): ScoreBands {
  const query = useQuery({
    queryKey: queryKeys['workspace-settings'].bands,
    queryFn: () => get<ScoreBands>('/settings/bands'),
    staleTime: 60_000,
    retry: false,
  })
  return query.data ?? DEFAULT_BANDS
}

export function useSentimentConfig() {
  return useQuery({
    queryKey: queryKeys['workspace-settings'].sentiment,
    queryFn: () => get<SentimentConfig>('/settings/sentiment'),
    retry: false,
  })
}

export function useSaveSentiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { enabled: boolean; guidance: string }) => put<SentimentConfig>('/settings/sentiment', input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys['workspace-settings'].sentiment, data)
      void qc.invalidateQueries({ queryKey: queryKeys['workspace-settings'].all })
    },
  })
}

/** Manual score edit: a new revision, recomputed total, every screen refreshed. */
export function useEditScores(recordingId: Id) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { scores: Record<string, number>; note: string }) =>
      patch<Recording>(`/recordings/${recordingId}/scores`, input),
    onSuccess: (rec) => {
      qc.setQueryData(queryKeys.workbench.recording(recordingId), rec)
      void qc.invalidateQueries({ queryKey: queryKeys.workbench.all })
      void qc.invalidateQueries({ queryKey: queryKeys.analysis.all })
      void qc.invalidateQueries({ queryKey: queryKeys.usage.all })
    },
  })
}

/** Keep digest queries fresh when the simulator finishes a stage. */
function useSummaryBus() {
  const qc = useQueryClient()
  useEffect(
    () =>
      bus.on('summary:updated', () => {
        void qc.invalidateQueries({ queryKey: queryKeys.analysis.all })
      }),
    [qc],
  )
}

/** Digests that include a call (or all digests when no id is given). */
export function useSummaries(recordingId?: Id) {
  useSummaryBus()
  return useQuery({
    queryKey: queryKeys.analysis.summaries(recordingId),
    queryFn: () => get<CallSummary[]>('/summaries', recordingId ? { recording_id: recordingId } : undefined),
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === 'running') ? 700 : false),
  })
}

export function useSummary(id: Id | undefined) {
  useSummaryBus()
  return useQuery({
    queryKey: queryKeys.analysis.summary(id ?? ''),
    queryFn: () => get<CallSummary>(`/summaries/${id}`),
    enabled: !!id,
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 600 : false),
  })
}

export function useCreateSummary() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordingIds: Id[]) => post<CallSummary>('/summaries', { recording_ids: recordingIds }),
    onSuccess: (summary) => {
      qc.setQueryData(queryKeys.analysis.summary(summary.id), summary)
      void qc.invalidateQueries({ queryKey: queryKeys.analysis.all })
    },
  })
}

/** Per-call blurbs in the seed carry English glosses the shared type does not declare. */
export type SummaryCall = CallSummary['calls'][number] & { summary_en?: string; outcome_en?: string }
export const callGloss = (call: CallSummary['calls'][number]): SummaryCall => call
