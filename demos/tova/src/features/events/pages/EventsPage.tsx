/** /admin/events (editor): every event, newest start first, with inline visibility toggles, create and delete. */
import { motion } from 'framer-motion'
import { Gamepad2, Gift, ListChecks, Plus, Settings2, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button, Card, EmptyState, ErrorState, InlineConfirm, PageHeader, Skeleton, StatusBadge, Switch, toast, toastError } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import type { EventSummary } from '@/types'
import { useDeleteEvent, useEventsList, useUpdateEvent, type EventPatch } from '../api'
import { EventCreateSheet } from '../components/EventCreateSheet'

type ToggleKey = 'published' | 'awardsVisible' | 'leaderboardVisible'
const TOGGLES: ToggleKey[] = ['published', 'awardsVisible', 'leaderboardVisible']

export default function EventsPage() {
  const { t } = useTranslation('events')
  const { data, isLoading, error, refetch } = useEventsList()
  const [createOpen, setCreateOpen] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)

  const newButton = (
    <Button size="sm" leftIcon={<Plus className="size-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
      {t('list.new')}
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t('list.title')} description={t('list.description')} actions={newButton} />

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-card" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card padding="none">
          <EmptyState title={t('list.emptyTitle')} description={t('list.emptyBody')} action={newButton} />
        </Card>
      ) : (
        <ul className="space-y-3" aria-label={t('list.title')}>
          {data.map((event) => (
            <motion.li key={event.id} layout transition={{ duration: 0.3 }}>
              <EventRow event={event} highlighted={event.id === highlight} />
            </motion.li>
          ))}
        </ul>
      )}

      <EventCreateSheet open={createOpen} onOpenChange={setCreateOpen} onCreated={(event) => setHighlight(event.id)} />
    </div>
  )
}

function EventRow({ event, highlighted }: { event: EventSummary; highlighted: boolean }) {
  const { t } = useTranslation('events')
  const update = useUpdateEvent()
  const remove = useDeleteEvent()
  const manageTo = `/admin/events/${encodeURIComponent(event.id)}`

  const toggle = (key: ToggleKey, value: boolean) => {
    const patch: EventPatch = { [key]: value }
    update.mutate(
      { id: event.id, patch },
      {
        onSuccess: () => toast.success(t(`toasts.${key}.${value ? 'on' : 'off'}`, { name: event.name })),
        onError: (error) => toastError(error),
      },
    )
  }

  const counts = [
    { icon: Snowflake, label: t('counts.items', { count: event.itemCount }) },
    { icon: Gift, label: t('counts.prizes', { count: event.prizeCount }) },
    { icon: ListChecks, label: t('counts.trivia', { count: event.triviaCount }) },
    { icon: Gamepad2, label: t('counts.plays', { count: event.playCount }) },
  ]

  return (
    <Card
      padding="none"
      className={cn('overflow-hidden transition-shadow', highlighted && 'ring-2 ring-accent', event.status === 'open' && 'border-primary')}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <Link to={manageTo} className="min-w-0 font-semibold break-words text-ink hover:text-primary hover:underline">
              {event.name}
            </Link>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 sm:max-w-lg">
            <div className="flex gap-2">
              <dt className="text-muted">{t('fields.startsAtShort')}</dt>
              <dd className="text-ink tabular-nums">{formatDateTime(event.startsAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">{t('fields.endsAtShort')}</dt>
              <dd className="text-ink tabular-nums">{formatDateTime(event.endsAt)}</dd>
            </div>
          </dl>
          <ul className="flex flex-wrap gap-1.5" aria-label={t('list.contents')}>
            {counts.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1 rounded-chip bg-sunken px-2 py-0.5 text-xs text-ink tabular-nums">
                <Icon className="size-3.5 text-muted" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 lg:flex-col lg:gap-2">
          {TOGGLES.map((key) => (
            <Switch
              key={key}
              checked={event[key]}
              onCheckedChange={(value) => toggle(key, value)}
              label={t(`toggles.${key}`)}
              disabled={update.isPending}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-zebra px-4 py-2">
        <Button asChild size="sm" variant="secondary" leftIcon={<Settings2 className="size-4" aria-hidden />}>
          <Link to={manageTo}>{t('list.manage')}</Link>
        </Button>
        <InlineConfirm
          question={event.playCount > 0 ? t('list.deleteQuestionPlays', { count: event.playCount }) : t('list.deleteQuestion')}
          busy={remove.isPending}
          onConfirm={() =>
            remove.mutateAsync(event.id).then(
              () => toast.success(t('toasts.deleted', { name: event.name })),
              (error: unknown) => toastError(error),
            )
          }
        />
      </div>
    </Card>
  )
}
