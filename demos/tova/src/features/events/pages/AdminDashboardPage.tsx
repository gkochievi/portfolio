/** /admin: console dashboard (staff). Player and round totals, the live event, role-filtered shortcuts. */
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ContactRound,
  Gamepad2,
  Gift,
  ListChecks,
  Settings2,
  Snowflake,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatTile, StatusBadge, ViewOnlyTag } from '@/components/ui'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { roleAllows, type Access } from '@/lib/roles'
import { localizedFirstName, useCurrentUser } from '@/shell/session'
import type { EventSummary } from '@/types'
import { useDashboard } from '../api'

interface NavCard {
  to: string
  icon: LucideIcon
  key: 'events' | 'people' | 'participants' | 'standings' | 'insights'
  access: Access
}

const NAV_CARDS: NavCard[] = [
  { to: '/admin/events', icon: CalendarDays, key: 'events', access: 'editor' },
  { to: '/admin/participants', icon: ContactRound, key: 'participants', access: 'staff' },
  { to: '/admin/leaderboard', icon: Trophy, key: 'standings', access: 'staff' },
  { to: '/admin/insights', icon: BarChart3, key: 'insights', access: 'staff' },
  { to: '/admin/people', icon: Users, key: 'people', access: 'super' },
]

/** Re-render every few seconds so "last round 12 s ago" stays honest. */
function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now())
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export default function AdminDashboardPage() {
  const { t, i18n } = useTranslation('events')
  const user = useCurrentUser()
  const role = user?.role ?? 'SUPERVISOR'
  const canEdit = roleAllows(role, 'editor')
  const { data, isLoading, error, refetch } = useDashboard()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={user ? t('dashboard.greeting', { name: localizedFirstName(user, i18n.language) }) : t('dashboard.title')}
        description={t('dashboard.description')}
        actions={role === 'SUPERVISOR' ? <ViewOnlyTag /> : undefined}
      />

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile
              label={t('dashboard.players')}
              value={data ? <span className="tabular-nums">{formatNumber(data.players)}</span> : '-'}
              hint={t('dashboard.playersHint')}
              icon={<Users className="size-5" aria-hidden />}
              tone="primary"
              loading={isLoading}
            />
            <StatTile
              label={t('dashboard.plays')}
              value={data ? <span className="tabular-nums">{formatNumber(data.plays)}</span> : '-'}
              hint={t('dashboard.playsHint')}
              icon={<Gamepad2 className="size-5" aria-hidden />}
              tone="accent"
              loading={isLoading}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-hero" />
          ) : data?.activeEvent ? (
            <LiveEventCard event={data.activeEvent} lastPlayAt={data.lastPlayAt} canEdit={canEdit} />
          ) : (
            <Card padding="none">
              <EmptyState
                title={t('dashboard.noLive')}
                description={canEdit ? t('dashboard.noLiveEditor') : t('dashboard.noLiveViewer')}
                action={
                  canEdit ? (
                    <Button asChild size="sm" rightIcon={<ArrowRight className="size-4" aria-hidden />}>
                      <Link to="/admin/events">{t('dashboard.goToEvents')}</Link>
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          )}
        </>
      )}

      <section aria-labelledby="console-shortcuts" className="space-y-3">
        <h2 id="console-shortcuts" className="font-display text-lg font-bold text-ink">
          {t('dashboard.shortcuts')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_CARDS.filter((card) => roleAllows(role, card.access)).map((card) => (
            <Link
              key={card.key}
              to={card.to}
              className="group flex items-start gap-3 rounded-card border border-line bg-panel p-4 shadow-card transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-primary-soft text-primary">
                <card.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-semibold text-ink">
                  {t(`dashboard.cards.${card.key}.title`)}
                  <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-0.5 block text-sm text-muted">{t(`dashboard.cards.${card.key}.body`)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

function LiveEventCard({ event, lastPlayAt, canEdit }: { event: EventSummary; lastPlayAt: string | null; canEdit: boolean }) {
  const { t } = useTranslation('events')
  const now = useNow()
  const counts = [
    { icon: Gamepad2, label: t('counts.plays', { count: event.playCount }) },
    { icon: Snowflake, label: t('counts.items', { count: event.itemCount }) },
    { icon: ListChecks, label: t('counts.trivia', { count: event.triviaCount }) },
    { icon: Gift, label: t('counts.prizes', { count: event.prizeCount }) },
  ]
  return (
    <Card hero padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{t('dashboard.liveEvent')}</p>
          <h2 className="mt-1 font-display text-xl font-bold break-words text-ink sm:text-2xl">{event.name}</h2>
          <p className="mt-1 text-sm text-muted tabular-nums">
            {t('window', { start: formatDateTime(event.startsAt), end: formatDateTime(event.endsAt) })}
          </p>
        </div>
        <StatusBadge status={event.status} />
      </div>

      <ul className="flex flex-wrap gap-2">
        {counts.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-chip bg-sunken px-2.5 py-1 text-sm text-ink tabular-nums">
            <Icon className="size-4 text-muted" aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent animate-live-dot" aria-hidden />
          {lastPlayAt ? t('dashboard.lastRound', { when: formatRelative(lastPlayAt, undefined, now) }) : t('dashboard.noRoundsYet')}
        </span>
        <span>{event.leaderboardVisible ? t('dashboard.boardPublic') : t('dashboard.boardHidden')}</span>
        <span>{event.awardsVisible ? t('dashboard.prizesPublic') : t('dashboard.prizesHidden')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" leftIcon={<Trophy className="size-4" aria-hidden />}>
          <Link to={`/admin/leaderboard?event=${encodeURIComponent(event.id)}`}>{t('dashboard.openStandings')}</Link>
        </Button>
        {canEdit && (
          <Button asChild size="sm" variant="secondary" leftIcon={<Settings2 className="size-4" aria-hidden />}>
            <Link to={`/admin/events/${encodeURIComponent(event.id)}`}>{t('dashboard.manage')}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" rightIcon={<ArrowRight className="size-4" aria-hidden />}>
          <Link to="/leaderboard">{t('dashboard.publicBoard')}</Link>
        </Button>
      </div>
    </Card>
  )
}
