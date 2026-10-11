/**
 * Public standings (`/leaderboard`, inside PlayerShell): the booth/TV board.
 * Polls every 10 s and refreshes the moment a round or trivia answer lands.
 * Staff always see the board (even when hidden from the public) and can open
 * a slide-over drill-down per entrant.
 */
import { EyeOff, Lock, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui'
import { isStaffRole } from '@/lib/roles'
import { useCurrentUser } from '@/shell/session'
import type { LeaderRow } from '@/types'
import { useStandings } from '../api'
import { EventClock, StatusPill, UpdatedAt } from '../components/BoardStatus'
import { PlayerDetailSheet } from '../components/PlayerDetail'
import { StandingsBoard } from '../components/StandingsBoard'

export default function StandingsPage() {
  const { t } = useTranslation('standings')
  const user = useCurrentUser()
  const staff = Boolean(user && !user.disabled && isStaffRole(user.role))
  const query = useStandings(null)
  const [selected, setSelected] = useState<LeaderRow | null>(null)

  const board = query.data
  const event = board?.event ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        variant="player"
        eyebrow={event?.name ?? t('eyebrow')}
        title={t('title')}
        actions={event ? <EventClock event={event} size="lg" className="sm:items-end sm:text-right" /> : undefined}
      />

      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <StandingsBoard rows={undefined} loading />
        </div>
      ) : query.isError && !board ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !board || !event ? (
        <EmptyState icon={<Trophy />} title={t('noEvent.title')} description={t('noEvent.description')} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusPill event={event} />
            {!board.hidden && <UpdatedAt at={board.updatedAt} />}
            {staff && !event.leaderboardVisible && (
              <Badge tone="warning" icon={<EyeOff className="size-3.5" />}>
                {t('staffHiddenNote')}
              </Badge>
            )}
          </div>
          {staff && board.rows.length > 0 && <p className="-mt-2 text-sm text-muted">{t('staffHint')}</p>}

          {board.hidden ? (
            <EmptyState icon={<Lock />} title={t('hidden.title')} description={t('hidden.description')} />
          ) : board.rows.length === 0 ? (
            <EmptyState icon={<Trophy />} title={t('empty.title')} description={t('empty.description')} />
          ) : (
            <StandingsBoard rows={board.rows} onSelect={staff ? setSelected : undefined} />
          )}
        </>
      )}

      {staff && <PlayerDetailSheet row={selected} eventId={event?.id ?? null} onClose={() => setSelected(null)} />}
    </div>
  )
}
