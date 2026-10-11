/** Create / edit a falling item in the 480px side sheet. */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ItemToken } from '@/components/brand'
import { Button, Field, Input, SideSheet, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { Item, ItemType } from '@/types'
import { ITEM_TYPES, TYPE_DEFAULT_POINTS, useItemCrud } from '../api'
import { applyServerErrors, ImagePicker } from './shared'

const num = (key: string) => z.number({ invalid_type_error: key, required_error: key }).int(key)

const schema = z.object({
  name: z.string().trim().min(1, 'content:errors.nameRequired').max(80, 'content:errors.nameTooLong'),
  type: z.enum(['GOOD', 'MINOR', 'MAJOR'], { message: 'content:errors.typeInvalid' }),
  points: num('content:errors.pointsRange').min(-100000, 'content:errors.pointsRange').max(100000, 'content:errors.pointsRange'),
  brandName: z.string().trim().max(120, 'content:errors.brandTooLong'),
  weight: num('content:errors.weightRange').min(1, 'content:errors.weightRange').max(100, 'content:errors.weightRange'),
  active: z.boolean(),
  imageUrl: z.string().nullable(),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['name', 'type', 'points', 'brandName', 'weight', 'active', 'imageUrl'] as const

const blank: FormValues = { name: '', type: 'GOOD', points: TYPE_DEFAULT_POINTS.GOOD, brandName: '', weight: 5, active: true, imageUrl: null }

const toForm = (item: Item): FormValues => ({
  name: item.name,
  type: item.type,
  points: item.points,
  brandName: item.brandName ?? '',
  weight: item.weight,
  active: item.active,
  imageUrl: item.imageUrl,
})

export function ItemSheet({
  eventId,
  open,
  item,
  onOpenChange,
}: {
  eventId: string
  open: boolean
  /** null = create. */
  item: Item | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('content')
  const { save } = useItemCrud(eventId)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: blank })
  const { register, control, handleSubmit, reset, setValue, setError, watch, formState } = form
  const { errors } = formState

  useEffect(() => {
    if (open) reset(item ? toForm(item) : blank)
  }, [open, item, reset])

  const type = watch('type')
  const name = watch('name')

  const pickType = (next: ItemType) => {
    setValue('type', next, { shouldDirty: true })
    setValue('points', TYPE_DEFAULT_POINTS[next], { shouldDirty: true, shouldValidate: true })
  }

  const onSubmit = handleSubmit((values) => {
    const input = { ...values, brandName: values.brandName.trim() || null }
    save.mutate(
      { id: item?.id ?? null, input },
      {
        onSuccess: (saved) => {
          toast.success(t(item ? 'items.toasts.updated' : 'items.toasts.created', { name: saved.name }))
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
      title={item ? t('items.sheet.editTitle') : t('items.sheet.createTitle')}
      description={t('items.sheet.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="item-form" loading={save.isPending}>
            {item ? t('common:actions.saveChanges') : t('items.add')}
          </Button>
        </div>
      }
    >
      <form id="item-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label={t('items.fields.image')}>
          {() => (
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImagePicker
                  value={field.value}
                  onChange={field.onChange}
                  showAi
                  fallback={<ItemToken type={type} imageUrl={null} name={name || t(`types.${type}`)} size={80} />}
                />
              )}
            />
          )}
        </Field>

        <Field label={t('items.fields.name')} htmlFor="item-name" error={errors.name?.message} required>
          <Input id="item-name" autoComplete="off" placeholder={t('items.fields.namePlaceholder')} invalid={!!errors.name} {...register('name')} />
        </Field>

        <Field label={t('items.fields.type')} hint={t('items.fields.typeHint')} error={errors.type?.message}>
          <div role="radiogroup" aria-label={t('items.fields.type')} className="grid grid-cols-3 gap-2">
            {ITEM_TYPES.map((option) => {
              const selected = option === type
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickType(option)}
                  className={cn(
                    'flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-card border-[1.5px] px-1.5 py-2 text-center text-xs font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    selected ? 'border-primary bg-primary-soft text-ink' : 'border-line bg-panel text-muted hover:border-primary/50 hover:text-ink',
                  )}
                >
                  <ItemToken type={option} imageUrl={null} name={t(`types.${option}`)} size={28} />
                  <span>{t(`types.${option}`)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted">{TYPE_DEFAULT_POINTS[option] > 0 ? '+' : ''}{TYPE_DEFAULT_POINTS[option]}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('items.fields.points')} htmlFor="item-points" hint={t('items.fields.pointsHint')} error={errors.points?.message} required>
            <Input id="item-points" type="number" inputMode="numeric" step={1} className="font-mono tabular-nums" invalid={!!errors.points} {...register('points', { valueAsNumber: true })} />
          </Field>
          <Field label={t('items.fields.weight')} htmlFor="item-weight" hint={t('items.fields.weightHint')} error={errors.weight?.message} required>
            <Input id="item-weight" type="number" inputMode="numeric" min={1} max={100} step={1} className="font-mono tabular-nums" invalid={!!errors.weight} {...register('weight', { valueAsNumber: true })} />
          </Field>
        </div>

        <Field label={t('items.fields.brandName')} htmlFor="item-brand" hint={t('items.fields.brandHint')} error={errors.brandName?.message}>
          <Input id="item-brand" autoComplete="off" placeholder={t('items.fields.brandPlaceholder')} invalid={!!errors.brandName} {...register('brandName')} />
        </Field>

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} label={t('items.fields.active')} description={t('items.fields.activeHint')} />
          )}
        />
      </form>
    </SideSheet>
  )
}
