/** Standings query hooks: the live board (10 s poll + bus invalidation) and the staff drill-down. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { CatchTally, LeaderboardResponse, PlayerDetail } from '@/types'

export const BOARD_REFRESH_MS = 10_000

/** The drill-down breakdown row; the mock adds the item's art when it still exists. */
export type DetailCatch = CatchTally & { total: number; imageUrl?: string | null }
export type PlayerDetailData = Omit<PlayerDetail, 'breakdown'> & { breakdown: DetailCatch[] }

/** `GET /leaderboard`; `eventId` null = the current event. */
export function useStandings(eventId: string | null, enabled = true) {
  useStandingsLive()
  return useQuery({
    queryKey: queryKeys.standings.board(eventId),
    queryFn: ({ signal }) => http.get<LeaderboardResponse>('/leaderboard', eventId ? { eventId } : undefined, signal),
    refetchInterval: BOARD_REFRESH_MS,
    placeholderData: (previous) => previous,
    enabled,
  })
}

/** `GET /admin/leaderboard/users/:userId` (staff). */
export function usePlayerDetail(userId: string | null, eventId: string | null) {
  return useQuery({
    queryKey: queryKeys.standings.player(userId ?? 'none', eventId),
    queryFn: ({ signal }) =>
      http.get<PlayerDetailData>(`/admin/leaderboard/users/${encodeURIComponent(userId ?? '')}`, eventId ? { eventId } : undefined, signal),
    enabled: Boolean(userId),
  })
}

/** Refresh every standings query the moment a round lands, an answer scores, or the board's event/users change. */
export function useStandingsLive(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.standings.all })
    const offs = [
      bus.on('play:created', refresh),
      bus.on('trivia:answered', refresh),
      bus.on('event:changed', refresh),
      bus.on('user:changed', refresh),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [queryClient])
}
