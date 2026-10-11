/** The signed-in persona and what it may do. Query key ['me']; invalidate it after access changes. */
import { useQuery } from '@tanstack/react-query'

import { http } from '@/lib/api'
import type { CdrSource, FeatureKey, MeResponse, RoleId } from '@/types'

export const ME_QUERY_KEY = ['me'] as const

export interface UseMe {
  me: MeResponse | undefined
  isLoading: boolean
  role: RoleId | null
  cdrSources: CdrSource[]
  can: (feature: FeatureKey) => boolean
}

export function useMe(): UseMe {
  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => http.get<MeResponse>('/me', undefined, signal),
    staleTime: 60_000,
  })
  const me = query.data
  return {
    me,
    isLoading: query.isLoading,
    role: me?.role ?? null,
    cdrSources: me?.cdrSources ?? [],
    can: (feature) => me?.features.includes(feature) ?? false,
  }
}
