import { History, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Callout, DataTable, EmptyState, FilterChip, type Column, type Tone } from '@/components/ui'
import { useFormat } from '@/lib/format'
import type { KbEvent, KbEventAction } from '@/types'
import { KB_EVENT_ACTIONS, useKbEvents } from '../api'
import { errorText } from '../components/bits'

const ACTION_TONE: Record<KbEventAction, Tone> = {
  import: 'primary',
  edit: 'info',
  delete: 'danger',
  reembed: 'accent',
  chunk_edit: 'info',
  chunk_delete: 'danger',
  bulk: 'warning',
  export: 'neutral',
  curation: 'success',
}

export default function KbActivityPage() {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const [action, setAction] = useState('')
  const events = useKbEvents(action)

  const columns: Column<KbEvent>[] = [
    {
      key: 'created_at',
      header: t('activity.when'),
      sortable: (row) => row.created_at,
      width: 150,
      cell: (row) => <span className="tabular whitespace-nowrap text-[13px]">{f.dateTime(row.created_at)}</span>,
    },
    {
      key: 'action',
      header: t('activity.action'),
      cell: (row) => <Badge tone={ACTION_TONE[row.action]}>{t(`activity.actions.${row.action}`)}</Badge>,
    },
    {
      key: 'document',
      header: t('activity.document'),
      cell: (row) =>
        row.document_id && row.document_title ? (
          <Link to={`/workspace/kb/chunks?doc=${encodeURIComponent(row.document_id)}`} className="hover:text-primary hover:underline">
            {row.document_title}
          </Link>
        ) : (
          <span className="text-subtle">{row.document_title ?? '-'}</span>
        ),
    },
    {
      key: 'detail',
      header: t('activity.detail'),
      hideBelow: 'md',
      cell: (row) => (
        <span className={row.status === 'error' ? 'text-danger' : 'text-muted'}>
          {row.method ? <span className="mr-1.5 font-mono text-xs text-subtle">{row.method}</span> : null}
          {row.detail}
        </span>
      ),
    },
    { key: 'actor', header: t('activity.actor'), hideBelow: 'lg', cell: (row) => <span className="text-[13px]">{row.actor}</span> },
    {
      key: 'chunk_count',
      header: t('activity.chunks'),
      align: 'right',
      hideBelow: 'lg',
      sortable: (row) => row.chunk_count ?? -1,
      cell: (row) => <span className="tabular">{row.chunk_count ?? '-'}</span>,
    },
    {
      key: 'duration_ms',
      header: t('activity.duration'),
      align: 'right',
      hideBelow: 'lg',
      sortable: (row) => row.duration_ms ?? -1,
      cell: (row) => <span className="tabular font-mono text-xs">{row.duration_ms == null ? '-' : `${f.number(row.duration_ms)} ms`}</span>,
    },
    {
      key: 'status',
      header: t('activity.status'),
      cell: (row) => <Badge tone={row.status === 'ok' ? 'success' : 'danger'}>{t(`activity.statuses.${row.status}`)}</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={action === ''} onClick={() => setAction('')}>
          {t('activity.all')}
        </FilterChip>
        {KB_EVENT_ACTIONS.map((a) => (
          <FilterChip key={a} active={action === a} onClick={() => setAction(action === a ? '' : a)}>
            {t(`activity.actions.${a}`)}
          </FilterChip>
        ))}
        <span className="ml-auto" />
        <Button
          variant="secondary"
          size="sm"
          loading={events.isFetching}
          icon={<RefreshCw className="size-4" />}
          onClick={() => void events.refetch()}
        >
          {t('common.refresh')}
        </Button>
      </div>

      {events.isError ? (
        <Callout tone="danger" title={t('common.loadError')}>
          {errorText(events.error, t('common.loadError'))}
        </Callout>
      ) : (
        <DataTable
          rows={events.data}
          columns={columns}
          rowKey={(row) => row.id}
          loading={events.isLoading}
          pageSize={15}
          defaultSort={{ key: 'created_at', dir: 'desc' }}
          caption={t('activity.caption')}
          empty={<EmptyState compact icon={<History className="size-5" />} title={t('activity.empty')} />}
        />
      )}
    </div>
  )
}
