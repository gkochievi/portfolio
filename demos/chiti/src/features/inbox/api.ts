/** Query hooks of the operator inbox (owner: inbox). Everything goes through `request()`. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Message, SessionDetail, SessionSummary } from '@/types'
import { request } from '@/lib/api'
import { useInvalidateOn } from '@/lib/realtime'

import type { InboxResponse, MessagesResponse, SendMessageBody } from './types'

export const inboxKeys = {
  list: ['inbox', 'list'] as const,
  detail: (sessionId: string) => ['inbox', 'detail', sessionId] as const,
  messages: (sessionId: string) => ['inbox', 'messages', sessionId] as const,
}

const PAGE = 30

/** Queue + my chats + counters. Live: refetched on session / message / assignment events. */
export function useInbox() {
  useInvalidateOn(
    ['session:upsert', 'message:upsert', 'assignment:upsert', 'operator:upsert', 'settings:update', 'demo:reset'],
    inboxKeys.list,
  )
  return useQuery({
    queryKey: inboxKeys.list,
    queryFn: () => request<InboxResponse>('GET', '/operator/inbox'),
    refetchOnWindowFocus: false,
  })
}

export function useSessionDetail(sessionId: string | null) {
  useInvalidateOn(['session:upsert', 'assignment:upsert', 'operator:upsert', 'customer:upsert', 'demo:reset'], ['inbox', 'detail'])
  return useQuery({
    queryKey: inboxKeys.detail(sessionId ?? 'none'),
    queryFn: () => request<SessionDetail>('GET', `/sessions/${sessionId}`),
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

function mergeMessages(...groups: Message[][]): Message[] {
  const byId = new Map<string, Message>()
  for (const group of groups) for (const message of group) byId.set(message.id, message)
  return [...byId.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

/** The latest page of a thread (live) plus "load older" pages fetched on scroll-up. */
export function useThreadMessages(sessionId: string | null) {
  useInvalidateOn(['message:upsert', 'demo:reset'], ['inbox', 'messages'])
  const latest = useQuery({
    queryKey: inboxKeys.messages(sessionId ?? 'none'),
    queryFn: () => request<MessagesResponse>('GET', `/sessions/${sessionId}/messages`, { params: { limit: PAGE } }),
    enabled: !!sessionId,
    refetchOnWindowFocus: false,
    retry: false,
  })
  const [older, setOlder] = useState<{ sessionId: string | null; items: Message[]; hasMore: boolean | null }>({
    sessionId: null,
    items: [],
    hasMore: null,
  })
  const [loadingOlder, setLoadingOlder] = useState(false)
  const olderFor = older.sessionId === sessionId ? older : { sessionId, items: [] as Message[], hasMore: null as boolean | null }

  const messages = useMemo(() => mergeMessages(olderFor.items, latest.data?.messages ?? []), [olderFor.items, latest.data])
  const hasMore = olderFor.hasMore ?? latest.data?.hasMore ?? false

  const loadOlder = useCallback(async () => {
    const first = messages[0]
    if (!sessionId || !first || loadingOlder) return 0
    setLoadingOlder(true)
    try {
      const page = await request<MessagesResponse>('GET', `/sessions/${sessionId}/messages`, { params: { before: first.timestamp, limit: PAGE } })
      setOlder((current) => ({
        sessionId,
        items: mergeMessages(current.sessionId === sessionId ? current.items : [], page.messages),
        hasMore: page.hasMore,
      }))
      return page.messages.length
    } finally {
      setLoadingOlder(false)
    }
  }, [messages, sessionId, loadingOlder])

  return { messages, hasMore, loadOlder, loadingOlder, query: latest }
}

export function useClaim() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => request<SessionSummary>('POST', `/sessions/${sessionId}/claim`),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: inboxKeys.list })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useSendMessage(sessionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: SendMessageBody) => request<Message>('POST', `/sessions/${sessionId}/messages`, { body }),
    onSuccess: (message) => {
      if (!sessionId) return
      client.setQueryData<MessagesResponse>(inboxKeys.messages(sessionId), (current) =>
        current ? { ...current, messages: mergeMessages(current.messages, [message]) } : current,
      )
      void client.invalidateQueries({ queryKey: inboxKeys.list })
      void client.invalidateQueries({ queryKey: inboxKeys.detail(sessionId) })
    },
  })
}

export function useFinishChat() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => request<SessionSummary>('POST', `/sessions/${sessionId}/finish`),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['inbox'] })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useRetryMessage(sessionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) => request<Message>('POST', `/sessions/${sessionId}/messages/${messageId}/retry`),
    onSuccess: (message) => {
      if (!sessionId) return
      client.setQueryData<MessagesResponse>(inboxKeys.messages(sessionId), (current) =>
        current ? { ...current, messages: mergeMessages(current.messages, [message]) } : current,
      )
      void client.invalidateQueries({ queryKey: inboxKeys.detail(sessionId) })
    },
  })
}

export function useReactToMessage(sessionId: string | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { messageId: string; emoji: string }) =>
      request<Message>('POST', `/sessions/${sessionId}/messages/${input.messageId}/reaction`, { body: { emoji: input.emoji } }),
    onSuccess: (message) => {
      if (!sessionId) return
      client.setQueryData<MessagesResponse>(inboxKeys.messages(sessionId), (current) =>
        current ? { ...current, messages: mergeMessages(current.messages, [message]) } : current,
      )
    },
  })
}

export function useSimulateTimeout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => request<SessionSummary>('POST', `/demo/sessions/${sessionId}/simulate-timeout`),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['inbox'] })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

/** Clears the unread badge when a chat is opened (and again when new customer messages arrive while it is open). */
export function useMarkSeen(sessionId: string | null, unread: number) {
  const client = useQueryClient()
  const inFlight = useRef(false)
  useEffect(() => {
    if (!sessionId || unread <= 0 || inFlight.current) return
    inFlight.current = true
    request('POST', `/sessions/${sessionId}/seen`)
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false
        void client.invalidateQueries({ queryKey: inboxKeys.list })
      })
  }, [sessionId, unread, client])
}

/** Fire-and-forget typing signal, throttled to one "typing" per 2.5 s and an explicit stop. */
export function useTypingSignal(sessionId: string | null) {
  const last = useRef(0)
  const active = useRef(false)
  const stop = useCallback(() => {
    if (!sessionId || !active.current) return
    active.current = false
    last.current = 0
    request('POST', `/sessions/${sessionId}/typing`, { body: { isTyping: false } }).catch(() => undefined)
  }, [sessionId])
  const ping = useCallback(() => {
    if (!sessionId) return
    const now = Date.now()
    if (active.current && now - last.current < 2_500) return
    active.current = true
    last.current = now
    request('POST', `/sessions/${sessionId}/typing`, { body: { isTyping: true } }).catch(() => undefined)
  }, [sessionId])
  useEffect(() => stop, [stop])
  return { ping, stop }
}
