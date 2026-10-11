/**
 * Query hooks for the workspace-settings screens. Keys come from
 * `queryKeys['workspace-settings']`. A rubric or band change also refreshes the
 * screens that colour or explain scores. OWNED BY: workspace-settings.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { ApiError, del, get, post, put } from '@/lib/api'
import type {
  AiByoOverride,
  AiCapability,
  AiEffective,
  AiProviderEntry,
  RubricDimension,
  RubricImportJob,
  ScoreBands,
  ScoringConfig,
  SentimentConfig,
  TranscriptionConfigView,
  TranscriptionSettings,
} from '@/types'

const k = queryKeys['workspace-settings']

export type RubricPayload = ScoringConfig & { can_edit: boolean; default_version: number }
export type DefaultRubricPayload = ScoringConfig & { source: 'built-in' | 'saved'; can_edit: boolean }
export interface RubricDraft {
  dimensions: RubricDimension[]
  rubric: string
}

export interface AiCapabilityView {
  capability: AiCapability
  effective: AiEffective
  fallback: AiEffective
  override: AiByoOverride | null
}
export interface AiPayload {
  providers: AiProviderEntry[]
  capabilities: AiCapabilityView[]
  can_edit: boolean
}
export interface AiTestResult {
  ok: boolean
  detail: string
  latency_ms: number | null
}
export interface AiOverrideInput {
  provider: string
  model: string
  api_key?: string
  notes: string
  enabled: boolean
}

/** Scores, scorecards and bands read elsewhere depend on the rubric and bands. */
function refreshScoring(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: k.all })
  void qc.invalidateQueries({ queryKey: ['workbench'] })
  void qc.invalidateQueries({ queryKey: ['analysis'] })
}

/** Human text from an ApiError (field errors first, then the message). */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const fields = Object.values(error.fieldErrors).flat()
    return fields.length ? fields.join(' ') : error.message || fallback
  }
  return fallback
}

/* ------------------------------------------------------------------ rubric */

export const useRubric = () => useQuery({ queryKey: k.rubric, queryFn: () => get<RubricPayload>('/settings/rubric') })

export function useSaveRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: RubricDraft) => put<RubricPayload>('/settings/rubric', draft),
    onSuccess: (data) => {
      qc.setQueryData(k.rubric, data)
      refreshScoring(qc)
    },
  })
}

export function useResetRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (password: string) => post<RubricPayload>('/settings/rubric/reset', { password }),
    onSuccess: (data) => {
      qc.setQueryData(k.rubric, data)
      refreshScoring(qc)
    },
  })
}

export const useStartRubricImport = () =>
  useMutation({ mutationFn: (file: { filename: string; size: number }) => post<RubricImportJob>('/settings/rubric/import', file) })

/** Polls the import job every 400 ms until it is done or failed. */
export function useRubricImportJob(jobId: string | null) {
  return useQuery({
    queryKey: k.rubricImport(jobId ?? 'none'),
    enabled: Boolean(jobId),
    queryFn: () => get<RubricImportJob>(`/settings/rubric/import/${jobId}`),
    refetchInterval: (query) => {
      const stage = query.state.data?.stage
      return stage === 'done' || stage === 'error' ? false : 400
    },
    gcTime: 0,
  })
}

/* ------------------------------------------------------------------- bands */

export const useBands = () => useQuery({ queryKey: k.bands, queryFn: () => get<ScoreBands>('/settings/bands') })

export function useSaveBands() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bands: ScoreBands) => put<ScoreBands>('/settings/bands', bands),
    onSuccess: (data) => {
      qc.setQueryData(k.bands, data)
      refreshScoring(qc)
    },
  })
}

export function useResetBands() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => del<ScoreBands>('/settings/bands'),
    onSuccess: (data) => {
      qc.setQueryData(k.bands, data)
      refreshScoring(qc)
    },
  })
}

/* --------------------------------------------------------------- sentiment */

/** Polls while the voice-tone service is warming up. */
export const useSentiment = () =>
  useQuery({
    queryKey: k.sentiment,
    queryFn: () => get<SentimentConfig>('/settings/sentiment'),
    refetchInterval: (query) => (query.state.data?.voice_tone === 'warming' ? 2000 : false),
  })

export function useSaveSentiment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { enabled: boolean; guidance: string }) => put<SentimentConfig>('/settings/sentiment', input),
    onSuccess: (data) => {
      qc.setQueryData(k.sentiment, data)
      void qc.invalidateQueries({ queryKey: k.all })
    },
  })
}

/* ----------------------------------------------------------- transcription */

export const useTranscription = () =>
  useQuery({ queryKey: k.transcription, queryFn: () => get<TranscriptionConfigView>('/settings/transcription') })

export function useSaveTranscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<TranscriptionSettings>) => put<TranscriptionConfigView>('/settings/transcription', input),
    onSuccess: (data) => {
      qc.setQueryData(k.transcription, data)
      void qc.invalidateQueries({ queryKey: ['workbench'] })
    },
  })
}

export function useRevertTranscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => del<TranscriptionConfigView>('/settings/transcription'),
    onSuccess: (data) => {
      qc.setQueryData(k.transcription, data)
      void qc.invalidateQueries({ queryKey: ['workbench'] })
    },
  })
}

/* ------------------------------------------------------------------ own AI */

export const useAiSettings = () => useQuery({ queryKey: k.ai, queryFn: () => get<AiPayload>('/settings/ai') })

const refreshAi = (qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: k.ai })
  void qc.invalidateQueries({ queryKey: ['console-ai'] })
  void qc.invalidateQueries({ queryKey: ['usage'] })
}

export function useSaveAiOverride(capability: AiCapability) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AiOverrideInput) => put<AiCapabilityView>(`/settings/ai/${capability}`, input),
    onSuccess: () => refreshAi(qc),
  })
}

export function useRemoveAiOverride(capability: AiCapability) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keyOnly: boolean) => del<AiCapabilityView>(`/settings/ai/${capability}`, { key_only: keyOnly }),
    onSuccess: () => refreshAi(qc),
  })
}

export const useTestAiOverride = (capability: AiCapability) =>
  useMutation({ mutationFn: () => post<AiTestResult>(`/settings/ai/${capability}/test`) })

/* --------------------------------------------------------- operator default */

export const useDefaultRubric = () =>
  useQuery({ queryKey: k.defaultRubric, queryFn: () => get<DefaultRubricPayload>('/admin/rubric/default') })

export function useSaveDefaultRubric() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: RubricDraft) => put<DefaultRubricPayload>('/admin/rubric/default', draft),
    onSuccess: (data) => {
      qc.setQueryData(k.defaultRubric, data)
      refreshScoring(qc)
    },
  })
}
