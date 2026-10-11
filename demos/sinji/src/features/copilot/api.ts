/**
 * Query hooks and mutations for the copilot group: the harness, the
 * workspace bot configuration, the global default bot and the bot control.
 * Query keys start with `copilot`. OWNED BY: copilot.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo'
import { get, post, put } from '@/lib/api'
import type { BotConfig, ChatConversation, TtsClip, TtsLanguage, Voice } from '@/types'
import type {
  BotConfigView,
  BotControl,
  ControlRow,
  ConversationView,
  FeedbackBody,
  FeedbackResult,
  NewConversationBody,
  SttBody,
  SttResult,
  TurnTicket,
  WorkspaceRow,
} from './types'

const keys = queryKeys.copilot

/** Refresh everything the copilot screens show when another screen changes the kill switch or the KB. */
export function useCopilotSync(): void {
  const client = useQueryClient()
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: keys.all })
    const offKill = bus.on('bot:kill-changed', refresh)
    const offKb = bus.on('kb:changed', refresh)
    return () => {
      offKill()
      offKb()
    }
  }, [client])
}

/* --------------------------------------------------------------- harness */

export const useWorkspaces = () => useQuery({ queryKey: keys.workspaces, queryFn: () => get<WorkspaceRow[]>('/copilot/workspaces') })

export const createConversation = (body: NewConversationBody) => post<ChatConversation>('/copilot/conversations', body)
export const sendTurn = (conversationId: string, content: string) => post<TurnTicket>(`/copilot/conversations/${conversationId}/turns`, { content })
export const fetchConversation = (conversationId: string) => get<ConversationView>(`/copilot/conversations/${conversationId}`)
export const sendFeedback = (body: FeedbackBody) => post<FeedbackResult>('/copilot/feedback', body)
export const transcribe = (body: SttBody) => post<SttResult>('/copilot/stt', body)

export interface TtsCatalogLite {
  languages: TtsLanguage[]
  voices: Voice[]
}

export const useTtsCatalog = () =>
  useQuery({ queryKey: [...keys.all, 'tts-catalog'] as const, queryFn: () => get<TtsCatalogLite>('/public/tts/catalog'), staleTime: 5 * 60_000 })

export const synthesize = (text: string, language: string, voiceId: string, modelId: string) =>
  post<TtsClip>('/public/tts', { text, language_code: language, voice_id: voiceId, model_id: modelId })

/* ------------------------------------------------------------- bot config */

export const useBotConfig = () => useQuery({ queryKey: keys.botConfig, queryFn: () => get<BotConfigView>('/bot/config') })

export function useSaveBotConfig() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<BotConfig>) => put<BotConfigView>('/bot/config', body),
    onSuccess: (view) => {
      client.setQueryData(keys.botConfig, view)
      void client.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export const useDefaultBot = () => useQuery({ queryKey: keys.defaultBot, queryFn: () => get<BotConfig>('/admin/bot/default') })

export function useSaveDefaultBot() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<BotConfig>) => put<BotConfig>('/admin/bot/default', body),
    onSuccess: (config) => {
      client.setQueryData(keys.defaultBot, config)
      void client.invalidateQueries({ queryKey: keys.all })
    },
  })
}

/* -------------------------------------------------------------- bot control */

export const useBotControl = () => useQuery({ queryKey: keys.botControl, queryFn: () => get<BotControl>('/admin/bot/control') })

export function useSetGlobalKill() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (global_disabled: boolean) => put<BotControl>('/admin/bot/kill', { global_disabled }),
    onSuccess: (view) => {
      client.setQueryData(keys.botControl, view)
      void client.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useSetTenantBot() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; disabled?: boolean; autopilot_enabled?: boolean }) => put<ControlRow>(`/admin/bot/tenants/${id}`, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  })
}
