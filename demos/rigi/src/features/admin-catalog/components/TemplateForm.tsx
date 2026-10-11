import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, Card, CardBody, CardFooter, CardHeader, Checkbox, Field, Input, Mono, Textarea, toast } from '@/components/ui'
import { slugTemplateCode } from '@/demo/handlers/admin-catalog'
import type { TaskTemplate } from '@/types'

import { apiErrorMessage, applyFieldErrors, type TemplateFormValues } from '../api'

interface FormValues {
  name: string
  description: string
  isFreeform: boolean
  defaultPoints: string
  isActive: boolean
}

interface Props {
  /** Present when editing: the code is shown, never changed. */
  template?: TaskTemplate
  /** Codes already in use, for the live code preview on the create form. */
  takenCodes?: string[]
  readOnly?: boolean
  submitLabel: string
  title: string
  description?: string
  onSubmit: (values: TemplateFormValues) => Promise<void>
  onCancel?: () => void
}

export function TemplateForm({ template, takenCodes = [], readOnly, submitLabel, title, description, onSubmit, onCancel }: Props) {
  const { t } = useTranslation(['admin-catalog', 'common'])

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t('validation.required')).max(200, t('validation.tooLong')),
          description: z.string().max(4000, t('validation.tooLong')),
          isFreeform: z.boolean(),
          defaultPoints: z.string(),
          isActive: z.boolean(),
        })
        .superRefine((v, ctx) => {
          if (v.isFreeform) return
          const raw = v.defaultPoints.trim()
          const n = Number(raw)
          if (raw === '') ctx.addIssue({ code: 'custom', path: ['defaultPoints'], message: t('validation.required') })
          else if (!Number.isFinite(n) || n < 0) ctx.addIssue({ code: 'custom', path: ['defaultPoints'], message: t('validation.pointsMin') })
          else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) ctx.addIssue({ code: 'custom', path: ['defaultPoints'], message: t('validation.pointsStep') })
        }),
    [t],
  )

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      isFreeform: template?.isFreeform ?? false,
      defaultPoints: template?.defaultPoints != null ? String(template.defaultPoints) : '',
      isActive: template?.isActive ?? true,
    },
  })

  const name = useWatch({ control, name: 'name' })
  const isFreeform = useWatch({ control, name: 'isFreeform' })
  const codePreview = useMemo(() => (name.trim() ? slugTemplateCode(name, new Set(takenCodes)) : ''), [name, takenCodes])

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({
        name: v.name.trim(),
        description: v.description.trim(),
        isFreeform: v.isFreeform,
        defaultPoints: v.isFreeform ? null : Number(v.defaultPoints),
        isActive: v.isActive,
      })
    } catch (e) {
      if (!applyFieldErrors(t, e, setError)) toast.error(apiErrorMessage(t, e))
    }
  })

  return (
    <form onSubmit={submit} noValidate>
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody className="grid gap-4">
          <Field label={t('templateForm.name')} required error={errors.name?.message} htmlFor="tpl-name">
            <Input id="tpl-name" placeholder={t('templateForm.namePlaceholder')} invalid={Boolean(errors.name)} disabled={readOnly} {...register('name')} />
          </Field>

          <Field
            label={t(template ? 'templateForm.code' : 'templateForm.codePreview')}
            hint={template ? undefined : t('templateForm.codeHint')}
          >
            <div className="flex h-9 items-center">
              {template ? <Mono>{template.code}</Mono> : codePreview ? <Mono>{codePreview}</Mono> : <span className="text-sm text-subtle">—</span>}
            </div>
          </Field>

          <Field label={t('templateForm.description')} hint={t('templateForm.descriptionHint')} error={errors.description?.message} htmlFor="tpl-desc">
            <Textarea id="tpl-desc" rows={4} invalid={Boolean(errors.description)} disabled={readOnly} {...register('description')} />
          </Field>

          <Checkbox
            label={t('templateForm.freeform')}
            description={t('templateForm.freeformDescription')}
            disabled={readOnly}
            {...register('isFreeform')}
          />

          {isFreeform ? null : (
            <Field label={t('templateForm.points')} hint={t('templateForm.pointsHint')} required error={errors.defaultPoints?.message} htmlFor="tpl-points">
              <Input
                id="tpl-points"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                mono
                className="max-w-40"
                invalid={Boolean(errors.defaultPoints)}
                disabled={readOnly}
                {...register('defaultPoints')}
              />
            </Field>
          )}

          <Checkbox label={t('templateForm.active')} description={t('templateForm.activeDescription')} disabled={readOnly} {...register('isActive')} />
        </CardBody>
        {readOnly ? null : (
          <CardFooter>
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                {t('common:actions.cancel')}
              </Button>
            ) : null}
            <Button type="submit" loading={isSubmitting}>
              {submitLabel}
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  )
}
