/** Details/edit form, linked emails and history for the partner task page. Owner: portal. */
import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronDown, Pencil } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage, fieldErrorsOf } from '@/api/client'
import { Button, Card, CardBody, CardHeader, DateText, Field, Input, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

import { useUpdatePortalTask, type PortalHistoryRow, type PortalLinkedEmail, type PortalTaskDetail, type TaskPatchInput } from '../api'
import { localDay, todayDay } from './PointsText'
import { OverdueChip } from '@/components/status'

interface FormValues {
  title: string
  description: string
  deadline: string
}

/** Title, description and deadline; editable while the task is open (dirty-only PATCH). */
export function TaskDetailsCard({ task }: { task: PortalTaskDetail }) {
  const { t } = useTranslation('portal')
  const [editing, setEditing] = useState(false)
  const update = useUpdatePortalTask(task.id)

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t('newTask.errors.titleRequired')).max(500, t('newTask.errors.titleMax')),
        description: z.string().max(20000, t('newTask.errors.descriptionMax')),
        deadline: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), t('newTask.errors.deadlineInvalid')),
      }),
    [t],
  )
  const defaults: FormValues = { title: task.title, description: task.description, deadline: localDay(task.deadline) }
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  const startEdit = () => {
    reset(defaults)
    setEditing(true)
  }

  const onSubmit = handleSubmit((values) => {
    const patch: TaskPatchInput = {}
    if (dirtyFields.title) patch.title = values.title.trim()
    if (dirtyFields.description) patch.description = values.description
    if (dirtyFields.deadline) patch.deadline = values.deadline || null
    if (Object.keys(patch).length === 0) {
      toast(t('task.noChanges'))
      setEditing(false)
      return
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.success(t('task.updatedToast'))
        setEditing(false)
      },
      onError: (error) => {
        const fields = fieldErrorsOf(error)
        for (const key of ['title', 'description', 'deadline'] as const) if (fields[key]) setError(key, { message: fields[key] })
        if (Object.keys(fields).length === 0) toast.error(errorMessage(error))
      },
    })
  })

  return (
    <Card>
      <CardHeader
        title={t('task.details')}
        actions={
          task.canEdit && !editing ? (
            <Button size="sm" variant="outline" icon={<Pencil aria-hidden />} onClick={startEdit}>
              {t('task.edit')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {editing ? (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field label={t('newTask.fields.title')} htmlFor="te-title" required error={errors.title?.message}>
              <Input id="te-title" maxLength={600} invalid={Boolean(errors.title)} {...register('title')} />
            </Field>
            <Field label={t('newTask.fields.description')} htmlFor="te-desc" error={errors.description?.message}>
              <Textarea id="te-desc" rows={6} invalid={Boolean(errors.description)} {...register('description')} />
            </Field>
            <Field label={t('newTask.fields.deadline')} htmlFor="te-deadline" error={errors.deadline?.message}>
              <Input id="te-deadline" type="date" min={todayDay()} className="sm:max-w-[220px]" invalid={Boolean(errors.deadline)} {...register('deadline')} />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={update.isPending}>
                {t('task.discard')}
              </Button>
              <Button type="submit" loading={update.isPending}>
                {t('task.save')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{task.description || <span className="text-muted">{t('task.noDescription')}</span>}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
              <span>
                {t('task.deadline')}: {task.deadline ? <DateText value={task.deadline} /> : t('task.noDeadline')}
              </span>
              {task.isOverdue ? <OverdueChip /> : null}
            </div>
            {!task.canEdit ? <p className="text-[13px] text-muted">{t('task.locked', { state: t(`common:taskStatePartner.${task.state}`) })}</p> : null}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/** Mails linked to the task, each collapsed until opened. */
export function LinkedEmails({ emails }: { emails: PortalLinkedEmail[] }) {
  const { t } = useTranslation('portal')
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader title={t('task.emails.title')} description={emails.length > 0 ? String(emails.length) : undefined} />
      {emails.length === 0 ? (
        <CardBody>
          <p className="text-[13px] text-muted">{t('task.emails.empty')}</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-hairline">
          {emails.map((m) => {
            const isOpen = open === m.id
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t('task.emails.hide') : t('task.emails.show')}
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-row-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.subject}</p>
                    <p className="truncate text-[13px] text-muted">
                      {m.fromName || m.fromAddr} · {formatDateTime(m.receivedAt)}
                    </p>
                  </div>
                  <ChevronDown className={cn('mt-1 size-4 shrink-0 stroke-[1.75] text-subtle transition-transform duration-150', isOpen && 'rotate-180')} aria-hidden />
                </button>
                {isOpen ? (
                  <div className="space-y-2 border-t border-hairline bg-sunken px-4 py-3 text-[13px]">
                    <p className="break-words text-muted">
                      <span className="font-medium text-ink">{t('task.emails.from')}:</span> {m.fromName ? `${m.fromName} <${m.fromAddr}>` : m.fromAddr}
                    </p>
                    <p className="break-words text-muted">
                      <span className="font-medium text-ink">{t('task.emails.to')}:</span> {m.toAddrs.join(', ')}
                    </p>
                    <p className="whitespace-pre-wrap break-words pt-1 leading-relaxed">{m.bodyText}</p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Timeline of state changes; the partner's own moves read "You". */
export function TaskHistory({ history }: { history: PortalHistoryRow[] }) {
  const { t } = useTranslation('portal')
  return (
    <Card>
      <CardHeader title={t('task.history.title')} />
      <CardBody>
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">{t('task.history.empty')}</p>
        ) : (
          <ol className="relative space-y-4 border-l border-hairline pl-4">
            {[...history].reverse().map((h) => {
              const state = t(`common:taskStatePartner.${h.toState}`)
              const text =
                h.fromState === null
                  ? h.byYou
                    ? t('task.history.createdYou')
                    : t('task.history.createdBy', { who: h.changedByName })
                  : h.byYou
                    ? t('task.history.movedYou', { state })
                    : t('task.history.movedBy', { who: h.changedByName, state })
              return (
                <li key={h.id} className="relative">
                  <span className={cn('absolute -left-[21px] top-1.5 size-2 rounded-[1px]', h.byYou ? 'bg-accent' : 'bg-subtle')} aria-hidden />
                  <p className="text-[13px] font-medium">{text}</p>
                  <p className="text-xs text-muted">
                    <DateText value={h.changedAt} withTime />
                  </p>
                  {h.note ? <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-sunken px-2.5 py-1.5 text-[13px]">{h.note}</p> : null}
                </li>
              )
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  )
}
