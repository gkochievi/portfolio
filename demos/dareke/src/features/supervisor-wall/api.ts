/** React Query hooks for the supervisor wall (keys start with a DataScope). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { WallAgentView } from '@/demo/handlers/supervisor-wall'
import { get, post } from '@/lib/api'
import type { AutoDialerCampaignState, AutoDialerOverview, CallEvent, CampaignProgress, CampaignWithStats, HourlyCallData, RealtimeMetrics } from '@/types'

export type { WallAgentView }

/** Wall data refetches every 5 s on top of the bus invalidation. */
const LIVE = { refetchInterval: 5000, refetchIntervalInBackground: false } as const

export const wallKeys = {
  metrics: ['metrics', 'wall'] as const,
  agents: ['agents', 'wall'] as const,
  events: ['calls', 'wall-events'] as const,
  hourly: ['calls', 'wall-hourly'] as const,
  campaigns: ['campaigns', 'wall'] as const,
  progress: (id: string) => ['campaigns', 'wall-progress', id] as const,
  dialer: ['dialer', 'auto'] as const,
}

export const useWallMetrics = () => useQuery({ queryKey: wallKeys.metrics, queryFn: () => get<RealtimeMetrics>('/supervisor/metrics'), ...LIVE })

export const useWallAgents = () => useQuery({ queryKey: wallKeys.agents, queryFn: () => get<WallAgentView[]>('/supervisor/agents'), ...LIVE })

export const useWallEvents = () => useQuery({ queryKey: wallKeys.events, queryFn: () => get<CallEvent[]>('/supervisor/events'), ...LIVE })

export const useWallHourly = () =>
  useQuery({ queryKey: wallKeys.hourly, queryFn: () => get<HourlyCallData[]>('/supervisor/hourly'), refetchInterval: 15000 })

export const useWallCampaigns = () =>
  useQuery({ queryKey: wallKeys.campaigns, queryFn: () => get<CampaignWithStats[]>('/supervisor/campaigns'), refetchInterval: 30000 })

export const useCampaignProgress = (id: string | null) =>
  useQuery({
    queryKey: wallKeys.progress(id ?? 'none'),
    queryFn: () => get<CampaignProgress>(`/supervisor/campaigns/${encodeURIComponent(id ?? '')}/progress`),
    enabled: !!id,
    placeholderData: keepPreviousData,
    ...LIVE,
  })

export const useAutoDialer = () => useQuery({ queryKey: wallKeys.dialer, queryFn: () => get<AutoDialerOverview>('/dialer/auto'), ...LIVE })

function useInvalidateLive() {
  const queryClient = useQueryClient()
  return () => {
    for (const scope of ['dialer', 'metrics', 'calls', 'agents', 'campaigns'] as const) void queryClient.invalidateQueries({ queryKey: [scope] })
  }
}

export function useDialerSwitch() {
  const invalidate = useInvalidateLive()
  return useMutation({
    mutationFn: (on: boolean) => post<{ enabled: boolean }>(on ? '/dialer/auto/start' : '/dialer/auto/stop'),
    onSettled: invalidate,
  })
}

export type DialerAction = 'trigger' | 'reset' | 'fail'

export function useDialerAction() {
  const invalidate = useInvalidateLive()
  return useMutation({
    mutationFn: ({ campaignId, action }: { campaignId: string; action: DialerAction }) =>
      post<{ dialed: number } | AutoDialerCampaignState>(`/dialer/auto/${encodeURIComponent(campaignId)}/${action}`),
    onSettled: invalidate,
  })
}
