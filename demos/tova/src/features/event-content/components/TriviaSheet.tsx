/** Create / edit a trivia question: text, four options with a radio for the correct one, points, seconds, active. */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button, Field, Input, SideSheet, Switch, Textarea, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { TriviaQuestion } from '@/types'
import { useTriviaCrud } from '../api'
import { applyServerErrors } from './shared'

const num = (key: string) => z.number({ invalid_type_error: key, required_error: key }).int(key)

const schema = z
  .object({
    question: z.string().trim().min(1, 'content:errors.questionRequired').max(300, 'content:errors.questionTooLong'),
    options: z.array(z.string().max(120, 'content:errors.optionTooLong')).length(4),
    correctIndex: z.number().int().min(0).max(3),
    points: num('content:errors.triviaPointsRange').min(1, 'content:errors.triviaPointsRange').max(10000, 'content:errors.triviaPointsRange'),
    seconds: num('content:errors.secondsRange').min(5, 'content:errors.secondsRange').max(120, 'content:errors.secondsRange'),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const filled = values.options.filter((o) => o.trim()).length
    if (filled < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'content:errors.optionsMin' })
    else if (!values.options[values.correctIndex]?.trim())
      ctx.addIssue({ code: 'custom', path: ['correctIndex'], message: 'content:errors.correctEmpty' })
  })
type FormValues = z.infer<typeof schema>
const FIELDS = ['question', 'options', 'correctIndex', 'points', 'seconds', 'active'] as const

const blank: FormValues = { question: '', options: ['', '', '', ''], correctIndex: 0, points: 20, seconds: 20, active: true }

const toForm = (q: TriviaQuestion): FormValues => ({
  question: q.question,
  options: [0, 1, 2, 3].map((i) => q.options[i] ?? ''),
  correctIndex: q.correctIndex,
  points: q.points,
  seconds: q.seconds,
  active: q.active,
})

export function TriviaSheet({
  eventId,
  open,
  question,
  onOpenChange,
}: {
  eventId: string
  open: boolean
  question: TriviaQuestion | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('content')
  const { save } = useTriviaCrud(eventId)
  const { register, control, handleSubmit, reset, setError, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: blank,
  })
  const { errors } = formState

  useEffect(() => {
    if (open) reset(question ? toForm(question) : blank)
  }, [open, question, reset])

  const correctIndex = watch('correctIndex')

  const onSubmit = handleSubmit((values) => {
    // Drop blank inputs; re-point the correct answer at its new position.
    const kept = values.options.map((text, index) => ({ text: text.trim(), index })).filter((o) => o.text)
    const input = {
      question: values.question,
      options: kept.map((o) => o.text),
      correctIndex: Math.max(0, kept.findIndex((o) => o.index === values.correctIndex)),
      points: values.points,
      seconds: values.seconds,
      active: values.active,
    }
    save.mutate(
      { id: question?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(t(question ? 'trivia.toasts.updated' : 'trivia.toasts.created'))
          onOpenChange(false)
        },
        onError: (error) => applyServerErrors(error, setError, FIELDS),
      },
    )
  })

  const optionsError = errors.options?.message ?? errors.options?.root?.message ?? errors.correctIndex?.message

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={question ? t('trivia.sheet.editTitle') : t('trivia.sheet.createTitle')}
      description={t('trivia.sheet.description')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="trivia-form" loading={save.isPending}>
            {question ? t('common:actions.saveChanges') : t('trivia.add')}
          </Button>
        </div>
      }
    >
      <form id="trivia-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label={t('trivia.fields.question')} htmlFor="trivia-question" error={errors.question?.message} required>
          <Textarea id="trivia-question" rows={3} placeholder={t('trivia.fields.questionPlaceholder')} invalid={!!errors.question} {...register('question')} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t('trivia.fields.options')}</legend>
          <p className="-mt-1 mb-1 text-xs text-muted">{t('trivia.fields.optionsHint')}</p>
          <Controller
            control={control}
            name="correctIndex"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('trivia.fields.correct')} className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const isCorrect = field.value === i
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-card border-[1.5px] p-1.5 pl-2.5 transition-colors',
                        isCorrect ? 'border-success bg-success-soft' : 'border-line bg-panel',
                      )}
                    >
                      <input
                        type="radio"
                        name="trivia-correct"
                        checked={isCorrect}
                        onChange={() => field.onChange(i)}
                        aria-label={t('trivia.fields.markCorrect', { n: i + 1 })}
                        className="size-4 shrink-0 accent-[var(--color-success)]"
                      />
                      <Input
                        inputSize="sm"
                        className="min-w-0 flex-1"
                        placeholder={t('trivia.fields.option', { n: i + 1 })}
                        aria-label={t('trivia.fields.option', { n: i + 1 })}
                        {...register(`options.${i}` as const)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          />
          {optionsError ? (
            <p role="alert" className="text-sm text-danger">{t(optionsError)}</p>
          ) : (
            <p className="text-xs text-muted">{t('trivia.fields.correctHint', { n: correctIndex + 1 })}</p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('trivia.fields.points')} htmlFor="trivia-points" error={errors.points?.message} required>
            <Input id="trivia-points" type="number" inputMode="numeric" min={1} step={1} className="font-mono tabular-nums" invalid={!!errors.points} {...register('points', { valueAsNumber: true })} />
          </Field>
          <Field label={t('trivia.fields.seconds')} htmlFor="trivia-seconds" hint={t('trivia.fields.secondsHint')} error={errors.seconds?.message} required>
            <Input id="trivia-seconds" type="number" inputMode="numeric" min={5} max={120} step={1} className="font-mono tabular-nums" invalid={!!errors.seconds} {...register('seconds', { valueAsNumber: true })} />
          </Field>
        </div>

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} label={t('trivia.fields.active')} description={t('trivia.fields.activeHint')} />
          )}
        />
      </form>
    </SideSheet>
  )
}
