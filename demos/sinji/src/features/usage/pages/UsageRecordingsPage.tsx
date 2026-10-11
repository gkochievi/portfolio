import { useLocation, useNavigate } from 'react-router-dom'

import { Badge, Button, Callout, DataTable, EmptyState, Toolbar, type Column, type SortState } from '@/components/ui'
import { formatDuration, formatNumber, formatTokens } from '@/lib/format'
import type { UsageGroup } from '@/types'
import { useRecordings } from '../api'
import { ListSearch } from '../components/ListSearch'
import { useLabels } from '../components/parts'
import { useUsageParams } from '../params'
import type { UsageRecordingRow } from '../types'

const GROUP_COLUMNS: UsageGroup[] = ['transcription', 'analysis', 'factcheck', 'tone', 'scoring', 'summary']

/** Recordings: paged, sortable, searchable; one token column per analyser group. */
export default function UsageRecordingsPage() {
  const L = useLabels()
  const { t, lang } = L
  const navigate = useNavigate()
  const { search } = useLocation()
  const { filters, tab, setTab, clearFilters, activeCount } = useUsageParams()
  const query = useRecordings(filters, tab)
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const sort: SortState = { key: tab.sort ?? 'created_at', dir: tab.dir ?? 'desc' }

  const columns: Column<UsageRecordingRow>[] = [
    {
      key: 'filename',
      header: t('recordings.cols.recording'),
      sortable: true,
      cell: (r) => (
        <div className="min-w-[180px] max-w-[320px]">
          <div className="truncate font-medium">{r.filename}</div>
          <div className="truncate text-[12px] text-muted">
            {L.workspace(r)} - {r.created_by}
          </div>
        </div>
      ),
    },
    { key: 'created_at', header: t('recordings.cols.date'), sortable: true, hideBelow: 'md', cell: (r) => <span className="tabular whitespace-nowrap text-[12.5px] text-muted">{date.format(new Date(r.created_at))}</span> },
    { key: 'duration_s', header: t('recordings.cols.duration'), sortable: true, align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular text-muted">{r.duration_s ? formatDuration(r.duration_s, lang) : '-'}</span> },
    ...GROUP_COLUMNS.map<Column<UsageRecordingRow>>((g) => ({
      key: `group:${g}`,
      header: L.group(g),
      sortable: true,
      align: 'right',
      hideBelow: 'xl' as never,
      cell: (r) => <span className="tabular font-mono text-[12.5px]">{r.groups[g] ? formatTokens(r.groups[g], lang) : <span className="text-subtle">-</span>}</span>,
    })),
    {
      key: 'total',
      header: t('recordings.cols.total'),
      sortable: true,
      align: 'right',
      cell: (r) => <span className="tabular font-mono text-[12.5px] font-medium">{formatTokens(r.total, lang)}</span>,
    },
    {
      key: 'calls',
      header: t('recordings.cols.calls'),
      sortable: true,
      align: 'right',
      hideBelow: 'sm',
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="tabular">{formatNumber(r.calls, lang)}</span>
          {r.failed > 0 ? <Badge tone="danger" size="sm">{formatNumber(r.failed, lang)}</Badge> : null}
        </span>
      ),
    },
  ]

  if (query.isError && !query.data) {
    return (
      <Callout tone="danger" title={t('error.title')} action={<Button size="sm" onClick={() => void query.refetch()}>{t('error.retry')}</Button>}>
        {t('error.body')}
      </Callout>
    )
  }

  return (
    <div>
      <Toolbar end={<span className="text-[12.5px] text-muted">{query.data ? t('recordings.count', { count: query.data.total, n: formatNumber(query.data.total, lang) }) : null}</span>}>
        <ListSearch placeholder={t('recordings.search')} />
      </Toolbar>
      <DataTable<UsageRecordingRow>
        rows={query.data?.items}
        loading={query.isLoading}
        columns={columns}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={(s) => setTab({ sort: s?.key, dir: s?.dir })}
        onRowClick={(r) => navigate(`/usage/recordings/${r.id}`, { state: { search } })}
        serverPagination={{
          page: query.data?.page ?? tab.page,
          pageSize: query.data?.page_size ?? 25,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setTab({ page }),
        }}
        empty={
          <EmptyState
            compact
            title={t('recordings.empty.title')}
            body={t('recordings.empty.body')}
            action={tab.q || activeCount > 0 ? <Button size="sm" onClick={() => { setTab({ q: undefined }); clearFilters() }}>{t('filters.clear')}</Button> : undefined}
          />
        }
        caption={t('recordings.caption')}
      />
    </div>
  )
}
