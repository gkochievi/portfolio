/** The Insights page sections: overview tiles, this month, per-event table, records and catches. */
import { CalendarDays, CircleHelp, Gift, Medal, Play, ShieldCheck, Sparkles, Trophy, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ItemToken } from '@/components/brand'
import { Card, DataTable, EmptyState, ItemTypeBadge, Skeleton, StatTile, StatusBadge, Tooltip, type Column } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber, formatPercent, formatRelative } from '@/lib/format'
import type { ItemType, Stats } from '@/types'

type PerEvent = Stats['perEvent'][number]

const grid = 'grid grid-cols-1 gap-3 min-[480px]:grid-cols-2'

/* ------------------------------------------------------------ overview */

export function OverviewTiles({ stats }: { stats: Stats | undefined }) {
  const { t, i18n } = useTranslation('insights')
  const lang = i18n.language
  const n = (value: number) => formatNumber(value, lang)
  const s = stats?.totals
  const loading = !s

  const tiles: { key: string; label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: 'accent' | 'primary' }[] = [
    {
      key: 'players',
      label: t('overview.players'),
      value: s ? n(s.players) : '',
      hint: s ? t('overview.playersHint', { active: n(s.activePlayers), disabled: n(s.disabledPlayers) }) : undefined,
      icon: <Users />,
    },
    {
      key: 'rounds',
      label: t('overview.rounds'),
      value: s ? n(s.plays) : '',
      hint: s ? t('overview.roundsHint', { avg: formatNumber(s.avgPlaysPerPlayer, lang, { maximumFractionDigits: 1 }) }) : undefined,
      icon: <Play />,
    },
    {
      key: 'record',
      label: t('overview.record'),
      value: s ? n(s.maxScore) : '',
      hint: s ? t('overview.recordHint', { avg: n(s.avgScore) }) : undefined,
      icon: <Trophy />,
      tone: 'accent',
    },
    {
      key: 'points',
      label: t('overview.points'),
      value: s ? n(s.totalPoints) : '',
      hint: t('overview.pointsHint'),
      icon: <Sparkles />,
    },
    {
      key: 'events',
      label: t('overview.events'),
      value: s ? n(s.events) : '',
      hint: s ? t('overview.eventsHint', { published: n(s.publishedEvents) }) : undefined,
      icon: <CalendarDays />,
    },
    {
      key: 'staff',
      label: t('overview.staff'),
      value: s ? n(s.staff) : '',
      hint: t('overview.staffHint'),
      icon: <ShieldCheck />,
    },
    {
      key: 'trivia',
      label: t('overview.trivia'),
      value: s ? n(s.triviaAnswers) : '',
      hint: s
        ? s.triviaAnswers
          ? t('overview.triviaHint', { pct: formatPercent(s.triviaCorrect / s.triviaAnswers, lang) })
          : t('overview.triviaNone')
        : undefined,
      icon: <CircleHelp />,
    },
    {
      key: 'bonus',
      label: t('overview.bonus'),
      value: s ? n(s.triviaBonus) : '',
      hint: s ? t('overview.bonusHint', { correct: n(s.triviaCorrect) }) : undefined,
      icon: <Gift />,
    },
  ]

  return (
    <div className={cn(grid, 'lg:grid-cols-4')}>
      {tiles.map((tile) => (
        <StatTile key={tile.key} label={tile.label} value={tile.value} hint={loading ? <Skeleton className="h-4 w-28" /> : tile.hint} icon={tile.icon} tone={tile.tone} loading={loading} />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- this month */

export function ThisMonth({ stats }: { stats: Stats | undefined }) {
  const { t, i18n } = useTranslation('insights')
  const lang = i18n.language
  const m = stats?.thisMonth
  const n = (value: number) => formatNumber(value, lang)
  return (
    <div className={cn(grid, 'md:grid-cols-3')}>
      <StatTile label={t('month.newPlayers')} value={m ? n(m.newPlayers) : ''} icon={<UserPlus />} tone="primary" loading={!m} />
      <StatTile label={t('month.plays')} value={m ? n(m.plays) : ''} icon={<Play />} tone="primary" loading={!m} />
      <StatTile label={t('month.activeEvents')} value={m ? n(m.activeEvents) : ''} icon={<CalendarDays />} tone="primary" loading={!m} />
    </div>
  )
}

/* ----------------------------------------------------------- per event */

export function EventTable({ stats }: { stats: Stats | undefined }) {
  const { t, i18n } = useTranslation('insights')
  const lang = i18n.language
  const n = (value: number) => <span className="tabular-nums">{formatNumber(value, lang)}</span>

  const columns: Column<PerEvent>[] = [
    {
      id: 'name',
      header: t('events.name'),
      cell: (row) => (
        <div className="min-w-[10rem]">
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted tabular-nums">
            {formatDate(row.startsAt, lang)} – {formatDate(row.endsAt, lang)}
          </div>
        </div>
      ),
      sortValue: (row) => row.startsAt,
    },
    { id: 'status', header: t('events.status'), cell: (row) => <StatusBadge status={row.status} size="sm" /> },
    { id: 'players', header: t('events.players'), cell: (row) => n(row.players), sortValue: (row) => row.players, align: 'right' },
    { id: 'plays', header: t('events.plays'), cell: (row) => n(row.plays), sortValue: (row) => row.plays, align: 'right' },
    { id: 'avg', header: t('events.avg'), cell: (row) => n(row.avgScore), sortValue: (row) => row.avgScore, align: 'right', hideBelow: 'md' },
    {
      id: 'top',
      header: t('events.top'),
      cell: (row) => <span className="font-mono font-semibold tabular-nums">{formatNumber(row.topScore, lang)}</span>,
      sortValue: (row) => row.topScore,
      align: 'right',
    },
    {
      id: 'topPlayer',
      header: t('events.topPlayer'),
      cell: (row) => (row.topPlayer ? <span className="whitespace-nowrap">{row.topPlayer}</span> : <span className="text-muted">—</span>),
      hideBelow: 'lg',
    },
    { id: 'signups', header: t('events.signups'), cell: (row) => n(row.newUsers), sortValue: (row) => row.newUsers, align: 'right', hideBelow: 'md' },
    { id: 'trivia', header: t('events.trivia'), cell: (row) => n(row.triviaAnswers), sortValue: (row) => row.triviaAnswers, align: 'right', hideBelow: 'lg' },
  ]

  return (
    <Card padding="none" className="overflow-hidden">
      <DataTable
        columns={columns}
        rows={stats?.perEvent}
        getRowId={(row) => row.id}
        pageSize={0}
        emptyTitle={t('events.empty')}
        caption={t('events.title')}
      />
    </Card>
  )
}

/* ------------------------------------------------------------- records */

function Rank({ index }: { index: number }) {
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-chip font-mono text-sm font-semibold tabular-nums',
        index === 0 ? 'bg-accent text-on-accent' : 'bg-sunken text-muted',
      )}
    >
      {index + 1}
    </span>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function Records({ stats }: { stats: Stats | undefined }) {
  const { t, i18n } = useTranslation('insights')
  const lang = i18n.language

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card padding="md" className="min-w-0">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
          <Trophy className="size-4 text-muted" aria-hidden="true" />
          {t('records.topScores')}
        </h3>
        {!stats ? (
          <ListSkeleton />
        ) : stats.topScores.length === 0 ? (
          <EmptyState compact title={t('records.empty')} />
        ) : (
          <ol className="divide-y divide-line">
            {stats.topScores.map((row, i) => (
              <li key={`${row.name}-${row.playedAt}-${i}`} className="flex items-center gap-3 py-2.5">
                <Rank index={i} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{row.name}</div>
                  <div className="truncate text-xs text-muted">
                    {[row.company, row.event ?? t('records.noEvent'), formatRelative(row.playedAt, lang)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className={cn('font-mono text-base font-semibold tabular-nums', i === 0 ? 'text-accent-ink' : 'text-ink')}>
                  {formatNumber(row.score, lang)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card padding="md" className="min-w-0">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
          <Medal className="size-4 text-muted" aria-hidden="true" />
          {t('records.topPlayers')}
        </h3>
        {!stats ? (
          <ListSkeleton />
        ) : stats.topPlayers.length === 0 ? (
          <EmptyState compact title={t('records.empty')} />
        ) : (
          <ol className="divide-y divide-line">
            {stats.topPlayers.map((row, i) => (
              <li key={`${row.name}-${i}`} className="flex items-center gap-3 py-2.5">
                <Rank index={i} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{row.name}</div>
                  {row.company && <div className="truncate text-xs text-muted">{row.company}</div>}
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-mono text-base font-semibold text-ink">{t('records.rounds', { count: row.plays, value: formatNumber(row.plays, lang) })}</div>
                  <div className="text-xs text-muted">{t('records.best', { value: formatNumber(row.best, lang) })}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------- catches */

const LEVELS = ['l1', 'l2', 'l3'] as const
/** One hue, light to dark by bonus level: sequential, never categorical. */
const LEVEL_CLASS: Record<(typeof LEVELS)[number], string> = {
  l1: 'bg-primary/35',
  l2: 'bg-primary/65',
  l3: 'bg-primary',
}

export function Catches({ stats }: { stats: Stats | undefined }) {
  const { t, i18n } = useTranslation(['insights', 'common'])
  const lang = i18n.language
  const c = stats?.catches
  const maxType = Math.max(1, ...(c?.byType.map((row) => row.total) ?? [1]))
  const maxTop = Math.max(1, ...(c?.top.map((row) => row.total) ?? [1]))

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card padding="md" className="flex min-w-0 flex-col gap-4">
        <div>
          <div className="text-sm font-medium text-muted">{t('catches.total')}</div>
          {c ? (
            <div className="font-display text-[32px] leading-tight tabular-nums">{formatNumber(c.totalCaught, lang)}</div>
          ) : (
            <Skeleton className="mt-1 h-9 w-24" />
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{t('catches.byType')}</h3>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label={t('catches.legend')}>
              {LEVELS.map((level) => (
                <li key={level} className="flex items-center gap-1.5">
                  <span className={cn('inline-block size-2.5 rounded-[3px]', LEVEL_CLASS[level])} aria-hidden="true" />
                  {t(`catches.levels.${level}`)}
                </li>
              ))}
            </ul>
          </div>
          {!c ? (
            <ListSkeleton />
          ) : (
            <ul className="space-y-3">
              {c.byType.map((row) => (
                <li key={row.type}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <ItemTypeBadge type={row.type} size="sm" />
                    <span className="font-mono text-sm font-semibold tabular-nums">{formatNumber(row.total, lang)}</span>
                  </div>
                  <div className="h-3 w-full rounded-chip bg-sunken">
                    <div className="flex h-full gap-[2px]" style={{ width: `${(row.total / maxType) * 100}%` }}>
                      {LEVELS.map((level) =>
                        row[level] > 0 ? (
                          <Tooltip
                            key={level}
                            content={`${t(`catches.levels.${level}`)}: ${formatNumber(row[level], lang)}`}
                          >
                            <span
                              tabIndex={0}
                              aria-label={`${t(`common:itemTypes.${row.type}`)} · ${t(`catches.levels.${level}`)}: ${row[level]}`}
                              className={cn('h-full min-w-[3px] first:rounded-l-chip last:rounded-r-chip', LEVEL_CLASS[level])}
                              style={{ flexGrow: row[level], flexBasis: 0 }}
                            />
                          </Tooltip>
                        ) : null,
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted tabular-nums">
                    {LEVELS.map((level) => `${t(`catches.levels.${level}`)} ${formatNumber(row[level], lang)}`).join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card padding="md" className="min-w-0">
        <h3 className="mb-3 font-semibold text-ink">{t('catches.top')}</h3>
        {!c ? (
          <ListSkeleton />
        ) : c.top.length === 0 ? (
          <EmptyState compact title={t('catches.empty')} />
        ) : (
          <ul className="space-y-2.5">
            {c.top.map((row) => (
              <li key={row.name} className="flex items-center gap-3">
                <ItemToken type={row.type as ItemType} name={row.name} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{row.name}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{formatNumber(row.total, lang)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-sunken">
                    <div
                      className={cn('h-full rounded-full', row.type === 'GOOD' ? 'bg-primary' : 'bg-muted/60')}
                      style={{ width: `${(row.total / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
