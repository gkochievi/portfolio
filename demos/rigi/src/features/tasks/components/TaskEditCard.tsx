import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, NativeSelect, Textarea, toast } from '@/components/ui'
import { usePartnerOptions } from '@/features/partners/api'

import { errorMessage, fieldErrorsOf, type TaskDetail, type UpdateTaskInput, useTaskActions } from '../api'
import { dayInputOf, deadlineFromDay } from '../lib/dates'

type FieldName = 'title' | 'partnerId' | 'description' | 'deadline' | 'points'

const schema = z.object({
  title: z.string().trim().min(1, 'required').max(500, 'tooLong'),
  description: z.string().max(20000, 'tooLong'),
  points: z.string().refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'points'),
})

/**
 * Edit card: title, partner, description, deadline, points. Sends only the
 * fields that changed. Pricing a freeform task (setting points) clears its
 * "pricing pending" flag server-side. Technicians cannot change the partner.
 */
export function TaskEditCard({ task, canEditPartner }: { task: TaskDetail; canEditPartner: boolean }) {
  const { t } = useTranslation(['tasks', 'common'])
  const actions = useTaskActions(task.id)
  const partners = usePartnerOptions()
  const readOnly = task.state === 'verified' || task.state === 'cancelled'

  const initial = {
    title: task.title,
    partnerId: task.partnerId ?? 'internal',
    description: task.description,
    deadline: dayInputOf(task.deadline),
    points: task.points === null ? '' : String(task.points),
  }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const set = <K extends FieldName>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const dirty = (Object.keys(initial) as FieldName[]).filter((k) => form[k] !== initial[k])

  const save = () => {
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as FieldName
        if (!next[key]) next[key] = t(`edit.errors.${issue.message}`, { max: key === 'title' ? 500 : 20000 })
      }
      setErrors(next)
      return
    }
    const input: UpdateTaskInput = {}
    if (dirty.includes('title')) input.title = form.title.trim()
    if (dirty.includes('description')) input.description = form.description
    if (dirty.includes('partnerId')) input.partnerId = form.partnerId === 'internal' ? null : form.partnerId
    if (dirty.includes('deadline')) input.deadline = form.deadline ? deadlineFromDay(form.deadline) : null
    if (dirty.includes('points')) input.points = form.points.trim() === '' ? null : Number(form.points)
    actions.update.mutate(input, {
      onSuccess: () => toast.success(t('edit.saved')),
      onError: (e) => {
        const fields = fieldErrorsOf(e)
        if (Object.keys(fields).length > 0) setErrors(fields as Partial<Record<FieldName, string>>)
        toast.error(errorMessage(e, t('edit.failed')))
      },
    })
  }

  return (
    <Card>
      <CardHeader title={t('edit.title')} description={t(canEditPartner ? 'edit.descriptionL1' : 'edit.descriptionTechnician')} />
      <CardBody className="space-y-4">
        {readOnly ? <Banner tone="neutral">{t('edit.closed')}</Banner> : null}
        <Field label={t('edit.fields.title')} htmlFor="task-title" required error={errors.title}>
          <Input id="task-title" value={form.title} maxLength={600} disabled={readOnly} invalid={Boolean(errors.title)} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {canEditPartner ? (
            <Field label={t('edit.fields.partner')} htmlFor="task-partner" error={errors.partnerId}>
              <NativeSelect
                id="task-partner"
                value={form.partnerId}
                disabled={readOnly}
                onChange={(e) => set('partnerId', e.target.value)}
                options={[{ value: 'internal', label: t('common:internal') }, ...(partners.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
              />
            </Field>
          ) : null}
          <Field label={t('edit.fields.deadline')} htmlFor="task-deadline" error={errors.deadline}>
            <Input id="task-deadline" type="date" value={form.deadline} disabled={readOnly} onChange={(e) => set('deadline', e.target.value)} />
          </Field>
          <Field
            label={t('edit.fields.points')}
            htmlFor="task-points"
            error={errors.points}
            hint={task.pricingPending ? t('edit.pricingHint') : undefined}
          >
            <Input
              id="task-points"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.points}
              disabled={readOnly}
              invalid={Boolean(errors.points)}
              suffix={t('common:units.points')}
              onChange={(e) => set('points', e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('edit.fields.description')} htmlFor="task-description" error={errors.description} hint={`${form.description.length}/20000`}>
          <Textarea id="task-description" rows={6} value={form.description} disabled={readOnly} invalid={Boolean(errors.description)} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </CardBody>
      {readOnly ? null : (
        <CardFooter>
          <Button variant="ghost" disabled={dirty.length === 0 || actions.update.isPending} onClick={() => { setForm(initial); setErrors({}) }}>
            {t('common:actions.reset')}
          </Button>
          <Button loading={actions.update.isPending} disabled={dirty.length === 0} onClick={save}>
            {t('common:actions.saveChanges')}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
