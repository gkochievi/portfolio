import { Ban, CheckCheck, FlaskConical, Hourglass, Play, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OverdueChip, TaskStateChip } from '@/components/status'
import { Badge, Banner, Button, Card, CardBody, DateText, Dialog, EmptyState, Field, Mono, PageHeader, Skeleton, Textarea, Tooltip, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatPoints, formatTaskNumber } from '@/lib/format'
import { isApiError } from '@/lib/api'
import type { TaskState } from '@/types'

import { errorMessage, type TaskDetail, useTask, useTaskActions } from '../api'
import { TaskChatPanel } from './TaskChatPanel'
import { TaskEditCard } from './TaskEditCard'
import { AssigneesCard, HistoryCard, MailsCard, MetaCard, ThreadsCard } from './TaskSidePanels'

type Mode = 'l1' | 'technician'

const TRANSITION_ICON: Record<TaskState, React.ReactNode> = {
  accepted: null,
  in_progress: <Play />,
  pending: <Hourglass />,
  testing: <FlaskConical />,
  finished: <CheckCheck />,
  verified: <CheckCheck />,
  cancelled: <Ban />,
}

function TransitionBar({ task, mode }: { task: TaskDetail; mode: Mode }) {
  const { t } = useTranslation(['tasks', 'common'])
  const actions = useTaskActions(task.id)
  const [target, setTarget] = useState<TaskState | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  // Technicians never reopen a finished task.
  const allowed = task.allowedTransitions.filter((to) => !(mode === 'technician' && task.state === 'finished' && to === 'in_progress'))
  const stateLabel = (s: TaskState) => t(`common:taskState.${s}`)

  const close = () => {
    setTarget(null)
    setNote('')
    setNoteError(null)
  }

  const confirm = () => {
    if (!target) return
    if (note.length > 2000) {
      setNoteError(t('transition.noteTooLong', { max: 2000 }))
      return
    }
    const from = task.state
    actions.transition.mutate(
      { to: target, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('transition.done', { state: stateLabel(target) }))
          close()
        },
        onError: (e) => {
          if (isApiError(e, 409)) {
            toast.error(t('transition.conflict', { from: stateLabel(from), to: stateLabel(target) }))
            close()
          } else {
            toast.error(errorMessage(e))
          }
        },
      },
    )
  }

  const reopen = (to: TaskState) => task.state === 'finished' && to === 'in_progress'
  const hint = allowed.length === 0 && !task.finishBlocked ? t(task.state === 'finished' ? 'transition.waitingVerify' : 'transition.terminal') : null

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-2">{t('transition.label')}</span>
        {allowed.map((to) => (
          <Button
            key={to}
            variant={to === 'finished' ? 'primary' : to === 'cancelled' ? 'outline' : 'secondary'}
            icon={reopen(to) ? <RotateCcw /> : TRANSITION_ICON[to]}
            className={cn(to === 'cancelled' && 'text-danger')}
            onClick={() => setTarget(to)}
          >
            {reopen(to) ? t('transition.reopen') : stateLabel(to)}
          </Button>
        ))}
        {task.finishBlocked ? (
          <Tooltip content={t('transition.finishBlocked')}>
            <span>
              <Button variant="primary" icon={<CheckCheck />} disabled>
                {stateLabel('finished')}
              </Button>
            </span>
          </Tooltip>
        ) : null}
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </CardBody>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => !open && close()}
        size="md"
        title={target ? t('transition.dialogTitle', { from: stateLabel(task.state), to: stateLabel(target) }) : ''}
        description={t('transition.dialogDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={actions.transition.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button loading={actions.transition.isPending} onClick={confirm}>
              {t('transition.confirm')}
            </Button>
          </>
        }
      >
        <Field label={t('transition.note')} htmlFor="transition-note" error={noteError ?? undefined} hint={t('transition.noteHint')}>
          <Textarea id="transition-note" rows={4} value={note} invalid={Boolean(noteError)} onChange={(e) => { setNote(e.target.value); setNoteError(null) }} />
        </Field>
      </Dialog>
    </Card>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}

/**
 * The task workspace: header, transitions, edit card, people, linked mail and
 * conversations, history and chat. One component, two modes:
 * - 'l1' (desk): assignees, links and partner are editable, reopen allowed for superadmin.
 * - 'technician': inline edit (no partner), "Assign to me" when unassigned,
 *   no reopen, linked items are read-only.
 */
export function TaskWorkspace({ taskId, mode }: { taskId: string; mode: Mode }) {
  const { t } = useTranslation(['tasks', 'common'])
  const query = useTask(taskId)
  const backTo = mode === 'l1' ? '/l1/tasks' : '/technician/tasks'

  if (query.isPending) return <WorkspaceSkeleton />
  if (query.isError || !query.data) {
    const notFound = isApiError(query.error, 404)
    return (
      <>
        <PageHeader title={t('workspace.errorTitle')} back={{ to: backTo, label: t('workspace.back') }} />
        <EmptyState
          title={notFound ? t('workspace.notFound') : t('workspace.loadFailed')}
          description={notFound ? t('workspace.notFoundHint') : undefined}
          action={
            notFound ? undefined : (
              <Button variant="secondary" onClick={() => void query.refetch()}>
                {t('common:actions.retry')}
              </Button>
            )
          }
        />
      </>
    )
  }

  const task = query.data
  return (
    <>
      <PageHeader
        eyebrow={<Mono chip={false}>{formatTaskNumber(task.number)}</Mono>}
        title={task.title}
        back={{ to: backTo, label: t('workspace.back') }}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <TaskStateChip state={task.state} />
            {task.partnerName ? <span className="text-sm">{task.partnerName}</span> : <Badge tone="outline">{t('common:internal')}</Badge>}
            {task.deadline ? (
              <span className={cn('inline-flex items-center gap-1.5 text-sm', task.isOverdue ? 'font-medium text-danger' : 'text-muted')}>
                {t('workspace.due')} <DateText value={task.deadline} />
                {task.isOverdue ? <OverdueChip /> : null}
              </span>
            ) : (
              <span className="text-sm text-subtle">{t('workspace.noDeadline')}</span>
            )}
            {task.points !== null && !task.pricingPending ? <span className="num text-sm text-muted">{formatPoints(task.points)}</span> : null}
          </div>
        }
      />

      {task.pricingPending ? (
        <div className="mb-4">
          <Banner tone="warning" title={t('workspace.pricingPendingTitle')}>
            {t('workspace.pricingPendingBody')}
          </Banner>
        </div>
      ) : null}

      <div className="mb-6">
        <TransitionBar task={task} mode={mode} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <TaskEditCard key={`${task.id}:${task.updatedAt}`} task={task} canEditPartner={mode === 'l1'} />
          <TaskChatPanel taskId={task.id} realm="staff" />
        </div>
        <div className="min-w-0 space-y-6">
          <AssigneesCard task={task} mode={mode} />
          <ThreadsCard task={task} mode={mode} />
          <MailsCard task={task} mode={mode} />
          <MetaCard task={task} mode={mode} />
          <HistoryCard task={task} />
        </div>
      </div>
    </>
  )
}
