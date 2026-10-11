/** The shared filter bar of the usage tabs. State lives in the URL (see params.ts). */
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, FilterChip, Input, SegmentedControl, Select, type SelectOption } from '@/components/ui'
import { useFacets } from '../api'
import { useUsageParams, WINDOWS, type FilterKey } from '../params'
import { useLabels } from './parts'
import type { UsageWindow } from '@/types'

const ALL = '__all__'

const dateInput = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function UsageFilterBar() {
  const { t } = useTranslation('usage')
  const L = useLabels()
  const { filters, setFilters, clearFilters, activeCount } = useUsageParams()
  const facets = useFacets().data

  const withCurrent = (values: string[] | undefined, current: string | undefined) => {
    const list = values ?? []
    return current && !list.includes(current) ? [current, ...list] : list
  }
  const opts = (values: string[], label: (v: string) => string, allLabel: string): SelectOption[] => [
    { value: ALL, label: allLabel },
    ...values.map((v) => ({ value: v, label: label(v) })),
  ]

  const workspaceOptions: SelectOption[] = [
    { value: ALL, label: t('filters.allWorkspaces') },
    ...(facets?.workspaces ?? []).map((w) => ({ value: w.id, label: L.lang === 'ka' ? w.name_ka : w.name })),
  ]
  if (filters.client_id && !(facets?.workspaces ?? []).some((w) => w.id === filters.client_id)) {
    workspaceOptions.push({ value: filters.client_id, label: filters.client_id })
  }

  const bind = (key: FilterKey) => (v: string) => setFilters({ [key]: v === ALL ? undefined : v })
  const windowLabel: Record<UsageWindow, string> = {
    '24h': t('window.24h'),
    '7d': t('window.7d'),
    '30d': t('window.30d'),
    '90d': t('window.90d'),
    custom: t('window.custom'),
  }

  const onWindow = (w: UsageWindow) => {
    if (w === 'custom') {
      const now = Date.now()
      setFilters({ window: 'custom', from: filters.from ?? dateInput(now - 30 * 86_400_000), to: filters.to ?? dateInput(now) })
    } else setFilters({ window: w === '30d' ? undefined : w, from: undefined, to: undefined })
  }

  const extra: Array<{ key: FilterKey; label: string; value: string }> = []
  if (filters.feature) extra.push({ key: 'feature', label: t('filters.feature'), value: L.feature(filters.feature) })
  if (filters.actor) extra.push({ key: 'actor', label: t('filters.user'), value: L.actor(filters.actor) })

  return (
    <section aria-label={t('filters.label')} className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<UsageWindow>
          aria-label={t('filters.window')}
          value={filters.window}
          onValueChange={onWindow}
          size="sm"
          options={WINDOWS.map((w) => ({ value: w, label: windowLabel[w] }))}
        />
        {filters.window === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              size="sm"
              aria-label={t('filters.from')}
              value={filters.from ?? ''}
              max={filters.to ?? dateInput(Date.now())}
              onChange={(e) => setFilters({ from: e.target.value || undefined })}
              className="w-[150px]"
            />
            <span className="text-muted" aria-hidden>
              -
            </span>
            <Input
              type="date"
              size="sm"
              aria-label={t('filters.to')}
              value={filters.to ?? ''}
              min={filters.from}
              max={dateInput(Date.now())}
              onChange={(e) => setFilters({ to: e.target.value || undefined })}
              className="w-[150px]"
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Select size="sm" aria-label={t('filters.workspace')} value={filters.client_id ?? ALL} onValueChange={bind('client_id')} options={workspaceOptions} />
        <Select
          size="sm"
          aria-label={t('filters.group')}
          value={filters.group ?? ALL}
          onValueChange={bind('group')}
          options={opts(withCurrent(facets?.groups, filters.group), L.group, t('filters.allGroups'))}
        />
        <Select
          size="sm"
          aria-label={t('filters.provider')}
          value={filters.provider ?? ALL}
          onValueChange={bind('provider')}
          options={opts(withCurrent(facets?.providers, filters.provider), L.provider, t('filters.allProviders'))}
        />
        <Select
          size="sm"
          aria-label={t('filters.model')}
          value={filters.model ?? ALL}
          onValueChange={bind('model')}
          options={opts(withCurrent(facets?.models, filters.model), (v) => v, t('filters.allModels'))}
        />
        <Select
          size="sm"
          aria-label={t('filters.capability')}
          value={filters.capability ?? ALL}
          onValueChange={bind('capability')}
          options={opts(withCurrent(facets?.capabilities, filters.capability), L.capability, t('filters.allCapabilities'))}
        />
        <Select
          size="sm"
          aria-label={t('filters.status')}
          value={filters.status ?? ALL}
          onValueChange={bind('status')}
          options={[
            { value: ALL, label: t('filters.allStatuses') },
            { value: 'ok', label: t('status.ok') },
            { value: 'failed', label: t('status.failed') },
          ]}
        />
      </div>

      {extra.length > 0 || activeCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {extra.map((e) => (
            <FilterChip key={e.key} active onRemove={() => setFilters({ [e.key]: undefined })}>
              {e.label}: {e.value}
            </FilterChip>
          ))}
          <Button variant="ghost" size="xs" icon={<X className="size-3.5" />} onClick={clearFilters}>
            {t('filters.clear')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
