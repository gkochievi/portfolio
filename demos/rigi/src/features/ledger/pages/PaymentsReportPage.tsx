import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { DataTable, Money, PageHeader, Section, Skeleton, type Column } from '@/components/ui'
import { formatMonthYear } from '../lib/period'

import { usePaymentsReport, useReportsLive, type PaymentsReport } from '../api'
import { CurrencyTotals } from '../components/CurrencyTotals'
import { ErrorPanel } from '../components/ErrorPanel'
import { PeriodFilters } from '../components/PeriodFilters'

type Row = PaymentsReport['rows'][number]

export default function PaymentsReportPage() {
  const { t } = useTranslation(['ledger', 'common'])
  const [search, setSearch] = useSearchParams()
  const year = Number(search.get('year')) || new Date().getFullYear()
  const monthParam = Number(search.get('month'))
  const month = monthParam >= 1 && monthParam <= 12 ? monthParam : null
  useReportsLive()
  const { data, error, refetch } = usePaymentsReport(year, month)

  const update = (patch: { year?: number; month?: number | null }) => {
    const next = new URLSearchParams(search)
    if (patch.year !== undefined) next.set('year', String(patch.year))
    if (patch.month !== undefined) {
      if (patch.month === null) next.delete('month')
      else next.set('month', String(patch.month))
    }
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
      { key: 'currency', header: t('common:fields.currency'), cell: (r) => <span className="font-mono text-xs">{r.currency}</span>, hideBelow: 'sm' },
      { key: 'paid', header: t('reports.payments.paid'), align: 'right', sortable: true, sortValue: (r) => r.paid, cell: (r) => <Money amount={r.paid} currency={r.currency} /> },
      { key: 'count', header: t('reports.payments.invoiceCount'), align: 'right', sortable: true, sortValue: (r) => r.invoiceCount, cell: (r) => <span className="num">{r.invoiceCount}</span> },
    ],
    [t],
  )

  const periodLabel = formatMonthYear(year, month)

  return (
    <>
      <PageHeader
        eyebrow={t('reports.eyebrow')}
        title={t('reports.payments.title')}
        description={t('reports.payments.description')}
        back={{ to: '/accountant/reports', label: t('reports.title') }}
        meta={<span>{periodLabel}</span>}
      />
      <PeriodFilters year={year} month={month} allowAllMonths onYear={(y) => update({ year: y })} onMonth={(m) => update({ month: m })} />

      {error ? (
        <ErrorPanel onRetry={() => void refetch()} />
      ) : (
        <>
          <Section title={t('reports.totals')}>
            {data ? (
              <CurrencyTotals
                empty={t('reports.payments.none', { period: periodLabel })}
                tiles={data.totals.map((x) => ({ currency: x.currency, label: t('reports.payments.paid'), amount: x.paid, detail: t('reports.payments.invoices', { count: x.invoiceCount }) }))}
              />
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </Section>
          <Section title={t('reports.byPartner')}>
            <DataTable
              columns={columns}
              rows={data?.rows}
              getRowId={(r) => r.partnerId}
              pageSize={20}
              initialSort={{ key: 'paid', dir: 'desc' }}
              empty={{ title: t('reports.payments.none', { period: periodLabel }) }}
            />
          </Section>
        </>
      )}
    </>
  )
}
