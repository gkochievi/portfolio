/**
 * The one QueryClient. Query keys start with a DataScope
 * so `data:changed` can invalidate by scope; the shared
 * keys below keep the common reads on one cache entry across features.
 */
import { QueryClient } from '@tanstack/react-query'

import type { DataScope } from '@/types'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The bus invalidates on every relevant change, so data can stay fresh for a while.
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: { retry: false },
  },
})

type Part = string | number | boolean | null | undefined | Record<string, unknown>

/** `scopeKey('numbers', campaignId, filters)` -> `['numbers', campaignId, filters]`. */
export const scopeKey = <S extends DataScope, P extends Part[]>(scope: S, ...parts: P) => [scope, ...parts] as const

export const queryKeys = {
  /** GET /auth/me */
  meUser: () => ['me', 'user'] as const,
  /** GET /agent/me/state */
  meState: () => ['me', 'state'] as const,
  /** GET /agent/me/call */
  meCall: () => ['me', 'call'] as const,
  /** GET /agent/me/kpis */
  meKpis: () => ['me', 'kpis'] as const,
  /** GET /agent/me/calls */
  meCalls: () => ['me', 'calls'] as const,
  /** GET /agent/me/campaigns */
  meCampaigns: () => ['me', 'campaigns'] as const,
  /** GET /dialer/status (top-bar badge) */
  dialerStatus: () => ['dialer', 'status'] as const,
  /** GET /dialer/auto */
  autoDialer: () => ['dialer', 'auto'] as const,
  /** GET /lookups/campaigns */
  campaignLookup: () => ['campaigns', 'lookup'] as const,
  /** GET /agent-statuses */
  statuses: () => ['statuses'] as const,
  /** GET /dispositions */
  dispositions: () => ['dispositions'] as const,
  /** GET /campaigns/:id */
  campaign: (id: string) => ['campaigns', id] as const,
  /** GET /campaigns/:id/numbers */
  numbers: (campaignId: string, filters?: Record<string, unknown>) => ['numbers', campaignId, filters ?? {}] as const,
}
