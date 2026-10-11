/** Query hooks for the game. Keys live under ['play']. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { PlayConfig, ScoreResult, ScoreSubmit } from '@/types'

/** Active event, its items, my best and the upcoming event. Always fresh so console changes reach the next round. */
export function usePlayConfig() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.play.all })
    const offs = [bus.on('event:changed', refresh), bus.on('demo:reset', refresh)]
    return () => offs.forEach((off) => off())
  }, [queryClient])
  return useQuery({
    queryKey: queryKeys.play.config(),
    queryFn: () => http.get<PlayConfig>('/play/config'),
    staleTime: 0,
    refetchOnMount: 'always',
    // An upcoming event may open while the closed screen is up.
    refetchInterval: (query) => (query.state.data && !query.state.data.event ? 30_000 : false),
  })
}

/** Save a finished round. Refreshes every screen that shows rounds or scores. */
export function useSubmitScore() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ScoreSubmit) => http.post<ScoreResult>('/play/score', body),
    onSettled: () => {
      for (const queryKey of [
        queryKeys.play.all,
        queryKeys.hub.all,
        queryKeys.standings.all,
        queryKeys.insights.all,
        queryKeys.events.all,
        queryKeys.people.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
