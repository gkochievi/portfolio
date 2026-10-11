/** React Query hooks for reports and the call history (keys start with 'reports' / 'calls'). */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { bus } from '@/demo/bus'
import { get } from '@/lib/api'
import type { AgentPerformanceRow, CallRecordView, CampaignReport, Paginated } from '@/types'

import type { CallDetail, CallDetailParams, CallListFilters, DateRange, ReportFilters } from './types'

export const reportKeys = {
  filters: () => ['reports', 'filters'] as const,
  agentPerformance: (r: DateRange | null) => ['reports', 'agent-performance', r?.from ?? null, r?.to ?? null] as const,
  campaign: (id: string | null, r: DateRange | null) => ['reports', 'campaign', id, r?.from ?? null, r?.to ?? null] as const,
  callDetail: (p: CallDetailParams | null) => ['reports', 'call-detail', p ?? null] as const,
  calls: (f: CallListFilters) => ['calls', 'list', f] as const,
  call: (id: string | null) => ['calls', 'detail', id] as const,
}

export function useReportFilters() {
  return useQuery({ queryKey: reportKeys.filters(), queryFn: () => get<ReportFilters>('/reports/filters'), staleTime: 60_000 })
}

/** `range` null = not generated yet. */
export function useAgentPerformance(range: DateRange | null) {
  return useQuery({
    queryKey: reportKeys.agentPerformance(range),
    queryFn: () => get<AgentPerformanceRow[]>('/reports/agent-performance', { from: range?.from, to: range?.to }),
    enabled: range != null,
  })
}

export function useCampaignReport(campaignId: string | null, range: DateRange | null) {
  return useQuery({
    queryKey: reportKeys.campaign(campaignId, range),
    queryFn: () => get<CampaignReport>(`/reports/campaign/${campaignId}`, { from: range?.from, to: range?.to }),
    enabled: campaignId != null && range != null,
  })
}

export function useCallDetailReport(params: CallDetailParams | null) {
  return useQuery({
    queryKey: reportKeys.callDetail(params),
    queryFn: () => get<CallRecordView[]>('/reports/call-detail', { ...params }),
    enabled: params != null,
  })
}

export function useCalls(filters: CallListFilters) {
  return useQuery({
    queryKey: reportKeys.calls(filters),
    queryFn: () => get<Paginated<CallRecordView>>('/calls', { ...filters }),
    placeholderData: keepPreviousData,
  })
}

export function useCall(id: string | null) {
  return useQuery({
    queryKey: reportKeys.call(id),
    queryFn: () => get<CallDetail>(`/calls/${id}`),
    enabled: id != null,
  })
}

/**
 * Keeps generated reports fresh while the page is open: finished calls and
 * dispositions refetch the active report queries (at most once every 4 s).
 */
export function useReportsLive() {
  const queryClient = useQueryClient()
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      timer = null
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    }
    const schedule = () => {
      if (timer === null) timer = setTimeout(flush, 4000)
    }
    const offs = [
      bus.on('call:event', schedule),
      bus.on('data:changed', ({ scopes }) => {
        if (scopes.includes('calls') || scopes.includes('reports')) schedule()
      }),
    ]
    return () => {
      for (const off of offs) off()
      if (timer !== null) clearTimeout(timer)
    }
  }, [queryClient])
}
