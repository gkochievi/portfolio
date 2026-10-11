/** Query hooks for the campaigns group (campaigns + node monitor). Keys all start with 'campaigns'. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { http } from '@/lib/api'
import type { Campaign, CampaignSettings, CampaignUpdate, CcNode } from '@/types'

export const campaignKeys = {
  all: queryKeys.campaigns.all,
  list: [...queryKeys.campaigns.all, 'list'] as const,
  one: (id: string) => [...queryKeys.campaigns.all, 'one', id] as const,
  settings: [...queryKeys.campaigns.all, 'settings'] as const,
  nodes: [...queryKeys.campaigns.all, 'nodes'] as const,
}

export const NODES_REFRESH_MS = 30_000

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.list,
    queryFn: ({ signal }) => http.get<Campaign[]>('/cc/campaigns', undefined, signal),
  })
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: campaignKeys.one(id ?? ''),
    queryFn: ({ signal }) => http.get<Campaign>(`/cc/campaigns/${encodeURIComponent(id ?? '')}`, undefined, signal),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
  })
}

export function useCampaignSettings() {
  return useQuery({
    queryKey: campaignKeys.settings,
    queryFn: ({ signal }) => http.get<CampaignSettings>('/cc/campaign-settings', undefined, signal),
    staleTime: 5 * 60_000,
  })
}

export function useUpdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: CampaignUpdate }) =>
      http.put<Campaign>(`/cc/campaigns/${encodeURIComponent(id)}`, update),
    onSuccess: (campaign) => {
      // Every screen that shows the campaign (picker dots, status card, editor) updates at once.
      qc.setQueryData<Campaign[]>(campaignKeys.list, (prev) => prev?.map((c) => (c.id === campaign.id ? campaign : c)))
      qc.setQueryData<Campaign>(campaignKeys.one(campaign.id), campaign)
      void qc.invalidateQueries({ queryKey: campaignKeys.list })
    },
  })
}

export function useNodes() {
  return useQuery({
    queryKey: campaignKeys.nodes,
    queryFn: ({ signal }) => http.get<CcNode[]>('/cc/nodes', undefined, signal),
    refetchInterval: NODES_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

export const supportsPorts = (type: Campaign['type']): boolean => type !== 'preview'
