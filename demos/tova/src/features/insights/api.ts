/** Insights query hook: `GET /admin/stats`, refreshed whenever the bus reports a change. */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo/events'
import { http } from '@/lib/api'
import type { Stats } from '@/types'

export function useInsights() {
  useInsightsLive()
  return useQuery({
    queryKey: queryKeys.insights.stats(),
    queryFn: ({ signal }) => http.get<Stats>('/admin/stats', undefined, signal),
    placeholderData: (previous) => previous,
  })
}

/** Ghost rounds, trivia answers, sign-ups and event edits all move the numbers. */
function useInsightsLive(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.insights.all })
    const offs = [
      bus.on('play:created', refresh),
      bus.on('trivia:answered', refresh),
      bus.on('user:changed', refresh),
      bus.on('event:changed', refresh),
    ]
    return () => {
      for (const off of offs) off()
    }
  }, [queryClient])
}
