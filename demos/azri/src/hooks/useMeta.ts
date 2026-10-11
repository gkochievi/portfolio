import { useQuery } from '@tanstack/react-query'

import { request } from '@/lib/api'
import type { MetaLookups } from '@/types'

/** Tenants, branches, staff and campaigns (query key ['meta']). Owner: seed agent. */
export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => request<MetaLookups>('GET', '/meta', { signal }),
    staleTime: Infinity,
  })
}
