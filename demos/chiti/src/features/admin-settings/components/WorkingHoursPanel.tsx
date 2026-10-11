import { zodResolver } from '@hookform/resolvers/zod'
import { Clock, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ErrorState, Field, IconButton, Input, LocalizedTextField, Modal, Pill, SegmentedControl, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { WorkingHoursStatus } from '@/types'

import { useSaveWorkingHours, useWorkingHours } from '../api'
import { cleanText, isoToTbilisiLocal, localizedSchema, locError, PanelSection, tbilisiLocalToIso, textValue, useSettingsErrors } from '../shared'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const FORM_ID = 'hours-form'

type Tab = 'schedule' | 'closure' | 'messages'

interface FormValues {
  weeklySchedule: { day: number; enabled: boolean; start: string; end: string }[]
  demoOverride: 'auto' | 'open' | 'closed'
  isTemporarilyClosed: boolean
  closedFrom: string
  closedUntil: string
  closedMessage: { ka: string; en: string; ru?: string }
  nextMessage: { ka: string; en: string; ru?: string }
}

/** Open / Closed pill plus the reason line; shared with the hub card. */
export function HoursStatus({ status, className }: { status: WorkingHoursStatus; className?: string }) {
  const { t } = useTranslation('adminSettings')
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <Pill tone={status.isOpen ? 'success' : 'danger'} dot>
        {status.isOpen ? t('hours.open') : t('hours.closed')}
      </Pill>
      <span className="text-[13px] text-muted">{t(`hours.reason.${status.reason}`)}</span>
    </span>
  )
}

export function WorkingHoursPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const query = useWorkingHours()
  const save = useSaveWorkingHours()
  const errors = useSettingsErrors()
  const [tab, setTab] = useState<Tab>('schedule')

  const schema = useMemo(() => {
    const day = z
      .object({ day: z.number(), enabled: z.boolean(), start: z.string(), end: z.string() })
      .superRefine((value, ctx) => {
        if (!value.enabled) return
        if (!TIME.test(value.start)) ctx.addIssue({ code: 'custom', path: ['start'], message: t('validation.time') })
        if (!TIME.test(value.end)) ctx.addIssue({ code: 'custom', path: ['end'], message: t('validation.time') })
        else if (TIME.test(value.start) && value.start >= value.end) ctx.addIssue({ code: 'custom', path: ['end'], message: t('hours.errors.afterStart') })
      })
    return z
      .object({
        weeklySchedule: z.array(day).length(7),
        demoOverride: z.enum(['auto', 'open', 'closed']),
        isTemporarilyClosed: z.boolean(),
        closedFrom: z.string(),
        closedUntil: z.string(),
        closedMessage: localizedSchema(t, [], 400),
        nextMessage: localizedSchema(t, ['ka', 'en'], 400),
      })
      .superRefine((value, ctx) => {
        if (value.isTemporarilyClosed) {
          if (!value.closedFrom) ctx.addIssue({ code: 'custom', path: ['closedFrom'], message: t('validation.required') })
          if (!value.closedUntil) ctx.addIssue({ code: 'custom', path: ['closedUntil'], message: t('validation.required') })
          if (value.closedFrom && value.closedUntil && value.closedUntil <= value.closedFrom) {
            ctx.addIssue({ code: 'custom', path: ['closedUntil'], message: t('hours.errors.afterFrom') })
          }
          for (const lang of ['ka', 'en'] as const) {
            if (!value.closedMessage[lang].trim()) ctx.addIssue({ code: 'custom', path: ['closedMessage', lang], message: t('validation.required') })
          }
        }
      })
  }, [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      weeklySchedule: WEEK_ORDER.map((day) => ({ day, enabled: false, start: '09:00', end: '18:00' })),
      demoOverride: 'auto',
      isTemporarilyClosed: false,
      closedFrom: '',
      closedUntil: '',
      closedMessage: { ka: '', en: '' },
      nextMessage: { ka: '', en: '' },
    },
  })
  const { control, register, handleSubmit, reset, watch, setValue, formState } = form

  // Fill the form once the data arrives (never again, so typing is not overwritten by live refreshes).
  const [loaded, setLoaded] = useState(false)
  const hours = query.data?.hours
  useEffect(() => {
    if (!hours || loaded) return
    reset({
      weeklySchedule: WEEK_ORDER.map((day) => {
        const row = hours.weeklySchedule.find((item) => item.day === day)
        return { day, enabled: row?.enabled ?? false, start: row?.start ?? '09:00', end: row?.end ?? '18:00' }
      }),
      demoOverride: hours.demoOverride,
      isTemporarilyClosed: hours.isTemporarilyClosed,
      closedFrom: isoToTbilisiLocal(hours.temporaryClosedFrom),
      closedUntil: isoToTbilisiLocal(hours.temporaryClosedUntil),
      closedMessage: textValue(hours.temporaryClosedMessage),
      nextMessage: textValue(hours.nextAvailableMessage),
    })
    setLoaded(true)
  }, [hours, loaded, reset])

  const days = watch('weeklySchedule')
  const closed = watch('isTemporarilyClosed')
  const e = formState.errors
  const scheduleBad = !!e.weeklySchedule
  const closureBad = !!(e.closedFrom || e.closedUntil || e.closedMessage)
  const messagesBad = !!e.nextMessage

  const submit = handleSubmit(
    async (values) => {
      try {
        await save.mutateAsync({
          weeklySchedule: values.weeklySchedule.map((row) => ({ ...row, start: TIME.test(row.start) ? row.start : '09:00', end: TIME.test(row.end) ? row.end : '18:00' })),
          demoOverride: values.demoOverride,
          isTemporarilyClosed: values.isTemporarilyClosed,
          temporaryClosedFrom: tbilisiLocalToIso(values.closedFrom),
          temporaryClosedUntil: tbilisiLocalToIso(values.closedUntil),
          temporaryClosedMessage: cleanText(values.closedMessage),
          nextAvailableMessage: cleanText(values.nextMessage),
        })
        toast.success(t('hours.saved'))
        onClose()
      } catch (error) {
        toast.error(errors.text(error))
      }
    },
    (invalid) => {
      if (invalid.weeklySchedule) setTab('schedule')
      else if (invalid.closedFrom || invalid.closedUntil || invalid.closedMessage) setTab('closure')
      else setTab('messages')
    },
  )

  const copyToAll = (index: number) => {
    const source = days[index]
    if (!source) return
    days.forEach((_, i) => {
      if (i === index) return
      setValue(`weeklySchedule.${i}.start`, source.start, { shouldDirty: true })
      setValue(`weeklySchedule.${i}.end`, source.end, { shouldDirty: true })
    })
    toast.success(t('hours.copied', { day: tc(`weekday.${source.day}`) }))
  }

  const dot = (bad: boolean) => (bad ? <span aria-label={t('validation.hasErrors')} className="ml-1.5 inline-block size-1.5 rounded-full bg-danger" /> : null)

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={t('hours.title')}
      description={t('hours.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={save.isPending} disabled={!loaded}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      {query.isError ? (
        <ErrorState title={t('hours.loadError')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
      ) : !loaded ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-9 w-64" />
          {WEEK_ORDER.map((day) => (
            <Skeleton key={day} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui bg-sunken px-3 py-2.5">
            {query.data ? <HoursStatus status={query.data.status} /> : null}
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
              <Clock className="size-4" strokeWidth={1.75} />
              {t('hours.timezone')}
            </span>
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} variant="underline">
            <TabsList>
              <TabsTrigger value="schedule">
                {t('hours.tabs.schedule')}
                {dot(scheduleBad)}
              </TabsTrigger>
              <TabsTrigger value="closure">
                {t('hours.tabs.closure')}
                {dot(closureBad)}
              </TabsTrigger>
              <TabsTrigger value="messages">
                {t('hours.tabs.messages')}
                {dot(messagesBad)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="mt-4 flex flex-col gap-5">
              <ul className="divide-y divide-line rounded-ui border border-line bg-panel">
                {days.map((row, index) => {
                  const dayErrors = e.weeklySchedule?.[index]
                  return (
                    <li key={row.day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                      <div className="flex min-w-[9.5rem] flex-1 items-center gap-3">
                        <Controller
                          control={control}
                          name={`weeklySchedule.${index}.enabled`}
                          render={({ field }) => <Switch size="sm" checked={field.value} onCheckedChange={field.onChange} aria-label={tc(`weekday.${row.day}`)} />}
                        />
                        <span className={cn('text-sm', row.enabled ? 'font-medium text-ink' : 'text-muted')}>{tc(`weekday.${row.day}`)}</span>
                        {!row.enabled ? <span className="text-[13px] text-muted">{t('hours.dayOff')}</span> : null}
                      </div>
                      {row.enabled ? (
                        <div className="flex items-center gap-2">
                          <Input type="time" size="sm" className="w-[7.5rem]" aria-label={t('hours.from')} invalid={!!dayErrors?.start} {...register(`weeklySchedule.${index}.start`)} />
                          <span className="text-muted" aria-hidden>
                            –
                          </span>
                          <Input type="time" size="sm" className="w-[7.5rem]" aria-label={t('hours.to')} invalid={!!dayErrors?.end} {...register(`weeklySchedule.${index}.end`)} />
                          <IconButton label={t('hours.copyToAll')} size="sm" variant="ghost" icon={<Copy strokeWidth={1.75} />} onClick={() => copyToAll(index)} />
                        </div>
                      ) : null}
                      {dayErrors?.start?.message || dayErrors?.end?.message ? (
                        <p role="alert" className="basis-full text-[13px] text-danger">
                          {dayErrors.end?.message ?? dayErrors.start?.message}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              <PanelSection title={t('hours.override.title')} description={t('hours.override.description')}>
                <Controller
                  control={control}
                  name="demoOverride"
                  render={({ field }) => (
                    <SegmentedControl
                      aria-label={t('hours.override.title')}
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'auto', label: t('hours.override.auto') },
                        { value: 'open', label: t('hours.override.open') },
                        { value: 'closed', label: t('hours.override.closed') },
                      ]}
                    />
                  )}
                />
              </PanelSection>
            </TabsContent>

            <TabsContent value="closure" className="mt-4 flex flex-col gap-4">
              <Controller
                control={control}
                name="isTemporarilyClosed"
                render={({ field }) => (
                  <Switch labelFirst checked={field.value} onCheckedChange={field.onChange} label={t('hours.closure.toggle')} description={t('hours.closure.toggleHint')} />
                )}
              />
              <div className={cn('grid gap-4 sm:grid-cols-2', !closed && 'opacity-60')}>
                <Field label={t('hours.closure.from')} htmlFor="closed-from" error={e.closedFrom?.message}>
                  <Input id="closed-from" type="datetime-local" disabled={!closed} invalid={!!e.closedFrom} {...register('closedFrom')} />
                </Field>
                <Field label={t('hours.closure.until')} htmlFor="closed-until" error={e.closedUntil?.message}>
                  <Input id="closed-until" type="datetime-local" disabled={!closed} invalid={!!e.closedUntil} {...register('closedUntil')} />
                </Field>
              </div>
              <Field label={t('hours.closure.message')} hint={t('hours.closure.messageHint')} error={locError(e.closedMessage)}>
                <Controller
                  control={control}
                  name="closedMessage"
                  render={({ field }) => <LocalizedTextField multiline rows={3} maxLength={400} value={field.value} onChange={field.onChange} invalid={!!e.closedMessage} />}
                />
              </Field>
            </TabsContent>

            <TabsContent value="messages" className="mt-4 flex flex-col gap-4">
              <Field label={t('hours.messages.next')} hint={t('hours.messages.nextHint')} error={locError(e.nextMessage)}>
                <Controller
                  control={control}
                  name="nextMessage"
                  render={({ field }) => <LocalizedTextField multiline rows={3} maxLength={400} value={field.value} onChange={field.onChange} invalid={!!e.nextMessage} />}
                />
              </Field>
            </TabsContent>
          </Tabs>
        </form>
      )}
    </Modal>
  )
}
