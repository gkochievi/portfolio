import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, Money, PageHeader, ProgressBar, Section, Skeleton, type Column } from '@/components/ui'
import { formatPercent, formatPoints } from '@/lib/format'

import { useReportsLive, useUnusedAllowanceReport, type UnusedAllowanceReport } from '../api'
import { CurrencyTotals } from '../components/CurrencyTotals'
import { ErrorPanel } from '../components/ErrorPanel'
import { PeriodFilters } from '../components/PeriodFilters'
import { formatMonthYear } from '../lib/period'

type Row = UnusedAllowanceReport['rows'][number]

export default function UnusedAllowanceReportPage() {
  const { t } = useTranslation(['ledger', 'common'])
  const [search, setSearch] = useSearchParams()
  const today = new Date()
  const year = Number(search.get('year')) || today.getFullYear()
  const monthParam = Number(search.get('month'))
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : today.getMonth() + 1
  useReportsLive()
  const { data, error, refetch } = useUnusedAllowanceReport(year, month)

  const update = (patch: { year?: number; month?: number | null }) => {
    const next = new URLSearchParams(search)
    if (patch.year !== undefined) next.set('year', String(patch.year))
    if (patch.month) next.set('month', String(patch.month))
    setSearch(next, { replace: true })
  }

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'partner',
        header: t('common:fields.partner'),
        sortable: true,
        sortValue: (r) => r.partnerName,
        cell: (r) => (
          <Link to={`/accountant/partners/${r.partnerId}`} className="link">
            {r.partnerName}
          </Link>
        ),
      },
      { key: 'allowance', header: t('reports.unused.allowance'), align: 'right', hideBelow: 'md', sortable: true, sortValue: (r) => r.allowance, cell: (r) => <span className="num">{formatPoints(r.allowance)}</span> },
      {
        key: 'meter',
        header: t('reports.unused.usage'),
        width: '14rem',
        hideBelow: 'sm',
        cell: (r) => (
          <ProgressBar
            value={r.used}
            max={r.allowance}
            tone={r.allowance > 0 && r.used >= r.allowance ? 'warning' : 'primary'}
            showValue={`${formatPoints(r.used)} · ${formatPercent(r.allowance > 0 ? r.used / r.allowance : 0)}`}
          />
        ),
      },
      { key: 'used', header: t('reports.unused.used'), align: 'right', hideBelow: 'lg', sortable: true, sortValue: (r) => r.used, cell: (r) => <span className="num">{formatPoints(r.used)}</span> },
      { key: 'unused', header: t('reports.unused.unused'), align: 'right', sortable: true, sortValue: (r) => r.unused, cell: (r) => <span className="num font-medium">{formatPoints(r.unused)}</span> },
      {
        key: 'equivalent',
        header: t('reports.unused.equivalent'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.equivalent,
        cell: (r) => <Money amount={r.equivalent} currency={r.currency} />,
      },
    ],
    [t],
  )

  const periodLabel = formatMonthYear(year, month)

  return (
    <>
      <PageHeader
        eyebrow={t('reports.eyebrow')}
        title={t('reports.unused.title')}
        description={t('reports.unused.description')}
        back={{ to: '/accountant/reports', label: t('reports.title') }}
        meta={<span>{periodLabel}</span>}
      />
      <PeriodFilters year={year} month={month} allowAllMonths={false} onYear={(y) => update({ year: y })} onMonth={(m) => update({ month: m })} />

      {error ? (
        <ErrorPanel onRetry={() => void refetch()} />
      ) : (
        <>
          <Section title={t('reports.totals')}>
            {data ? (
              <CurrencyTotals
                empty={t('reports.unused.none')}
                tiles={data.totals.map((x) => ({ currency: x.currency, label: t('reports.unused.equivalent'), amount: x.equivalent, detail: t('reports.unused.unusedPoints', { points: formatPoints(x.unused) }) }))}
              />
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </Section>
          <Section title={t('reports.byPartner')} description={t('reports.unused.note')}>
            <DataTable
              columns={columns}
              rows={data?.rows}
              getRowId={(r) => r.partnerId}
              pageSize={20}
              initialSort={{ key: 'equivalent', dir: 'desc' }}
              empty={{ title: t('reports.unused.none') }}
            />
          </Section>
        </>
      )}
    </>
  )
}
