/** Query hooks for history, transcript, statistics and activity. */
import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { ActivityLog, ChatNote, CustomField, Feedback, Message, Paginated, PersonName, SessionDetail, SessionSummary } from '@/types'

type Params = Record<string, string | number | undefined>

function clean(params: Params): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '' && value !== 'all') out[key] = value
  return out
}

/** A value that follows `value` after `delay` ms of quiet (text filters). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/* ----------------------------------------------------------------- history */

export interface HistoryFilterOptions {
  operators: { id: string; name: PersonName }[]
  fields: CustomField[]
}

export function useHistoryFilters() {
  return useQuery({ queryKey: [...queryKeys.admin.history({ scope: 'filters' })], queryFn: () => api.get<HistoryFilterOptions>('/admin/history/filters'), staleTime: 60_000 })
}

export function useHistory(params: Params) {
  const cleaned = clean(params)
  useInvalidateOn(['session:upsert', 'feedback:new', 'demo:reset'], queryKeys.admin.history())
  return useQuery({
    queryKey: queryKeys.admin.history(cleaned),
    queryFn: () => api.get<Paginated<SessionSummary>>('/admin/history', { params: cleaned }),
    placeholderData: keepPreviousData,
  })
}

export interface Transcript {
  detail: SessionDetail
  messages: Message[]
  notes: ChatNote[]
  feedback: Feedback | null
}

export function useTranscript(sessionId: string | null) {
  useInvalidateOn(['message:upsert', 'note:upsert', 'note:deleted', 'session:upsert', 'feedback:new', 'assignment:upsert'], queryKeys.admin.transcript(sessionId ?? ''))
  return useQuery({
    queryKey: queryKeys.admin.transcript(sessionId ?? ''),
    queryFn: () => api.get<Transcript>(`/admin/history/${sessionId}`),
    enabled: sessionId !== null,
  })
}

/* -------------------------------------------------------------- statistics */

export function useStatisticsSessions(range: { from: string; to: string }) {
  useInvalidateOn(['session:upsert', 'demo:reset'], queryKeys.admin.statistics())
  return useQuery({
    queryKey: queryKeys.admin.statistics({ ...range }),
    queryFn: () => api.get<SessionSummary[]>('/admin/statistics/sessions', { params: range }),
    placeholderData: keepPreviousData,
  })
}

export function useExportLog() {
  return useMutation({
    mutationFn: (input: { from: string; to: string; rows: number; filename: string }) => api.post<{ ok: true }>('/admin/statistics/export-log', input),
  })
}

/* ---------------------------------------------------------------- activity */

export function useActivity(params: Params) {
  const cleaned = clean(params)
  useInvalidateOn(['activity:new', 'demo:reset'], queryKeys.admin.activity())
  return useQuery({
    queryKey: queryKeys.admin.activity(cleaned),
    queryFn: () => api.get<Paginated<ActivityLog>>('/admin/activity', { params: cleaned }),
    placeholderData: keepPreviousData,
  })
}
