/** Create / edit a prize: label, description, image, sort order. */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trophy } from 'lucide-react'
import { z } from 'zod'

import { Button, Field, Input, SideSheet, Textarea, toast } from '@/components/ui'
import type { Prize } from '@/types'
import { usePrizeCrud } from '../api'
import { applyServerErrors, ImagePicker } from './shared'

const schema = z.object({
  label: z.string().trim().min(1, 'content:errors.labelRequired').max(120, 'content:errors.labelTooLong'),
  description: z.string().trim().max(500, 'content:errors.descriptionTooLong'),
  imageUrl: z.string().nullable(),
  sortOrder: z
    .number({ invalid_type_error: 'content:errors.sortOrderRange', required_error: 'content:errors.sortOrderRange' })
    .int('content:errors.sortOrderRange')
    .min(0, 'content:errors.sortOrderRange')
    .max(10000, 'content:errors.sortOrderRange'),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['label', 'description', 'imageUrl', 'sortOrder'] as const

export function PrizeSheet({
  eventId,
  open,
  prize,
  nextSortOrder,
  onOpenChange,
}: {
  eventId: string
  open: boolean
  prize: Prize | null
  nextSortOrder: number
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('content')
  const { save } = usePrizeCrud(eventId)
  const { register, control, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', description: '', imageUrl: null, sortOrder: nextSortOrder },
  })
  const { errors } = formState

  useEffect(() => {
    if (!open) return
    reset(
      prize
        ? { label: prize.label, description: prize.description ?? '', imageUrl: prize.imageUrl, sortOrder: prize.sortOrder }
        : { label: '', description: '', imageUrl: null, sortOrder: nextSortOrder },
    )
  }, [open, prize, nextSortOrder, reset])

  const onSubmit = handleSubmit((values) => {
    const input = { ...values, description: values.description || null }
    save.mutate(
      { id: prize?.id ?? null, input },
      {
        onSuccess: (saved) => {
          toast.success(t(prize ? 'prizes.toasts.updated' : 'prizes.toasts.created', { name: saved.label }))
          onOpenChange(false)
        },
        onError: (error) => applyServerErrors(error, setError, FIELDS),
      },
    )
  })

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={prize ? t('prizes.sheet.editTitle') : t('prizes.sheet.createTitle')}
      description={t('prizes.sheet.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="prize-form" loading={save.isPending}>
            {prize ? t('common:actions.saveChanges') : t('prizes.add')}
          </Button>
        </div>
      }
    >
      <form id="prize-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label={t('prizes.fields.label')} htmlFor="prize-label" error={errors.label?.message} required>
          <Input id="prize-label" autoComplete="off" placeholder={t('prizes.fields.labelPlaceholder')} invalid={!!errors.label} {...register('label')} />
        </Field>
        <Field label={t('prizes.fields.description')} htmlFor="prize-description" error={errors.description?.message}>
          <Textarea
            id="prize-description"
            rows={3}
            placeholder={t('prizes.fields.descriptionPlaceholder')}
            invalid={!!errors.description}
            {...register('description')}
          />
        </Field>
        <Field label={t('prizes.fields.image')}>
          {() => (
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImagePicker value={field.value} onChange={field.onChange} aspect="wide" fallback={<Trophy aria-hidden className="size-8 text-muted" />} />
              )}
            />
          )}
        </Field>
        <Field label={t('prizes.fields.sortOrder')} htmlFor="prize-sort" hint={t('prizes.fields.sortOrderHint')} error={errors.sortOrder?.message}>
          <Input
            id="prize-sort"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className="w-32 font-mono tabular-nums"
            invalid={!!errors.sortOrder}
            {...register('sortOrder', { valueAsNumber: true })}
          />
        </Field>
      </form>
    </SideSheet>
  )
}
