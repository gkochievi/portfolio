/** The 480px "New event" side sheet: name, round length, start and end. */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { isApiError } from '@/api/client'
import { Button, Field, Input, SideSheet, toast, toastError } from '@/components/ui'
import type { EventSummary } from '@/types'
import { useCreateEvent } from '../api'
import { defaultWindow, fromLocalInput } from '../lib/datetime'

const schema = z
  .object({
    name: z.string().trim().min(1, 'events:errors.nameRequired').max(120, 'events:errors.nameTooLong'),
    durationSeconds: z.coerce
      .number({ invalid_type_error: 'events:errors.duration' })
      .int('events:errors.duration')
      .min(10, 'events:errors.duration')
      .max(600, 'events:errors.duration'),
    startsAt: z.string().refine((v) => fromLocalInput(v) !== null, 'events:errors.dateInvalid'),
    endsAt: z.string().refine((v) => fromLocalInput(v) !== null, 'events:errors.dateInvalid'),
  })
  .refine((v) => {
    const start = fromLocalInput(v.startsAt)
    const end = fromLocalInput(v.endsAt)
    return !start || !end || Date.parse(end) > Date.parse(start)
  }, { path: ['endsAt'], message: 'events:errors.endBeforeStart' })

type FormValues = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

const FIELDS = ['name', 'durationSeconds', 'startsAt', 'endsAt'] as const

function blank(): FormValues {
  return { name: '', durationSeconds: 60, ...defaultWindow() }
}

export function EventCreateSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (event: EventSummary) => void
}) {
  const { t } = useTranslation('events')
  const create = useCreateEvent()
  const form = useForm<FormValues, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: blank() })
  const { errors } = form.formState

  useEffect(() => {
    if (open) {
      form.reset(blank())
      create.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const event = await create.mutateAsync({
        name: values.name,
        durationSeconds: values.durationSeconds,
        startsAt: fromLocalInput(values.startsAt) ?? '',
        endsAt: fromLocalInput(values.endsAt) ?? '',
      })
      toast.success(t('toasts.created', { name: event.name }))
      onCreated(event)
      onOpenChange(false)
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fieldErrors).length > 0) {
        for (const field of FIELDS) {
          const message = error.fieldErrors[field]?.[0]
          if (message) form.setError(field, { message })
        }
      } else {
        toastError(error)
      }
    }
  })

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('create.title')}
      description={t('create.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="event-create-form" loading={create.isPending}>
            {t('create.submit')}
          </Button>
        </div>
      }
    >
      <form id="event-create-form" noValidate onSubmit={onSubmit} className="space-y-4">
        <Field label={t('fields.name')} htmlFor="ev-name" error={errors.name?.message} required>
          <Input id="ev-name" autoComplete="off" placeholder={t('create.namePlaceholder')} invalid={Boolean(errors.name)} {...form.register('name')} />
        </Field>
        <Field
          label={t('fields.duration')}
          htmlFor="ev-duration"
          hint={t('fields.durationHint')}
          error={errors.durationSeconds?.message}
          required
        >
          <Input
            id="ev-duration"
            type="number"
            inputMode="numeric"
            min={10}
            max={600}
            step={1}
            trailing={<span className="text-sm text-muted">{t('common:units.seconds')}</span>}
            invalid={Boolean(errors.durationSeconds)}
            {...form.register('durationSeconds')}
          />
        </Field>
        <Field label={t('fields.startsAt')} htmlFor="ev-start" error={errors.startsAt?.message} required>
          <Input id="ev-start" type="datetime-local" invalid={Boolean(errors.startsAt)} {...form.register('startsAt')} />
        </Field>
        <Field label={t('fields.endsAt')} htmlFor="ev-end" error={errors.endsAt?.message} required>
          <Input id="ev-end" type="datetime-local" invalid={Boolean(errors.endsAt)} {...form.register('endsAt')} />
        </Field>
        <p className="rounded-card bg-sunken p-3 text-sm text-muted">{t('create.defaultsNote')}</p>
      </form>
    </SideSheet>
  )
}
