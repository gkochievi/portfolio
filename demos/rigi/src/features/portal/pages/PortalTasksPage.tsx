/**
 * /partner: My tasks. Finished work waits on top ("Your turn"), the rest is a
 * sortable table. Owner: portal.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OverdueChip, TaskStateChip } from '@/components/status'
import { Button, DataTable, DateText, Mono, PageHeader, SegmentedControl, Section, TicketCard, type Column } from '@/components/ui'
import { formatRelative, formatTaskNumber } from '@/lib/format'
import type { TaskState } from '@/types'

import { usePortalTasks, type PortalTaskRow } from '../api'
import { PointsText } from '../components/PointsText'

const STATE_ORDER: Record<TaskState, number> = { accepted: 0, in_progress: 1, pending: 2, testing: 3, finished: 4, verified: 5, cancelled: 6 }
const CLOSED: TaskState[] = ['verified', 'cancelled']

type Filter = 'all' | 'open' | 'closed'

export default function PortalTasksPage() {
  const { t } = useTranslation('portal')
  const tasks = usePortalTasks()
  const [filter, setFilter] = useState<Filter>('all')

  const awaiting = useMemo(() => (tasks.data ?? []).filter((r) => r.state === 'finished'), [tasks.data])
  const rest = useMemo(() => {
    if (!tasks.data) return undefined
    const others = tasks.data.filter((r) => r.state !== 'finished')
    if (filter === 'open') return others.filter((r) => !CLOSED.includes(r.state))
    if (filter === 'closed') return others.filter((r) => CLOSED.includes(r.state))
    return others
  }, [tasks.data, filter])

  const columns: Column<PortalTaskRow>[] = [
    {
      key: 'number',
      header: t('list.columns.number'),
      width: '96px',
      sortable: true,
      cell: (r) => <Mono>{formatTaskNumber(r.number)}</Mono>,
    },
    {
      key: 'title',
      header: t('list.columns.title'),
      sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{r.title}</span>
          {r.isOverdue ? <OverdueChip /> : null}
        </div>
      ),
    },
    {
      key: 'templateName',
      header: t('list.columns.template'),
      hideBelow: 'md',
      sortable: true,
      sortValue: (r) => r.templateName ?? '',
      cell: (r) => <span className="text-muted">{r.templateName ?? t('list.noTemplate')}</span>,
    },
    {
      key: 'state',
      header: t('list.columns.state'),
      sortable: true,
      sortValue: (r) => STATE_ORDER[r.state],
      cell: (r) => <TaskStateChip state={r.state} realm="partner" />,
    },
    {
      key: 'points',
      header: t('list.columns.points'),
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.points === null || r.pricingPending ? -1 : r.points),
      cell: (r) => <PointsText points={r.points} pricingPending={r.pricingPending} short />,
    },
    {
      key: 'deadline',
      header: t('list.columns.deadline'),
      hideBelow: 'sm',
      sortable: true,
      sortValue: (r) => r.deadline ?? '9999',
      cell: (r) => (r.deadline ? <DateText value={r.deadline} /> : <span className="text-subtle">—</span>),
    },
    {
      key: 'updatedAt',
      header: t('list.columns.updated'),
      hideBelow: 'lg',
      sortable: true,
      cell: (r) => <DateText value={r.updatedAt} relative />,
    },
  ]

  const nothingAtAll = tasks.data !== undefined && tasks.data.length === 0

  return (
    <>
      <PageHeader
        eyebrow={t('list.eyebrow')}
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <Button asChild>
            <Link to="/partner/tasks/new">
              <Plus aria-hidden />
              {t('list.newTask')}
            </Link>
          </Button>
        }
      />

      {awaiting.length > 0 ? (
        <Section eyebrow={t('list.yourTurn')} title={t('list.yourTurnHint')}>
          <div className="grid gap-3 md:grid-cols-2">
            {awaiting.map((r) => (
              <TicketCard
                key={r.id}
                active
                to={`/partner/tasks/${r.id}`}
                footer={
                  <div className="flex items-center justify-between gap-3">
                    <span>{t('list.finishedAgo', { when: formatRelative(r.updatedAt) })}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      {t('list.review')}
                      <ArrowRight className="size-4 stroke-[1.75]" aria-hidden />
                    </span>
                  </div>
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Mono>{formatTaskNumber(r.number)}</Mono>
                    <p className="mt-1.5 line-clamp-2 font-display text-[15px] font-semibold">{r.title}</p>
                    <p className="mt-1 text-[13px] text-muted">{r.templateName ?? t('list.noTemplate')}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-[13px]">
                    <TaskStateChip state={r.state} realm="partner" />
                    <PointsText points={r.points} pricingPending={r.pricingPending} short />
                  </div>
                </div>
              </TicketCard>
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        actions={
          nothingAtAll ? null : (
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'all', label: t('list.filters.all') },
                { value: 'open', label: t('list.filters.open') },
                { value: 'closed', label: t('list.filters.closed') },
              ]}
            />
          )
        }
      >
        <DataTable
          caption={t('list.title')}
          columns={columns}
          rows={rest}
          getRowId={(r) => r.id}
          rowHref={(r) => `/partner/tasks/${r.id}`}
          error={tasks.error ? t('list.error') : undefined}
          onRetry={() => void tasks.refetch()}
          initialSort={{ key: 'updatedAt', dir: 'desc' }}
          empty={
            nothingAtAll
              ? {
                  title: t('list.empty.title'),
                  description: t('list.empty.description'),
                  action: (
                    <Button asChild>
                      <Link to="/partner/tasks/new">
                        <Plus aria-hidden />
                        {t('list.empty.cta')}
                      </Link>
                    </Button>
                  ),
                }
              : awaiting.length > 0 && filter === 'all' && rest?.length === 0
                ? { title: t('common:states.allCaughtUp') }
                : { title: t('common:states.noResults') }
          }
        />
      </Section>
    </>
  )
}
