/**
 * Query hooks for the four integration sub-pages. Every mutation refreshes
 * each screen that shows the data (FAQ also refreshes the widget config and
 * the settings hub; AI link also the tenant settings).
 */
import { useEffect } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/realtime'
import type { FaqTree, PageComment, TelegramIntegration } from '@/types'

import type { AiLinkView, AiTestResult, FaqState, IntegrationsView, MetaChannel, MetaTestResult, SimpleTestResult, TikTokCheckResult } from './types'

/* --------------------------------------------------------------------- FAQ */

export function useFaq() {
  return useQuery({ queryKey: queryKeys.admin.faq, queryFn: ({ signal }) => api.get<FaqState>('/admin/faq', { signal }) })
}

export function useSaveFaq() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { faqEnabled: boolean; faqShowOperatorButton: boolean; tree: FaqTree }) => api.put<FaqState>('/admin/faq', input),
    onSuccess: (data) => {
      client.setQueryData(queryKeys.admin.faq, data)
      void client.invalidateQueries({ queryKey: queryKeys.admin.settings })
      void client.invalidateQueries({ queryKey: queryKeys.tenantSettings })
      void client.invalidateQueries({ queryKey: ['widget'] })
    },
  })
}

/* ------------------------------------------------------------ integrations */

export function useIntegrations() {
  const query = useQuery({
    queryKey: queryKeys.admin.integrations,
    queryFn: ({ signal }) => api.get<IntegrationsView>('/admin/integrations', { signal }),
    // The TikTok authorise popup is polled every 3 s until the platform answers.
    refetchInterval: (q) => (q.state.data?.tiktokPending ? 3_000 : false),
  })
  useInvalidateOn(['integration:update', 'demo:reset'], queryKeys.admin.integrations)
  return query
}

/** Polls the Telegram handshake every 5 s while `active`; a finished handshake refreshes the cards. */
export function useTelegramPoll(active: boolean) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.admin.telegram,
    queryFn: ({ signal }) => api.get<TelegramIntegration>('/admin/integrations/telegram', { signal }),
    enabled: active,
    refetchInterval: active ? 5_000 : false,
  })
  const state = query.data?.state
  useEffect(() => {
    if (active && state === 'connected') void client.invalidateQueries({ queryKey: queryKeys.admin.integrations })
  }, [active, state, client])
  return query
}

function useRefreshIntegrations() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.integrations })
    void client.invalidateQueries({ queryKey: queryKeys.admin.activity() })
    void client.invalidateQueries({ queryKey: ['admin', 'activity'] })
  }
}

export interface MetaFormInput {
  enabled: boolean
  displayName: string
  routingId: string
  accessToken: string
  appSecret: string
  verifyToken: string
}

export function useSaveMeta() {
  const refresh = useRefreshIntegrations()
  return useMutation({
    mutationFn: ({ channel, ...body }: MetaFormInput & { channel: MetaChannel }) => api.put<IntegrationsView>(`/admin/integrations/meta/${channel}`, body),
    onSuccess: refresh,
  })
}

export function useConnectMeta() {
  const refresh = useRefreshIntegrations()
  return useMutation({
    mutationFn: (channel: MetaChannel) => api.post<IntegrationsView>(`/admin/integrations/meta/${channel}/connect`),
    onSuccess: refresh,
  })
}

export function useTestMeta() {
  const refresh = useRefreshIntegrations()
  return useMutation({
    mutationFn: (channel: MetaChannel) => api.post<MetaTestResult>(`/admin/integrations/meta/${channel}/test`),
    onSettled: refresh,
  })
}

export function useDeleteMeta() {
  const refresh = useRefreshIntegrations()
  return useMutation({
    mutationFn: (channel: MetaChannel) => api.delete<IntegrationsView>(`/admin/integrations/meta/${channel}`),
    onSuccess: refresh,
  })
}

export function useConnectTelegram() {
  const refresh = useRefreshIntegrations()
  return useMutation({
    mutationFn: (input: { token: string; acknowledgeEviction: boolean }) => api.post<TelegramIntegration>('/admin/integrations/telegram/connect', input),
    onSuccess: refresh,
  })
}

export function useTestTelegram() {
  return useMutation({ mutationFn: () => api.post<SimpleTestResult>('/admin/integrations/telegram/test') })
}

export function useDisconnectTelegram() {
  const refresh = useRefreshIntegrations()
  return useMutation({ mutationFn: () => api.delete<TelegramIntegration>('/admin/integrations/telegram'), onSuccess: refresh })
}

export function useConnectTikTok() {
  const refresh = useRefreshIntegrations()
  return useMutation({ mutationFn: () => api.post<{ pending: boolean }>('/admin/integrations/tiktok/connect'), onSuccess: refresh })
}

export function useCheckTikTok() {
  const refresh = useRefreshIntegrations()
  return useMutation({ mutationFn: () => api.post<TikTokCheckResult>('/admin/integrations/tiktok/check'), onSuccess: refresh })
}

export function useTestTikTok() {
  return useMutation({ mutationFn: () => api.post<SimpleTestResult>('/admin/integrations/tiktok/test') })
}

export function useDisconnectTikTok() {
  const refresh = useRefreshIntegrations()
  return useMutation({ mutationFn: () => api.delete('/admin/integrations/tiktok'), onSuccess: refresh })
}

/* ---------------------------------------------------------------- comments */

export function useComments(channel: 'all' | 'facebook_messenger' | 'instagram') {
  const query = useQuery({
    queryKey: queryKeys.admin.comments(channel),
    queryFn: ({ signal }) => api.get<PageComment[]>('/admin/comments', { params: { channel }, signal }),
    placeholderData: keepPreviousData,
  })
  useInvalidateOn(['comment:upsert', 'demo:reset'], ['admin', 'comments'])
  return query
}

function useRefreshComments() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: ['admin', 'comments'] })
    void client.invalidateQueries({ queryKey: ['admin', 'activity'] })
  }
}

export function useReplyComment() {
  const refresh = useRefreshComments()
  return useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => api.post<PageComment>(`/admin/comments/${id}/reply`, { text }), onSuccess: refresh })
}

export function useHideComment() {
  const refresh = useRefreshComments()
  return useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.post<PageComment>(`/admin/comments/${id}/hide`, { hidden }), onSuccess: refresh })
}

export function useDeleteComment() {
  const refresh = useRefreshComments()
  return useMutation({ mutationFn: (id: string) => api.delete(`/admin/comments/${id}`), onSuccess: refresh })
}

/* ----------------------------------------------------------------- AI link */

export function useAiLink() {
  const query = useQuery({ queryKey: queryKeys.admin.aiLink, queryFn: ({ signal }) => api.get<AiLinkView>('/admin/ai-link', { signal }) })
  useInvalidateOn(['settings:update', 'demo:controls', 'demo:reset'], queryKeys.admin.aiLink)
  return query
}

function useRefreshAi() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.admin.aiLink })
    void client.invalidateQueries({ queryKey: queryKeys.admin.settings })
    void client.invalidateQueries({ queryKey: queryKeys.tenantSettings })
    void client.invalidateQueries({ queryKey: ['admin', 'activity'] })
  }
}

export function useSaveAiLink() {
  const refresh = useRefreshAi()
  return useMutation({
    mutationFn: (input: { aiClientId: string; aiBotEnabled: boolean }) => api.put<AiLinkView>('/admin/ai-link', input),
    onSuccess: refresh,
  })
}

export function useTestAiLink() {
  const refresh = useRefreshAi()
  return useMutation({ mutationFn: () => api.post<AiTestResult>('/admin/ai-link/test'), onSettled: refresh })
}
