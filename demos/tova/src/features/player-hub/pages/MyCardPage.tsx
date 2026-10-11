/** `/me`: the player's card. Totals, round history, trivia and the reveal countdown. */
import { Award, Gamepad2, Hash, Sparkles, Star, TimerReset } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button, Card, Countdown, DataTable, ErrorState, PageHeader, StatTile, type Column } from '@/components/ui'
import { formatDateTime, formatNumber } from '@/lib/format'
import { localizedFirstName } from '@/shell/session'
import type { MyCard } from '@/types'
import { useHubLiveSync, useMyCard } from '../api'
import { TriviaPanel } from '../components/TriviaPanel'

type HistoryRow = MyCard['history'][number]

export default function MyCardPage() {
  const { t, i18n } = useTranslation('hub')
  useHubLiveSync()
  const card = useMyCard()
  const data = card.data
  const loading = card.isLoading

  const columns: Column<HistoryRow>[] = [
    {
      id: 'date',
      header: t('history.date'),
      cell: (row) => <span className="tabular-nums">{formatDateTime(row.playedAt)}</span>,
      sortValue: (row) => Date.parse(row.playedAt),
    },
    {
      id: 'score',
      header: t('history.score'),
      align: 'right',
      cell: (row) => (
        <span className={row.score < 0 ? 'font-mono font-bold tabular-nums text-danger' : 'font-mono font-bold tabular-nums'}>
          {formatNumber(row.score)}
        </span>
      ),
      sortValue: (row) => row.score,
    },
  ]

  const name = data ? localizedFirstName(data.user, i18n.language) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        variant="player"
        eyebrow={data?.event?.name ?? t('card.eyebrow')}
        title={name ? t('card.titleNamed', { name }) : t('card.title')}
        description={t('card.description')}
      />

      {card.isError ? (
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              tone="accent"
              label={t('card.total')}
              value={formatNumber(data?.total ?? 0)}
              hint={t('card.totalHint')}
              icon={<Star className="size-5" aria-hidden />}
              loading={loading}
            />
            <StatTile
              label={t('card.record')}
              value={formatNumber(data?.best ?? 0)}
              hint={t('card.recordHint')}
              icon={<Award className="size-5" aria-hidden />}
              loading={loading}
            />
            <StatTile
              label={t('card.bonus')}
              value={formatNumber(data?.bonus ?? 0)}
              hint={t('card.bonusHint')}
              icon={<Sparkles className="size-5" aria-hidden />}
              loading={loading}
            />
            <StatTile
              label={t('card.rounds')}
              value={formatNumber(data?.rounds ?? 0)}
              icon={<Hash className="size-5" aria-hidden />}
              loading={loading}
            />
          </div>

          {data?.boardHidden && data.event && (
            <Card padding="md" className="flex flex-col items-center gap-2 text-center">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <TimerReset className="size-4" strokeWidth={1.75} aria-hidden />
                {t('card.revealTitle')}
              </p>
              <Countdown to={data.event.endsAt} size="lg" onDone={() => void card.refetch()} />
              <p className="text-xs text-muted">{t('card.revealHint')}</p>
            </Card>
          )}

          {!loading && !data?.event && <p className="text-center text-sm text-muted">{t('common:empty.noEvent')}</p>}

          <Button asChild size="lg" block>
            <Link to="/play">
              <Gamepad2 className="size-5" aria-hidden />
              {data && data.rounds > 0 ? t('card.playAgain') : t('card.play')}
            </Link>
          </Button>

          <TriviaPanel />

          <section aria-labelledby="history-title" className="space-y-3">
            <h2 id="history-title" className="font-display text-lg text-ink">
              {t('history.title')}
            </h2>
            <DataTable<HistoryRow>
              columns={columns}
              rows={data?.history}
              loading={loading}
              getRowId={(row) => row.id}
              pageSize={10}
              emptyTitle={t('history.emptyTitle')}
              emptyDescription={t('history.emptyHint')}
              caption={t('history.title')}
            />
          </section>
        </>
      )}
    </div>
  )
}
