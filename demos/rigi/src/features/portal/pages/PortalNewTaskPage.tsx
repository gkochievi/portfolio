/**
 * /partner/tasks/new: pick a catalogue template, then describe the task.
 * Owner: portal.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { fieldErrorsOf, errorMessage } from '@/api/client'
import { Banner, Button, Card, CardBody, EmptyState, Field, Input, PageHeader, Section, Skeleton, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

import { useCreatePortalTask, usePortalCatalogue, type PortalCatalogueItem } from '../api'
import { todayDay } from '../components/PointsText'

interface FormValues {
  title: string
  description: string
  deadline: string
}

export default function PortalNewTaskPage() {
  const { t } = useTranslation('portal')
  const navigate = useNavigate()
  const catalogue = usePortalCatalogue()
  const create = useCreatePortalTask()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [pickError, setPickError] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        title: z.string().trim().min(1, t('newTask.errors.titleRequired')).max(500, t('newTask.errors.titleMax')),
        description: z.string().max(20000, t('newTask.errors.descriptionMax')),
        deadline: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), t('newTask.errors.deadlineInvalid')),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { title: '', description: '', deadline: '' } })

  const onSubmit = handleSubmit((values) => {
    if (!templateId) {
      setPickError(true)
      return
    }
    create.mutate(
      { templateId, title: values.title.trim(), description: values.description, deadline: values.deadline || null },
      {
        onSuccess: (task) => {
          toast.success(t('newTask.submitted'))
          navigate(`/partner/tasks/${task.id}`)
        },
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          if (fields.templateId) setPickError(true)
          if (fields.title) setError('title', { message: fields.title })
          if (fields.description) setError('description', { message: fields.description })
          if (fields.deadline) setError('deadline', { message: fields.deadline })
          if (Object.keys(fields).length === 0) toast.error(errorMessage(error, t('newTask.failed')))
        },
      },
    )
  })

  const selected = catalogue.data?.find((c) => c.id === templateId)

  return (
    <>
      <PageHeader back={{ to: '/partner', label: t('newTask.back') }} title={t('newTask.title')} description={t('newTask.description')} />

      <Section title={t('newTask.stepTemplate')}>
        {catalogue.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : catalogue.error ? (
          <Banner tone="danger" title={t('newTask.catalogueError')} action={<Button size="sm" variant="outline" onClick={() => void catalogue.refetch()}>{t('common:actions.retry')}</Button>} />
        ) : catalogue.data && catalogue.data.length === 0 ? (
          <EmptyState compact title={t('newTask.catalogueEmpty')} />
        ) : (
          <div role="radiogroup" aria-label={t('newTask.stepTemplate')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogue.data?.map((item) => (
              <TemplateCard
                key={item.id}
                item={item}
                selected={item.id === templateId}
                onSelect={() => {
                  setTemplateId(item.id)
                  setPickError(false)
                }}
              />
            ))}
          </div>
        )}
        {pickError ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {t('newTask.templateRequired')}
          </p>
        ) : null}
      </Section>

      <Section title={t('newTask.stepDetails')}>
        <Card className={cn(!selected && 'opacity-80')}>
          <CardBody>
            <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-4">
              {!selected ? <p className="text-[13px] text-muted">{t('newTask.pickFirst')}</p> : null}
              <Field label={t('newTask.fields.title')} htmlFor="pt-title" required error={errors.title?.message}>
                <Input id="pt-title" maxLength={600} placeholder={t('newTask.fields.titlePlaceholder')} invalid={Boolean(errors.title)} {...register('title')} />
              </Field>
              <Field label={t('newTask.fields.description')} htmlFor="pt-desc" error={errors.description?.message}>
                <Textarea id="pt-desc" rows={6} placeholder={t('newTask.fields.descriptionPlaceholder')} invalid={Boolean(errors.description)} {...register('description')} />
              </Field>
              <Field label={t('newTask.fields.deadline')} htmlFor="pt-deadline" hint={t('newTask.fields.deadlineHint')} error={errors.deadline?.message}>
                <Input id="pt-deadline" type="date" min={todayDay()} className="sm:max-w-[220px]" invalid={Boolean(errors.deadline)} {...register('deadline')} />
              </Field>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => navigate('/partner')}>
                  {t('common:actions.cancel')}
                </Button>
                <Button type="submit" loading={create.isPending} icon={<Send aria-hidden />}>
                  {t('newTask.submit')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </Section>
    </>
  )
}

function TemplateCard({ item, selected, onSelect }: { item: PortalCatalogueItem; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation('portal')
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'ticket flex min-h-28 flex-col rounded-lg border bg-panel px-4 py-3 text-left transition-colors duration-150 ease-rigi hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
        selected ? 'serving border-hairline-strong bg-row-hover' : 'border-hairline hover:border-hairline-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[15px] font-semibold">{item.name}</p>
        {selected ? <Check className="size-4 shrink-0 stroke-[2] text-accent" aria-hidden /> : null}
      </div>
      <p className="mt-1 line-clamp-3 flex-1 text-[13px] text-muted">{item.description}</p>
      <p className="eyebrow mt-3 num">
        {item.points === null || item.isFreeform ? t('newTask.pricedAfterReview') : t('newTask.pts', { value: formatNumber(item.points, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
      </p>
    </button>
  )
}
