import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ConfirmDialog, ErrorState, Field, Input, LocalizedTextField, Modal, Skeleton, Switch, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { DistributionStrategy } from '@/types'

import { usePurge, useSettings, useUpdateSettings, useVerifyPassword, type PurgeResult } from '../api'
import { cleanText, intSchema, localizedSchema, locError, PanelSection, RowGroup, textValue, todayTbilisi, useSettingsErrors } from '../shared'

const FORM_ID = 'routing-form'
const STRATEGIES: DistributionStrategy[] = ['ordered', 'round_robin', 'random', 'least_busy']

interface FormValues {
  operatorEnterDirectly: boolean
  chatDistributionStrategy: DistributionStrategy
  operatorChatLimit: number
  typingTransparency: boolean
  requestFeedback: boolean
  messageNotesEnabled: boolean
  clientIpEnabled: boolean
  autoGreetingEnabled: boolean
  autoGreeting: { ka: string; en: string; ru?: string }
  bannedMessage: { ka: string; en: string; ru?: string }
  inactiveWarningMinutes: number
  inactiveDisconnectMinutes: number
  operatorResponseMinutes: number
  operatorLogoutGraceMinutes: number
  chatRetentionDays: number
}

export function RoutingPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const query = useSettings()
  const update = useUpdateSettings()
  const verify = useVerifyPassword()
  const purge = usePurge()
  const errors = useSettingsErrors()

  const schema = useMemo(
    () =>
      z
        .object({
          operatorEnterDirectly: z.boolean(),
          chatDistributionStrategy: z.enum(['ordered', 'round_robin', 'random', 'least_busy']),
          operatorChatLimit: intSchema(t, 0, 50),
          typingTransparency: z.boolean(),
          requestFeedback: z.boolean(),
          messageNotesEnabled: z.boolean(),
          clientIpEnabled: z.boolean(),
          autoGreetingEnabled: z.boolean(),
          autoGreeting: localizedSchema(t, [], 500),
          bannedMessage: localizedSchema(t, ['ka', 'en'], 300),
          inactiveWarningMinutes: intSchema(t, 1, 120),
          inactiveDisconnectMinutes: intSchema(t, 2, 240),
          operatorResponseMinutes: intSchema(t, 0, 120),
          operatorLogoutGraceMinutes: intSchema(t, 0, 120),
          chatRetentionDays: intSchema(t, 7, 3650),
        })
        .superRefine((value, ctx) => {
          if (value.inactiveDisconnectMinutes <= value.inactiveWarningMinutes) {
            ctx.addIssue({ code: 'custom', path: ['inactiveDisconnectMinutes'], message: t('routing.errors.afterWarning') })
          }
          if (value.autoGreetingEnabled) {
            for (const lang of ['ka', 'en'] as const) {
              if (!value.autoGreeting[lang].trim()) ctx.addIssue({ code: 'custom', path: ['autoGreeting', lang], message: t('validation.required') })
            }
          }
        }),
    [t],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      operatorEnterDirectly: false,
      chatDistributionStrategy: 'round_robin',
      operatorChatLimit: 0,
      typingTransparency: false,
      requestFeedback: false,
      messageNotesEnabled: false,
      clientIpEnabled: false,
      autoGreetingEnabled: false,
      autoGreeting: { ka: '', en: '' },
      bannedMessage: { ka: '', en: '' },
      inactiveWarningMinutes: 5,
      inactiveDisconnectMinutes: 10,
      operatorResponseMinutes: 0,
      operatorLogoutGraceMinutes: 0,
      chatRetentionDays: 180,
    },
  })
  const { control, register, handleSubmit, reset, watch, formState } = form
  const e = formState.errors

  const [loaded, setLoaded] = useState(false)
  const settings = query.data
  useEffect(() => {
    if (!settings || loaded) return
    reset({
      operatorEnterDirectly: settings.operatorEnterDirectly,
      chatDistributionStrategy: settings.chatDistributionStrategy,
      operatorChatLimit: settings.operatorChatLimit,
      typingTransparency: settings.typingTransparency,
      requestFeedback: settings.requestFeedback,
      messageNotesEnabled: settings.messageNotesEnabled,
      clientIpEnabled: settings.clientIpEnabled,
      autoGreetingEnabled: settings.autoGreetingEnabled,
      autoGreeting: textValue(settings.autoGreeting),
      bannedMessage: textValue(settings.bannedMessage),
      inactiveWarningMinutes: settings.inactiveWarningMinutes,
      inactiveDisconnectMinutes: settings.inactiveDisconnectMinutes,
      operatorResponseMinutes: settings.operatorResponseMinutes,
      operatorLogoutGraceMinutes: settings.operatorLogoutGraceMinutes,
      chatRetentionDays: settings.chatRetentionDays,
    })
    setLoaded(true)
  }, [settings, loaded, reset])

  const autoAssign = watch('operatorEnterDirectly')
  const greetingOn = watch('autoGreetingEnabled')
  const limit = watch('operatorChatLimit')

  /* ------------------------------------------------------------------ save */

  const [pending, setPending] = useState<FormValues | null>(null)

  const toPatch = (values: FormValues) => ({
    ...values,
    autoGreeting: cleanText(values.autoGreeting),
    bannedMessage: cleanText(values.bannedMessage),
  })

  const saveNow = async (values: FormValues, password?: string) => {
    await update.mutateAsync({ ...toPatch(values), ...(password ? { password } : {}) })
    toast.success(t('routing.saved'))
    onClose()
  }

  const submit = handleSubmit(async (values) => {
    if (settings && values.chatRetentionDays !== settings.chatRetentionDays) {
      setPending(values)
      return
    }
    try {
      await saveNow(values)
    } catch (error) {
      toast.error(errors.text(error))
    }
  })

  const confirmRetention = async (password?: string) => {
    if (!pending) return
    try {
      await verify.mutateAsync(password ?? '')
      await saveNow(pending, password)
    } catch (error) {
      toast.error(errors.text(error))
      throw error
    }
  }

  /* ----------------------------------------------------------------- purge */

  const [range, setRange] = useState({ from: '', to: todayTbilisi() })
  const [rangeError, setRangeError] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [result, setResult] = useState<PurgeResult | null>(null)

  const askPurge = () => {
    if (!range.from || !range.to) return setRangeError(t('routing.purge.errors.required'))
    if (range.from > range.to) return setRangeError(t('routing.purge.errors.order'))
    setRangeError(null)
    setPurgeOpen(true)
  }

  const runPurge = async (password?: string) => {
    try {
      const counts = await purge.mutateAsync({ ...range, password: password ?? '' })
      setResult(counts)
      toast.success(t('routing.purge.done'))
    } catch (error) {
      toast.error(errors.text(error))
      throw error
    }
  }

  const number = (name: keyof FormValues, label: string, hint: string, error?: string) => (
    <Field label={label} hint={hint} error={error} htmlFor={`routing-${name}`}>
      <Input id={`routing-${name}`} type="number" inputMode="numeric" min={0} invalid={!!error} {...register(name as 'operatorChatLimit', { valueAsNumber: true })} />
    </Field>
  )

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        size="xl"
        title={t('routing.title')}
        description={t('routing.description')}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form={FORM_ID} loading={update.isPending} disabled={!loaded}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        {query.isError ? (
          <ErrorState title={t('routing.loadError')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
        ) : !loaded ? (
          <div className="flex flex-col gap-3" aria-busy>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-7">
            <PanelSection title={t('routing.assignment.title')} description={t('routing.assignment.description')}>
              <RowGroup>
                <Controller
                  control={control}
                  name="operatorEnterDirectly"
                  render={({ field }) => (
                    <Switch labelFirst checked={field.value} onCheckedChange={field.onChange} label={t('routing.assignment.auto')} description={t('routing.assignment.autoHint')} />
                  )}
                />
              </RowGroup>
              <Controller
                control={control}
                name="chatDistributionStrategy"
                render={({ field }) => (
                  <div role="radiogroup" aria-label={t('routing.assignment.strategy')} className={cn('grid gap-2 sm:grid-cols-2', !autoAssign && 'opacity-60')}>
                    {STRATEGIES.map((strategy) => {
                      const selected = field.value === strategy
                      return (
                        <button
                          key={strategy}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => field.onChange(strategy)}
                          className={cn(
                            'flex flex-col gap-0.5 rounded-ui border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent',
                            selected ? 'border-accent bg-accent-soft' : 'border-line bg-panel hover:bg-hover',
                          )}
                        >
                          <span className="text-sm font-medium text-ink">{tc(`strategy.${strategy}`)}</span>
                          <span className="text-[13px] text-muted">{t(`routing.assignment.strategies.${strategy}`)}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              />
              {!autoAssign ? <p className="text-[13px] text-muted">{t('routing.assignment.strategyOff')}</p> : null}
              <div className="max-w-xs">
                {number('operatorChatLimit', t('routing.assignment.limit'), limit === 0 ? t('routing.assignment.limitUnlimited') : t('routing.assignment.limitHint', { count: Number.isFinite(limit) ? limit : 0 }), e.operatorChatLimit?.message)}
              </div>
            </PanelSection>

            <PanelSection title={t('routing.conversation.title')} description={t('routing.conversation.description')}>
              <RowGroup>
                {(
                  [
                    ['typingTransparency', 'typing'],
                    ['requestFeedback', 'feedback'],
                    ['messageNotesEnabled', 'notes'],
                    ['clientIpEnabled', 'ip'],
                  ] as const
                ).map(([name, key]) => (
                  <Controller
                    key={name}
                    control={control}
                    name={name}
                    render={({ field }) => (
                      <Switch labelFirst checked={field.value} onCheckedChange={field.onChange} label={t(`routing.conversation.${key}`)} description={t(`routing.conversation.${key}Hint`)} />
                    )}
                  />
                ))}
                <div className="flex flex-col gap-3">
                  <Controller
                    control={control}
                    name="autoGreetingEnabled"
                    render={({ field }) => (
                      <Switch labelFirst checked={field.value} onCheckedChange={field.onChange} label={t('routing.conversation.greeting')} description={t('routing.conversation.greetingHint')} />
                    )}
                  />
                  {greetingOn ? (
                    <Field error={locError(e.autoGreeting)}>
                      <Controller
                        control={control}
                        name="autoGreeting"
                        render={({ field }) => <LocalizedTextField multiline rows={3} maxLength={500} value={field.value} onChange={field.onChange} invalid={!!e.autoGreeting} />}
                      />
                    </Field>
                  ) : null}
                </div>
              </RowGroup>
              <Field label={t('routing.conversation.banned')} hint={t('routing.conversation.bannedHint')} error={locError(e.bannedMessage)} required>
                <Controller
                  control={control}
                  name="bannedMessage"
                  render={({ field }) => <LocalizedTextField multiline rows={2} maxLength={300} value={field.value} onChange={field.onChange} invalid={!!e.bannedMessage} />}
                />
              </Field>
            </PanelSection>

            <PanelSection title={t('routing.timers.title')} description={t('routing.timers.description')}>
              <div className="grid gap-4 sm:grid-cols-2">
                {number('inactiveWarningMinutes', t('routing.timers.warn'), t('routing.timers.warnHint'), e.inactiveWarningMinutes?.message)}
                {number('inactiveDisconnectMinutes', t('routing.timers.disconnect'), t('routing.timers.disconnectHint'), e.inactiveDisconnectMinutes?.message)}
                {number('operatorResponseMinutes', t('routing.timers.response'), t('routing.timers.responseHint'), e.operatorResponseMinutes?.message)}
                {number('operatorLogoutGraceMinutes', t('routing.timers.grace'), t('routing.timers.graceHint'), e.operatorLogoutGraceMinutes?.message)}
              </div>
            </PanelSection>

            <PanelSection title={t('routing.data.title')} description={t('routing.data.description')}>
              <div className="max-w-xs">
                <Field label={t('routing.data.retention')} hint={t('routing.data.retentionHint')} error={e.chatRetentionDays?.message} htmlFor="routing-retention">
                  <Input
                    id="routing-retention"
                    type="number"
                    inputMode="numeric"
                    invalid={!!e.chatRetentionDays}
                    leftIcon={<Lock className="size-4" strokeWidth={1.75} />}
                    {...register('chatRetentionDays', { valueAsNumber: true })}
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-3 rounded-ui border border-danger/30 bg-danger-soft p-4">
                <div>
                  <p className="text-sm font-medium text-ink">{t('routing.purge.title')}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{t('routing.purge.description')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Field label={t('routing.purge.from')} htmlFor="purge-from">
                    <Input id="purge-from" type="date" max={range.to || undefined} value={range.from} onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))} />
                  </Field>
                  <Field label={t('routing.purge.to')} htmlFor="purge-to">
                    <Input id="purge-to" type="date" min={range.from || undefined} value={range.to} onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))} />
                  </Field>
                  <Button type="button" variant="danger-outline" leftIcon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={askPurge}>
                    {t('routing.purge.action')}
                  </Button>
                </div>
                {rangeError ? (
                  <p role="alert" className="text-[13px] text-danger">
                    {rangeError}
                  </p>
                ) : null}
                {result ? (
                  <dl className="grid grid-cols-3 gap-2 rounded-ui bg-panel p-3 text-center" aria-live="polite">
                    {(['sessions', 'messages', 'files'] as const).map((key) => (
                      <div key={key}>
                        <dd className="font-display text-xl font-semibold text-ink tabular">{formatNumber(result[key])}</dd>
                        <dt className="text-[12px] text-muted">{t(`routing.purge.result.${key}`)}</dt>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </PanelSection>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('routing.data.confirmTitle')}
        description={t('routing.data.confirmDescription', { days: pending?.chatRetentionDays ?? '' })}
        confirmLabel={tc('actions.save')}
        requirePassword
        passwordLabel={t('routing.password')}
        onConfirm={confirmRetention}
      />
      <ConfirmDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        tone="danger"
        title={t('routing.purge.confirmTitle')}
        description={t('routing.purge.confirmDescription', { from: range.from, to: range.to })}
        confirmLabel={t('routing.purge.confirm')}
        requirePassword
        passwordLabel={t('routing.password')}
        onConfirm={runPurge}
      />
    </>
  )
}
