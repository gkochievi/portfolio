/** `/admin/insights`: read-only analytics for every staff role, live as rounds land. */
import { useTranslation } from 'react-i18next'

import { Badge, ErrorState, PageHeader, Section } from '@/components/ui'
import { formatDate, formatTime } from '@/lib/format'
import { useInsights } from '../api'
import { DailyBars } from '../components/DailyBars'
import { Catches, EventTable, OverviewTiles, Records, ThisMonth } from '../components/sections'

export default function InsightsPage() {
  const { t, i18n } = useTranslation('insights')
  const lang = i18n.language
  const query = useInsights()
  const stats = query.data

  if (query.isError && !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} description={t('description')} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    )
  }

  const month = formatDate(stats?.generatedAt ?? Date.now(), lang, { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-2">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          stats ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone="primary" dot pulse size="sm">
                {t('live')}
              </Badge>
              <span className="tabular-nums" aria-live="polite">
                {t('generatedAt', { time: formatTime(stats.generatedAt, lang, true) })}
              </span>
            </div>
          ) : undefined
        }
      />

      <Section title={t('overview.title')}>
        <OverviewTiles stats={stats} />
      </Section>

      <Section title={t('month.title')} description={month}>
        <ThisMonth stats={stats} />
      </Section>

      <Section title={t('charts.title')} description={t('charts.description')}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DailyBars title={t('charts.signups')} unit={t('charts.signupsUnit')} data={stats?.registrationsByDay} />
          <DailyBars title={t('charts.plays')} unit={t('charts.playsUnit')} data={stats?.playsByDay} />
        </div>
      </Section>

      <Section title={t('events.title')} description={t('events.description')}>
        <EventTable stats={stats} />
      </Section>

      <Section title={t('records.title')} description={t('records.description')}>
        <Records stats={stats} />
      </Section>

      <Section title={t('catches.title')} description={t('catches.description')}>
        <Catches stats={stats} />
      </Section>
    </div>
  )
}
