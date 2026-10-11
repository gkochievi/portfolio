/** React Query hooks for the campaigns screens (keys start with 'campaigns' / 'numbers'). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { del, get, patch, post, put } from '@/lib/api'
import type {
  AutoDialerOverview,
  CampaignNumber,
  CampaignStatus,
  CampaignWithStats,
  DialingMode,
  ImportResult,
  Localized,
  SystemSettings,
  User,
} from '@/types'

export interface CampaignFilters {
  status: CampaignStatus | 'all'
  q: string
}

export type NumberGroup = 'all' | 'pending' | 'completed' | 'failed' | 'dnc' | 'callback'

export interface NumberFilters {
  status: NumberGroup
  q: string
}

export interface CampaignInput {
  name: Localized | string
  clientName: Localized | string
  description: Localized | string
  callerId: string
  queueName: string
  workingHoursStart: string
  workingHoursEnd: string
  maxAttempts: number
  retryDelayMinutes: number
  dialingMode: DialingMode
  dialRatio: number
  maxConcurrentCalls: number
  dialIntervalMs: number
}

export type LifecycleAction = 'start' | 'pause' | 'stop'

const LIVE_MS = 5000

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: (filters: CampaignFilters) => ['campaigns', 'list', filters] as const,
  detail: (id: string) => ['campaigns', id] as const,
  agents: (id: string) => ['campaigns', id, 'agents'] as const,
  assignable: (id: string) => ['users', 'assignable', id] as const,
  numbers: (id: string, filters?: NumberFilters) => (filters ? (['numbers', id, filters] as const) : (['numbers', id] as const)),
  duplicates: (id: string) => ['numbers', id, 'duplicates'] as const,
}

/** Live views: refetch while any campaign is running (react-query pauses in hidden tabs). */
export function useCampaigns(filters: CampaignFilters) {
  return useQuery({
    queryKey: campaignKeys.list(filters),
    queryFn: ({ signal }) =>
      get<CampaignWithStats[]>('/campaigns', { status: filters.status === 'all' ? undefined : filters.status, q: filters.q || undefined }, signal),
    placeholderData: (previous) => previous,
    refetchInterval: (query) => (query.state.data?.some((c) => c.status === 'active') ? LIVE_MS : false),
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: ({ signal }) => get<CampaignWithStats>(`/campaigns/${id}`, undefined, signal),
    retry: false,
    refetchInterval: (query) => (query.state.data?.status === 'active' ? LIVE_MS : false),
  })
}

export function useCampaignNumbers(id: string, filters: NumberFilters, live: boolean) {
  return useQuery({
    queryKey: campaignKeys.numbers(id, filters),
    queryFn: ({ signal }) =>
      get<CampaignNumber[]>(`/campaigns/${id}/numbers`, { status: filters.status === 'all' ? undefined : filters.status, q: filters.q || undefined }, signal),
    placeholderData: (previous) => previous,
    refetchInterval: live ? LIVE_MS : false,
  })
}

export function useDuplicates(id: string, enabled: boolean) {
  return useQuery({
    queryKey: campaignKeys.duplicates(id),
    queryFn: ({ signal }) => get<{ phoneNumber: string; instances: number }[]>(`/campaigns/${id}/duplicates`, undefined, signal),
    enabled,
  })
}

export function useCampaignAgents(id: string) {
  return useQuery({
    queryKey: campaignKeys.agents(id),
    queryFn: ({ signal }) => get<User[]>(`/campaigns/${id}/agents`, undefined, signal),
  })
}

export function useAssignableAgents(id: string, enabled: boolean) {
  return useQuery({
    queryKey: campaignKeys.assignable(id),
    queryFn: ({ signal }) => get<User[]>(`/campaigns/${id}/assignable-agents`, undefined, signal),
    enabled,
  })
}

const FALLBACK_DIALER: SystemSettings['dialer'] = { baseDialRatio: 1.2, maxDialRatio: 2.5, minDialRatio: 1, targetAbandonRate: 3 }

/** Dial-ratio bounds for the form (falls back to the seeded defaults). */
export function useDialerBounds() {
  const query = useQuery({
    queryKey: ['settings'] as const,
    queryFn: ({ signal }) => get<SystemSettings>('/settings', undefined, signal),
    retry: false,
    staleTime: 60_000,
  })
  return query.data?.dialer ?? FALLBACK_DIALER
}

export function useAutoDialer(enabled: boolean) {
  return useQuery({
    queryKey: ['dialer', 'auto'] as const,
    queryFn: ({ signal }) => get<AutoDialerOverview>('/dialer/auto', undefined, signal),
    enabled,
    retry: false,
    refetchInterval: enabled ? 2000 : false,
  })
}

/* --------------------------------------------------------------- mutations */

function useInvalidate() {
  const qc = useQueryClient()
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['campaigns'] })
    if (id) void qc.invalidateQueries({ queryKey: ['numbers', id] })
    else void qc.invalidateQueries({ queryKey: ['numbers'] })
    for (const scope of ['metrics', 'dialer', 'me', 'reports'] as const) void qc.invalidateQueries({ queryKey: [scope] })
  }
}

export function useSaveCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CampaignInput }) =>
      id ? patch<CampaignWithStats>(`/campaigns/${id}`, input) : post<CampaignWithStats>('/campaigns', input),
    onSuccess: (campaign) => invalidate(campaign.id),
  })
}

export function useDeleteCampaign() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => del<{ archived: boolean }>(`/campaigns/${id}`),
    onSuccess: (_r, id) => invalidate(id),
  })
}

export function useLifecycle() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: LifecycleAction }) => post<CampaignWithStats>(`/campaigns/${id}/${action}`),
    onSuccess: (campaign) => invalidate(campaign.id),
  })
}

export function useImportNumbers(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { rows: Record<string, string>[]; allowDuplicates: boolean; campaignId?: string }) =>
      post<ImportResult>(`/campaigns/${input.campaignId ?? id}/numbers/import`, { rows: input.rows, allowDuplicates: input.allowDuplicates }),
    onSuccess: (_r, input) => invalidate(input.campaignId ?? id),
  })
}

export function useAddNumber(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { phoneNumber: string; customerName?: string }) => post<CampaignNumber>(`/campaigns/${id}/numbers`, input),
    onSuccess: () => invalidate(id),
  })
}

export function useClearNumbers(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: () => del<{ deleted: number }>(`/campaigns/${id}/numbers`),
    onSuccess: () => invalidate(id),
  })
}

export function useRemoveNumber(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (numberId: string) => del<void>(`/campaigns/${id}/numbers/${numberId}`),
    onSuccess: () => invalidate(id),
  })
}

export function useSetAgents(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (agentIds: string[]) => put<User[]>(`/campaigns/${id}/agents`, { agentIds }),
    onSuccess: () => {
      invalidate(id)
      void qc.invalidateQueries({ queryKey: ['users'] })
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
