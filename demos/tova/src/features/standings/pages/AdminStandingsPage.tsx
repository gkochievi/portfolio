/**
 * Staff standings (`/admin/leaderboard`, inside AdminShell): always visible to
 * staff, for the event picked in the shell's switcher. Row click opens the
 * drill-down modal. Read-only for every staff role, so nothing to gate.
 */
import { Eye, EyeOff, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Card, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { useAdminEventId } from '@/shell/adminEvent'
import type { LeaderRow } from '@/types'
import { useStandings } from '../api'
import { EventClock, StatusPill, UpdatedAt } from '../components/BoardStatus'
import { PlayerDetailModal } from '../components/PlayerDetail'
import { StandingsBoard } from '../components/StandingsBoard'

export default function AdminStandingsPage() {
  const { t } = useTranslation('standings')
  const eventId = useAdminEventId()
  const query = useStandings(eventId)
  const [selected, setSelected] = useState<LeaderRow | null>(null)

  const board = query.data
  // While switching events, placeholder data from the previous event is shown; prefer the requested id.
  const event = board?.event && (!eventId || board.event.id === eventId) ? board.event : null
  const switching = Boolean(eventId && board?.event && board.event.id !== eventId)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title')}
        eyebrow={event?.name}
        description={t('admin.description')}
        actions={event ? <EventClock event={event} size="md" className="sm:items-end sm:text-right" /> : undefined}
      />

      {query.isPending || switching ? (
        <Card padding="sm">
          <StandingsBoard rows={undefined} loading podium={false} />
        </Card>
      ) : query.isError && !board ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !event ? (
        <EmptyState icon={<Trophy />} title={t('noEvent.title')} description={t('admin.noEvent')} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusPill event={event} />
            {event.leaderboardVisible ? (
              <Badge tone="primary" icon={<Eye className="size-3.5" />}>
                {t('admin.publicShown')}
              </Badge>
            ) : (
              <Badge tone="warning" icon={<EyeOff className="size-3.5" />}>
                {t('admin.publicHidden')}
              </Badge>
            )}
            <UpdatedAt at={board?.updatedAt} />
          </div>
          <Card padding="none" className="overflow-hidden pt-3">
            {board && board.rows.length > 0 ? (
              <StandingsBoard rows={board.rows} onSelect={setSelected} podium={false} />
            ) : (
              <EmptyState compact icon={<Trophy />} title={t('empty.title')} description={t('empty.description')} />
            )}
          </Card>
        </>
      )}

      <PlayerDetailModal row={selected} eventId={event?.id ?? eventId} onClose={() => setSelected(null)} />
    </div>
  )
}
