/** Query hooks for the usage endpoints, plus the live feed (`usage:appended`). */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { queryKeys } from '@/api/queryKeys'
import { bus } from '@/demo'
import { get } from '@/lib/api'
import { filterParams, type TabState } from './params'
import type {
  CallRow,
  Paged,
  UsageConversationDetail,
  UsageConversationRow,
  UsageFacets,
  UsageOverview,
  UsageQuery,
  UsageRecordingDetail,
  UsageRecordingRow,
} from './types'

const listParams = (filters: UsageQuery, tab: Pick<TabState, 'q' | 'sort' | 'dir' | 'page'>, pageSize: number) => ({
  ...filterParams(filters),
  q: tab.q || undefined,
  sort: tab.sort,
  dir: tab.dir,
  page: tab.page,
  page_size: pageSize,
})

export const useFacets = () => useQuery({ queryKey: queryKeys.usage.facets, queryFn: () => get<UsageFacets>('/admin/usage/facets'), staleTime: 60_000 })

export const useOverview = (filters: UsageQuery) =>
  useQuery({
    queryKey: queryKeys.usage.overview(filters),
    queryFn: ({ signal }) => get<UsageOverview>('/admin/usage/overview', filterParams(filters), signal),
    placeholderData: keepPreviousData,
  })

export const useRecordings = (filters: UsageQuery, tab: TabState, pageSize = 25) => {
  const params = listParams(filters, tab, pageSize)
  return useQuery({
    queryKey: queryKeys.usage.recordings(filters, params),
    queryFn: ({ signal }) => get<Paged<UsageRecordingRow>>('/admin/usage/recordings', params, signal),
    placeholderData: keepPreviousData,
  })
}

export const useRecording = (id: string) =>
  useQuery({ queryKey: queryKeys.usage.recording(id), queryFn: ({ signal }) => get<UsageRecordingDetail>(`/admin/usage/recordings/${id}`, undefined, signal) })

export const useConversations = (filters: UsageQuery, tab: TabState, pageSize = 25) => {
  const params = listParams(filters, tab, pageSize)
  return useQuery({
    queryKey: queryKeys.usage.conversations(filters, params),
    queryFn: ({ signal }) => get<Paged<UsageConversationRow>>('/admin/usage/conversations', params, signal),
    placeholderData: keepPreviousData,
  })
}

export const useConversation = (id: string) =>
  useQuery({
    queryKey: queryKeys.usage.conversation(id),
    queryFn: ({ signal }) => get<UsageConversationDetail>(`/admin/usage/conversations/${id}`, undefined, signal),
  })

export const useCalls = (filters: UsageQuery, tab: TabState, pageSize = 50) => {
  const params = listParams(filters, tab, pageSize)
  return useQuery({
    queryKey: queryKeys.usage.calls(filters, params),
    queryFn: ({ signal }) => get<Paged<CallRow>>('/admin/usage/calls', params, signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * New usage rows (from any screen that "calls a model") refresh every usage query.
 * Returns how many rows arrived since the page was opened.
 */
export function useUsageLive(): number {
  const qc = useQueryClient()
  const [arrived, setArrived] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = bus.on('usage:appended', ({ count }) => {
      if (count > 0) setArrived((n) => n + count)
      clearTimeout(timer)
      timer = setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.usage.all }), 350)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [qc])
  return arrived
}
