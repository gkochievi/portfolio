import { useLocation, useNavigate } from 'react-router-dom'

import { Badge, Button, Callout, DataTable, EmptyState, Toolbar, type Column, type SortState } from '@/components/ui'
import { formatDateTime, formatNumber, formatTokens } from '@/lib/format'
import type { ChatConversation } from '@/types'
import { useConversations } from '../api'
import { ListSearch } from '../components/ListSearch'
import { useLabels } from '../components/parts'
import { useUsageParams } from '../params'
import type { UsageConversationRow } from '../types'

export const stateTone: Record<ChatConversation['state'], 'success' | 'warning' | 'neutral'> = {
  open: 'success',
  handoff: 'warning',
  resolved: 'neutral',
}

const FEATURE_COLUMNS = ['triage', 'autopilot', 'handoff', 'copilot'] as const

/** Bot conversations: tokens per feature (triage / autopilot / handoff / copilot), paged and sortable. */
export default function UsageConversationsPage() {
  const L = useLabels()
  const { t, lang } = L
  const navigate = useNavigate()
  const { search } = useLocation()
  const { filters, tab, setTab, clearFilters, activeCount } = useUsageParams()
  const query = useConversations(filters, tab)
  const sort: SortState = { key: tab.sort ?? 'created_at', dir: tab.dir ?? 'desc' }

  const columns: Column<UsageConversationRow>[] = [
    {
      key: 'subject',
      header: t('conversations.cols.subject'),
      sortable: true,
      cell: (r) => (
        <div className="min-w-[200px] max-w-[340px]">
          <div className="truncate font-medium">{r.subject}</div>
          <div className="truncate text-[12px] text-muted">
            {L.workspace(r)} - {formatDateTime(r.last_message_at, lang)}
          </div>
        </div>
      ),
    },
    { key: 'channel', header: t('conversations.cols.channel'), sortable: true, hideBelow: 'md', cell: (r) => <span>{L.channel(r.channel)}</span> },
    {
      key: 'state',
      header: t('conversations.cols.state'),
      sortable: true,
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={stateTone[r.state]} size="sm">{L.state(r.state)}</Badge>
          <span className="hidden text-[12px] text-muted lg:inline">{L.mode(r.mode)}</span>
        </div>
      ),
    },
    { key: 'turns', header: t('conversations.cols.turns'), sortable: true, align: 'right', hideBelow: 'sm', cell: (r) => <span className="tabular">{formatNumber(r.turns, lang)}</span> },
    { key: 'questions', header: t('conversations.cols.questions'), sortable: true, align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular">{formatNumber(r.questions, lang)}</span> },
    ...FEATURE_COLUMNS.map<Column<UsageConversationRow>>((f) => ({
      key: f,
      header: L.feature(f),
      sortable: true,
      align: 'right',
      hideBelow: 'xl' as never,
      cell: (r) => <span className="tabular font-mono text-[12.5px]">{r.features[f] ? formatTokens(r.features[f] ?? 0, lang) : <span className="text-subtle">-</span>}</span>,
    })),
    {
      key: 'total',
      header: t('conversations.cols.total'),
      sortable: true,
      align: 'right',
      cell: (r) => (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="tabular font-mono text-[12.5px] font-medium">{formatTokens(r.total, lang)}</span>
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
      <Toolbar end={<span className="text-[12.5px] text-muted">{query.data ? t('conversations.count', { count: query.data.total, n: formatNumber(query.data.total, lang) }) : null}</span>}>
        <ListSearch placeholder={t('conversations.search')} />
      </Toolbar>
      <DataTable<UsageConversationRow>
        rows={query.data?.items}
        loading={query.isLoading}
        columns={columns}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={(s) => setTab({ sort: s?.key, dir: s?.dir })}
        onRowClick={(r) => navigate(`/usage/conversations/${r.id}`, { state: { search } })}
        serverPagination={{
          page: query.data?.page ?? tab.page,
          pageSize: query.data?.page_size ?? 25,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setTab({ page }),
        }}
        empty={
          <EmptyState
            compact
            title={t('conversations.empty.title')}
            body={t('conversations.empty.body')}
            action={tab.q || activeCount > 0 ? <Button size="sm" onClick={() => { setTab({ q: undefined }); clearFilters() }}>{t('filters.clear')}</Button> : undefined}
          />
        }
        caption={t('conversations.caption')}
      />
    </div>
  )
}
