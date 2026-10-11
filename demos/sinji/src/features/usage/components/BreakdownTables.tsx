/** Sortable breakdown tables (workspace, group, provider, model, feature, user); a row click narrows the filter. */
import { useState } from 'react'

import { DataTable, Tabs, type Column } from '@/components/ui'
import { formatNumber, formatPercent, formatTokens } from '@/lib/format'
import { useUsageParams, type FilterKey } from '../params'
import type { BreakdownDimension, BreakdownRow } from '../types'
import { useLabels } from './parts'

const DIMENSIONS: BreakdownDimension[] = ['workspace', 'group', 'provider', 'model', 'feature', 'user']
const FILTER_OF: Record<BreakdownDimension, FilterKey> = {
  workspace: 'client_id',
  group: 'group',
  provider: 'provider',
  model: 'model',
  feature: 'feature',
  user: 'actor',
}

export function BreakdownTables({ data, loading }: { data: Record<BreakdownDimension, BreakdownRow[]> | undefined; loading?: boolean }) {
  const L = useLabels()
  const { t, lang } = L
  const { filters, setFilters } = useUsageParams()
  const [dim, setDim] = useState<BreakdownDimension>('workspace')

  const rows = data?.[dim]
  const grand = (rows ?? []).reduce((s, r) => s + r.total, 0)
  const filterKey = FILTER_OF[dim]
  const activeValue = filters[filterKey as keyof typeof filters] as string | undefined

  const labelOf = (r: BreakdownRow): string => {
    switch (dim) {
      case 'workspace':
        return r.key === 'public' ? t('workspaces.public') : lang === 'ka' ? (r.label_ka ?? r.label) : r.label
      case 'group':
        return L.group(r.key)
      case 'provider':
        return L.provider(r.key)
      case 'feature':
        return L.feature(r.key)
      case 'user':
        return L.actor(r.key)
      default:
        return r.key
    }
  }

  const columns: Column<BreakdownRow>[] = [
    {
      key: 'label',
      header: t(`breakdown.dims.${dim}`),
      sortable: (r) => labelOf(r),
      cell: (r) => (
        <div className="min-w-[140px]">
          <div className={dim === 'model' ? 'font-mono text-[12.5px]' : 'font-medium'}>{labelOf(r)}</div>
          <div className="mt-1 h-1 w-full max-w-[220px] overflow-hidden rounded-pill bg-sunken" aria-hidden>
            <div className="h-full rounded-pill bg-primary/55" style={{ width: `${grand ? Math.max(2, (r.total / grand) * 100) : 0}%` }} />
          </div>
        </div>
      ),
    },
    { key: 'calls', header: t('breakdown.cols.calls'), sortable: true, align: 'right', cell: (r) => <span className="tabular">{formatNumber(r.calls, lang)}</span> },
    {
      key: 'failed',
      header: t('breakdown.cols.failed'),
      sortable: true,
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className={r.failed ? 'tabular text-danger' : 'tabular text-subtle'}>{formatNumber(r.failed, lang)}</span>,
    },
    { key: 'input', header: t('breakdown.cols.input'), sortable: true, align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular font-mono text-[12.5px]">{formatTokens(r.input, lang)}</span> },
    { key: 'output', header: t('breakdown.cols.output'), sortable: true, align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular font-mono text-[12.5px]">{formatTokens(r.output, lang)}</span> },
    { key: 'cached', header: t('breakdown.cols.cached'), sortable: true, align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular font-mono text-[12.5px]">{formatTokens(r.cached, lang)}</span> },
    { key: 'total', header: t('breakdown.cols.total'), sortable: true, align: 'right', cell: (r) => <span className="tabular font-mono text-[12.5px] font-medium">{formatTokens(r.total, lang)}</span> },
    {
      key: 'share',
      header: t('breakdown.cols.share'),
      sortable: (r) => r.total,
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => <span className="tabular text-muted">{formatPercent(grand ? r.total / grand : 0, lang, { digits: 1 })}</span>,
    },
  ]

  const narrow = (r: BreakdownRow) => {
    if (dim === 'workspace' && r.key === 'public') return
    setFilters({ [filterKey]: activeValue === r.key ? undefined : r.key })
  }

  return (
    <div>
      <div className="max-w-full overflow-x-auto pb-1">
        <Tabs
          variant="pill"
          value={dim}
          onValueChange={(v) => setDim(v as BreakdownDimension)}
          items={DIMENSIONS.map((d) => ({ value: d, label: t(`breakdown.dims.${d}`), count: data?.[d]?.length }))}
        />
      </div>
      <p className="mb-3 mt-3 text-[12.5px] text-muted">{t('breakdown.hint')}</p>
      <DataTable<BreakdownRow>
        key={dim}
        rows={rows}
        loading={loading && !rows}
        columns={columns}
        rowKey={(r) => r.key}
        dense
        pageSize={8}
        defaultSort={{ key: 'total', dir: 'desc' }}
        onRowClick={narrow}
        activeKey={activeValue ?? null}
        empty={<span className="text-muted">{t('empty.title')}</span>}
      />
    </div>
  )
}
