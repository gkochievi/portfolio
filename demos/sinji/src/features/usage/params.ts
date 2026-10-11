/**
 * The usage filter bar lives in the URL search params so the four tabs share it
 * (and `?client_id=` deep links work). Tab-local state (search, sort, page) lives
 * in the same params and is dropped when a tab link is built.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { UsageCapability, UsageGroup, UsageWindow } from '@/types'
import type { UsageQuery } from './types'

export const FILTER_KEYS = ['window', 'from', 'to', 'client_id', 'group', 'provider', 'model', 'capability', 'status', 'feature', 'actor'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
const TAB_KEYS = ['q', 'sort', 'dir', 'page'] as const

export const WINDOWS: UsageWindow[] = ['24h', '7d', '30d', '90d', 'custom']

function readWindow(value: string | null): UsageWindow {
  return (WINDOWS as string[]).includes(value ?? '') ? (value as UsageWindow) : '30d'
}

export interface TabState {
  q: string
  sort: string | undefined
  dir: 'asc' | 'desc' | undefined
  page: number
}

export function useUsageParams() {
  const [sp, setSp] = useSearchParams()

  const filters = useMemo<UsageQuery>(() => {
    const f: UsageQuery = { window: readWindow(sp.get('window')) }
    if (sp.get('from')) f.from = sp.get('from') as string
    if (sp.get('to')) f.to = sp.get('to') as string
    if (sp.get('client_id')) f.client_id = sp.get('client_id') as string
    if (sp.get('group')) f.group = sp.get('group') as UsageGroup
    if (sp.get('provider')) f.provider = sp.get('provider') as string
    if (sp.get('model')) f.model = sp.get('model') as string
    if (sp.get('capability')) f.capability = sp.get('capability') as UsageCapability
    const status = sp.get('status')
    if (status === 'ok' || status === 'failed') f.status = status
    if (sp.get('feature')) f.feature = sp.get('feature') as string
    if (sp.get('actor')) f.actor = sp.get('actor') as string
    return f
  }, [sp])

  const tab = useMemo<TabState>(() => {
    const dir = sp.get('dir')
    return {
      q: sp.get('q') ?? '',
      sort: sp.get('sort') ?? undefined,
      dir: dir === 'asc' || dir === 'desc' ? dir : undefined,
      page: Math.max(1, Number.parseInt(sp.get('page') ?? '', 10) || 1),
    }
  }, [sp])

  /** Set or clear filter params (undefined or '' removes); resets paging. */
  const setFilters = useCallback(
    (patch: Partial<Record<FilterKey, string | undefined>>) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k)
            else next.set(k, v)
          }
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSp],
  )

  const setTab = useCallback(
    (patch: Partial<Record<(typeof TAB_KEYS)[number], string | number | undefined>>) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '' || (k === 'page' && Number(v) <= 1)) next.delete(k)
            else next.set(k, String(v))
          }
          if ('q' in patch || 'sort' in patch) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSp],
  )

  const clearFilters = useCallback(() => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const k of FILTER_KEYS) if (k !== 'window') next.delete(k)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [setSp])

  /** `?window=7d&client_id=...` for tab links: the filters, never the tab-local state. */
  const filterSearch = useMemo(() => {
    const next = new URLSearchParams()
    for (const k of FILTER_KEYS) {
      const v = sp.get(k)
      if (v) next.set(k, v)
    }
    const s = next.toString()
    return s ? `?${s}` : ''
  }, [sp])

  const activeCount = FILTER_KEYS.filter((k) => k !== 'window' && k !== 'from' && k !== 'to' && sp.get(k)).length

  return { filters, tab, setFilters, setTab, clearFilters, filterSearch, activeCount }
}

/** Request params for the API: the filters, only the defined ones. */
export const filterParams = (f: UsageQuery): Record<string, string> => {
  const out: Record<string, string> = { window: f.window }
  for (const k of FILTER_KEYS) {
    const v = f[k as keyof UsageQuery]
    if (k !== 'window' && typeof v === 'string' && v) out[k] = v
  }
  return out
}
