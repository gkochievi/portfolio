import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable, ErrorState, LiveDot, Section, StatusBadge, type Column } from '@/components/ui'
import { clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { formatRelative } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { LinkRow } from '@/types'
import { useMyLinks } from '../api'

const RECENT_MS = 10 * 60_000

export function RecentSends({ admin, highlightId }: { admin: boolean; highlightId: string | null }) {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const [page, setPage] = useState(1)
  const query = useMyLinks(page)
  const now = clock.now()

  const columns: Column<LinkRow>[] = [
    {
      id: 'token',
      header: t('send.recent.token'),
      cell: (row) => (
        <span className="inline-flex items-center gap-2 font-mono text-ink">
          {now.getTime() - new Date(row.sentAt).getTime() < RECENT_MS && <LiveDot tone="accent" />}
          {row.id}
        </span>
      ),
    },
    {
      id: 'recipient',
      header: t('send.recent.recipient'),
      cell: (row) => (
        <div className="min-w-0">
          {row.recipientName && <p className="truncate text-ink">{lt(row.recipientName, lang)}</p>}
          <p className="font-mono text-xs text-muted">{row.phoneMasked}</p>
        </div>
      ),
    },
    {
      id: 'campaign',
      header: t('send.recent.campaign'),
      hideBelow: 'md',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{lt(row.campaignTitle, lang)}</p>
          <p className="truncate text-xs text-muted">
            {lt(row.tenantName, lang)} · {lt(row.branchName, lang)}
          </p>
        </div>
      ),
    },
    ...(admin
      ? [{ id: 'staff', header: t('send.recent.staff'), hideBelow: 'lg' as const, cell: (row: LinkRow) => lt(row.staffName, lang) }]
      : []),
    {
      id: 'sent',
      header: t('send.recent.sent'),
      hideBelow: 'sm',
      cell: (row) => <span className="whitespace-nowrap text-muted tabular">{formatRelative(row.sentAt, lang, now)}</span>,
    },
    {
      id: 'status',
      header: t('send.recent.status'),
      align: 'right',
      cell: (row) => {
        const detail =
          row.status === 'pending'
            ? t('send.recent.expires', { when: formatRelative(row.expiresAt, lang, now) })
            : row.status === 'completed' && row.completedAt
              ? t('send.recent.answered', { when: formatRelative(row.completedAt, lang, now) })
              : undefined
        // Badge on top, detail underneath: keeps the column narrow at 375px.
        return (
          <div className="flex flex-col items-end gap-0.5">
            <StatusBadge status={row.status} size="sm" />
            {detail && <span className="whitespace-nowrap text-xs text-muted">{detail}</span>}
          </div>
        )
      },
    },
  ]

  return (
    <Section title={admin ? t('send.recent.titleAdmin') : t('send.recent.title')} description={t('send.recent.description')}>
      {query.isError ? (
        <ErrorState compact onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          getRowId={(row) => row.id}
          loading={!query.data}
          highlightIds={highlightId ? [highlightId] : undefined}
          empty={{ title: t('send.recent.emptyTitle'), description: t('send.recent.emptyDescription') }}
          pagination={
            query.data
              ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: setPage }
              : undefined
          }
        />
      )}
    </Section>
  )
}
