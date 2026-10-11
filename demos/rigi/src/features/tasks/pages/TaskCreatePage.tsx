import { Link2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { MailStatusChip } from '@/components/status'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Field,
  Input,
  NativeSelect,
  PageHeader,
  Skeleton,
  Textarea,
  toast,
} from '@/components/ui'
import { usePartnerOptions } from '@/features/partners/api'
import { formatDateTime, localName } from '@/lib/format'

import {
  errorMessage,
  fieldErrorsOf,
  type MailLite,
  useCreateTask,
  useMailLite,
  useRecentMails,
  useTaskTemplates,
  useTechnicians,
  useThreadLite,
} from '../api'
import { deadlineFromDay } from '../lib/dates'

type FieldName = 'title' | 'description' | 'points' | 'deadline' | 'partnerId' | 'assigneeIds' | 'mailIds' | 'threadId'

const schema = z.object({
  title: z.string().trim().min(1, 'required').max(500, 'titleTooLong'),
  description: z.string().max(20000, 'descriptionTooLong'),
  points: z.string().refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'points'),
})

/** /l1/tasks/new (?mailId=… / ?threadId=…): create a task by hand or from mail. */
export default function TaskCreatePage() {
  const { t } = useTranslation(['tasks', 'common'])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mailId = params.get('mailId')
  const threadId = params.get('threadId')

  const templates = useTaskTemplates()
  const partners = usePartnerOptions()
  const technicians = useTechnicians()
  const recent = useRecentMails()
  const fromMail = useMailLite(mailId)
  const thread = useThreadLite(threadId)
  const create = useCreateTask()

  const [form, setForm] = useState({ templateId: '', title: '', partnerId: 'internal', points: '', description: '', deadline: '' })
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [mailIds, setMailIds] = useState<string[]>(mailId ? [mailId] : [])
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Pick a template: fill only the fields that are still empty.
  const pickTemplate = (id: string) => {
    const tpl = (templates.data ?? []).find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      templateId: id,
      title: f.title.trim() === '' && tpl ? tpl.name : f.title,
      points: f.points.trim() === '' && tpl && tpl.defaultPoints !== null ? String(tpl.defaultPoints) : f.points,
      description: f.description.trim() === '' && tpl ? tpl.description : f.description,
    }))
  }

  const mails: MailLite[] = useMemo(() => {
    const list = recent.data ?? []
    return fromMail.data && !list.some((m) => m.id === fromMail.data.id) ? [fromMail.data, ...list] : list
  }, [recent.data, fromMail.data])

  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName
        if (!next[key]) next[key] = t(`create.errors.${issue.message}`, { max: key === 'title' ? 500 : 20000 })
      }
      setErrors(next)
      return
    }
    create.mutate(
      {
        templateId: form.templateId || null,
        title: form.title.trim(),
        partnerId: form.partnerId === 'internal' ? null : form.partnerId,
        points: form.points.trim() === '' ? undefined : Number(form.points),
        description: form.description,
        deadline: form.deadline ? deadlineFromDay(form.deadline) : null,
        assigneeIds,
        mailIds,
        threadId,
      },
      {
        onSuccess: (task) => {
          toast.success(t('create.created', { number: task.number }))
          navigate(`/l1/tasks/${task.id}`)
        },
        onError: (err) => {
          const fields = fieldErrorsOf(err)
          if (Object.keys(fields).length > 0) setErrors(fields as Partial<Record<FieldName, string>>)
          toast.error(errorMessage(err, t('create.failed')))
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        eyebrow={t('create.eyebrow')}
        title={t('create.title')}
        description={t('create.description')}
        back={{ to: '/l1/tasks', label: t('workspace.back') }}
      />

      {threadId ? (
        <div className="mb-4">
          <Banner tone="info" title={t('create.threadBannerTitle')}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <Link2 className="size-4 stroke-[1.75]" aria-hidden />
              {thread.data ? <strong className="font-medium">{thread.data.subject}</strong> : thread.isError ? <span>{threadId}</span> : <Skeleton className="h-4 w-48" />}
            </span>
            <span className="mt-1 block">{t('create.threadBannerBody')}</span>
          </Banner>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={t('create.details')} />
          <CardBody className="space-y-4">
            <Field label={t('create.template')} htmlFor="new-template" hint={t('create.templateHint')}>
              <NativeSelect
                id="new-template"
                value={form.templateId}
                onChange={(e) => pickTemplate(e.target.value)}
                placeholder={templates.isPending ? t('common:states.loading') : t('create.noTemplate')}
                options={(templates.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
              />
            </Field>
            <Field label={t('edit.fields.title')} htmlFor="new-title" required error={errors.title}>
              <Input id="new-title" value={form.title} maxLength={600} invalid={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} autoFocus />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('edit.fields.partner')} htmlFor="new-partner" error={errors.partnerId}>
                <NativeSelect
                  id="new-partner"
                  value={form.partnerId}
                  onChange={(e) => set('partnerId', e.target.value)}
                  options={[{ value: 'internal', label: t('common:internal') }, ...(partners.data ?? []).filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name }))]}
                />
              </Field>
              <Field label={t('edit.fields.deadline')} htmlFor="new-deadline" error={errors.deadline}>
                <Input id="new-deadline" type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
              </Field>
              <Field
                label={t('edit.fields.points')}
                htmlFor="new-points"
                error={errors.points}
                hint={form.partnerId !== 'internal' && form.points.trim() === '' ? t('create.pointsHint') : undefined}
              >
                <Input
                  id="new-points"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={form.points}
                  invalid={Boolean(errors.points)}
                  suffix={t('common:units.points')}
                  onChange={(e) => set('points', e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('edit.fields.description')} htmlFor="new-description" error={errors.description} hint={`${form.description.length}/20000`}>
              <Textarea id="new-description" rows={8} value={form.description} invalid={Boolean(errors.description)} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </CardBody>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link to="/l1/tasks">{t('common:actions.cancel')}</Link>
            </Button>
            <Button type="submit" loading={create.isPending}>
              {t('create.submit')}
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t('assignees.title')} description={t('create.assigneesHint')} />
            <CardBody>
              {technicians.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : technicians.isError ? (
                <Banner tone="danger">{t('create.loadFailed')}</Banner>
              ) : (
                <ul className="space-y-2.5">
                  {(technicians.data ?? []).map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3">
                      <Checkbox
                        label={localName(u)}
                        checked={assigneeIds.includes(u.id)}
                        onChange={(e) => setAssigneeIds((list) => toggle(list, u.id, e.target.checked))}
                      />
                      {u.technicianType ? <Badge tone="outline">{t(`common:technicianType.${u.technicianType}`)}</Badge> : null}
                    </li>
                  ))}
                </ul>
              )}
              {errors.assigneeIds ? <p className="mt-2 text-xs text-danger">{errors.assigneeIds}</p> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('create.mailsTitle')} description={t('create.mailsHint')} />
            <CardBody>
              {recent.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : recent.isError ? (
                <Banner tone="danger">{t('create.loadFailed')}</Banner>
              ) : mails.length === 0 ? (
                <p className="text-sm text-muted">{t('create.noMails')}</p>
              ) : (
                <ul className="max-h-80 space-y-2.5 overflow-auto pr-1">
                  {mails.map((m) => (
                    <li key={m.id}>
                      <Checkbox
                        label={m.subject}
                        description={`${m.fromName || m.fromAddr} · ${formatDateTime(m.receivedAt)}`}
                        checked={mailIds.includes(m.id)}
                        onChange={(e) => setMailIds((list) => toggle(list, m.id, e.target.checked))}
                      />
                      {m.id === mailId ? (
                        <span className="ml-6 mt-1 inline-flex">
                          <MailStatusChip status={m.status} />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {errors.mailIds ? <p className="mt-2 text-xs text-danger">{errors.mailIds}</p> : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  )
}
