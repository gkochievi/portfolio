/** /admin/settings - dialer pacing, wrap-up and working-hours rules shared by every campaign. */
import { Clock, Gauge, Hourglass } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Field, Input, LoadingBlock, PageHeader, Panel } from '@/components/ui'
import { cn } from '@/lib/cn'
import { toast } from '@/lib/toast'
import type { SystemSettings } from '@/types'

import { useSaveSettings, useSettings } from '../api'
import { LoadError, ReadOnlyNote, useCanEdit, useFieldErrors, useToastError } from '../components/shared'

interface FormState {
  base: string
  max: string
  min: string
  abandon: string
  wrapDefault: string
  wrapMax: string
  start: string
  end: string
  days: number[]
}

type TextKey = Exclude<keyof FormState, 'days'>

const toForm = (s: SystemSettings): FormState => ({
  base: String(s.dialer.baseDialRatio),
  max: String(s.dialer.maxDialRatio),
  min: String(s.dialer.minDialRatio),
  abandon: String(s.dialer.targetAbandonRate),
  wrapDefault: String(s.wrapup.defaultWrapupTime),
  wrapMax: String(s.wrapup.maxWrapupTime),
  start: s.workingHours.startTime,
  end: s.workingHours.endTime,
  days: [...s.workingHours.workingDays].sort(),
})

const DAYS = [1, 2, 3, 4, 5, 6, 7]

function SettingsForm({ settings, canEdit }: { settings: SystemSettings; canEdit: boolean }) {
  const { t } = useTranslation('config')
  const { t: tc } = useTranslation()
  const save = useSaveSettings()
  const mapErrors = useFieldErrors()
  const toastError = useToastError()
  const [form, setForm] = useState<FormState>(() => toForm(settings))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const saved = useMemo(() => JSON.stringify(toForm(settings)), [settings])
  const dirty = JSON.stringify(form) !== saved

  // Pick up the server copy whenever it changes (after a save, or from another tab).
  useEffect(() => {
    setForm(toForm(settings))
    setErrors({})
  }, [settings])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggleDay = (day: number) => set('days', form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day].sort())

  const validate = (): SystemSettings | null => {
    const next: Record<string, string> = {}
    const ratio = (value: string, key: string) => {
      const n = Number(value)
      if (value.trim() === '' || !Number.isFinite(n) || n < 1 || n > 5) next[key] = t('server.ratioRange')
      return n
    }
    const min = ratio(form.min, 'dialer.minDialRatio')
    const base = ratio(form.base, 'dialer.baseDialRatio')
    const max = ratio(form.max, 'dialer.maxDialRatio')
    if (!next['dialer.minDialRatio'] && !next['dialer.baseDialRatio'] && min > base) next['dialer.minDialRatio'] = t('server.minAboveBase')
    if (!next['dialer.baseDialRatio'] && !next['dialer.maxDialRatio'] && base > max) next['dialer.maxDialRatio'] = t('server.maxBelowBase')
    const abandon = Number(form.abandon)
    if (form.abandon.trim() === '' || !Number.isFinite(abandon) || abandon < 0 || abandon > 100) next['dialer.targetAbandonRate'] = t('server.abandonRange')
    const wrap = (value: string, key: string) => {
      const n = Number(value)
      if (value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 3600) next[key] = t('server.wrapRange')
      return n
    }
    const wDefault = wrap(form.wrapDefault, 'wrapup.defaultWrapupTime')
    const wMax = wrap(form.wrapMax, 'wrapup.maxWrapupTime')
    if (!next['wrapup.defaultWrapupTime'] && !next['wrapup.maxWrapupTime'] && wDefault > wMax) next['wrapup.maxWrapupTime'] = t('server.wrapMaxBelow')
    if (!form.start) next['workingHours.startTime'] = t('server.timeFormat')
    if (!form.end) next['workingHours.endTime'] = t('server.timeFormat')
    else if (form.start && form.end <= form.start) next['workingHours.endTime'] = t('server.endBeforeStart')
    if (form.days.length === 0) next['workingHours.workingDays'] = t('server.pickDay')
    setErrors(next)
    if (Object.keys(next).length) return null
    return {
      dialer: { baseDialRatio: base, maxDialRatio: max, minDialRatio: min, targetAbandonRate: abandon },
      wrapup: { defaultWrapupTime: wDefault, maxWrapupTime: wMax },
      workingHours: { startTime: form.start, endTime: form.end, workingDays: form.days },
    }
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!canEdit) return
    const payload = validate()
    if (!payload) return
    save.mutate(payload, {
      onSuccess: () => toast.success(t('settings.saved')),
      onError: (error) => {
        const fields = mapErrors(error)
        if (Object.keys(fields).length) setErrors(fields)
        else toastError(error)
      },
    })
  }

  const numberInput = (id: string, key: TextKey, errorKey: string, props: { step: number; min: number; max: number }) => (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      mono
      {...props}
      disabled={!canEdit}
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      invalid={Boolean(errors[errorKey])}
    />
  )

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2" noValidate>
      <Panel title={t('settings.dialer.title')} description={t('settings.dialer.description')} icon={<Gauge size={18} strokeWidth={1.75} />} className="lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('settings.dialer.min')} error={errors['dialer.minDialRatio']} htmlFor="ds-min">
            {numberInput('ds-min', 'min', 'dialer.minDialRatio', { step: 0.1, min: 1, max: 5 })}
          </Field>
          <Field label={t('settings.dialer.base')} error={errors['dialer.baseDialRatio']} htmlFor="ds-base">
            {numberInput('ds-base', 'base', 'dialer.baseDialRatio', { step: 0.1, min: 1, max: 5 })}
          </Field>
          <Field label={t('settings.dialer.max')} error={errors['dialer.maxDialRatio']} htmlFor="ds-max">
            {numberInput('ds-max', 'max', 'dialer.maxDialRatio', { step: 0.1, min: 1, max: 5 })}
          </Field>
          <Field label={t('settings.dialer.abandon')} error={errors['dialer.targetAbandonRate']} htmlFor="ds-abandon">
            {numberInput('ds-abandon', 'abandon', 'dialer.targetAbandonRate', { step: 0.5, min: 0, max: 100 })}
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          {t('settings.dialer.ratioHint')} · {t('settings.dialer.abandonHint')}
        </p>
      </Panel>

      <Panel title={t('settings.wrapup.title')} description={t('settings.wrapup.description')} icon={<Hourglass size={18} strokeWidth={1.75} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.wrapup.default')} error={errors['wrapup.defaultWrapupTime']} htmlFor="ds-wrap-default">
            {numberInput('ds-wrap-default', 'wrapDefault', 'wrapup.defaultWrapupTime', { step: 1, min: 0, max: 3600 })}
          </Field>
          <Field label={t('settings.wrapup.max')} error={errors['wrapup.maxWrapupTime']} htmlFor="ds-wrap-max">
            {numberInput('ds-wrap-max', 'wrapMax', 'wrapup.maxWrapupTime', { step: 1, min: 0, max: 3600 })}
          </Field>
        </div>
      </Panel>

      <Panel title={t('settings.hours.title')} description={t('settings.hours.description')} icon={<Clock size={18} strokeWidth={1.75} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.hours.start')} error={errors['workingHours.startTime']} htmlFor="ds-start">
            <Input id="ds-start" type="time" mono disabled={!canEdit} value={form.start} onChange={(e) => set('start', e.target.value)} invalid={Boolean(errors['workingHours.startTime'])} />
          </Field>
          <Field label={t('settings.hours.end')} error={errors['workingHours.endTime']} htmlFor="ds-end">
            <Input id="ds-end" type="time" mono disabled={!canEdit} value={form.end} onChange={(e) => set('end', e.target.value)} invalid={Boolean(errors['workingHours.endTime'])} />
          </Field>
          <Field label={t('settings.hours.days')} error={errors['workingHours.workingDays']} className="sm:col-span-2">
            <div role="group" aria-label={t('settings.hours.days')} className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => {
                const on = form.days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    disabled={!canEdit}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'h-9 min-w-12 rounded-control border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      on
                        ? 'border-carbon bg-carbon text-on-carbon dark:border-lime dark:bg-lime dark:text-on-lime'
                        : 'border-hairline-strong bg-panel text-muted hover:bg-sunken hover:text-ink',
                    )}
                  >
                    {t(`settings.days.${day}`)}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>
      </Panel>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
          {dirty && <span className="text-sm text-muted">{t('shared.unsaved')}</span>}
          <Button
            variant="ghost"
            disabled={!dirty || save.isPending}
            onClick={() => {
              setForm(toForm(settings))
              setErrors({})
            }}
          >
            {t('settings.discard')}
          </Button>
          <Button type="submit" variant="dial" loading={save.isPending} disabled={!dirty}>
            {tc('actions.save')}
          </Button>
        </div>
      )}
    </form>
  )
}

export default function DialerSettingsPage() {
  const { t } = useTranslation('config')
  const canEdit = useCanEdit()
  const query = useSettings()
  return (
    <section>
      <PageHeader eyebrow={t('eyebrow')} title={t('pages.DialerSettingsPage')} description={t('settings.description')} />
      {!canEdit && <ReadOnlyNote />}
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <SettingsForm settings={query.data} canEdit={canEdit} />
      ) : (
        <LoadingBlock />
      )}
    </section>
  )
}
