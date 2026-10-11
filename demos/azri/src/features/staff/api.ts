/**
 * Query hooks for the staff group. Keys start with 'staff' so realtime
 * invalidation (link/response/sms/clock events) keeps every screen live.
 *
 * Owner: feature group staff.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { LinkRow, Page, ResponseRow } from '@/types'
import type { MyOverview, SendOptions, SendSurveyRequest } from './types'

export function useMyOverview(days: number) {
  return useQuery({
    queryKey: queryKeys.staff.overview({ days }),
    queryFn: ({ signal }) => api.get<MyOverview>('/console/me/overview', { params: { days }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useMyResponses(page: number, hasComment: boolean) {
  return useQuery({
    queryKey: queryKeys.staff.responses({ page, hasComment }),
    queryFn: ({ signal }) =>
      api.get<Page<ResponseRow>>('/console/me/responses', {
        params: { page, pageSize: 8, hasComment: hasComment ? 'true' : undefined },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useSendOptions() {
  return useQuery({
    queryKey: queryKeys.staff.sendOptions(),
    queryFn: ({ signal }) => api.get<SendOptions>('/console/send/options', { signal }),
    staleTime: 60_000,
  })
}

export function useMyLinks(page: number) {
  return useQuery({
    queryKey: queryKeys.staff.links({ page }),
    queryFn: ({ signal }) => api.get<Page<LinkRow>>('/console/me/links', { params: { page, pageSize: 8 }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useSendSurvey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendSurveyRequest) => api.post<LinkRow>('/console/send', input),
    onSuccess: () => {
      for (const scope of ['staff', 'campaigns', 'insights', 'launcher']) {
        void queryClient.invalidateQueries({ queryKey: [scope] })
      }
    },
  })
}
