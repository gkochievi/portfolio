/** Events console query hooks: dashboard, events list, one event, and the event writes. */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { DashboardSummary, EventSummary, GameEvent } from '@/types'

/** `GET /admin/dashboard` adds the live event's latest round for the "last round" line. */
export type DashboardData = DashboardSummary & { lastPlayAt: string | null }

export interface EventCreateInput {
  name: string
  durationSeconds: number
  startsAt: string
  endsAt: string
}

export type EventPatch = Partial<
  Pick<
    GameEvent,
    | 'name'
    | 'startsAt'
    | 'endsAt'
    | 'durationSeconds'
    | 'maxGood'
    | 'maxBad'
    | 'difficulty'
    | 'speedLevel'
    | 'leaderboardSize'
    | 'published'
    | 'awardsVisible'
    | 'leaderboardVisible'
  >
>

/** Everything an event write can change elsewhere: /play, the boards, the hub, the switcher. */
export function invalidateAfterEventWrite(queryClient: QueryClient): void {
  for (const key of [queryKeys.events.all, queryKeys.core.all, queryKeys.standings.all, queryKeys.play.all, queryKeys.hub.all, queryKeys.content.all, queryKeys.insights.all, queryKeys.people.all]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

/** Keep counts and the live card fresh as ghost rounds land and other screens write. */
export function useEventsLive(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
    const offs = [
      bus.on('play:created', refresh),
      bus.on('event:changed', refresh),
      bus.on('user:changed', refresh),
      bus.on('trivia:answered', refresh),
      bus.on('demo:reset', refresh),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [queryClient])
}

export function useDashboard() {
  useEventsLive()
  return useQuery({
    queryKey: queryKeys.events.dashboard(),
    queryFn: () => http.get<DashboardData>('/admin/dashboard'),
    placeholderData: (previous) => previous,
  })
}

export function useEventsList(enabled = true) {
  useEventsLive()
  return useQuery({
    queryKey: queryKeys.events.list(),
    queryFn: () => http.get<EventSummary[]>('/admin/events'),
    enabled,
  })
}

export function useEventDetail(eventId: string | undefined) {
  useEventsLive()
  return useQuery({
    queryKey: queryKeys.events.detail(eventId ?? 'none'),
    queryFn: () => http.get<EventSummary>(`/admin/events/${encodeURIComponent(eventId ?? '')}`),
    enabled: Boolean(eventId),
    retry: false,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EventCreateInput) => http.post<EventSummary>('/admin/events', input),
    onSuccess: () => invalidateAfterEventWrite(queryClient),
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EventPatch }) =>
      http.patch<EventSummary>(`/admin/events/${encodeURIComponent(id)}`, patch),
    /** Optimistic for the list toggles: flip the row at once, roll back on error. */
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.events.list() })
      const previous = queryClient.getQueryData<EventSummary[]>(queryKeys.events.list())
      if (previous) {
        queryClient.setQueryData<EventSummary[]>(
          queryKeys.events.list(),
          previous.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        )
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.events.list(), context.previous)
    },
    onSuccess: (event) => {
      queryClient.setQueryData(queryKeys.events.detail(event.id), event)
    },
    onSettled: () => invalidateAfterEventWrite(queryClient),
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.del<{ ok: true }>(`/admin/events/${encodeURIComponent(id)}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.events.detail(id) })
      queryClient.removeQueries({ queryKey: queryKeys.content.items(id) })
      queryClient.removeQueries({ queryKey: queryKeys.content.trivia(id) })
      queryClient.removeQueries({ queryKey: queryKeys.content.prizes(id) })
      invalidateAfterEventWrite(queryClient)
    },
  })
}
