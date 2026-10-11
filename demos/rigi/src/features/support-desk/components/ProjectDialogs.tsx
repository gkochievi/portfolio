import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Banner, Button, Dialog, Field, Input, NativeSelect, Textarea, toast } from '@/components/ui'
import { formatMoney } from '@/lib/format'

import {
  errorMessage,
  fieldErrorsOf,
  useCreateProject,
  useProjectActions,
  type PartnerLite,
  type ProjectRow,
} from '../api'

type TFn = (key: string, opts?: Record<string, unknown>) => string

/** Empty or a non-negative number with at most 2 decimals (comma accepted). */
const priceText = (t: TFn, required: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => (required ? v !== '' : true), { message: t('validation.required') })
    .refine((v) => v === '' || (/^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(',', '.')) <= 10_000_000), { message: t('validation.price') })

export const parsePrice = (v: string): number | null => (v.trim() === '' ? null : Number(v.trim().replace(',', '.')))

/** Copy a mock validation error onto the form fields; returns true when something was mapped. */
function applyServerErrors(error: unknown, setError: (name: never, e: { message: string }) => void, fields: string[]): boolean {
  const errs = fieldErrorsOf(error)
  let mapped = false
  for (const [k, msg] of Object.entries(errs)) {
    if (fields.includes(k)) {
      setError(k as never, { message: msg })
      mapped = true
    }
  }
  return mapped
}

/* ----------------------------------------------------------------- create */

export function CreateProjectDialog({
  open,
  onOpenChange,
  partners,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partners: PartnerLite[]
  onCreated: (project: ProjectRow) => void
}) {
  const { t } = useTranslation(['support-desk', 'common'])
  const create = useCreateProject()
  const schema = z.object({
    partnerId: z.string().min(1, t('validation.partner')),
    name: z.string().trim().min(1, t('validation.required')).max(300, t('validation.nameMax')),
    description: z.string().max(20000, t('validation.descriptionMax')),
    price: priceText(t, false),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { partnerId: '', name: '', description: '', price: '' } })
  const { register, handleSubmit, setError, reset, formState } = form
  const { errors } = formState
  const currency = partners.find((p) => p.id === form.watch('partnerId'))?.currency

  const submit = handleSubmit((v) =>
    create.mutate(
      { partnerId: v.partnerId, name: v.name.trim(), description: v.description.trim(), price: parsePrice(v.price) },
      {
        onSuccess: (project) => {
          toast.success(t('projects.created', { name: project.name }))
          reset()
          onOpenChange(false)
          onCreated(project)
        },
        onError: (e) => {
          if (!applyServerErrors(e, setError as never, ['partnerId', 'name', 'description', 'price'])) toast.error(errorMessage(e))
        },
      },
    ),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
      title={t('projects.createTitle')}
      description={t('projects.createDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="create-project-form" loading={create.isPending}>{t('common:actions.create')}</Button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('projects.fields.partner')} required error={errors.partnerId?.message} htmlFor="prj-partner">
          <NativeSelect
            id="prj-partner"
            invalid={Boolean(errors.partnerId)}
            placeholder={t('projects.partnerPlaceholder')}
            options={partners.map((p) => ({ value: p.id, label: p.name }))}
            {...register('partnerId')}
          />
        </Field>
        <Field label={t('projects.fields.name')} required error={errors.name?.message} htmlFor="prj-name">
          <Input id="prj-name" invalid={Boolean(errors.name)} placeholder={t('projects.namePlaceholder')} maxLength={300} {...register('name')} />
        </Field>
        <Field label={t('projects.fields.description')} error={errors.description?.message} htmlFor="prj-desc">
          <Textarea id="prj-desc" rows={3} invalid={Boolean(errors.description)} {...register('description')} />
        </Field>
        <Field label={t('projects.fields.price')} hint={t('projects.priceHint')} error={errors.price?.message} htmlFor="prj-price">
          <Input id="prj-price" inputMode="decimal" mono suffix={currency ?? ''} invalid={Boolean(errors.price)} placeholder="0.00" {...register('price')} />
        </Field>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------- edit */

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRow
}) {
  const { t } = useTranslation(['support-desk', 'common'])
  const { update } = useProjectActions(project.id)
  const schema = z.object({
    name: z.string().trim().min(1, t('validation.required')).max(300, t('validation.nameMax')),
    description: z.string().max(20000, t('validation.descriptionMax')),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: project.name, description: project.description },
  })
  const { errors } = formState
  const submit = handleSubmit((v) =>
    update.mutate(
      { name: v.name.trim(), description: v.description.trim() },
      {
        onSuccess: () => {
          toast.success(t('project.saved'))
          onOpenChange(false)
        },
        onError: (e) => {
          if (!applyServerErrors(e, setError as never, ['name', 'description'])) toast.error(errorMessage(e))
        },
      },
    ),
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('project.editTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="edit-project-form" loading={update.isPending}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <form id="edit-project-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('projects.fields.name')} required error={errors.name?.message} htmlFor="ep-name">
          <Input id="ep-name" invalid={Boolean(errors.name)} maxLength={300} {...register('name')} />
        </Field>
        <Field label={t('projects.fields.description')} error={errors.description?.message} htmlFor="ep-desc">
          <Textarea id="ep-desc" rows={4} invalid={Boolean(errors.description)} {...register('description')} />
        </Field>
      </form>
    </Dialog>
  )
}

/* -------------------------------------------------------------- set price */

export function SetPriceDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project: ProjectRow }) {
  const { t } = useTranslation(['support-desk', 'common'])
  const { setPrice } = useProjectActions(project.id)
  const schema = z.object({ price: priceText(t, true) })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { price: project.price !== null ? String(project.price) : '' },
  })
  const submit = handleSubmit((v) =>
    setPrice.mutate(parsePrice(v.price) ?? 0, {
      onSuccess: () => {
        toast.success(t('project.priceSet'))
        onOpenChange(false)
      },
      onError: (e) => {
        if (!applyServerErrors(e, setError as never, ['price'])) toast.error(errorMessage(e))
      },
    }),
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('project.setPriceTitle')}
      description={t('project.setPriceDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="set-price-form" loading={setPrice.isPending}>{t('common:actions.save')}</Button>
        </>
      }
    >
      <form id="set-price-form" onSubmit={submit} noValidate>
        <Field label={t('projects.fields.price')} required error={formState.errors.price?.message} htmlFor="sp-price">
          <Input id="sp-price" inputMode="decimal" mono autoFocus suffix={project.currency} invalid={Boolean(formState.errors.price)} {...register('price')} />
        </Field>
      </form>
    </Dialog>
  )
}

/* --------------------------------------------------------------- complete */

export function CompleteProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project: ProjectRow }) {
  const { t } = useTranslation(['support-desk', 'common'])
  const { complete } = useProjectActions(project.id)
  const schema = z.object({
    finalPrice: priceText(t, true),
    adjustNote: z.string().max(2000, t('validation.noteMax')),
  })
  type Values = z.infer<typeof schema>
  const { register, handleSubmit, setError, watch, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { finalPrice: project.price !== null ? String(project.price) : '', adjustNote: '' },
  })
  const { errors } = formState
  const finalPrice = parsePrice(watch('finalPrice') ?? '')
  const changed = project.price !== null && finalPrice !== null && finalPrice !== project.price

  const submit = handleSubmit((v) =>
    complete.mutate(
      { finalPrice: parsePrice(v.finalPrice) ?? 0, adjustNote: v.adjustNote.trim() },
      {
        onSuccess: () => {
          toast.success(t('project.completed'))
          onOpenChange(false)
        },
        onError: (e) => {
          if (!applyServerErrors(e, setError as never, ['finalPrice', 'adjustNote'])) toast.error(errorMessage(e))
        },
      },
    ),
  )
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('project.completeTitle')}
      description={t('project.completeDescription')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button type="submit" form="complete-project-form" loading={complete.isPending}>{t('project.complete')}</Button>
        </>
      }
    >
      <form id="complete-project-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label={t('project.finalPrice')}
          required
          hint={project.price !== null ? t('project.agreedPrice', { price: formatMoney(project.price, project.currency) }) : t('project.noAgreedPrice')}
          error={errors.finalPrice?.message}
          htmlFor="cp-price"
        >
          <Input id="cp-price" inputMode="decimal" mono suffix={project.currency} invalid={Boolean(errors.finalPrice)} {...register('finalPrice')} />
        </Field>
        <Field label={t('project.adjustNote')} hint={t('project.adjustNoteHint')} error={errors.adjustNote?.message} htmlFor="cp-note">
          <Textarea id="cp-note" rows={3} invalid={Boolean(errors.adjustNote)} {...register('adjustNote')} />
        </Field>
        {changed ? <Banner tone="warning">{t('project.priceChangedWarning')}</Banner> : null}
        <Banner tone="info">{t('project.completeBillingNote')}</Banner>
      </form>
    </Dialog>
  )
}
