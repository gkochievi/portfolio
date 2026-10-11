/**
 * Overview (/console): admin KPIs, trend, distribution, per-business table,
 * per-question averages and the latest comments. Owner: feature group insights.
 */
import { ArrowRight, MessageSquareText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  LiveDot,
  PageHeader,
  ScorePill,
  Skeleton,
  StatTile,
  type Column,
} from '@/components/ui'
import { DistributionBars, Meter, TrendChart, TrendLegend } from '@/components/ui/charts'
import { useLang } from '@/hooks/useLang'
import { formatNumber, formatPercent, formatRating } from '@/lib/format'
import { lt } from '@/lib/utils'
import type { KpiSet, QuestionStat } from '@/types'
import { useInsightsFilters, useOverview } from '../api'
import { InsightsFilterBar } from '../components/InsightsFilterBar'
import { CommentItem, TenantMarkFor } from '../components/shared'
import type { BreakdownRow, Overview } from '../types'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export default function OverviewPage() {
  const { t } = useTranslation('insights')
  const lang = useLang()
  const location = useLocation()
  const { filters, update } = useInsightsFilters()
  const overview = useOverview(filters)
  const data = overview.data

  const responsesLink = `/console/responses${location.search}`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('overview.eyebrow')}
        title={t('overview.title')}
        description={t('overview.description')}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-panel px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-border">
            <LiveDot tone="accent" />
            {t('overview.live')}
          </span>
        }
      />

      <InsightsFilterBar />

      {overview.isError && !data ? (
        <ErrorState description={t('common:errors.loadFailed')} onRetry={() => void overview.refetch()} />
      ) : (
        <>
          {KpiRow({ data, loading: overview.isLoading })}

          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            <Card className="lg:col-span-2" padding="md">
              <CardHeader
                title={t('overview.trendTitle', { count: filters.days })}
                description={t('overview.trendHint')}
                actions={<TrendLegend />}
              />
              {data ? (
                data.responses === 0 ? (
                  <EmptyState compact illustration="empty" title={t('common:empty.noData')} description={t('common:table.noResultsHint')} />
                ) : (
                  <TrendChart data={data.trend} height={240} />
                )
              ) : (
                <Skeleton className="h-[240px] w-full" />
              )}
            </Card>

            <Card padding="md">
              <CardHeader
                title={t('common:chart.distribution')}
                description={
                  data ? t('overview.ratingsCount', { count: data.distribution.reduce((a, b) => a + b, 0) }) : undefined
                }
              />
              {data ? (
                data.distribution.some((n) => n > 0) ? (
                  <DistributionBars distribution={data.distribution} />
                ) : (
                  <EmptyState compact illustration={null} title={t('common:empty.noData')} />
                )
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5 [&>*]:min-w-0">
            <div className="space-y-4 lg:col-span-3">
              {BreakdownCard({
                data,
                loading: overview.isLoading,
                onPick: (row, level) =>
                  level === 'tenant' ? update({ tenantId: row.id }) : update({ branchId: row.id, tenantId: row.tenantId }),
              })}
              {filters.campaignId && QuestionsCard({ questions: data?.questions, loading: !data })}
            </div>

            <Card className="lg:col-span-2" padding="md">
              <CardHeader
                title={t('overview.commentsTitle')}
                icon={<MessageSquareText size={20} strokeWidth={1.75} />}
                actions={
                  <Button asChild size="sm" variant="ghost">
                    <Link to={responsesLink}>
                      {t('common:actions.viewAll')}
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                    </Link>
                  </Button>
                }
              />
              {!data ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : data.latestComments.length === 0 ? (
                <EmptyState compact illustration="empty" title={t('common:empty.noComments')} description={t('overview.noCommentsHint')} />
              ) : (
                <ul className="-mx-3 space-y-1">
                  {data.latestComments.map((row) => (
                    <li key={row.id} className="animate-fade-in">
                      <CommentItem row={row} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )

  /* Section renderers (plain functions, called inline: no hooks inside). */

  function KpiRow({ data, loading }: { data: Overview | undefined; loading: boolean }) {
    const kpis: KpiSet | undefined = data?.kpis
    const prev = data?.previous
    const hasPrev = Boolean(prev && prev.sent + (data?.previousResponses ?? 0) > 0)
    const delta = (key: 'csat' | 'avgRating' | 'responseRate'): number | null =>
      kpis && prev && hasPrev && (key !== 'avgRating' || prev.avgRating > 0) ? round1(kpis[key] - prev[key]) : null
    const pts = (n: number | null) => (n == null ? undefined : t('overview.deltaPts', { value: `${n > 0 ? '+' : ''}${formatNumber(n, lang, 1)}` }))
    const vs = t('common:kpi.vsPrevious')
    const ratingDelta = delta('avgRating')

    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          highlight
          loading={loading}
          label={t('common:kpi.csat')}
          value={kpis ? formatPercent(kpis.csat, lang) : '—'}
          delta={delta('csat')}
          deltaLabel={pts(delta('csat'))}
          hint={hasPrev ? vs : t('common:kpi.csatHint')}
        />
        <StatTile
          loading={loading}
          label={t('common:kpi.avgRating')}
          value={kpis && kpis.avgRating > 0 ? formatRating(kpis.avgRating, lang) : '—'}
          unit="/ 5"
          delta={ratingDelta}
          deltaLabel={ratingDelta == null ? undefined : `${ratingDelta > 0 ? '+' : ''}${formatNumber(ratingDelta, lang, 1)}`}
          hint={t('overview.ratingsHint', { count: data ? data.distribution.reduce((a, b) => a + b, 0) : 0 })}
        />
        <StatTile
          loading={loading}
          label={t('common:kpi.responseRate')}
          value={kpis ? formatPercent(kpis.responseRate, lang) : '—'}
          delta={delta('responseRate')}
          deltaLabel={pts(delta('responseRate'))}
          hint={kpis ? t('overview.rateHint', { completed: kpis.completed, sent: kpis.sent }) : undefined}
        />
        <StatTile
          loading={loading}
          label={t('common:kpi.responsesToday')}
          value={kpis ? formatNumber(kpis.responsesToday, lang) : '—'}
          hint={data ? t('overview.inWindow', { count: data.responses, days: data.days }) : undefined}
        />
      </div>
    )
  }

  function BreakdownCard({
    data,
    loading,
    onPick,
  }: {
    data: Overview | undefined
    loading: boolean
    onPick: (row: BreakdownRow, level: 'tenant' | 'branch') => void
  }) {
    const level = data?.breakdown.level ?? (filters.tenantId ? 'branch' : 'tenant')
    const columns: Column<BreakdownRow>[] = [
      {
        id: 'name',
        header: level === 'tenant' ? t('common:filters.tenant') : t('common:filters.branch'),
        cell: (row) => (
          <span className="flex min-w-0 items-center gap-2.5">
            {level === 'tenant' && <TenantMarkFor tenantId={row.id} size="xs" />}
            <span className="truncate font-medium text-ink">{lt(row.name, lang)}</span>
          </span>
        ),
        sortValue: (row) => lt(row.name, lang),
        sortable: true,
      },
      {
        id: 'responses',
        header: t('common:kpi.responses'),
        cell: (row) => <span className="tabular">{formatNumber(row.responses, lang)}</span>,
        sortValue: (row) => row.responses,
        sortable: true,
        align: 'right',
      },
      {
        id: 'avg',
        header: t('common:kpi.avgRating'),
        cell: (row) => (row.avgRating == null ? <span className="text-subtle">—</span> : <ScorePill value={row.avgRating} size="sm" />),
        sortValue: (row) => row.avgRating,
        sortable: true,
        align: 'right',
      },
      {
        id: 'rate',
        header: t('common:kpi.responseRate'),
        cell: (row) => (
          <span className="flex items-center justify-end gap-2">
            <span className="hidden w-20 sm:block">
              <Meter value={row.responseRate} label={t('common:kpi.responseRate')} />
            </span>
            <span className="tabular w-12 text-right">{row.sent ? formatPercent(row.responseRate, lang) : '—'}</span>
          </span>
        ),
        sortValue: (row) => row.responseRate,
        sortable: true,
        align: 'right',
        hideBelow: 'sm',
      },
    ]
    return (
      <Card padding="md">
        <CardHeader
          title={level === 'tenant' ? t('overview.byTenant') : t('overview.byBranch')}
          description={level === 'tenant' ? t('overview.byTenantHint') : t('overview.byBranchHint')}
        />
        <DataTable
          bare
          columns={columns}
          rows={data?.breakdown.rows}
          getRowId={(row) => row.id}
          loading={loading}
          skeletonRows={5}
          onRowClick={(row) => onPick(row, level)}
          isRowActive={(row) => row.id === filters.branchId}
          defaultSort={{ id: 'responses', dir: 'desc' }}
          caption={level === 'tenant' ? t('overview.byTenant') : t('overview.byBranch')}
          empty={{ title: t('common:table.noResults'), description: t('common:table.noResultsHint') }}
        />
      </Card>
    )
  }

  function QuestionsCard({ questions, loading }: { questions: QuestionStat[] | undefined; loading: boolean }) {
    return (
      <Card padding="md">
        <CardHeader title={t('overview.questionsTitle')} description={t('overview.questionsHint')} />
        {loading || !questions ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState compact illustration={null} title={t('common:empty.noData')} />
        ) : (
          <ol className="space-y-4">
            {questions.map((q, index) => (
              <li key={q.questionId}>
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm text-ink">
                    <span className="tabular mr-2 text-xs text-subtle">{index + 1}</span>
                    {lt(q.text, lang)}
                  </p>
                  <span className="tabular shrink-0 text-sm font-semibold text-ink">
                    {q.avg == null ? '—' : formatRating(q.avg, lang)}
                    <span className="font-normal text-muted"> / 5</span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <Meter value={q.avg == null ? 0 : (q.avg / 5) * 100} tone="accent" label={lt(q.text, lang)} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t('overview.answeredSkipped', { answered: q.answered, skipped: q.skipped })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    )
  }
}
