/** /admin/events/:eventId/trivia: bonus questions for one event. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Check, Clock, Pencil, Plus } from 'lucide-react'

import { Badge, Button, Card, EmptyState, ErrorState, IconButton, InlineConfirm, Skeleton, toast, toastError } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { TriviaQuestion } from '@/types'
import { useContentSync, useTrivia, useTriviaCrud } from '../api'
import { TriviaSheet } from '../components/TriviaSheet'
import { ContentHeader, useCanEdit } from '../components/shared'

const LETTERS = ['A', 'B', 'C', 'D']

export default function TriviaPage() {
  const { eventId = '' } = useParams()
  const { t } = useTranslation('content')
  const canEdit = useCanEdit()
  useContentSync()
  const trivia = useTrivia(eventId)
  const { remove } = useTriviaCrud(eventId)
  const [sheet, setSheet] = useState<{ open: boolean; question: TriviaQuestion | null }>({ open: false, question: null })

  const openCreate = () => setSheet({ open: true, question: null })
  const rows = trivia.data
  const activeRows = rows?.filter((q) => q.active) ?? []
  const totalPoints = activeRows.reduce((sum, q) => sum + q.points, 0)

  const onDelete = async (q: TriviaQuestion) => {
    try {
      await remove.mutateAsync(q.id)
      toast.success(t('trivia.toasts.deleted'))
    } catch (error) {
      toastError(error)
    }
  }

  return (
    <div>
      <ContentHeader
        eventId={eventId}
        title={t('trivia.title')}
        description={t('trivia.description')}
        actions={
          canEdit ? (
            <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
              {t('trivia.add')}
            </Button>
          ) : null
        }
      />

      {trivia.isError ? (
        <ErrorState error={trivia.error} onRetry={() => void trivia.refetch()} />
      ) : !rows ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title={t('trivia.empty.title')}
            description={t('trivia.empty.description')}
            action={
              canEdit ? (
                <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                  {t('trivia.add')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted tabular-nums">
            {t('trivia.summary', { count: activeRows.length, points: formatNumber(totalPoints) })}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {rows.map((q, index) => (
              <li key={q.id} className="animate-drop-in" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
                <Card padding="md" className={cn('flex h-full flex-col gap-3', !q.active && 'opacity-70')}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-chip bg-sunken font-mono text-xs tabular-nums text-muted">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 font-medium leading-snug text-ink">{q.question}</p>
                    {canEdit ? (
                      <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
                        <IconButton
                          label={t('common:actions.edit')}
                          icon={<Pencil className="size-4" />}
                          size="sm"
                          onClick={() => setSheet({ open: true, question: q })}
                        />
                        <InlineConfirm iconOnly question={t('trivia.deleteQuestion')} onConfirm={() => onDelete(q)} />
                      </div>
                    ) : null}
                  </div>
                  <ol className="flex flex-col gap-1.5" aria-label={t('trivia.optionsLabel')}>
                    {q.options.map((option, i) => {
                      const correct = i === q.correctIndex
                      return (
                        <li
                          key={i}
                          className={cn(
                            'flex items-center gap-2 rounded-chip border-[1.5px] px-2.5 py-1.5 text-sm',
                            correct ? 'border-success bg-success-soft text-ink' : 'border-line text-muted',
                          )}
                        >
                          <span className="font-mono text-xs">{LETTERS[i]}</span>
                          <span className="min-w-0 flex-1 break-words">{option}</span>
                          {correct ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                              <Check aria-hidden className="size-3.5" />
                              {t('trivia.correct')}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ol>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    <Badge tone="accent" size="sm">{t('trivia.points', { value: formatNumber(q.points) })}</Badge>
                    <Badge tone="neutral" size="sm" icon={<Clock className="size-3" />}>
                      {t('trivia.seconds', { value: q.seconds })}
                    </Badge>
                    {q.active ? (
                      <Badge tone="success" dot size="sm">{t('state.active')}</Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">{t('state.inactive')}</Badge>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {canEdit ? (
        <TriviaSheet
          eventId={eventId}
          open={sheet.open}
          question={sheet.question}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        />
      ) : null}
    </div>
  )
}
