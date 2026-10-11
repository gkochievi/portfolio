/** Create / edit a campaign in the 480px right drawer (react-hook-form + zod). */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, Button, Drawer, Field, Input, Segmented, Textarea } from '@/components/ui'
import { applyFieldErrors } from '@/lib/api'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import type { CampaignWithStats, Localized } from '@/types'

import { useDialerBounds, useSaveCampaign, type CampaignInput } from '../api'
import { useApiErrorText } from './shared'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function useSchema(min: number, max: number) {
  const { t } = useTranslation('campaigns')
  return useMemo(() => {
    const int = (lo: number, hi: number) =>
      z.coerce
        .number({ invalid_type_error: t('form.errors.number') })
        .int(t('form.errors.whole'))
        .min(lo, t('form.errors.range', { min: lo, max: hi }))
        .max(hi, t('form.errors.range', { min: lo, max: hi }))
    return z
      .object({
        name: z.string().trim().min(2, t('form.errors.nameShort')).max(100, t('form.errors.tooLong', { max: 100 })),
        clientName: z.string().trim().min(1, t('form.errors.required')).max(100, t('form.errors.tooLong', { max: 100 })),
        description: z.string().trim().max(500, t('form.errors.tooLong', { max: 500 })),
        callerId: z.string().trim().min(1, t('form.errors.required')).regex(/^\+?[\d\s()-]{5,20}$/, t('form.errors.callerId')),
        queueName: z.string().trim().regex(/^[A-Za-z0-9_-]{0,40}$/, t('form.errors.queue')),
        workingHoursStart: z.string().regex(HHMM, t('form.errors.time')),
        workingHoursEnd: z.string().regex(HHMM, t('form.errors.time')),
        maxAttempts: int(1, 10),
        retryDelayMinutes: int(1, 1440),
        dialingMode: z.enum(['MANUAL', 'AUTO']),
        dialRatio: z.coerce
          .number({ invalid_type_error: t('form.errors.number') })
          .min(min, t('form.errors.ratio', { min, max }))
          .max(max, t('form.errors.ratio', { min, max })),
        maxConcurrentCalls: int(1, 50),
        dialIntervalMs: int(250, 10000),
      })
      .refine((v) => v.workingHoursEnd > v.workingHoursStart, { path: ['workingHoursEnd'], message: t('form.errors.hours') })
  }, [t, min, max])
}

type FormValues = z.infer<ReturnType<typeof useSchema>>

export function CampaignFormDrawer({
  open,
  onOpenChange,
  campaign,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: CampaignWithStats | null
  onSaved?: (campaign: CampaignWithStats, created: boolean) => void
}) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const errText = useApiErrorText()
  const bounds = useDialerBounds()
  const schema = useSchema(bounds.minDialRatio, bounds.maxDialRatio)
  const save = useSaveCampaign()

  const defaults = useMemo<FormValues>(
    () => ({
      name: campaign ? l(campaign.name) : '',
      clientName: campaign ? l(campaign.clientName) : '',
      description: campaign ? l(campaign.description) : '',
      callerId: campaign?.callerId ?? '',
      queueName: campaign?.queueName ?? '',
      workingHoursStart: campaign?.workingHoursStart ?? '10:00',
      workingHoursEnd: campaign?.workingHoursEnd ?? '19:00',
      maxAttempts: campaign?.maxAttempts ?? 3,
      retryDelayMinutes: campaign?.retryDelayMinutes ?? 60,
      dialingMode: campaign?.dialingMode === 'AUTO' ? 'AUTO' : 'MANUAL',
      dialRatio: campaign?.dialRatio ?? bounds.baseDialRatio,
      maxConcurrentCalls: campaign?.maxConcurrentCalls ?? 6,
      dialIntervalMs: campaign?.dialIntervalMs ?? 1500,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaign?.id, open],
  )

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const { register, handleSubmit, formState, reset, control, setError } = form
  const errors = formState.errors
  const mode = useWatch({ control, name: 'dialingMode' })

  useEffect(() => {
    if (open) reset(defaults)
  }, [open, defaults, reset])

  const keep = (typed: string, original: Localized | undefined): Localized | string =>
    original && typed === l(original) ? original : typed

  const onSubmit = handleSubmit((values) => {
    const input: CampaignInput = {
      ...values,
      name: keep(values.name, campaign?.name),
      clientName: keep(values.clientName, campaign?.clientName),
      description: keep(values.description, campaign?.description),
    }
    save.mutate(
      { id: campaign?.id, input },
      {
        onSuccess: (saved) => {
          toast.success(campaign ? t('form.updated') : t('form.created'), { description: l(saved.name) })
          onOpenChange(false)
          onSaved?.(saved, !campaign)
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError)) toast.error(t('form.saveFailed'), { description: errText(error) })
        },
      },
    )
  })

  const err = (key: keyof FormValues) => {
    const message = errors[key]?.message
    return typeof message === 'string' ? errText(new Error(message)) : undefined
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={campaign ? t('form.editEyebrow') : t('form.newEyebrow')}
      title={campaign ? l(campaign.name) : t('form.newTitle')}
      description={campaign ? undefined : t('form.newHint')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc('actions.cancel')}
          </Button>
          <Button variant="dial" loading={save.isPending} onClick={() => void onSubmit()}>
            {campaign ? tc('actions.save') : t('form.create')}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field label={t('form.name')} required error={err('name')} htmlFor="cf-name">
          <Input id="cf-name" invalid={!!errors.name} placeholder={t('form.namePh')} {...register('name')} />
        </Field>
        <Field label={t('form.client')} required error={err('clientName')} htmlFor="cf-client">
          <Input id="cf-client" invalid={!!errors.clientName} placeholder={t('form.clientPh')} {...register('clientName')} />
        </Field>
        <Field label={t('form.description')} error={err('description')} htmlFor="cf-desc">
          <Textarea id="cf-desc" invalid={!!errors.description} {...register('description')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.callerId')} required error={err('callerId')} htmlFor="cf-caller">
            <Input id="cf-caller" mono invalid={!!errors.callerId} placeholder="+995 32 2 00 01 01" {...register('callerId')} />
          </Field>
          <Field label={t('form.queue')} hint={t('form.queueHint')} error={err('queueName')} htmlFor="cf-queue">
            <Input id="cf-queue" mono invalid={!!errors.queueName} placeholder="q_sales" {...register('queueName')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('form.hoursStart')} error={err('workingHoursStart')} htmlFor="cf-hs">
            <Input id="cf-hs" type="time" mono invalid={!!errors.workingHoursStart} {...register('workingHoursStart')} />
          </Field>
          <Field label={t('form.hoursEnd')} error={err('workingHoursEnd')} htmlFor="cf-he">
            <Input id="cf-he" type="time" mono invalid={!!errors.workingHoursEnd} {...register('workingHoursEnd')} />
          </Field>
          <Field label={t('form.maxAttempts')} error={err('maxAttempts')} htmlFor="cf-att">
            <Input id="cf-att" type="number" min={1} max={10} mono invalid={!!errors.maxAttempts} {...register('maxAttempts')} />
          </Field>
          <Field label={t('form.retryDelay')} error={err('retryDelayMinutes')} htmlFor="cf-retry">
            <Input id="cf-retry" type="number" min={1} max={1440} mono suffix={t('units.min')} invalid={!!errors.retryDelayMinutes} {...register('retryDelayMinutes')} />
          </Field>
        </div>

        <div className="rounded-card border border-hairline p-4">
          <p className="mb-2 text-sm font-medium text-ink">{t('form.dialingMode')}</p>
          <Controller
            control={control}
            name="dialingMode"
            render={({ field }) => (
              <Segmented
                value={field.value}
                onChange={(v) => field.onChange(v)}
                aria-label={t('form.dialingMode')}
                options={[
                  { value: 'MANUAL', label: tc('dialingMode.MANUAL') },
                  { value: 'AUTO', label: tc('dialingMode.AUTO') },
                  { value: 'PREDICTIVE' as 'AUTO', label: `${tc('dialingMode.PREDICTIVE')} · ${t('comingSoon')}`, disabled: true },
                ]}
              />
            )}
          />
          <p className="mt-2 text-xs text-muted">{mode === 'AUTO' ? t('form.autoHint') : t('form.manualHint')}</p>
          {mode === 'AUTO' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t('form.dialRatio')} hint={t('form.ratioHint', { min: bounds.minDialRatio, max: bounds.maxDialRatio })} error={err('dialRatio')} htmlFor="cf-ratio">
                <Input
                  id="cf-ratio"
                  type="number"
                  step={0.1}
                  min={bounds.minDialRatio}
                  max={bounds.maxDialRatio}
                  mono
                  invalid={!!errors.dialRatio}
                  {...register('dialRatio')}
                />
              </Field>
              <Field label={t('form.maxConcurrent')} error={err('maxConcurrentCalls')} htmlFor="cf-max">
                <Input id="cf-max" type="number" min={1} max={50} mono invalid={!!errors.maxConcurrentCalls} {...register('maxConcurrentCalls')} />
              </Field>
              <Field label={t('form.interval')} error={err('dialIntervalMs')} htmlFor="cf-int">
                <Input id="cf-int" type="number" step={50} min={250} max={10000} mono suffix="ms" invalid={!!errors.dialIntervalMs} {...register('dialIntervalMs')} />
              </Field>
            </div>
          )}
        </div>
        {!campaign && <Alert tone="info">{t('form.draftNote')}</Alert>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Drawer>
  )
}
