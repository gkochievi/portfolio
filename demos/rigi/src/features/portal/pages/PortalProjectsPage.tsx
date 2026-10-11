/** /partner/projects: project list with an inline request form. Owner: portal. */
import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { errorMessage, fieldErrorsOf } from '@/api/client'
import { ProjectStateChip } from '@/components/status'
import { Button, Card, CardBody, CardHeader, DataTable, DateText, Field, Input, Mono, Money, PageHeader, Section, Textarea, toast, type Column } from '@/components/ui'
import { formatProjectNumber } from '@/lib/format'

import { useCreatePortalProject, usePortalProjects, type PortalProjectRow } from '../api'

interface FormValues {
  name: string
  description: string
}

export default function PortalProjectsPage() {
  const { t } = useTranslation('portal')
  const projects = usePortalProjects()
  const create = useCreatePortalProject()
  const [formOpen, setFormOpen] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('projects.errors.nameRequired')).max(300, t('projects.errors.nameMax')),
        description: z.string().max(20000, t('projects.errors.descriptionMax')),
      }),
    [t],
  )
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '' } })

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { name: values.name.trim(), description: values.description },
      {
        onSuccess: () => {
          toast.success(t('projects.created'))
          reset()
          setFormOpen(false)
        },
        onError: (error) => {
          const fields = fieldErrorsOf(error)
          if (fields.name) setError('name', { message: fields.name })
          if (fields.description) setError('description', { message: fields.description })
          if (Object.keys(fields).length === 0) toast.error(errorMessage(error, t('projects.failed')))
        },
      },
    )
  })

  const columns: Column<PortalProjectRow>[] = [
    { key: 'number', header: '№', width: '96px', sortable: true, cell: (r) => <Mono>{formatProjectNumber(r.number)}</Mono> },
    {
      key: 'name',
      header: t('projects.columns.name'),
      sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{r.name}</span>
          <span className="text-xs text-subtle sm:hidden">
            <DateText value={r.createdAt} />
          </span>
        </div>
      ),
    },
    { key: 'taskCount', header: t('projects.columns.tasks'), align: 'right', sortable: true, hideBelow: 'sm', cell: (r) => <span className="num">{r.taskCount}</span> },
    { key: 'state', header: t('projects.columns.state'), sortable: true, cell: (r) => <ProjectStateChip state={r.state} /> },
    {
      key: 'price',
      header: t('projects.columns.price'),
      align: 'right',
      sortable: true,
      sortValue: (r) => (r.pricingPending || r.price === null ? -1 : r.price),
      cell: (r) => (r.pricingPending || r.price === null ? <span className="text-muted">{t('projects.pricingPending')}</span> : <Money amount={r.price} currency={r.currency} />),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow={t('projects.eyebrow')}
        title={t('projects.title')}
        description={t('projects.description')}
        actions={
          !formOpen ? (
            <Button icon={<Plus aria-hidden />} onClick={() => setFormOpen(true)}>
              {t('projects.request')}
            </Button>
          ) : null
        }
      />

      {formOpen ? (
        <Card className="mb-6">
          <CardHeader title={t('projects.formTitle')} description={t('projects.formHint')} />
          <CardBody>
            <form onSubmit={onSubmit} noValidate className="grid max-w-3xl gap-4">
              <Field label={t('projects.name')} htmlFor="pp-name" required error={errors.name?.message}>
                <Input id="pp-name" autoFocus maxLength={400} placeholder={t('projects.namePlaceholder')} invalid={Boolean(errors.name)} {...register('name')} />
              </Field>
              <Field label={t('projects.descriptionLabel')} htmlFor="pp-desc" error={errors.description?.message}>
                <Textarea id="pp-desc" rows={4} placeholder={t('projects.descriptionPlaceholder')} invalid={Boolean(errors.description)} {...register('description')} />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset()
                    setFormOpen(false)
                  }}
                  disabled={create.isPending}
                >
                  {t('common:actions.cancel')}
                </Button>
                <Button type="submit" loading={create.isPending} icon={<Send aria-hidden />}>
                  {t('projects.submit')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Section>
        <DataTable
          caption={t('projects.title')}
          columns={columns}
          rows={projects.data}
          getRowId={(r) => r.id}
          rowHref={(r) => `/partner/projects/${r.id}`}
          error={projects.error ? t('projects.error') : undefined}
          onRetry={() => void projects.refetch()}
          initialSort={{ key: 'number', dir: 'desc' }}
          empty={{
            title: t('projects.empty.title'),
            description: t('projects.empty.description'),
            action: !formOpen ? (
              <Button icon={<Plus aria-hidden />} onClick={() => setFormOpen(true)}>
                {t('projects.request')}
              </Button>
            ) : undefined,
          }}
        />
      </Section>
    </>
  )
}
