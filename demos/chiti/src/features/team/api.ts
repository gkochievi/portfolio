/** Query hooks for the team group: roster, conversations, threads, profile. */
import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { request } from '@/lib/api'
import { useAccount } from '@/lib/account'
import { useBusEvent, useInvalidateOn } from '@/lib/realtime'
import type { Operator, OperatorProfileStats, Paginated, PersonName, SessionSummary, StaffMessage } from '@/types'

import type { ConversationRow, MessagesPage, ProfileResponse, RosterEntry } from './types'

/* ------------------------------------------------------------ roster + list */

export function useRoster(enabled = true) {
  useInvalidateOn(['staff:message', 'staff:conversation', 'operator:upsert', 'demo:reset'], queryKeys.team.roster)
  return useQuery({
    queryKey: queryKeys.team.roster,
    queryFn: () => request<RosterEntry[]>('GET', '/team/roster'),
    enabled,
  })
}

export function useConversations(enabled = true) {
  useInvalidateOn(['staff:message', 'staff:conversation', 'demo:reset'], queryKeys.team.conversations)
  return useQuery({
    queryKey: queryKeys.team.conversations,
    queryFn: () => request<ConversationRow[]>('GET', '/team/conversations'),
    enabled,
  })
}

export function totalUnread(rows: ConversationRow[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.unread, 0)
}

export function useOpenDirect() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (target: Pick<RosterEntry, 'role' | 'id'>) =>
      request<ConversationRow>('POST', '/team/conversations/direct', { body: { role: target.role, memberId: target.id } }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.team.all })
    },
  })
}

export function useMarkRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => request<ConversationRow>('POST', `/team/conversations/${conversationId}/read`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.team.conversations })
      void client.invalidateQueries({ queryKey: queryKeys.team.roster })
    },
  })
}

/* ------------------------------------------------------------------ threads */

export interface LocalMessage {
  clientId: string
  type: StaffMessage['type']
  content: string
  fileUrl: string | null
  fileName: string | null
  timestamp: string
  failed: boolean
}

export interface ThreadMessage extends StaffMessage {
  /** Only set for bubbles that exist on this device and have not been confirmed yet. */
  local?: boolean
}

function mergeById(...lists: StaffMessage[][]): StaffMessage[] {
  const map = new Map<string, StaffMessage>()
  for (const list of lists) for (const message of list) map.set(message.id, message)
  return [...map.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
}

/** A conversation's messages: server page + older pages + optimistic outbox, with retry. */
export function useThread(conversationId: string) {
  const client = useQueryClient()
  const account = useAccount()
  const [older, setOlder] = useState<StaffMessage[]>([])
  const [olderExhausted, setOlderExhausted] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [outbox, setOutbox] = useState<LocalMessage[]>([])
  const key = queryKeys.team.messages(conversationId)

  const query = useQuery({
    queryKey: key,
    queryFn: () => request<MessagesPage>('GET', `/team/conversations/${conversationId}/messages`, { params: { limit: 30 } }),
    refetchOnMount: 'always',
  })

  // Live messages are folded into the cache (reconciling on clientId), so an open thread never refetches.
  useBusEvent('staff:message', (message) => {
    if (message.conversationId !== conversationId) return
    client.setQueryData<MessagesPage>(key, (page) => {
      if (!page) return page
      const rest = page.messages.filter((row) => row.id !== message.id && !(message.clientId && row.clientId === message.clientId))
      return { ...page, messages: [...rest, message].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) }
    })
    if (message.clientId) setOutbox((rows) => rows.filter((row) => row.clientId !== message.clientId))
  })
  useBusEvent('demo:reset', () => {
    setOlder([])
    setOutbox([])
    setOlderExhausted(false)
    void client.invalidateQueries({ queryKey: key })
  })

  const send = useMutation({
    mutationFn: (local: LocalMessage) =>
      request<StaffMessage>('POST', `/team/conversations/${conversationId}/messages`, {
        body: { content: local.content, type: local.type, clientId: local.clientId, fileUrl: local.fileUrl, fileName: local.fileName },
      }),
    onSuccess: (message) => {
      client.setQueryData<MessagesPage>(key, (page) => {
        if (!page) return page
        const rest = page.messages.filter((row) => row.id !== message.id && row.clientId !== message.clientId)
        return { ...page, messages: [...rest, message] }
      })
      setOutbox((rows) => rows.filter((row) => row.clientId !== message.clientId))
      void client.invalidateQueries({ queryKey: queryKeys.team.conversations })
      void client.invalidateQueries({ queryKey: queryKeys.team.roster })
    },
    onError: (_error, local) => {
      setOutbox((rows) => rows.map((row) => (row.clientId === local.clientId ? { ...row, failed: true } : row)))
    },
  })

  const counter = useRef(0)
  const post = (input: Pick<LocalMessage, 'type' | 'content' | 'fileUrl' | 'fileName'>) => {
    counter.current += 1
    const local: LocalMessage = {
      ...input,
      clientId: `cid_${Date.now().toString(36)}_${counter.current}`,
      timestamp: new Date().toISOString(),
      failed: false,
    }
    setOutbox((rows) => [...rows, local])
    send.mutate(local)
  }
  const retry = (clientId: string) => {
    const local = outbox.find((row) => row.clientId === clientId)
    if (!local) return
    setOutbox((rows) => rows.map((row) => (row.clientId === clientId ? { ...row, failed: false, timestamp: new Date().toISOString() } : row)))
    send.mutate({ ...local, failed: false })
  }
  const discard = (clientId: string) => setOutbox((rows) => rows.filter((row) => row.clientId !== clientId))

  const serverMessages = query.data?.messages ?? []
  const first = older[0] ?? serverMessages[0]
  const hasMore = !olderExhausted && (older.length > 0 ? true : (query.data?.hasMore ?? false))

  const loadOlder = async () => {
    if (!first || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await request<MessagesPage>('GET', `/team/conversations/${conversationId}/messages`, {
        params: { before: first.timestamp, limit: 30 },
      })
      setOlder((rows) => mergeById(page.messages, rows))
      if (!page.hasMore) setOlderExhausted(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  const confirmedClientIds = new Set(serverMessages.map((row) => row.clientId).filter(Boolean))
  const me = account ? { role: account.role, id: account.staffId } : null
  const messages: ThreadMessage[] = [
    ...mergeById(older, serverMessages),
    ...outbox
      .filter((row) => !confirmedClientIds.has(row.clientId))
      .map<ThreadMessage>((row) => ({
        id: `local_${row.clientId}`,
        tenantId: '',
        conversationId,
        senderRole: (me?.role ?? 'operator') as StaffMessage['senderRole'],
        senderId: me?.id ?? '',
        senderName: { en: '', ka: '' },
        type: row.type,
        content: row.content,
        fileUrl: row.fileUrl,
        fileName: row.fileName,
        timestamp: row.timestamp,
        pending: !row.failed,
        failed: row.failed,
        clientId: row.clientId,
        local: true,
      })),
  ]

  return { messages, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, hasMore, loadingOlder, loadOlder, post, retry, discard }
}

/** Colleagues currently typing in a conversation (entries expire after 5 s without a refresh). */
export function useTypingNames(conversationId: string): PersonName[] {
  const account = useAccount()
  const [typing, setTyping] = useState<Map<string, { name: PersonName; until: number }>>(new Map())
  useBusEvent('staff:typing', (event) => {
    if (event.conversationId !== conversationId || event.memberId === account?.staffId) return
    setTyping((current) => {
      const next = new Map(current)
      if (event.isTyping) next.set(event.memberId, { name: event.name, until: Date.now() + 5_000 })
      else next.delete(event.memberId)
      return next
    })
  })
  useBusEvent('staff:message', (message) => {
    if (message.conversationId !== conversationId) return
    setTyping((current) => {
      if (!current.has(message.senderId)) return current
      const next = new Map(current)
      next.delete(message.senderId)
      return next
    })
  })
  useEffect(() => {
    if (typing.size === 0) return
    const timer = setInterval(() => {
      setTyping((current) => {
        const now = Date.now()
        const next = new Map([...current].filter(([, value]) => value.until > now))
        return next.size === current.size ? current : next
      })
    }, 1_000)
    return () => clearInterval(timer)
  }, [typing.size])
  return [...typing.values()].map((value) => value.name)
}

/** Tell the others we are typing (throttled), and that we stopped after a pause. */
export function useTypingSender(conversationId: string) {
  const last = useRef(0)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendTyping = (isTyping: boolean) => {
    void request('POST', `/team/conversations/${conversationId}/typing`, { body: { isTyping } }).catch(() => undefined)
  }
  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
    },
    [],
  )
  return {
    typed: () => {
      const now = Date.now()
      if (now - last.current > 2_500) {
        last.current = now
        sendTyping(true)
      }
      if (stopTimer.current) clearTimeout(stopTimer.current)
      stopTimer.current = setTimeout(() => {
        last.current = 0
        sendTyping(false)
      }, 3_000)
    },
    stopped: () => {
      if (stopTimer.current) clearTimeout(stopTimer.current)
      if (last.current !== 0) {
        last.current = 0
        sendTyping(false)
      }
    },
  }
}

/* ------------------------------------------------------------------ profile */

export function useProfile() {
  useInvalidateOn(['operator:upsert'], queryKeys.profile.all)
  return useQuery({
    queryKey: [...queryKeys.profile.all, 'me'],
    queryFn: () => request<ProfileResponse>('GET', '/operator/profile'),
  })
}

export function useUpdateProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Operator, 'nickname' | 'avatarId' | 'avatarUrl' | 'language' | 'pushEnabled'>>) =>
      request<Operator>('PATCH', '/operator/profile', { body: patch }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.profile.all })
      void client.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useProfileStats(range: { from: string; to: string }) {
  useInvalidateOn(['session:upsert', 'feedback:new', 'assignment:upsert'], queryKeys.profile.all)
  return useQuery({
    queryKey: queryKeys.profile.stats(range),
    queryFn: () => request<OperatorProfileStats>('GET', '/operator/profile/stats', { params: range }),
    placeholderData: keepPreviousData,
  })
}

export function useProfileChats(params: { q: string; page: number }) {
  return useQuery({
    queryKey: queryKeys.profile.chats(params),
    queryFn: () => request<Paginated<SessionSummary>>('GET', '/operator/profile/chats', { params }),
    placeholderData: keepPreviousData,
  })
}
