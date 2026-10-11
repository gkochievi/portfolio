/** Query hooks for the admin live screens. Keys sit under `queryKeys.admin` so one prefix refreshes them all. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { ChatNote, Message, SessionDetail } from '@/types'
import type { MessagesResponse } from '@/features/inbox/types'

import type { AdminSessionsResponse, AdminSessionTab, DashboardResponse } from './types'

const LIVE_EVENTS = ['session:upsert', 'operator:upsert', 'customer:upsert'] as const

export function useDashboard() {
  useInvalidateOn([...LIVE_EVENTS], queryKeys.admin.dashboard)
  return useQuery({ queryKey: queryKeys.admin.dashboard, queryFn: () => api.get<DashboardResponse>('/admin/dashboard') })
}

export function useAdminSessions(tab: AdminSessionTab) {
  useInvalidateOn([...LIVE_EVENTS], ['admin', 'sessions'])
  return useQuery({
    queryKey: queryKeys.admin.sessions(tab),
    queryFn: () => api.get<AdminSessionsResponse>('/admin/sessions', { params: { tab } }),
  })
}

const spectateKey = (sessionId: string) => ['admin', 'spectate', sessionId] as const

export function useSpectateDetail(sessionId: string) {
  useInvalidateOn(['session:upsert', 'assignment:upsert', 'operator:upsert'], spectateKey(sessionId))
  return useQuery({
    queryKey: [...spectateKey(sessionId), 'detail'],
    queryFn: () => api.get<SessionDetail>(`/sessions/${sessionId}`),
  })
}

export function useSpectateMessages(sessionId: string) {
  useInvalidateOn(['message:upsert'], [...spectateKey(sessionId), 'messages'])
  return useQuery({
    queryKey: [...spectateKey(sessionId), 'messages'],
    queryFn: async (): Promise<Message[]> => (await api.get<MessagesResponse>(`/sessions/${sessionId}/messages`, { params: { limit: 100 } })).messages,
  })
}

export function useSpectateNotes(sessionId: string) {
  useInvalidateOn(['note:upsert', 'note:deleted'], [...spectateKey(sessionId), 'notes'])
  return useQuery({
    queryKey: [...spectateKey(sessionId), 'notes'],
    queryFn: () => api.get<ChatNote[]>(`/sessions/${sessionId}/notes`),
    retry: false,
  })
}

function useRefresh() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.admin.all })
}

export function useSetIntervention(sessionId: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (active: boolean) => api.post<SessionDetail>(`/admin/sessions/${sessionId}/intervention`, { active }),
    onSettled: refresh,
  })
}

export function useSendAdminMessage(sessionId: string) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (content: string) => api.post<Message>(`/admin/sessions/${sessionId}/messages`, { content }),
    onSettled: refresh,
  })
}

export function useEndSession(sessionId: string) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: () => api.post(`/admin/sessions/${sessionId}/end`), onSettled: refresh })
}

export function useClearQueue() {
  const refresh = useRefresh()
  return useMutation({ mutationFn: () => api.post<{ cleared: number }>('/admin/queue/clear'), onSettled: refresh })
}
