/**
 * React Query hooks for the agent workspace. Every key starts with a
 * DataScope ('me' for the operator's own data) so bus invalidation reaches it.
 * The live call is also pushed straight into the cache from 'operator:call'
 * (the in-browser stand-in for the source's WebSocket), so phase changes show
 * without waiting for a refetch.
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { bus } from '@/demo/bus'
import { get, post } from '@/lib/api'
import type {
  AgentStateView,
  AgentStatus,
  AgentTodayKpis,
  CallRecordView,
  CampaignWithStats,
  Disposition,
  OperatorCall,
} from '@/types'

export const agentKeys = {
  state: ['me', 'state'] as const,
  campaigns: ['me', 'campaigns'] as const,
  kpis: ['me', 'kpis'] as const,
  calls: ['me', 'calls'] as const,
  call: ['me', 'call'] as const,
  history: (numberId: string) => ['me', 'history', numberId] as const,
  statuses: ['statuses'] as const,
  dispositions: ['dispositions'] as const,
}

export function useMyState() {
  return useQuery({ queryKey: agentKeys.state, queryFn: () => get<AgentStateView>('/agent/me/state'), refetchInterval: 15_000 })
}

export function useMyCampaigns() {
  return useQuery({
    queryKey: agentKeys.campaigns,
    queryFn: () => get<CampaignWithStats[]>('/agent/me/campaigns'),
    refetchInterval: 30_000,
  })
}

export function useMyKpis() {
  return useQuery({ queryKey: agentKeys.kpis, queryFn: () => get<AgentTodayKpis>('/agent/me/kpis') })
}

export function useMyCalls() {
  return useQuery({ queryKey: agentKeys.calls, queryFn: () => get<CallRecordView[]>('/agent/me/calls') })
}

/** The operator's live call, kept current from the bus. */
export function useMyCall(agentId: string | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!agentId) return
    return bus.on('operator:call', (event) => {
      if (event.agentId !== agentId) return
      queryClient.setQueryData<OperatorCall | null>(agentKeys.call, event.call)
    })
  }, [agentId, queryClient])
  return useQuery({ queryKey: agentKeys.call, queryFn: () => get<OperatorCall | null>('/agent/me/call'), enabled: !!agentId })
}

export function useLeadHistory(numberId: string | null | undefined) {
  return useQuery({
    queryKey: agentKeys.history(numberId ?? ''),
    queryFn: () => get<CallRecordView[]>(`/dialer/numbers/${numberId}/history`),
    enabled: !!numberId,
  })
}

export function useStatuses() {
  return useQuery({ queryKey: agentKeys.statuses, queryFn: () => get<AgentStatus[]>('/agent-statuses'), staleTime: 60_000 })
}

export function useDispositions() {
  return useQuery({ queryKey: agentKeys.dispositions, queryFn: () => get<Disposition[]>('/dispositions'), staleTime: 60_000 })
}

/* -------------------------------------------------------------- mutations */

function useInvalidateMe() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['me'] })
}

export function useSetStatus() {
  const invalidate = useInvalidateMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (statusId: string) => post<AgentStateView>('/agent/me/status', { statusId }),
    onSuccess: (view) => {
      queryClient.setQueryData(agentKeys.state, view)
      void invalidate()
    },
  })
}

export function useSetCampaign() {
  const invalidate = useInvalidateMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) => post<AgentStateView>('/agent/me/campaign', { campaignId }),
    onSuccess: (view) => {
      queryClient.setQueryData(agentKeys.state, view)
      void invalidate()
    },
  })
}

export function useNextLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string | null) => post<OperatorCall>('/dialer/next', { campaignId }),
    onSuccess: (call) => {
      queryClient.setQueryData(agentKeys.call, call)
    },
  })
}

type CallAction = 'answer' | 'reject' | 'hangup'

export function useCallAction() {
  const invalidate = useInvalidateMe()
  return useMutation({
    mutationFn: ({ callId, action }: { callId: string; action: CallAction }) => post<OperatorCall | null>(`/dialer/calls/${callId}/${action}`),
    onSettled: () => void invalidate(),
  })
}

export function useHold() {
  const invalidate = useInvalidateMe()
  return useMutation({
    mutationFn: ({ callId, onHold }: { callId: string; onHold: boolean }) => post<OperatorCall>(`/dialer/calls/${callId}/hold`, { onHold }),
    onSettled: () => void invalidate(),
  })
}

export function useTransfer() {
  const invalidate = useInvalidateMe()
  return useMutation({
    mutationFn: ({ callId, extension }: { callId: string; extension: string }) =>
      post<OperatorCall>(`/dialer/calls/${callId}/transfer`, { extension }),
    onSettled: () => void invalidate(),
  })
}

export function useDispose() {
  const invalidate = useInvalidateMe()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ callId, ...body }: { callId: string; code: string; note?: string; callbackAt?: string | null }) =>
      post<CallRecordView>(`/calls/${callId}/disposition`, body),
    onSuccess: () => {
      queryClient.setQueryData(agentKeys.call, null)
      void invalidate()
      void queryClient.invalidateQueries({ queryKey: ['calls'] })
    },
  })
}
