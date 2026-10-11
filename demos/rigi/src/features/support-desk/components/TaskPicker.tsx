import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TaskStateChip } from '@/components/status'
import { Banner, Button, Dialog, EmptyState, Mono, SearchInput, Skeleton } from '@/components/ui'
import { formatTaskNumber } from '@/lib/format'

import { useTaskSearch, type TaskLite } from '../api'

/** Search tasks (GET /api/tasks?q=) and pick one to link. */
export function TaskPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  pending,
  error,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  excludeIds: string[]
  pending?: boolean
  error?: string | null
  onPick: (task: TaskLite) => void
}) {
  const { t } = useTranslation(['support-desk', 'common'])
  const [q, setQ] = useState('')
  const query = useTaskSearch(q, open)
  const rows = (query.data ?? []).filter((task) => !excludeIds.includes(task.id)).slice(0, 25)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('picker.title')}
      description={t('picker.description')}
      footer={<Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.close')}</Button>}
    >
      <div className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder={t('picker.placeholder')} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {query.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : query.isError ? (
          <Banner tone="danger" action={<Button size="sm" variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>}>
            {t('picker.failed')}
          </Banner>
        ) : rows.length === 0 ? (
          <EmptyState compact title={t('picker.empty')} />
        ) : (
          <ul className="max-h-[50vh] divide-y divide-hairline overflow-auto rounded-md border border-hairline">
            {rows.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Mono>{formatTaskNumber(task.number)}</Mono>
                    <TaskStateChip state={task.state} />
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-ink">{task.title}</div>
                  <div className="truncate text-xs text-muted">{task.partnerName ?? t('common:internal')}</div>
                </div>
                <Button size="sm" variant="secondary" loading={pending} onClick={() => onPick(task)}>
                  {t('picker.link')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
