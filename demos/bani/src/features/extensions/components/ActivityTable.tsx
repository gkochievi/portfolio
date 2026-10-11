import { useTranslation } from 'react-i18next'

import { DataTable, ErrorState, StatusChip, type Column } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { ExtensionAction, ExtensionActivity } from '@/types'
import { localizeDetails } from '../lib/details'

type Tone = 'info' | 'success' | 'neutral' | 'danger' | 'warning'

export const ACTION_TONE: Record<ExtensionAction, Tone> = {
  create_start: 'info',
  create_finish: 'success',
  create_abort: 'neutral',
  create_error: 'danger',
  purge_logs: 'warning',
  disconnect: 'neutral',
}

interface Props {
  rows: ExtensionActivity[]
  loading: boolean
  error?: unknown
  onRetry?: () => void
}

export function ActivityTable({ rows, loading, error, onRetry }: Props) {
  const { t } = useTranslation('extensions')
  const lang = useLang()

  if (error) return <ErrorState error={error} onRetry={onRetry} />

  const columns: Column<ExtensionActivity>[] = [
    {
      id: 'createdAt',
      header: t('activity.time'),
      mono: true,
      width: 168,
      sortValue: (r) => r.createdAt,
      cell: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.createdAt, lang, { seconds: true })}</span>,
    },
    {
      id: 'username',
      header: t('activity.username'),
      hideBelow: 'sm',
      mono: true,
      sortValue: (r) => r.username,
    },
    {
      id: 'action',
      header: t('activity.action'),
      width: 150,
      sortValue: (r) => r.action,
      cell: (r) => (
        <StatusChip tone={ACTION_TONE[r.action]} size="sm" title={r.action}>
          {t(`activity.actions.${r.action}`)}
        </StatusChip>
      ),
    },
    {
      id: 'details',
      header: t('activity.details'),
      cell: (r) => (
        <div className="min-w-0">
          <div className="break-words">{localizeDetails(r.details, t, lang)}</div>
          <div className="font-mono text-xs text-muted sm:hidden">{r.username}</div>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      compact
      pageSize={25}
      pageSizes={[25, 50, 100]}
      defaultSort={{ id: 'createdAt', dir: 'desc' }}
      emptyTitle={t('activity.emptyTitle')}
      emptyBody={t('activity.emptyBody')}
    />
  )
}
