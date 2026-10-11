/** Query hooks of the operator tools (context, notes, quick replies, templates, copilot, history). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { ChatNote, CopilotTransform, DemoControls, Message, SessionDetail } from '@/types'

import type { ContextResponse, CopilotResponse, HistoryResponse, QuickReplyView, TemplatesResponse } from './types'

/* ------------------------------------------------------------------ context */

export function useSessionContext(sessionId: string) {
  useInvalidateOn(['session:upsert', 'customer:upsert'], queryKeys.context(sessionId))
  return useQuery({
    queryKey: queryKeys.context(sessionId),
    queryFn: () => api.get<ContextResponse>(`/sessions/${sessionId}/context`),
  })
}

/** Own cache entry (the inbox keeps its own detail query). */
export function useDrawerSession(sessionId: string) {
  useInvalidateOn(['session:upsert'], ['operator-tools', 'session', sessionId])
  return useQuery({
    queryKey: ['operator-tools', 'session', sessionId],
    queryFn: () => api.get<SessionDetail>(`/sessions/${sessionId}`),
  })
}

/* -------------------------------------------------------------------- notes */

export function useNotes(sessionId: string, enabled = true) {
  useInvalidateOn(['note:upsert', 'note:deleted'], queryKeys.notes(sessionId))
  return useQuery({
    queryKey: queryKeys.notes(sessionId),
    queryFn: () => api.get<ChatNote[]>(`/sessions/${sessionId}/notes`),
    enabled,
  })
}

export function useAddNote(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => api.post<ChatNote>(`/sessions/${sessionId}/notes`, { content }),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(sessionId) }),
  })
}

export function useDeleteNote(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => api.delete<{ ok: true }>(`/sessions/${sessionId}/notes/${noteId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notes(sessionId) }),
  })
}

/* ------------------------------------------------------------ quick replies */

export function useQuickReplies(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.quickReplies(''), sessionId],
    queryFn: () => api.get<QuickReplyView[]>('/quick-replies', { params: { sessionId } }),
    enabled,
    staleTime: 30_000,
  })
}

/* ---------------------------------------------------------------- templates */

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: () => api.get<TemplatesResponse>('/whatsapp/templates'),
    enabled,
  })
}

export function useSyncTemplates() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<TemplatesResponse>('/whatsapp/templates/sync'),
    onSuccess: (data) => client.setQueryData(queryKeys.templates, data),
  })
}

export function useSendTemplate(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { templateId: string; values: Record<string, string> }) => api.post<Message>(`/sessions/${sessionId}/template`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.messages(sessionId) })
      void client.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
      void client.invalidateQueries({ queryKey: queryKeys.inbox })
    },
  })
}

/* ------------------------------------------------------------------ copilot */

export function useCopilot(sessionId: string) {
  useInvalidateOn(['copilot:update', 'demo:controls'], queryKeys.copilot(sessionId))
  return useQuery({
    queryKey: queryKeys.copilot(sessionId),
    queryFn: () => api.get<CopilotResponse>(`/sessions/${sessionId}/copilot`),
    // The draft is also pushed over the bus; polling is the safety net while it runs.
    refetchInterval: (query) => (query.state.data?.draft?.state === 'running' ? 1_200 : false),
  })
}

export function useRegenerateCopilot(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<CopilotResponse>(`/sessions/${sessionId}/copilot/regenerate`),
    onSuccess: (data) => client.setQueryData(queryKeys.copilot(sessionId), data),
  })
}

export function useTransformCopilot(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (transform: CopilotTransform) => api.post<CopilotResponse>(`/sessions/${sessionId}/copilot/transform`, { transform }),
    onSuccess: (data) => client.setQueryData(queryKeys.copilot(sessionId), data),
  })
}

export function sendCopilotFeedback(input: { sessionId: string; draftId: string; action: 'shown' | 'inserted'; variantIndex: number | null; finalText?: string | null }): void {
  void api.post('/copilot/feedback', input).catch(() => undefined)
}

export function useSimulateOutage(sessionId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (on: boolean) => {
      await api.patch<DemoControls>('/demo/controls', { aiOutageUntil: on ? new Date(Date.now() + 45_000).toISOString() : null })
      return api.post<CopilotResponse>(`/sessions/${sessionId}/copilot/regenerate`)
    },
    onSuccess: (data) => {
      client.setQueryData(queryKeys.copilot(sessionId), data)
      void client.invalidateQueries({ queryKey: queryKeys.demoControls })
    },
  })
}

/* ------------------------------------------------------------------ history */

export function useOperatorHistory(params: { q: string; page: number }) {
  return useQuery({
    queryKey: queryKeys.operatorHistory(params),
    queryFn: () => api.get<HistoryResponse>('/operator/history', { params }),
    placeholderData: keepPreviousData,
  })
}
