import { CalendarClock } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardBody, CardHeader, DataTable, DateText, Money, PageHeader, ProgressBar, Skeleton, type Column } from '@/components/ui'
import { formatNumber, formatPercent, formatPeriod, formatPoints } from '@/lib/format'

import { usePortalPoints, type PointsHistoryRow } from '../api'
import { ErrorPanel } from '../components/ErrorPanel'
import { PointsChart } from '../components/PointsChart'

export default function PortalPointsPage() {
  const { t } = useTranslation(['ledger', 'common'])
  const { data, error, refetch } = usePortalPoints()
  const currency = data?.currency ?? 'GEL'
  const cur = data?.current

  const columns = useMemo<Column<PointsHistoryRow>[]>(
    () => [
      {
        key: 'period',
        header: t('points.history.period'),
        sortable: true,
        sortValue: (r) => r.year * 100 + r.month,
        cell: (r) => <span className="font-medium">{formatPeriod(r.year, r.month)}</span>,
      },
      {
        key: 'used',
        header: t('points.history.used'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.used,
        cell: (r) => (
          <span className="num">
            {formatNumber(r.used)} <span className="text-subtle">/ {formatNumber(r.allowance)}</span>
          </span>
        ),
      },
      {
        key: 'billable',
        header: t('points.history.billable'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.billablePoints,
        cell: (r) => <span className="num">{formatNumber(r.billablePoints)}</span>,
      },
      { key: 'rate', header: t('points.history.rate'), align: 'right', hideBelow: 'sm', cell: (r) => <Money amount={r.rate} currency={currency} /> },
      {
        key: 'cost',
        header: t('points.history.cost'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.cost,
        cell: (r) => (r.cost === 0 ? <span className="text-subtle">—</span> : <Money amount={r.cost} currency={currency} />),
      },
    ],
    [t, currency],
  )

  return (
    <>
      <PageHeader
        eyebrow={t('points.eyebrow')}
        title={t('points.title')}
        description={t('points.description')}
        meta={cur ? <span>{formatPeriod(cur.year, cur.month)}</span> : undefined}
      />
      {error ? (
        <ErrorPanel onRetry={() => void refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MeterCard label={t('points.meter.allowance')} loading={!cur}>
              {cur ? (
                <>
                  <p className="font-display text-3xl font-semibold num">{formatPoints(cur.allowance)}</p>
                  <p className="mt-1 text-xs text-muted">{t('points.meter.allowanceHint')}</p>
                </>
              ) : null}
            </MeterCard>
            <MeterCard label={t('points.meter.freeUsed')} loading={!cur}>
              {cur ? (
                <>
                  <p className="font-display text-3xl font-semibold num">
                    {formatPoints(cur.freeUsed)} <span className="text-base font-normal text-muted">({formatPercent(cur.freeUsedPct / 100)})</span>
                  </p>
                  <ProgressBar className="mt-3" value={cur.freeUsed} max={cur.allowance} tone={cur.freeUsedPct >= 100 ? 'warning' : 'primary'} />
                </>
              ) : null}
            </MeterCard>
            <MeterCard label={t('points.meter.remaining')} loading={!cur}>
              {cur ? (
                <>
                  <p className="font-display text-3xl font-semibold num">{formatPoints(cur.remaining)}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
                    <CalendarClock className="size-3.5" />
                    {t('points.meter.resets')} <DateText value={cur.resetOn} />
                  </p>
                </>
              ) : null}
            </MeterCard>
            <MeterCard label={t('points.meter.billable')} loading={!cur} accent={Boolean(cur && cur.billable.points > 0)}>
              {cur ? (
                <>
                  <p className="font-display text-3xl font-semibold num">{formatPoints(cur.billable.points)}</p>
                  <p className="mt-1 text-xs text-muted">
                    <span className="num">{formatNumber(cur.billable.points)}</span> × <Money amount={cur.billable.rate} currency={currency} /> ={' '}
                    <Money amount={cur.billable.amount} currency={currency} />
                  </p>
                </>
              ) : null}
            </MeterCard>
          </div>

          <Card className="mt-6">
            <CardHeader title={t('points.chart.title')} description={t('points.chart.description')} />
            <CardBody>{data ? <PointsChart history={data.history} /> : <Skeleton className="h-56 w-full" />}</CardBody>
          </Card>

          <div className="mt-6">
            <h2 className="font-display mb-2 text-lg font-semibold">{t('points.history.title')}</h2>
            <DataTable
              columns={columns}
              rows={data?.history.slice().reverse()}
              getRowId={(r) => `${r.year}-${r.month}`}
              pageSize={0}
              empty={{ title: t('points.history.empty') }}
            />
          </div>
        </>
      )}
    </>
  )
}

function MeterCard({ label, loading, accent, children }: { label: string; loading: boolean; accent?: boolean; children: React.ReactNode }) {
  return (
    <Card active={accent} className="p-4">
      <p className="eyebrow">{label}</p>
      <div className="mt-2">{loading ? <Skeleton className="h-9 w-32" /> : children}</div>
    </Card>
  )
}
