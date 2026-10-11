/**
 * Query hooks of the launcher group. Every key starts with 'launcher', so the
 * realtime bridge refetches them on each bus event (submit, SMS, clock).
 */
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'

import { request } from '@/lib/api'

import type { BranchSample, ClockState, InboxMessage, PlaygroundRoute, RecipientSummary } from './types'

export const launcherKeys = {
  all: ['launcher'] as const,
  recipients: () => ['launcher', 'recipients'] as const,
  messages: (recipientId: string) => ['launcher', 'messages', recipientId] as const,
  branches: () => ['launcher', 'branches'] as const,
  routes: () => ['launcher', 'routes'] as const,
  clock: () => ['launcher', 'clock'] as const,
}

export function useRecipients() {
  return useQuery({
    queryKey: launcherKeys.recipients(),
    queryFn: ({ signal }) => request<RecipientSummary[]>('GET', '/inbox/recipients', { signal }),
  })
}

function messagesQuery(recipientId: string) {
  return {
    queryKey: launcherKeys.messages(recipientId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      request<InboxMessage[]>('GET', `/inbox/recipients/${encodeURIComponent(recipientId)}/messages`, { signal }),
  }
}

export function useInbox(recipientId: string | null) {
  return useQuery({
    ...messagesQuery(recipientId ?? ''),
    enabled: Boolean(recipientId),
  })
}

/** Every persona's inbox at once (tenant chips, playground token list). */
export function useAllInboxes(recipientIds: string[]) {
  return useQueries({
    queries: recipientIds.map((id) => messagesQuery(id)),
    combine: (results) => ({
      messages: results.flatMap((result) => result.data ?? []),
      isLoading: results.some((result) => result.isLoading),
    }),
  })
}

export function useBranches() {
  return useQuery({
    queryKey: launcherKeys.branches(),
    queryFn: ({ signal }) => request<BranchSample[]>('GET', '/inbox/branches', { signal }),
  })
}

export function usePlaygroundRoutes() {
  return useQuery({
    queryKey: launcherKeys.routes(),
    queryFn: ({ signal }) => request<PlaygroundRoute[]>('GET', '/playground/routes', { signal }),
    staleTime: Infinity,
  })
}

export function useDemoClock() {
  return useQuery({
    queryKey: launcherKeys.clock(),
    queryFn: ({ signal }) => request<ClockState>('GET', '/playground/clock', { signal }),
  })
}

export function useSetDemoClock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (days: number) => request<ClockState>('POST', '/playground/clock', { body: { days } }),
    onSuccess: (state) => {
      queryClient.setQueryData(launcherKeys.clock(), state)
      void queryClient.invalidateQueries({ queryKey: launcherKeys.all })
    },
  })
}
