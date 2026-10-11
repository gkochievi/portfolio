/**
 * Query hooks for the campaigns group. Keys start with 'campaigns' so
 * src/lib/realtime.ts refetches them on every live event.
 * Owner: feature group campaigns.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { request } from '@/lib/api'
import type { CampaignDetail, CampaignSummary, LinksPage, LinksQuery } from './types'

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: (tenantId: string, days: number) => ['campaigns', 'list', tenantId, days] as const,
  detail: (campaignId: string, days: number) => ['campaigns', 'detail', campaignId, days] as const,
  links: (query: LinksQuery) => ['campaigns', 'links', query] as const,
}

export function useCampaigns(tenantId: string, days: number) {
  return useQuery({
    queryKey: campaignKeys.list(tenantId, days),
    queryFn: ({ signal }) =>
      request<CampaignSummary[]>('GET', '/console/campaigns', { params: { tenantId, days }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useCampaignDetail(campaignId: string, days: number) {
  return useQuery({
    queryKey: campaignKeys.detail(campaignId, days),
    queryFn: ({ signal }) =>
      request<CampaignDetail>('GET', `/console/campaigns/${encodeURIComponent(campaignId)}`, {
        params: { days },
        signal,
      }),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === campaignId ? previous : undefined,
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

export function useLinks(query: LinksQuery) {
  return useQuery({
    queryKey: campaignKeys.links(query),
    queryFn: ({ signal }) =>
      request<LinksPage>('GET', '/console/links', {
        params: {
          status: query.status === 'all' ? undefined : query.status,
          tenantId: query.tenantId,
          campaignId: query.campaignId,
          branchId: query.branchId,
          q: query.q,
          page: query.page,
          pageSize: query.pageSize,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}
