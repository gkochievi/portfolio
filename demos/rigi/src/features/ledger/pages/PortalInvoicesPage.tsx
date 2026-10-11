import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button, DataTable, DateText, Mono, Money, PageHeader, type Column } from '@/components/ui'
import { InvoiceDisplayStatusChip } from '@/components/status'
import { formatPeriod } from '@/lib/format'

import { usePortalInvoices, type PortalInvoiceRow } from '../api'
import { ErrorPanel } from '../components/ErrorPanel'

export default function PortalInvoicesPage() {
  const { t } = useTranslation(['ledger', 'common'])
  const navigate = useNavigate()
  const { data, error, refetch } = usePortalInvoices()

  const columns = useMemo<Column<PortalInvoiceRow>[]>(
    () => [
      {
        key: 'number',
        header: t('invoices.number'),
        sortable: true,
        sortValue: (r) => r.invoiceNumber,
        cell: (r) => <Mono chip={false}>{r.invoiceNumber}</Mono>,
      },
      {
        key: 'period',
        header: t('invoices.period'),
        sortable: true,
        sortValue: (r) => r.periodYear * 100 + r.periodMonth,
        cell: (r) =>
          r.kind === 'adhoc' && r.title ? (
            <span className="line-clamp-1 max-w-[18rem]" title={r.title}>
              {r.title}
            </span>
          ) : (
            formatPeriod(r.periodYear, r.periodMonth)
          ),
      },
      {
        key: 'status',
        header: t('common:fields.status'),
        sortable: true,
        sortValue: (r) => r.displayStatus,
        cell: (r) => <InvoiceDisplayStatusChip status={r.displayStatus} />,
      },
      {
        key: 'issued',
        header: t('invoices.issued'),
        sortable: true,
        sortValue: (r) => r.issuedAt ?? '',
        hideBelow: 'md',
        cell: (r) => (r.issuedAt ? <DateText value={r.issuedAt} /> : '—'),
      },
      {
        key: 'due',
        header: t('invoices.due'),
        sortable: true,
        sortValue: (r) => r.dueAt ?? '',
        hideBelow: 'md',
        cell: (r) => (r.dueAt ? <DateText value={r.dueAt} /> : '—'),
      },
      {
        key: 'total',
        header: t('invoices.total'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.total,
        cell: (r) => (
          <span className="inline-flex flex-col items-end leading-tight">
            <Money amount={r.total} currency={r.currency} />
            <span className="text-2xs text-subtle">{r.vatInclusive ? t('invoices.inclVat') : t('invoices.plusVat')}</span>
          </span>
        ),
      },
      {
        key: 'open',
        header: <span className="sr-only">{t('common:actions.open')}</span>,
        align: 'right',
        cell: (r) => (
          <Button size="xs" variant="outline" onClick={() => navigate(`/partner/invoices/${r.id}`)}>
            {t('common:actions.open')}
          </Button>
        ),
      },
    ],
    [t, navigate],
  )

  return (
    <>
      <PageHeader eyebrow={t('invoices.eyebrow')} title={t('invoices.title')} description={t('invoices.description')} />
      {error ? (
        <ErrorPanel onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          rowHref={(r) => `/partner/invoices/${r.id}`}
          initialSort={{ key: 'issued', dir: 'desc' }}
          pageSize={15}
          empty={{ title: t('invoices.empty'), description: t('invoices.emptyDescription') }}
        />
      )}
    </>
  )
}
