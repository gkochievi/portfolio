/**
 * Query hooks for the insights group. Keys start with 'insights', so
 * src/lib/realtime.ts invalidates them on every live event.
 * Owner: feature group insights.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { request } from '@/lib/api'
import type { Page, ResponseDetail, ResponseRow } from '@/types'
import type { InsightsFilters, Overview, ResponsesQuery } from './types'

export const WINDOWS = [7, 30, 90] as const

/* ---------------------------------------------------------------- filters */

const FILTER_KEYS = ['tenantId', 'branchId', 'staffId', 'campaignId', 'days', 'rating', 'hasComment', 'q', 'page'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

/** Filters live in the URL so a view can be shared and survives a reload. */
export function useInsightsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<ResponsesQuery>(() => {
    const days = Number(searchParams.get('days'))
    return {
      tenantId: searchParams.get('tenantId') ?? '',
      branchId: searchParams.get('branchId') ?? '',
      staffId: searchParams.get('staffId') ?? '',
      campaignId: searchParams.get('campaignId') ?? '',
      days: (WINDOWS as readonly number[]).includes(days) ? days : 30,
      rating: searchParams.get('rating') ?? '',
      hasComment: searchParams.get('hasComment') === 'true',
      q: searchParams.get('q') ?? '',
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      pageSize: 20,
    }
  }, [searchParams])

  /** Patch some filters. Anything but `page` resets the page. Cascades tenant → branch → staff. */
  const update = useCallback(
    (patch: Partial<Record<FilterKey, string | number | boolean | null>>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const set = (key: string, value: string | number | boolean | null | undefined) => {
            if (value === null || value === undefined || value === '' || value === false) next.delete(key)
            else next.set(key, String(value))
          }
          // Cascade only when the parent actually changes, and never over a value set in this patch.
          const changed = (key: FilterKey) => key in patch && (prev.get(key) ?? '') !== String(patch[key] ?? '')
          const drop = (key: FilterKey) => {
            if (!(key in patch)) next.delete(key)
          }
          if (changed('tenantId')) {
            drop('branchId')
            drop('staffId')
            drop('campaignId')
          }
          if (changed('branchId')) drop('staffId')
          for (const [key, value] of Object.entries(patch)) set(key, value)
          if ('days' in patch && Number(patch.days) === 30) next.delete('days')
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const clear = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of FILTER_KEYS) next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const active = Boolean(
    filters.tenantId || filters.branchId || filters.staffId || filters.campaignId || filters.rating || filters.hasComment || filters.q,
  )

  return { filters, update, clear, active }
}

function scopeParams(f: InsightsFilters) {
  return {
    tenantId: f.tenantId || undefined,
    branchId: f.branchId || undefined,
    staffId: f.staffId || undefined,
    campaignId: f.campaignId || undefined,
    days: f.days,
  }
}

/* ---------------------------------------------------------------- queries */

export function useOverview(filters: InsightsFilters) {
  const params = scopeParams(filters)
  return useQuery({
    queryKey: ['insights', 'overview', params],
    queryFn: ({ signal }) => request<Overview>('GET', '/console/overview', { params, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useResponses(query: ResponsesQuery) {
  const params = {
    ...scopeParams(query),
    rating: query.rating || undefined,
    hasComment: query.hasComment ? 'true' : undefined,
    q: query.q || undefined,
    page: query.page,
    pageSize: query.pageSize,
  }
  return useQuery({
    queryKey: ['insights', 'responses', params],
    queryFn: ({ signal }) => request<Page<ResponseRow>>('GET', '/console/responses', { params, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useResponseDetail(responseId: string | null) {
  return useQuery({
    queryKey: ['insights', 'response', responseId],
    queryFn: ({ signal }) => request<ResponseDetail>('GET', `/console/responses/${responseId}`, { signal }),
    enabled: Boolean(responseId),
    retry: false,
  })
}
