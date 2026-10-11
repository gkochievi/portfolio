import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Card, CardHeader, DataTable, SearchInput, type Column } from '@/components/ui'
import { TranscriptDialog } from '@/features/admin-insights/TranscriptDialog'
import { formatSmartDate } from '@/lib/format'
import type { SessionSummary } from '@/types'

import { useProfileChats } from '../api'

export function OwnChats() {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const chats = useProfileChats({ q, page })

  const columns: Column<SessionSummary>[] = [
    {
      id: 'customer',
      header: t('chats.customer'),
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.customerName}</div>
          <div className="truncate text-xs text-muted">{t(`channel.${row.channel}`, { ns: 'common' })}{row.secondaryLine ? ` · ${row.secondaryLine}` : ''}</div>
        </div>
      ),
    },
    {
      id: 'summary',
      header: t('chats.summary'),
      hideBelow: 'md',
      cell: (row) => <span className="line-clamp-2 text-sm text-muted">{row.endSummary ?? row.lastMessage?.text ?? '-'}</span>,
    },
    {
      id: 'status',
      header: t('chats.status'),
      cell: (row) => (
        <Badge size="sm" tone={row.status === 'ended' ? 'muted' : row.status === 'waiting' ? 'warning' : 'success'}>
          {t(`sessionStatus.${row.status}`, { ns: 'common' })}
        </Badge>
      ),
    },
    { id: 'when', header: t('chats.started'), hideBelow: 'sm', cell: (row) => <span className="tabular text-sm">{formatSmartDate(row.startedAt, lang)}</span> },
    { id: 'messages', header: t('chats.messages'), align: 'right', hideBelow: 'sm', cell: (row) => <span className="tabular text-sm">{row.messageCount}</span> },
    { id: 'rating', header: t('chats.rating'), align: 'right', cell: (row) => <span className="tabular text-sm">{row.rating ? `${row.rating} / 5` : '-'}</span> },
  ]

  return (
    <Card padding="md">
      <CardHeader title={t('chats.title')} description={t('chats.description')} />
      <div className="mb-3 max-w-sm">
        <SearchInput value={q} onChange={(value) => { setQ(value); setPage(1) }} placeholder={t('chats.search')} size="sm" />
      </div>
      <DataTable<SessionSummary>
        columns={columns}
        rows={chats.data?.rows ?? []}
        rowKey={(row) => row.id}
        loading={chats.isLoading}
        total={chats.data?.total ?? 0}
        pageSize={chats.data?.pageSize ?? 8}
        page={page}
        onPageChange={setPage}
        onRowClick={(row) => setOpen(row.id)}
        empty={{ title: q ? t('chats.noResults') : t('chats.empty'), description: q ? undefined : t('chats.emptyHint') }}
      />
      <TranscriptDialog sessionId={open} onOpenChange={(next) => !next && setOpen(null)} />
    </Card>
  )
}
