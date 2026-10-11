/** The board's live strip: status badge, last-updated time and the countdown to the event's end. */
import { useQueryClient } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { queryKeys } from '@/api/queryKeys'
import { Badge, Countdown } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/format'
import type { GameEvent } from '@/types'

export type BoardStatusKind = 'upcoming' | 'open' | 'closed'

/** Display status of a published event, from its window. */
export function boardStatus(event: GameEvent, now: number = Date.now()): BoardStatusKind {
  if (now < Date.parse(event.startsAt)) return 'upcoming'
  if (now > Date.parse(event.endsAt)) return 'closed'
  return 'open'
}

export function StatusPill({ event }: { event: GameEvent }) {
  const { t } = useTranslation('standings')
  const status = boardStatus(event)
  if (status === 'open')
    return (
      <Badge tone="success" dot pulse>
        {t('status.open')}
      </Badge>
    )
  return <Badge tone={status === 'upcoming' ? 'info' : 'neutral'}>{t(`status.${status}`)}</Badge>
}

export function UpdatedAt({ at, className }: { at: string | undefined; className?: string }) {
  const { t, i18n } = useTranslation('standings')
  if (!at) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-muted', className)} title={t('refreshNote')}>
      <Clock className="size-3.5" aria-hidden />
      <span className="font-mono tabular-nums">{t('updated', { time: formatTime(at, i18n.language, true) })}</span>
    </span>
  )
}

/** "Ends in Dd HH:MM:SS"; when the clock hits zero the board refreshes so the status flips to closed. */
export function EventClock({ event, size = 'lg', className }: { event: GameEvent; size?: 'md' | 'lg' | 'xl'; className?: string }) {
  const { t } = useTranslation('standings')
  const queryClient = useQueryClient()
  const status = boardStatus(event)
  const onDone = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.standings.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.core.all })
  }, [queryClient])

  if (status === 'closed') return <p className={cn('text-sm font-semibold text-muted', className)}>{t('finished')}</p>
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-xs font-semibold text-muted">{status === 'upcoming' ? t('startsIn') : t('endsIn')}</span>
      <Countdown to={status === 'upcoming' ? event.startsAt : event.endsAt} size={size} onDone={onDone} className="text-ink" />
    </div>
  )
}
