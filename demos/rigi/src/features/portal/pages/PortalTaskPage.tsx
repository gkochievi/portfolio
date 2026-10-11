/**
 * /partner/tasks/:taskId: header, edit, cancel, approve & verify / send back,
 * linked emails, history and chat. Owner: portal.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, CornerUpLeft, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/api/client'
import { TaskStateChip } from '@/components/status'
import { Button, Card, CardBody, CardHeader, DateText, DescriptionList, EmptyState, Mono, PageHeader, PageSkeleton } from '@/components/ui'
import { TaskChatPanel } from '@/features/tasks/components/TaskChatPanel'
import { formatRelative, formatTaskNumber } from '@/lib/format'

import { usePortalTask } from '../api'
import { PointsText } from '../components/PointsText'
import { CancelTaskDialog, SendBackDialog, VerifyTaskDialog } from '../components/TaskDialogs'
import { LinkedEmails, TaskDetailsCard, TaskHistory } from '../components/TaskSections'

export default function PortalTaskPage() {
  const { t } = useTranslation('portal')
  const { taskId = '' } = useParams()
  const query = usePortalTask(taskId)
  const [dialog, setDialog] = useState<'cancel' | 'verify' | 'sendBack' | null>(null)
  const task = query.data

  if (query.isLoading) return <PageSkeleton />
  if (query.error || !task) {
    const missing = isApiError(query.error, 404)
    return (
      <>
        <PageHeader back={{ to: '/partner', label: t('task.back') }} title={t("task.back")} />
        <EmptyState
          title={missing ? t('task.notFound') : t('task.loadError')}
          action={
            missing ? undefined : (
              <Button variant="outline" onClick={() => void query.refetch()}>
                {t('common:actions.retry')}
              </Button>
            )
          }
        />
      </>
    )
  }

  const open = (name: 'cancel' | 'verify' | 'sendBack') => () => setDialog(name)
  const close = (next: boolean) => {
    if (!next) setDialog(null)
  }

  return (
    <>
      <PageHeader
        back={{ to: '/partner', label: t('task.back') }}
        eyebrow={<Mono>{formatTaskNumber(task.number)}</Mono>}
        title={task.title}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <TaskStateChip state={task.state} realm="partner" />
            <span className="text-muted">{task.templateName ?? t('list.noTemplate')}</span>
            <PointsText points={task.points} pricingPending={task.pricingPending} />
          </div>
        }
        actions={
          task.canCancel ? (
            <Button variant="destructive-ghost" size="sm" icon={<X aria-hidden />} onClick={open('cancel')}>
              {t('task.cancel.button')}
            </Button>
          ) : null
        }
      />

      {task.canVerify ? (
        <Card active className="mb-6">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">{t('list.yourTurn')}</p>
              <p className="mt-1 font-display text-base font-semibold">{t('task.verify.bannerTitle')}</p>
              <p className="mt-1 text-[13px] text-muted">{t('task.verify.bannerBody')}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" icon={<CornerUpLeft aria-hidden />} onClick={open('sendBack')}>
                {t('task.sendBack.button')}
              </Button>
              <Button icon={<Check aria-hidden />} onClick={open('verify')}>
                {t('task.verify.approve')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <TaskDetailsCard key={task.id} task={task} />
          <Card>
            <CardHeader title={t('task.conversation')} />
            <CardBody>
              <TaskChatPanel taskId={task.id} realm="partner" />
            </CardBody>
          </Card>
          <LinkedEmails emails={task.emails} />
        </div>
        <aside className="min-w-0 space-y-6">
          <Card>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: t('task.template'), value: task.templateName ?? t('list.noTemplate') },
                  { label: t('task.points'), value: <PointsText points={task.points} pricingPending={task.pricingPending} /> },
                  { label: t('task.deadline'), value: task.deadline ? <DateText value={task.deadline} /> : t('task.noDeadline') },
                  { label: t('task.created'), value: <DateText value={task.createdAt} /> },
                  { label: t('task.updated'), value: formatRelative(task.updatedAt) },
                  task.project ? { label: t('task.project'), value: task.project.name } : null,
                ]}
              />
              {task.pricingPending ? <p className="mt-3 text-[13px] text-muted">{t('task.pricingPendingHint')}</p> : null}
            </CardBody>
          </Card>
          <TaskHistory history={task.history} />
        </aside>
      </div>

      <CancelTaskDialog task={task} open={dialog === 'cancel'} onOpenChange={close} />
      <VerifyTaskDialog task={task} open={dialog === 'verify'} onOpenChange={close} />
      <SendBackDialog task={task} open={dialog === 'sendBack'} onOpenChange={close} />
    </>
  )
}
