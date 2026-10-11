import { Link2, Mail, MessagesSquare, Trash2, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { MailStatusChip, TaskStateChip } from '@/components/status'
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DateText,
  DescriptionList,
  EmptyState,
  IconButton,
  Input,
  NativeSelect,
  SearchInput,
  Skeleton,
  Spinner,
  toast,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatRelative, localName } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import { isApiError } from '@/lib/api'

import {
  errorMessage,
  fieldErrorsOf,
  type TaskDetail,
  useMailSearch,
  useTaskActions,
  useTechnicians,
  useThreadSearch,
} from '../api'

const isOpenState = (state: string) => ['accepted', 'in_progress', 'pending', 'testing'].includes(state)

/* --------------------------------------------------------------- assignees */

export function AssigneesCard({ task, mode }: { task: TaskDetail; mode: 'l1' | 'technician' }) {
  const { t } = useTranslation(['tasks', 'common'])
  const me = useStaffMe()
  const actions = useTaskActions(task.id)
  const technicians = useTechnicians()
  const [pick, setPick] = useState('')
  const l1 = mode === 'l1'
  const available = (technicians.data ?? []).filter((u) => !task.assignees.some((a) => a.id === u.id))

  const add = () => {
    if (!pick) return
    actions.addAssignee.mutate(pick, {
      onSuccess: () => {
        setPick('')
        toast.success(t('assignees.added'))
      },
      onError: (e) => toast.error(isApiError(e, 409) ? t('assignees.already') : errorMessage(e)),
    })
  }

  return (
    <Card>
      <CardHeader title={t('assignees.title')} description={l1 ? t('assignees.descriptionL1') : t('assignees.descriptionTechnician')} />
      <CardBody className="space-y-3">
        {task.assignees.length === 0 ? (
          <p className="text-sm text-muted">{t('assignees.none')}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {task.assignees.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={localName(a)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {localName(a)}
                    {me?.id === a.id ? <span className="ml-1.5 text-xs font-normal text-muted">{t('assignees.you')}</span> : null}
                  </div>
                  {a.technicianType ? <div className="text-xs text-muted">{t(`common:technicianType.${a.technicianType}`)}</div> : null}
                </div>
                {l1 ? (
                  <IconButton
                    label={t('assignees.remove', { name: localName(a) })}
                    icon={<X />}
                    variant="ghost"
                    loading={actions.removeAssignee.isPending && actions.removeAssignee.variables === a.id}
                    onClick={() =>
                      actions.removeAssignee.mutate(a.id, {
                        onSuccess: () => toast.success(t('assignees.removed')),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {l1 ? (
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label={t('assignees.pick')}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              placeholder={technicians.isPending ? t('common:states.loading') : t('assignees.pick')}
              options={available.map((u) => ({
                value: u.id,
                label: `${localName(u)}${u.technicianType ? ` · ${t(`common:technicianType.${u.technicianType}`)}` : ''}`,
              }))}
            />
            <Button variant="secondary" icon={<UserPlus />} disabled={!pick} loading={actions.addAssignee.isPending} onClick={add}>
              {t('common:actions.add')}
            </Button>
          </div>
        ) : task.assignees.length === 0 && isOpenState(task.state) ? (
          <Button
            icon={<UserPlus />}
            loading={actions.selfAssign.isPending}
            onClick={() =>
              actions.selfAssign.mutate(undefined, {
                onSuccess: () => toast.success(t('assignees.assignedToMe')),
                onError: (e) => toast.error(isApiError(e, 409) ? t('assignees.alreadyTaken') : errorMessage(e)),
              })
            }
          >
            {t('assignees.assignToMe')}
          </Button>
        ) : null}
      </CardBody>
    </Card>
  )
}

/* ---------------------------------------------------------------- threads */

function ThreadPicker({ open, onOpenChange, task }: { open: boolean; onOpenChange: (open: boolean) => void; task: TaskDetail }) {
  const { t } = useTranslation(['tasks', 'common'])
  const actions = useTaskActions(task.id)
  const [q, setQ] = useState('')
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const search = useThreadSearch(q, open)
  const rows = (search.data ?? []).filter((th) => !task.threads.some((l) => l.id === th.id))

  const link = (threadId: string) => {
    setError(null)
    actions.linkThread.mutate(threadId, {
      onSuccess: () => {
        toast.success(t('threads.linked'))
        setPasted('')
        onOpenChange(false)
      },
      onError: (e) => {
        if (isApiError(e, 409)) setError(t('threads.already'))
        else if (isApiError(e, 400) || fieldErrorsOf(e).threadId) setError(t('threads.notFound'))
        else setError(errorMessage(e))
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('threads.pickerTitle')}
      description={t('threads.pickerDescription')}
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('common:actions.close')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Banner tone="info">{t('threads.routeNote')}</Banner>
        <SearchInput value={q} onChange={setQ} placeholder={t('threads.searchPlaceholder')} />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {search.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : search.isError ? (
          <Banner tone="danger">{t('threads.searchFailed')}</Banner>
        ) : rows.length === 0 ? (
          <EmptyState compact title={t('threads.noResults')} />
        ) : (
          <ul className="max-h-64 divide-y divide-hairline overflow-auto rounded-md border border-hairline">
            {rows.map((th) => (
              <li key={th.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{th.subject}</div>
                  <div className="num text-xs text-muted">
                    {t('threads.meta', { count: th.messageCount, when: formatRelative(th.lastMessageAt) })}
                  </div>
                </div>
                <Button size="sm" variant="secondary" loading={actions.linkThread.isPending && actions.linkThread.variables === th.id} onClick={() => link(th.id)}>
                  {t('threads.link')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-hairline pt-4">
          <label htmlFor="paste-thread" className="text-sm font-medium">
            {t('threads.pasteLabel')}
          </label>
          <div className="mt-1.5 flex gap-2">
            <Input id="paste-thread" mono value={pasted} placeholder="thr_…" onChange={(e) => setPasted(e.target.value)} />
            <Button variant="secondary" disabled={!pasted.trim()} loading={actions.linkThread.isPending && actions.linkThread.variables === pasted.trim()} onClick={() => link(pasted.trim())}>
              {t('threads.link')}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export function ThreadsCard({ task, mode }: { task: TaskDetail; mode: 'l1' | 'technician' }) {
  const { t } = useTranslation(['tasks', 'common'])
  const actions = useTaskActions(task.id)
  const [open, setOpen] = useState(false)
  const l1 = mode === 'l1'
  return (
    <Card>
      <CardHeader
        title={t('threads.title')}
        description={t('threads.description')}
        actions={
          l1 ? (
            <Button size="sm" variant="secondary" icon={<Link2 />} onClick={() => setOpen(true)}>
              {t('threads.add')}
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {task.threads.length === 0 ? (
          <p className="text-sm text-muted">{t('threads.none')}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {task.threads.map((th) => (
              <li key={th.id} className="flex items-center gap-3 px-3 py-2.5">
                <MessagesSquare className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  {l1 ? (
                    <Link to={`/l1/threads/${th.id}`} className="link block truncate text-sm font-medium">
                      {th.subject}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium">{th.subject}</span>
                  )}
                  <div className="num text-xs text-muted">{t('threads.meta', { count: th.messageCount, when: formatRelative(th.lastMessageAt) })}</div>
                </div>
                {l1 ? (
                  <IconButton
                    label={t('threads.unlink')}
                    icon={<Trash2 />}
                    variant="ghost"
                    loading={actions.unlinkThread.isPending && actions.unlinkThread.variables === th.id}
                    onClick={() =>
                      actions.unlinkThread.mutate(th.id, {
                        onSuccess: () => toast.success(t('threads.unlinked')),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {l1 ? <ThreadPicker open={open} onOpenChange={setOpen} task={task} /> : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ mails */

export function MailsCard({ task, mode }: { task: TaskDetail; mode: 'l1' | 'technician' }) {
  const { t } = useTranslation(['tasks', 'common'])
  const actions = useTaskActions(task.id)
  const [q, setQ] = useState('')
  const l1 = mode === 'l1'
  const search = useMailSearch(q)
  const searching = q.trim().length >= 2
  const results = (search.data ?? []).filter((m) => !task.mails.some((l) => l.id === m.id))

  return (
    <Card>
      <CardHeader title={t('mails.title')} description={l1 ? t('mails.descriptionL1') : t('mails.descriptionTechnician')} />
      <CardBody className="space-y-3">
        {l1 ? (
          <div className="space-y-2">
            <SearchInput value={q} onChange={setQ} debounce={300} placeholder={t('mails.searchPlaceholder')} />
            {q.trim().length === 1 ? <p className="text-xs text-muted">{t('mails.minChars')}</p> : null}
            {searching ? (
              search.isPending ? (
                <Spinner label={t('common:states.loading')} />
              ) : search.isError ? (
                <Banner tone="danger">{t('mails.searchFailed')}</Banner>
              ) : results.length === 0 ? (
                <p className="text-sm text-muted">{t('mails.noResults')}</p>
              ) : (
                <ul className={cn('max-h-56 divide-y divide-hairline overflow-auto rounded-md border border-hairline', search.isFetching && 'opacity-70')}>
                  {results.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.subject}</div>
                        <div className="truncate text-xs text-muted">
                          {m.fromName || m.fromAddr} · <span className="num">{formatDateTime(m.receivedAt)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={actions.linkMail.isPending && actions.linkMail.variables === m.id}
                        onClick={() =>
                          actions.linkMail.mutate(m.id, {
                            onSuccess: () => toast.success(t('mails.linked')),
                            onError: (e) => toast.error(errorMessage(e)),
                          })
                        }
                      >
                        {t('mails.link')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        {task.mails.length === 0 ? (
          <p className="text-sm text-muted">{t('mails.none')}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {task.mails.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <Mail className="size-4 shrink-0 stroke-[1.75] text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  {l1 ? (
                    <Link to={`/l1/mails/${m.id}`} className="link block truncate text-sm font-medium">
                      {m.subject}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm font-medium">{m.subject}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="truncate">{m.fromName || m.fromAddr}</span>
                    <span className="num">{formatDateTime(m.receivedAt)}</span>
                    {l1 ? <MailStatusChip status={m.status} /> : null}
                  </div>
                </div>
                {l1 ? (
                  <IconButton
                    label={t('mails.unlink')}
                    icon={<Trash2 />}
                    variant="ghost"
                    loading={actions.unlinkMail.isPending && actions.unlinkMail.variables === m.id}
                    onClick={() =>
                      actions.unlinkMail.mutate(m.id, {
                        onSuccess: () => toast.success(t('mails.unlinked')),
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------- meta */

export function MetaCard({ task, mode }: { task: TaskDetail; mode: 'l1' | 'technician' }) {
  const { t } = useTranslation(['tasks', 'common'])
  const creator = task.createdBy
  return (
    <Card>
      <CardHeader title={t('meta.title')} />
      <CardBody>
        <DescriptionList
          columns={1}
          items={[
            {
              label: t('meta.createdBy'),
              value: creator ? (
                <span>
                  {localName({ fullName: creator.name, fullNameKa: creator.nameKa })}
                  {creator.kind === 'partner' ? <span className="ml-1.5 text-muted">{t('meta.byPartner')}</span> : null}
                </span>
              ) : null,
            },
            { label: t('meta.createdAt'), value: <DateText value={task.createdAt} withTime /> },
            { label: t('meta.updatedAt'), value: <DateText value={task.updatedAt} withTime /> },
            { label: t('meta.template'), value: task.template ? task.template.name : t('meta.noTemplate') },
            {
              label: t('meta.project'),
              value: task.project ? (
                mode === 'l1' ? (
                  <Link to={`/l1/projects/${task.project.id}`} className="link">
                    {task.project.number ? `PRJ-${task.project.number} · ` : ''}
                    {task.project.name}
                  </Link>
                ) : (
                  <span>{`PRJ-${task.project.number} · ${task.project.name}`}</span>
                )
              ) : (
                t('meta.noProject')
              ),
            },
            task.finishedAt ? { label: t('meta.finishedAt'), value: <DateText value={task.finishedAt} withTime /> } : null,
            task.verifiedAt ? { label: t('meta.verifiedAt'), value: <DateText value={task.verifiedAt} withTime /> } : null,
          ]}
        />
      </CardBody>
    </Card>
  )
}

/* ---------------------------------------------------------------- history */

export function HistoryCard({ task }: { task: TaskDetail }) {
  const { t } = useTranslation(['tasks', 'common'])
  const steps = [...task.history].reverse()
  return (
    <Card>
      <CardHeader title={t('history.title')} description={t('history.description')} />
      <CardBody>
        {steps.length === 0 ? (
          <p className="text-sm text-muted">{t('history.none')}</p>
        ) : (
          <ol className="space-y-3">
            {steps.map((h, i) => (
              <li key={h.id} className={cn('relative border-l-[3px] py-0.5 pl-3', i === 0 ? 'serving border-signal' : 'border-hairline')}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {h.fromState ? (
                    <>
                      <TaskStateChip state={h.fromState} />
                      <span aria-hidden className="text-subtle">
                        →
                      </span>
                    </>
                  ) : (
                    <Badge tone="outline">{t('history.created')}</Badge>
                  )}
                  <TaskStateChip state={h.toState} />
                </div>
                <div className="mt-1 text-xs text-muted">
                  <span className="font-medium text-ink">
                    {h.changedById ? localName({ fullName: h.changedByName, fullNameKa: h.changedByNameKa }) : t('history.partner')}
                  </span>
                  {' · '}
                  <span className="num">{formatDateTime(h.changedAt)}</span>
                </div>
                {h.note ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{h.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
