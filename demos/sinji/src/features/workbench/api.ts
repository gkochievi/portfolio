/**
 * Query hooks and the "All at once" orchestration for the workbench.
 * OWNED BY: workbench.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo'
import { del, get, post, ApiError } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { DEFAULT_BANDS } from '@/lib/scoring'
import type {
  Analyser,
  CallSummary,
  ContentLang,
  Id,
  Recording,
  RecordingRow,
  ScoreBands,
  TranscriptionConfigView,
  TranscriptionSettings,
} from '@/types'

/** The four result analysers plus the per-call summary (a superset of `Analyser`). */
export type RunKey = Analyser | 'summary'
export const RESULT_KEYS = ['factcheck', 'score', 'semantic', 'summary'] as const
export type ResultKey = (typeof RESULT_KEYS)[number]

export interface RecordingFilters {
  q?: string
  status?: string
  source?: string
}

const POLL_MS = 700

const isBusy = (r: { status: string; running: readonly string[] }) =>
  r.running.length > 0 || r.status === 'transcribing' || r.status === 'analyzing'

/** Mirror the simulated server's events into the query cache (the stand-in for a socket). */
export function useRecordingEvents(): void {
  const client = useQueryClient()
  useEffect(
    () =>
      bus.on('recording:updated', () => {
        void client.invalidateQueries({ queryKey: queryKeys.workbench.all })
      }),
    [client],
  )
}

export function useRecordings(filters: RecordingFilters = {}) {
  return useQuery({
    queryKey: queryKeys.workbench.recordings(filters as Record<string, unknown>),
    queryFn: () => get<RecordingRow[]>('/recordings', { ...filters }),
    refetchInterval: (query) => (query.state.data?.some(isBusy) ? POLL_MS : false),
  })
}

export function useRecording(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workbench.recording(id ?? ''),
    queryFn: () => get<Recording>(`/recordings/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data && isBusy(query.state.data) ? POLL_MS : false),
  })
}

export function useBands(): ScoreBands {
  const query = useQuery({
    queryKey: queryKeys['workspace-settings'].bands,
    queryFn: () => get<ScoreBands>('/settings/bands'),
    retry: false,
  })
  return query.data ?? DEFAULT_BANDS
}

export const FALLBACK_TRANSCRIPTION: TranscriptionSettings = {
  language_code: null,
  diarize: true,
  keyterms: [],
  audio_format: 'original',
}

export function useTranscriptionDefaults(): TranscriptionSettings {
  const query = useQuery({
    queryKey: queryKeys['workspace-settings'].transcription,
    queryFn: () => get<TranscriptionConfigView>('/settings/transcription'),
    retry: false,
  })
  return query.data?.effective ?? FALLBACK_TRANSCRIPTION
}

export function useDigests() {
  return useQuery({
    queryKey: queryKeys.analysis.summaries(),
    queryFn: () => get<CallSummary[]>('/summaries'),
    retry: false,
    refetchInterval: (query) => (query.state.data?.some((s) => s.status === 'running') ? POLL_MS : false),
  })
}

export function useRunAnalysers(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (analysers: RunKey[]) => post<Recording>(`/recordings/${id}/run`, { analysers }),
    onSuccess: (rec) => {
      client.setQueryData(queryKeys.workbench.recording(id), rec)
      void client.invalidateQueries({ queryKey: queryKeys.workbench.all })
    },
  })
}

export function useDeleteRecordings() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (ids: Id[]) => {
      await Promise.all(ids.map((id) => del(`/recordings/${id}`)))
      return ids
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.workbench.all })
    },
  })
}

export interface UploadInput {
  file: { name: string; size: number; type: string }
  override: Partial<TranscriptionSettings> | null
}

/** POST one file (the batch endpoint takes one override, so overrides stay per file). */
export async function uploadOne({ file, override }: UploadInput): Promise<Recording> {
  const created = await post<Recording[]>('/recordings/upload', { files: [file], override })
  void queryClient.invalidateQueries({ queryKey: queryKeys.workbench.all })
  const first = created[0]
  if (!first) throw new ApiError(500, 'Upload failed.')
  return first
}

export async function createTextCall(input: { title: string; language: ContentLang; text: string }): Promise<Recording> {
  const rec = await post<Recording>('/recordings/text', input)
  void queryClient.invalidateQueries({ queryKey: queryKeys.workbench.all })
  return rec
}

/* ---------------------------------------------------------- All at once */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitUntil(id: Id, done: (rec: Recording) => boolean, timeoutMs = 45_000): Promise<Recording> {
  const started = Date.now()
  for (;;) {
    const rec = await get<Recording>(`/recordings/${id}`)
    void queryClient.invalidateQueries({ queryKey: queryKeys.workbench.all })
    if (done(rec) || Date.now() - started > timeoutMs) return rec
    await sleep(400)
  }
}

export interface RunAllResult {
  ok: RunKey[]
  failed: Array<{ key: RunKey; message: string }>
}

/**
 * Transcribe if needed -> fact-check + tone in parallel -> score (after both) + call summary.
 * Each step is its own request so one failure never blocks the others.
 */
export async function runAllAtOnce(id: Id, onStage?: (stage: 'transcribe' | 'parallel' | 'score') => void): Promise<RunAllResult> {
  const result: RunAllResult = { ok: [], failed: [] }
  let rec = await get<Recording>(`/recordings/${id}`)

  if (rec.segments.length === 0 && rec.source === 'audio') {
    onStage?.('transcribe')
    if (rec.status !== 'transcribing') {
      try {
        await post(`/recordings/${id}/run`, { analysers: ['transcribe'] })
      } catch (error) {
        result.failed.push({ key: 'transcribe', message: error instanceof Error ? error.message : String(error) })
        return result
      }
    }
    rec = await waitUntil(id, (r) => r.status !== 'transcribing')
    if (rec.status === 'error' || rec.segments.length === 0) {
      result.failed.push({ key: 'transcribe', message: rec.error ?? 'Transcription failed.' })
      return result
    }
    result.ok.push('transcribe')
  }

  const attempt = async (keys: RunKey[]) =>
    Promise.allSettled(
      keys.map(async (key) => {
        await post(`/recordings/${id}/run`, { analysers: [key] })
        return key
      }),
    ).then((settled) =>
      settled.forEach((s, i) => {
        const key = keys[i] as RunKey
        if (s.status === 'fulfilled') result.ok.push(key)
        else result.failed.push({ key, message: s.reason instanceof Error ? s.reason.message : String(s.reason) })
      }),
    )

  onStage?.('parallel')
  await attempt(['factcheck', 'semantic'])
  await waitUntil(id, (r) => !r.running.includes('factcheck') && !r.running.includes('semantic'))

  onStage?.('score')
  await attempt(['score', 'summary'])
  await waitUntil(id, (r) => r.running.length === 0)
  void queryClient.invalidateQueries({ queryKey: queryKeys.workbench.all })
  return result
}
