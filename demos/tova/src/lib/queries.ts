/** Shared hooks every group may use. Owner: shell. */
import { useQuery } from '@tanstack/react-query'

import { useAuthUserId } from '@/demo/auth'
import { http } from '@/lib/api'
import type { CurrentEvents, SessionUser } from '@/types'

/** The signed-in user (`null` when signed out). Key: ['auth', 'me', userId]. */
export function useMe() {
  const userId = useAuthUserId()
  return useQuery({
    queryKey: ['auth', 'me', userId],
    queryFn: () => http.get<SessionUser | null>('/auth/me'),
    staleTime: 60_000,
  })
}

/** Active / current / upcoming event (public). Key: ['core', 'current']. */
export function useCurrentEvents() {
  return useQuery({
    queryKey: ['core', 'current'],
    queryFn: () => http.get<CurrentEvents>('/events/current'),
    staleTime: 15_000,
    refetchInterval: 60_000,
  })
}
