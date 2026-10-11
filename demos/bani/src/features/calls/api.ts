/** Query hooks for the Call Explorer. Keys start with 'calls' (PLAN section 5). */
import { useMutation, useQuery } from '@tanstack/react-query'

import { http } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useInvalidateOn } from '@/lib/live'
import type {
  CdrSearchRequest,
  CdrSearchResponse,
  CdrSource,
  RecordingBundleRequest,
  RecordingBundleResponse,
  RecordingLookupResponse,
} from '@/types'

/** A submitted search. `nonce` makes pressing Search twice refetch; it is never sent. */
export interface SearchParams extends CdrSearchRequest {
  nonce: number
}

export function useCallSearch(params: SearchParams | null) {
  useInvalidateOn('demo:reset', queryKeys.calls.all)
  return useQuery({
    queryKey: queryKeys.calls.key('search', params),
    enabled: params !== null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) => {
      const { nonce: _nonce, ...request } = params as SearchParams
      void _nonce
      return http.post<CdrSearchResponse>('/calls/search', request, signal)
    },
  })
}

/** Lazy recording lookup for one leg; enabled when the drawer needs it. */
export function useRecordingLookup(legId: string | null, source: CdrSource, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.calls.key('recording', legId, source),
    enabled: enabled && legId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: ({ signal }) => http.post<RecordingLookupResponse>('/recordings/lookup', { callId: legId, source }, signal),
  })
}

export function useRecordingBundle() {
  return useMutation({
    mutationFn: (request: RecordingBundleRequest) => http.post<RecordingBundleResponse>('/recordings/bundle', request),
  })
}
