/**
 * My scores (/console/me): the signed-in agent's own ratings, how they compare
 * with the branch and the business, per-question averages and a live feed of
 * verbatim comments. Default export: src/routes.tsx lazy-imports this file.
 *
 * Owner: feature group staff.
 */
import { BarChart3, ListChecks, Send, Trophy, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
  Stars,
  TenantMark,
} from '@/components/ui'
import { DistributionBars, Meter, Sparkline, TrendChart, TrendLegend } from '@/components/ui/charts'
import { useLang } from '@/hooks/useLang'
import { formatNumber, formatPercent, formatRating } from '@/lib/format'
import { cn, lt } from '@/lib/utils'
import { useMyOverview } from '../api'
import { CommentsFeed } from '../components/CommentsFeed'
import type { MyOverview } from '../types'

type Days = '7' | '30' | '90'

export default function MyScoresPage() {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const [days, setDays] = useState<Days>('30')
  const query = useMyOverview(Number(days))
  const data = query.data

  if (query.isError && !data) {
    return <ErrorState title={t('scores.errorTitle')} onRetry={() => void query.refetch()} />
  }

  const delta = data && data.myAvg != null && data.branchAvg != null ? Math.round((data.myAvg - data.branchAvg) * 10) / 10 : null

  return (
    <div>
      <PageHeader
        eyebrow={t('scores.eyebrow')}
        title={data ? t('scores.greeting', { name: lt(data.staff.name, lang).split(' ')[0] }) : <Skeleton className="h-8 w-56" />}
        description={
          data ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <TenantMark monogram={data.tenant.monogram} primary={data.tenant.primary} onPrimary={data.tenant.onPrimary} size="xs" />
              {t('scores.subtitle', {
                title: lt(data.staff.title, lang),
                branch: lt(data.branch.name, lang),
                tenant: lt(data.tenant.name, lang),
              })}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<Days>
              label={t('scores.period')}
              value={days}
              onChange={setDays}
              size="sm"
              options={(['7', '30', '90'] as const).map((d) => ({ value: d, label: t('common:window.short', { count: Number(d) }) }))}
            />
            <Button asChild>
              <Link to="/console/send">
                <Send size={18} strokeWidth={1.75} aria-hidden />
                {t('scores.sendCta')}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          loading={!data}
          label={t('scores.kpi.avg')}
          value={data ? formatRating(data.myAvg, lang) : ''}
          unit="/ 5"
          delta={delta}
          deltaLabel={delta != null ? `${delta > 0 ? '+' : ''}${formatRating(delta, lang)} ${t('scores.kpi.vsBranch')}` : undefined}
          hint={!delta ? t('scores.kpi.avgHint') : undefined}
          highlight
        />
        <StatTile
          loading={!data}
          label={t('scores.kpi.csat')}
          value={data ? formatPercent(data.kpis.csat, lang) : ''}
          hint={t('scores.kpi.csatHint')}
        />
        <StatTile
          loading={!data}
          label={t('scores.kpi.responses')}
          value={data ? formatNumber(data.responseCount, lang) : ''}
          hint={t('scores.kpi.responsesHint', { count: Number(days) })}
          chart={data ? <Sparkline values={data.trend.map((p) => p.responses)} label={t('scores.kpi.responses')} /> : undefined}
        />
        <StatTile
          loading={!data}
          label={t('scores.kpi.responseRate')}
          value={data ? formatPercent(data.kpis.responseRate, lang) : ''}
          hint={data ? t('scores.kpi.responseRateHint', { completed: data.kpis.completed, sent: data.kpis.sent }) : undefined}
          chart={data ? <Meter value={data.kpis.responseRate} tone="accent" /> : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ComparisonCard data={data} days={Number(days)} />
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader
            icon={<TrendingUp strokeWidth={1.75} />}
            title={days === '30' ? t('scores.trend.title') : t('scores.trend.titleDays', { count: Number(days) })}
            description={t('scores.trend.description')}
            actions={<TrendLegend />}
          />
          {data ? <TrendChart data={data.trend} /> : <Skeleton className="h-[220px] w-full" />}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card padding="lg">
          <CardHeader
            icon={<BarChart3 strokeWidth={1.75} />}
            title={t('scores.distribution.title')}
            description={t('scores.distribution.description')}
          />
          {data ? <DistributionBars distribution={data.distribution} /> : <Skeleton className="h-40 w-full" />}
        </Card>
        <QuestionsCard data={data} />
      </div>

      <div className="mt-4">
        <CommentsFeed />
      </div>
    </div>
  )
}

function ComparisonCard({ data, days }: { data: MyOverview | undefined; days: number }) {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const rows = data
    ? [
        { key: 'you', label: t('scores.compare.you'), value: data.myAvg, mine: true },
        { key: 'branch', label: t('scores.compare.branch', { branch: lt(data.branch.name, lang) }), value: data.branchAvg, mine: false },
        { key: 'tenant', label: t('scores.compare.tenant', { tenant: lt(data.tenant.name, lang) }), value: data.tenantAvg, mine: false },
      ]
    : []
  return (
    <Card padding="lg">
      <CardHeader
        icon={<Trophy strokeWidth={1.75} />}
        title={t('scores.compare.title')}
        description={t('scores.compare.description', { count: days })}
      />
      {!data ? (
        <Skeleton className="h-44 w-full" />
      ) : (
        <>
          <div className="mb-4 flex items-end gap-3">
            <div>
              <p className="text-xs text-muted">{t('scores.compare.rankLabel')}</p>
              <p className="font-display text-3xl font-semibold text-ink tabular">
                {t('scores.compare.rank', { position: data.rank.position, of: data.rank.of })}
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className={cn('truncate', row.mine ? 'font-semibold text-ink' : 'text-muted')}>{row.label}</span>
                  <span className="tabular font-medium text-ink">
                    {row.value == null ? t('scores.compare.noData') : formatRating(row.value, lang)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500 ease-azri', row.mine ? 'bg-primary' : 'bg-border-strong')}
                    style={{ width: `${row.value == null ? 0 : (row.value / 5) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">{t('scores.compare.rankHint')}</p>
        </>
      )}
    </Card>
  )
}

function QuestionsCard({ data }: { data: MyOverview | undefined }) {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const answered = data?.questions.some((q) => q.answered > 0)
  return (
    <Card padding="lg" className="lg:col-span-2">
      <CardHeader
        icon={<ListChecks strokeWidth={1.75} />}
        title={t('scores.questions.title')}
        description={data?.campaign ? t('scores.questions.description', { campaign: lt(data.campaign.title, lang) }) : undefined}
      />
      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : !answered ? (
        <EmptyState compact illustration={null} title={t('scores.questions.empty')} />
      ) : (
        <ul className="divide-y divide-border">
          {data.questions.map((q) => (
            <li key={q.questionId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
              <p className="min-w-0 flex-1 text-ink">{lt(q.text, lang)}</p>
              <div className="flex shrink-0 items-center gap-3">
                <Stars value={q.avg} />
                <span className="w-8 text-right font-medium text-ink tabular">{formatRating(q.avg, lang)}</span>
                <span className="w-24 text-right text-xs text-muted tabular">
                  {t('scores.questions.answered', { count: q.answered })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
