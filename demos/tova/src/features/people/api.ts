/** People and participants query hooks. Mutations refresh every screen that shows users, plays or scores. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { ParticipantRow, Role, User } from '@/types'

export interface NewUserInput {
  firstName: string
  lastName: string
  role: Role
  email: string
  username?: string
}

export interface UserPatch {
  role?: Role
  disabled?: boolean
}

export function useUsers(enabled = true) {
  usePeopleLive()
  return useQuery({
    queryKey: queryKeys.people.users(),
    queryFn: () => http.get<User[]>('/admin/users'),
    enabled,
  })
}

export function useParticipants(q: string) {
  usePeopleLive()
  return useQuery({
    queryKey: queryKeys.people.participants(q),
    queryFn: ({ signal }) => http.get<ParticipantRow[]>('/admin/participants', q ? { q } : undefined, signal),
    placeholderData: (previous) => previous,
  })
}

/** Everything a user change can move: People, the lead list, standings, Insights and the dashboard counts. */
function useInvalidateAfterUserWrite() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.people.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.standings.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.events.dashboard() }),
    ])
}

export function useCreateUser() {
  const invalidate = useInvalidateAfterUserWrite()
  return useMutation({
    mutationFn: (input: NewUserInput) => http.post<User>('/admin/users', input),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateAfterUserWrite()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UserPatch }) =>
      http.patch<User>(`/admin/users/${encodeURIComponent(id)}`, patch),
    onSuccess: () => invalidate(),
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateAfterUserWrite()
  return useMutation({
    mutationFn: (id: string) => http.del(`/admin/users/${encodeURIComponent(id)}`),
    onSuccess: () => invalidate(),
  })
}

/**
 * Live refresh: a round landing (the visitor's or a ghost player's) moves best
 * and plays; registrations, guest logins and other tabs' People edits add rows.
 */
export function usePeopleLive(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.people.all })
    const offs = [bus.on('play:created', refresh), bus.on('user:changed', refresh), bus.on('demo:reset', refresh)]
    return () => {
      for (const off of offs) off()
    }
  }, [queryClient])
}

/** A value that settles `delay` ms after the last change (search boxes). */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return settled
}
