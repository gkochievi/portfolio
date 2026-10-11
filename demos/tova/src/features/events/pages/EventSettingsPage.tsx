/** /admin/events/:eventId (editor): schedule, fairness caps, difficulty, speed, board size and visibility. */
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check, Gift, ListChecks, Save, Snowflake } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'

import { isApiError } from '@/api/client'
import { Button, Card, CardHeader, Checkbox, EmptyState, ErrorState, Field, Input, PageHeader, Segmented, Skeleton, StatusBadge, toast, toastError } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { Difficulty, EventSummary, SpeedLevel } from '@/types'
import { useEventDetail, useUpdateEvent, type EventPatch } from '../api'
import { fromLocalInput, toLocalInput } from '../lib/datetime'

const int = (key: string, min: number, max: number) =>
  z.coerce.number({ invalid_type_error: key }).int(key).min(min, key).max(max, key)

const schema = z
  .object({
    name: z.string().trim().min(1, 'events:errors.nameRequired').max(120, 'events:errors.nameTooLong'),
    durationSeconds: int('events:errors.duration', 10, 600),
    startsAt: z.string().refine((v) => fromLocalInput(v) !== null, 'events:errors.dateInvalid'),
    endsAt: z.string().refine((v) => fromLocalInput(v) !== null, 'events:errors.dateInvalid'),
    maxGood: int('events:errors.capPositive', 1, 100_000),
    maxBad: int('events:errors.capPositive', 1, 100_000),
    difficulty: z.enum(['easy', 'normal', 'hard']),
    speedLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    leaderboardSize: int('events:errors.boardSize', 1, 100),
    published: z.boolean(),
    awardsVisible: z.boolean(),
    leaderboardVisible: z.boolean(),
  })
  .refine((v) => {
    const start = fromLocalInput(v.startsAt)
    const end = fromLocalInput(v.endsAt)
    return !start || !end || Date.parse(end) > Date.parse(start)
  }, { path: ['endsAt'], message: 'events:errors.endBeforeStart' })

type FormValues = z.input<typeof schema>
type FormOutput = z.output<typeof schema>
type FieldName = keyof FormOutput

const FIELD_NAMES: FieldName[] = [
  'name',
  'durationSeconds',
  'startsAt',
  'endsAt',
  'maxGood',
  'maxBad',
  'difficulty',
  'speedLevel',
  'leaderboardSize',
  'published',
  'awardsVisible',
  'leaderboardVisible',
]

const SPEEDS: { level: SpeedLevel; factor: string }[] = [
  { level: 1, factor: '×1' },
  { level: 2, factor: '×1.5' },
  { level: 3, factor: '×2' },
]

function toForm(event: EventSummary): FormValues {
  return {
    name: event.name,
    durationSeconds: event.durationSeconds,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    maxGood: event.maxGood,
    maxBad: event.maxBad,
    difficulty: event.difficulty,
    speedLevel: event.speedLevel,
    leaderboardSize: event.leaderboardSize,
    published: event.published,
    awardsVisible: event.awardsVisible,
    leaderboardVisible: event.leaderboardVisible,
  }
}

export default function EventSettingsPage() {
  const { t } = useTranslation('events')
  const { eventId } = useParams<{ eventId: string }>()
  const { data, isLoading, error, refetch } = useEventDetail(eventId)

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    )
  }
  if (error || !data) {
    const missing = isApiError(error) && error.status === 404
    return (
      <div className="space-y-6">
        <PageHeader title={t('settings.title')} back={{ to: '/admin/events', label: t('settings.back') }} />
        {missing ? (
          <Card padding="none">
            <EmptyState
              title={t('settings.missingTitle')}
              description={t('settings.missingBody')}
              action={
                <Button asChild size="sm">
                  <Link to="/admin/events">{t('settings.back')}</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} />
        )}
      </div>
    )
  }
  return <SettingsForm key={data.id} event={data} />
}

function SettingsForm({ event }: { event: EventSummary }) {
  const { t } = useTranslation('events')
  const update = useUpdateEvent()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const form = useForm<FormValues, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: toForm(event) })
  const { errors, isDirty } = form.formState

  // Follow background changes (another tab, the list toggles) while there are no unsaved edits.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toForm(event))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.updatedAt])

  useEffect(() => {
    if (savedAt === null) return
    const id = window.setTimeout(() => setSavedAt(null), 2500)
    return () => window.clearTimeout(id)
  }, [savedAt])

  const maxGood = Number(form.watch('maxGood')) || 0
  const maxBad = Number(form.watch('maxBad')) || 0

  const onSubmit = form.handleSubmit(async (values) => {
    const patch: EventPatch = {
      ...values,
      startsAt: fromLocalInput(values.startsAt) ?? event.startsAt,
      endsAt: fromLocalInput(values.endsAt) ?? event.endsAt,
    }
    try {
      const saved = await update.mutateAsync({ id: event.id, patch })
      form.reset(toForm(saved))
      setSavedAt(Date.now())
      toast.success(t('toasts.saved', { name: saved.name }))
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fieldErrors).length > 0) {
        for (const field of FIELD_NAMES) {
          const message = error.fieldErrors[field]?.[0]
          if (message) form.setError(field, { message })
        }
      }
      toastError(error)
    }
  })

  const base = `/admin/events/${encodeURIComponent(event.id)}`
  const links = [
    { to: `${base}/items`, icon: Snowflake, title: t('settings.links.items'), count: t('counts.items', { count: event.itemCount }) },
    { to: `${base}/trivia`, icon: ListChecks, title: t('settings.links.trivia'), count: t('counts.trivia', { count: event.triviaCount }) },
    { to: `${base}/prizes`, icon: Gift, title: t('settings.links.prizes'), count: t('counts.prizes', { count: event.prizeCount }) },
  ]

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6 pb-24">
      <PageHeader
        back={{ to: '/admin/events', label: t('settings.back') }}
        eyebrow={t('settings.eyebrow')}
        title={<span className="break-words">{event.name}</span>}
        description={t('window', { start: formatDateTime(event.startsAt), end: formatDateTime(event.endsAt) })}
        actions={<StatusBadge status={event.status} />}
      />

      <nav aria-label={t('settings.links.label')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group flex items-center gap-3 rounded-card border border-line bg-panel p-3 shadow-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="grid size-9 place-items-center rounded-chip bg-primary-soft text-primary">
              <link.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{link.title}</span>
              <span className="block text-sm text-muted tabular-nums">{link.count}</span>
            </span>
            <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </nav>

      <Card padding="lg" className="space-y-4">
        <CardHeader title={t('settings.schedule.title')} description={t('settings.schedule.description')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('fields.name')} htmlFor="es-name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="es-name" autoComplete="off" invalid={Boolean(errors.name)} {...form.register('name')} />
          </Field>
          <Field label={t('fields.duration')} htmlFor="es-duration" hint={t('fields.durationHint')} error={errors.durationSeconds?.message} required>
            <Input
              id="es-duration"
              type="number"
              inputMode="numeric"
              min={10}
              max={600}
              trailing={<span className="text-sm text-muted">{t('common:units.seconds')}</span>}
              invalid={Boolean(errors.durationSeconds)}
              {...form.register('durationSeconds')}
            />
          </Field>
          <div className="hidden sm:block" />
          <Field label={t('fields.startsAt')} htmlFor="es-start" error={errors.startsAt?.message} required>
            <Input id="es-start" type="datetime-local" invalid={Boolean(errors.startsAt)} {...form.register('startsAt')} />
          </Field>
          <Field label={t('fields.endsAt')} htmlFor="es-end" error={errors.endsAt?.message} required>
            <Input id="es-end" type="datetime-local" invalid={Boolean(errors.endsAt)} {...form.register('endsAt')} />
          </Field>
        </div>
      </Card>

      <Card padding="lg" className="space-y-4">
        <CardHeader title={t('settings.fairness.title')} description={t('settings.fairness.description')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('fields.maxGood')} htmlFor="es-good" hint={t('fields.maxGoodHint')} error={errors.maxGood?.message} required>
            <Input
              id="es-good"
              type="number"
              inputMode="numeric"
              min={1}
              trailing={<span className="text-sm text-muted">{t('common:units.points')}</span>}
              invalid={Boolean(errors.maxGood)}
              {...form.register('maxGood')}
            />
          </Field>
          <Field label={t('fields.maxBad')} htmlFor="es-bad" hint={t('fields.maxBadHint')} error={errors.maxBad?.message} required>
            <Input
              id="es-bad"
              type="number"
              inputMode="numeric"
              min={1}
              trailing={<span className="text-sm text-muted">{t('common:units.points')}</span>}
              invalid={Boolean(errors.maxBad)}
              {...form.register('maxBad')}
            />
          </Field>
        </div>
        <p className="rounded-card bg-primary-soft p-3 text-sm text-ink">
          {t('settings.fairness.note', { good: formatNumber(maxGood), bad: formatNumber(maxBad) })}
        </p>
        <Field label={t('fields.difficulty')} hint={t('settings.fairness.difficultyHint')}>
          {() => (
            <Controller
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <Segmented<Difficulty>
                  aria-label={t('fields.difficulty')}
                  value={field.value}
                  onChange={field.onChange}
                  block
                  options={(['easy', 'normal', 'hard'] as const).map((value) => ({ value, label: t(`common:difficulty.${value}`) }))}
                />
              )}
            />
          )}
        </Field>
      </Card>

      <Card padding="lg" className="space-y-4">
        <CardHeader title={t('settings.speed.title')} description={t('settings.speed.description')} />
        <Controller
          control={form.control}
          name="speedLevel"
          render={({ field }) => (
            <div role="radiogroup" aria-label={t('settings.speed.title')} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SPEEDS.map(({ level, factor }) => {
                const selected = field.value === level
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => field.onChange(level)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-card border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      selected ? 'border-primary bg-primary-soft' : 'border-line bg-panel hover:border-primary/60',
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-sm font-medium text-muted">{t('settings.speed.level', { level })}</span>
                      {selected && <Check className="size-4 text-primary" aria-hidden />}
                    </span>
                    <span className="font-mono text-2xl font-bold text-ink tabular-nums">{factor}</span>
                    <span className="text-sm text-muted">{t(`settings.speed.caption${level}`)}</span>
                  </button>
                )
              })}
            </div>
          )}
        />
      </Card>

      <Card padding="lg" className="space-y-4">
        <CardHeader title={t('settings.visibility.title')} description={t('settings.visibility.description')} />
        <Field label={t('fields.leaderboardSize')} htmlFor="es-size" hint={t('fields.leaderboardSizeHint')} error={errors.leaderboardSize?.message} className="sm:max-w-xs">
          <Input id="es-size" type="number" inputMode="numeric" min={1} max={100} invalid={Boolean(errors.leaderboardSize)} {...form.register('leaderboardSize')} />
        </Field>
        <div className="space-y-3">
          <Checkbox label={t('toggles.published')} description={t('toggles.publishedHint')} {...form.register('published')} />
          <Checkbox label={t('toggles.leaderboardVisible')} description={t('toggles.leaderboardVisibleHint')} {...form.register('leaderboardVisible')} />
          <Checkbox label={t('toggles.awardsVisible')} description={t('toggles.awardsVisibleHint')} {...form.register('awardsVisible')} />
        </div>
        {event.notifiedAt && (
          <p className="rounded-card bg-sunken p-3 text-sm text-muted">
            {t('settings.visibility.notified', { when: formatDateTime(event.notifiedAt) })}
          </p>
        )}
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface/95 px-4 py-3 sm:mx-0 sm:rounded-card sm:border">
        <span className="mr-auto text-sm text-muted" aria-live="polite">
          {savedAt !== null ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <Check className="size-4" aria-hidden />
              {t('settings.saved')}
            </span>
          ) : isDirty ? (
            t('settings.unsaved')
          ) : (
            t('settings.updated', { when: formatDateTime(event.updatedAt) })
          )}
        </span>
        <Button variant="ghost" size="sm" disabled={!isDirty || update.isPending} onClick={() => form.reset(toForm(event))}>
          {t('settings.discard')}
        </Button>
        <Button type="submit" size="sm" loading={update.isPending} leftIcon={<Save className="size-4" aria-hidden />}>
          {t('common:actions.saveChanges')}
        </Button>
      </div>
    </form>
  )
}
