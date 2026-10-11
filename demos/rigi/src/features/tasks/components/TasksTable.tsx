import { Download, MessageSquareDot, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { OverdueChip, TaskStateChip } from '@/components/status'
import {
  Avatar,
  Badge,
  Button,
  type Column,
  Checkbox,
  DataTable,
  DateText,
  FilterBar,
  Mono,
  SearchInput,
  Select,
  SelectItem,
  Tooltip,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { downloadText, toCsv } from '@/lib/csv'
import { formatDate, formatPoints, formatTaskNumber, localName } from '@/lib/format'
import { usePartnerOptions } from '@/features/partners/api'
import type { TaskState } from '@/types'

import type { TaskRow } from '../api'

const STATES: TaskState[] = ['accepted', 'in_progress', 'pending', 'testing', 'finished', 'verified', 'cancelled']

/* ----------------------------------------------------------------- filters */

export interface TaskFilterValue {
  state: string
  partnerId: string
  q: string
  mine: boolean
}

export function TaskFilterBar({
  value,
  onChange,
  onClear,
  showMine = false,
  actions,
}: {
  value: TaskFilterValue
  onChange: (patch: Partial<TaskFilterValue>) => void
  onClear: () => void
  showMine?: boolean
  actions?: React.ReactNode
}) {
  const { t } = useTranslation(['tasks', 'common'])
  const partners = usePartnerOptions()
  const active = value.state !== 'all' || value.partnerId !== 'all' || value.q !== '' || value.mine
  return (
    <FilterBar onClear={active ? onClear : undefined} actions={actions}>
      <Select value={value.state} onValueChange={(state) => onChange({ state })} aria-label={t('filters.state')}>
        <SelectItem value="all">{t('filters.allStates')}</SelectItem>
        <SelectItem value="open">{t('filters.open')}</SelectItem>
        {STATES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`common:taskState.${s}`)}
          </SelectItem>
        ))}
      </Select>
      <Select value={value.partnerId} onValueChange={(partnerId) => onChange({ partnerId })} aria-label={t('filters.partner')}>
        <SelectItem value="all">{t('common:filters.allPartners')}</SelectItem>
        <SelectItem value="internal">{t('common:internal')}</SelectItem>
        {(partners.data ?? []).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </Select>
      <SearchInput value={value.q} onChange={(q) => onChange({ q })} placeholder={t('filters.searchPlaceholder')} />
      {showMine ? <Checkbox label={t('filters.onlyMine')} checked={value.mine} onChange={(e) => onChange({ mine: e.target.checked })} /> : null}
    </FilterBar>
  )
}

/* ------------------------------------------------------------------- table */

function AssigneeStack({ assignees }: { assignees: TaskRow['assignees'] }) {
  const { t } = useTranslation('tasks')
  if (assignees.length === 0) return <span className="text-subtle">{t('table.unassigned')}</span>
  const shown = assignees.slice(0, 3)
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {shown.map((a) => (
          <Tooltip key={a.id} content={localName(a)}>
            <span className="inline-flex rounded border-2 border-panel">
              <Avatar name={localName(a)} size="xs" />
            </span>
          </Tooltip>
        ))}
      </div>
      {assignees.length > 3 ? <span className="num ml-1.5 text-xs text-muted">+{assignees.length - 3}</span> : null}
    </div>
  )
}

export function PointsCell({ task }: { task: Pick<TaskRow, 'points' | 'pricingPending'> }) {
  const { t } = useTranslation('tasks')
  if (task.pricingPending) return <Badge tone="warning">{t('table.pricingPending')}</Badge>
  if (task.points === null) return <span className="text-subtle">—</span>
  return <span className="num">{formatPoints(task.points)}</span>
}

export function DeadlineCell({ task }: { task: Pick<TaskRow, 'deadline' | 'isOverdue'> }) {
  if (!task.deadline) return <span className="text-subtle">—</span>
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', task.isOverdue && 'font-medium text-danger')}>
      <DateText value={task.deadline} />
      {task.isOverdue ? <OverdueChip /> : null}
    </span>
  )
}

export function TasksTable({
  rows,
  error,
  onRetry,
  basePath,
  selectedIds,
  onSelectedChange,
  empty,
}: {
  rows: TaskRow[] | undefined
  error?: unknown
  onRetry?: () => void
  /** `/l1/tasks` or `/technician/tasks`. */
  basePath: string
  selectedIds: string[]
  onSelectedChange: (ids: string[]) => void
  empty?: React.ComponentProps<typeof DataTable<TaskRow>>['empty']
}) {
  const { t } = useTranslation(['tasks', 'common'])
  const columns: Column<TaskRow>[] = [
    {
      key: 'number',
      header: t('table.number'),
      mono: true,
      sortable: true,
      sortValue: (r) => r.number,
      cell: (r) => <Mono chip={false}>{formatTaskNumber(r.number)}</Mono>,
      width: 96,
    },
    {
      key: 'title',
      header: t('table.title'),
      sortable: true,
      sortValue: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-[180px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">{r.title}</span>
            {r.hasNewReplies ? (
              <Badge tone="accent" icon={<MessageSquareDot aria-hidden />}>
                {t('table.newReplies')}
              </Badge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: t('table.partner'),
      sortable: true,
      hideBelow: 'md',
      sortValue: (r) => r.partnerName ?? '',
      cell: (r) => (r.partnerName ? <span>{r.partnerName}</span> : <Badge tone="outline">{t('common:internal')}</Badge>),
    },
    {
      key: 'state',
      header: t('table.state'),
      sortable: true,
      sortValue: (r) => STATES.indexOf(r.state),
      cell: (r) => <TaskStateChip state={r.state} />,
    },
    {
      key: 'points',
      header: t('table.points'),
      sortable: true,
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => (r.pricingPending ? null : r.points),
      cell: (r) => <PointsCell task={r} />,
    },
    {
      key: 'deadline',
      header: t('table.deadline'),
      sortable: true,
      hideBelow: 'sm',
      sortValue: (r) => r.deadline,
      cell: (r) => <DeadlineCell task={r} />,
    },
    {
      key: 'assignees',
      header: t('table.assignees'),
      hideBelow: 'lg',
      cell: (r) => <AssigneeStack assignees={r.assignees} />,
    },
    {
      key: 'mails',
      header: <Paperclip className="ml-auto size-4" aria-label={t('table.mails')} />,
      align: 'right',
      hideBelow: 'lg',
      sortable: true,
      sortValue: (r) => r.mailCount,
      cell: (r) => <span className="num text-muted">{r.mailCount}</span>,
      width: 64,
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.id}
      rowNumbers
      selectable
      selectedIds={selectedIds}
      onSelectedChange={onSelectedChange}
      rowHref={(r) => `${basePath}/${r.id}`}
      error={error}
      onRetry={onRetry}
      empty={empty}
      initialSort={{ key: 'number', dir: 'desc' }}
      caption={t('table.caption')}
    />
  )
}

/* ------------------------------------------------------------------ export */

export function TaskExportButtons({ rows, selected }: { rows: TaskRow[]; selected: TaskRow[] }) {
  const { t } = useTranslation(['tasks', 'common'])
  const run = (list: TaskRow[], suffix: string) => {
    const csv = toCsv(list, [
      { key: 'number', header: t('csv.number'), value: (r) => formatTaskNumber(r.number) },
      { key: 'title', header: t('csv.title') },
      { key: 'partner', header: t('csv.partner'), value: (r) => r.partnerName ?? t('common:internal') },
      { key: 'state', header: t('csv.state'), value: (r) => t(`common:taskState.${r.state}`) },
      { key: 'points', header: t('csv.points'), value: (r) => (r.pricingPending ? t('table.pricingPending') : (r.points ?? '')) },
      { key: 'deadline', header: t('csv.deadline'), value: (r) => (r.deadline ? formatDate(r.deadline) : '') },
      { key: 'overdue', header: t('csv.overdue'), value: (r) => (r.isOverdue ? t('common:yes') : t('common:no')) },
      { key: 'assignees', header: t('csv.assignees'), value: (r) => r.assignees.map((a) => localName(a)).join('; ') },
      { key: 'mails', header: t('csv.mails'), value: (r) => r.mailCount },
      { key: 'created', header: t('csv.created'), value: (r) => formatDate(r.createdAt) },
    ])
    downloadText(`rigi-tasks-${suffix}.csv`, csv)
  }
  return (
    <>
      <Button variant="secondary" icon={<Download />} disabled={rows.length === 0} onClick={() => run(rows, 'filtered')}>
        {t('common:actions.export')}
      </Button>
      <Button variant="secondary" icon={<Download />} disabled={selected.length === 0} onClick={() => run(selected, 'selected')}>
        {t('common:actions.exportSelected')}
        {selected.length > 0 ? <span className="num ml-1 text-muted">({selected.length})</span> : null}
      </Button>
    </>
  )
}
