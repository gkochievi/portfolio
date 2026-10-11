import { Link } from 'react-router-dom'
import { MessageSquareDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TaskStateChip } from '@/components/status'
import { Badge, Mono } from '@/components/ui'
import { formatTaskNumber } from '@/lib/format'

import type { TaskLite } from '../api'

/** Linked-task rows (mail detail, thread panel). `action` renders at the row end. */
export function TaskLinkList({ tasks, action }: { tasks: TaskLite[]; action?: (task: TaskLite) => React.ReactNode }) {
  const { t } = useTranslation(['support-desk', 'common'])
  return (
    <ul className="divide-y divide-hairline">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/l1/tasks/${task.id}`} className="link">
                <Mono chip={false}>{formatTaskNumber(task.number)}</Mono>
              </Link>
              <TaskStateChip state={task.state} />
              {task.hasNewReplies ? (
                <Badge tone="accent" icon={<MessageSquareDot />}>
                  {t('linkedTasks.newReplies')}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 truncate text-sm text-ink">{task.title}</div>
            <div className="truncate text-xs text-muted">{task.partnerName ?? t('common:internal')}</div>
          </div>
          {action ? <div className="shrink-0">{action(task)}</div> : null}
        </li>
      ))}
    </ul>
  )
}
