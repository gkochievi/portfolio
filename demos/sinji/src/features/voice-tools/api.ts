/**
 * Query hooks and mutations for the public voice tools. OWNED BY: voice-tools.
 * Every spend (TTS, transcription, sentiment, conversion) refreshes the daily-allowance banner.
 */
import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ApiError, get, post } from '@/lib/api'
import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo'
import { useAccount } from '@/lib/session'
import type {
  ContentLang,
  ConversionBatch,
  ConvertFormat,
  ConvertLimits,
  LimitsSnapshot,
  Sentiment,
  TtsClip,
  TtsLanguage,
  TtsModel,
  Voice,
} from '@/types'

const keys = queryKeys['voice-tools']

export interface HealthInfo {
  ok: boolean
  version: string
  uptime_s: number
}

export interface TtsCatalog {
  languages: TtsLanguage[]
  voices: Voice[]
  models: TtsModel[]
}

export interface TtsRequest {
  text: string
  language_code: ContentLang
  voice_id: string
  model_id: string
  settings?: Record<string, unknown>
}

export interface AudioRequest {
  name: string
  size: number
  sample?: number
  canned_id?: string
}

export interface TranscribeResult {
  id: string
  name: string
  language: ContentLang
  duration_s: number
  transcript: string
  model: string
  processing_ms: number
}

export interface SentimentResult {
  id: string
  name: string
  language: ContentLang
  duration_s: number
  transcript: string
  sentiment: Sentiment
  guidance: string
}

export interface ConvertFormats {
  formats: ConvertFormat[]
  limits: ConvertLimits
}

export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: () => get<HealthInfo>('/public/health'),
    refetchInterval: 30_000,
    retry: false,
  })
}

/** The daily allowance for whoever is looking (guest or signed-in account). */
export function useLimits() {
  const account = useAccount()
  return useQuery({
    queryKey: [...keys.limits, account?.id ?? 'guest'],
    queryFn: () => get<LimitsSnapshot>('/public/limits'),
    retry: false,
  })
}

export function useTtsCatalog() {
  return useQuery({ queryKey: keys.ttsCatalog, queryFn: () => get<TtsCatalog>('/public/tts/catalog') })
}

export function useConvertFormats() {
  return useQuery({ queryKey: keys.convertFormats, queryFn: () => get<ConvertFormats>('/public/convert/formats') })
}

/** Refresh the allowance banner (call after any spend, successful or refused). */
export function useRefreshLimits() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: keys.limits })
}

export function useSynthesize() {
  const refresh = useRefreshLimits()
  return useMutation({
    mutationFn: (body: TtsRequest) => post<TtsClip>('/public/tts', body),
    onSettled: () => void refresh(),
  })
}

export function useTranscribe() {
  const refresh = useRefreshLimits()
  return useMutation({
    mutationFn: (body: AudioRequest) => post<TranscribeResult>('/public/transcribe', body),
    onSettled: () => void refresh(),
  })
}

export function useSentimentRead() {
  const refresh = useRefreshLimits()
  return useMutation({
    mutationFn: (body: AudioRequest) => post<SentimentResult>('/public/sentiment', body),
    onSettled: () => void refresh(),
  })
}

export interface StartBatchBody {
  format: string
  files: Array<{ name: string; bytes: number }>
}

export function useStartBatch() {
  const refresh = useRefreshLimits()
  return useMutation({
    mutationFn: (body: StartBatchBody) => post<ConversionBatch>('/public/convert/batches', body),
    onSettled: () => void refresh(),
  })
}

/** Live batch progress: the bus pushes frames; a slow poll is the safety net. */
export function useBatch(id: string | null) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: keys.batch(id ?? 'none'),
    queryFn: () => get<ConversionBatch>(`/public/convert/batches/${id}`),
    enabled: id !== null,
    refetchInterval: (q) => (q.state.data?.state === 'running' ? 1500 : false),
  })
  const idRef = useRef(id)
  idRef.current = id
  useEffect(() => {
    return bus.on('convert:progress', ({ batch }) => {
      if (batch.id === idRef.current) client.setQueryData(keys.batch(batch.id), batch)
    })
  }, [client])
  return query
}

/** The message a failed call should show: 429 gets its own copy, validation lists the fields. */
export function errorKind(error: unknown): { status: number; message: string; fields: Record<string, string[]> } {
  if (error instanceof ApiError) return { status: error.status, message: error.message, fields: error.fieldErrors }
  return { status: 0, message: error instanceof Error ? error.message : '', fields: {} }
}
