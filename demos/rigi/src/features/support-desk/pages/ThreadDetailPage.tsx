import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Link2, ListPlus, Unlink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MailStatusChip } from '@/components/status'
import {
  Avatar,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DateText,
  DescriptionList,
  EmptyState,
  IconButton,
  PageHeader,
  PageSkeleton,
  toast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

import { errorMessage, type TaskLite, type ThreadMailDto, useLinkThreadTask, useThread, useUnlinkThreadTask } from '../api'
import { AttachmentList, PaperclipMark } from '../components/AttachmentList'
import { TaskLinkList } from '../components/TaskLinkList'
import { TaskPickerDialog } from '../components/TaskPicker'

function oneLine(text: string, max = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function Message({ mail, open, onToggle }: { mail: ThreadMailDto; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation(['support-desk', 'common'])
  const sender = mail.fromName || mail.fromAddr
  return (
    <li className={cn('rounded-lg border bg-panel', open ? 'border-hairline-strong' : 'border-hairline', mail.status === 'new' && 'serving')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-150 ease-rigi hover:bg-row-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
      >
        <Avatar name={sender} size="md" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn('truncate text-sm text-ink', mail.status === 'new' ? 'font-semibold' : 'font-medium')}>{sender}</span>
            <span className="truncate font-mono text-xs text-muted">{mail.fromAddr}</span>
          </span>
          {open ? (
            <span className="mt-0.5 block truncate text-xs text-muted">
              {t('mail.to')}: {mail.toAddrs.join(', ')}
              {mail.ccAddrs.length ? ` · ${t('mail.cc')}: ${mail.ccAddrs.join(', ')}` : ''}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-[13px] text-muted">{oneLine(mail.bodyText)}</span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="flex items-center gap-2">
            {mail.attachments.length ? <PaperclipMark label={t('inbox.hasAttachments')} /> : null}
            <DateText value={mail.receivedAt} withTime />
          </span>
          <span className="flex items-center gap-1.5">
            <MailStatusChip status={mail.status} />
            {open ? <ChevronDown className="size-4 stroke-[1.75] text-muted" aria-hidden /> : <ChevronRight className="size-4 stroke-[1.75] text-muted" aria-hidden />}
          </span>
        </span>
      </button>
      {open ? (
        <div className="border-t border-hairline px-4 py-4 sm:pl-[68px]">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">{mail.bodyText}</pre>
          {mail.attachments.length ? <AttachmentList attachments={mail.attachments} className="mt-4" /> : null}
          <div className="mt-4 flex justify-end">
            <Button asChild size="sm" variant="ghost">
              <Link to={`/l1/mails/${mail.id}`}>{t('thread.openMail')}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export default function ThreadDetailPage() {
  const { t } = useTranslation(['support-desk', 'common'])
  const { threadId = '' } = useParams()
  const query = useThread(threadId)
  const link = useLinkThreadTask(threadId)
  const unlink = useUnlinkThreadTask(threadId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [toUnlink, setToUnlink] = useState<TaskLite | null>(null)
  // `null` = default (only the latest message open); otherwise the user's own selection.
  const [openIds, setOpenIds] = useState<Set<string> | null>(null)

  const mails = query.data?.mails
  const latestId = mails && mails.length ? mails[mails.length - 1]?.id : undefined
  const expanded = useMemo(() => openIds ?? new Set(latestId ? [latestId] : []), [openIds, latestId])

  if (query.isPending) return <PageSkeleton />
  if (query.isError || !query.data || !mails) {
    return (
      <>
        <PageHeader title={t('thread.notFoundTitle')} back={{ to: '/l1/mails', label: t('thread.back') }} />
        <EmptyState title={t('thread.notFound')} action={<Button variant="secondary" onClick={() => void query.refetch()}>{t('common:actions.retry')}</Button>} />
      </>
    )
  }

  const { thread, participants, linkedTasks, partner } = query.data
  const allOpen = mails.every((m) => expanded.has(m.id))
  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenIds(next)
  }

  const onPick = (task: TaskLite) => {
    setPickerError(null)
    link.mutate(task.id, {
      onSuccess: () => {
        setPickerOpen(false)
        toast.success(t('thread.linked', { number: task.number }))
      },
      onError: (e) => setPickerError(errorMessage(e)),
    })
  }
  const onUnlink = () => {
    if (!toUnlink) return
    unlink.mutate(toUnlink.id, {
      onSuccess: () => {
        setToUnlink(null)
        toast.success(t('thread.unlinked'))
      },
      onError: (e) => {
        setToUnlink(null)
        toast.error(errorMessage(e))
      },
    })
  }

  return (
    <>
      <PageHeader
        eyebrow={t('thread.eyebrow')}
        title={thread.subject}
        back={{ to: '/l1/mails', label: t('thread.back') }}
        meta={<MailStatusChip status={thread.status} />}
        actions={
          <Button asChild icon={<ListPlus />}>
            <Link to={`/l1/tasks/new?threadId=${thread.id}`}>{t('thread.createTask')}</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0" aria-label={t('thread.messages')}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-ink">{t('thread.messagesCount', { count: mails.length })}</h2>
            {mails.length > 1 ? (
              <Button
                size="sm"
                variant="ghost"
                icon={allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
                onClick={() => setOpenIds(allOpen ? new Set() : new Set(mails.map((m) => m.id)))}
              >
                {allOpen ? t('thread.collapseAll') : t('thread.expandAll')}
              </Button>
            ) : null}
          </div>
          <ol className="space-y-2">
            {mails.map((m) => (
              <Message key={m.id} mail={m} open={expanded.has(m.id)} onToggle={() => toggle(m.id)} />
            ))}
          </ol>
        </section>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t('thread.details')} />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: t('thread.count'), value: mails.length },
                  partner ? { label: t('mail.partner'), value: partner.name } : null,
                  { label: t('thread.firstMessage'), value: formatDateTime(thread.firstMessageAt) },
                  { label: t('thread.lastMessage'), value: formatDateTime(thread.lastMessageAt) },
                  {
                    label: t('thread.participants', { count: participants.length }),
                    value: (
                      <ul className="space-y-0.5">
                        {participants.map((p) => (
                          <li key={p} className="break-all font-mono text-xs">
                            {p}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('thread.linkedTasks')}
              description={t('thread.linkedHint')}
              actions={
                <Button size="sm" variant="secondary" icon={<Link2 />} onClick={() => { setPickerError(null); setPickerOpen(true) }}>
                  {t('thread.linkTask')}
                </Button>
              }
            />
            <CardBody>
              {linkedTasks.length === 0 ? (
                <p className="text-sm text-muted">{t('thread.noLinkedTasks')}</p>
              ) : (
                <>
                  {linkedTasks.some((x) => x.hasNewReplies) ? (
                    <Banner tone="info">{t('thread.newRepliesBanner')}</Banner>
                  ) : null}
                  <div className={linkedTasks.some((x) => x.hasNewReplies) ? 'mt-3' : undefined}>
                    <TaskLinkList
                      tasks={linkedTasks}
                      action={(task) => (
                        <IconButton label={t('thread.unlink')} icon={<Unlink />} variant="destructive-ghost" size="sm" onClick={() => setToUnlink(task)} />
                      )}
                    />
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <TaskPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={linkedTasks.map((x) => x.id)}
        pending={link.isPending}
        error={pickerError}
        onPick={onPick}
      />
      <ConfirmDialog
        open={toUnlink !== null}
        onOpenChange={(o) => !o && setToUnlink(null)}
        title={t('thread.unlinkTitle')}
        description={t('thread.unlinkDescription')}
        confirmLabel={t('thread.unlink')}
        tone="danger"
        pending={unlink.isPending}
        onConfirm={onUnlink}
      />
    </>
  )
}
