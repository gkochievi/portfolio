import { FilePlus2, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { Button, DataTable, DateText, EmptyState, FilterBar, Mono, Money, NativeSelect, PageHeader, type Column } from '@/components/ui'
import { monthName } from '@/lib/format'
import type { InvoiceStatus } from '@/types'

import { useInvoices, usePartnerOptions, type InvoiceRow } from '../api'
import { InvoiceStatusCell } from '../components/InvoiceStatusCell'

const STATUSES: InvoiceStatus[] = ['draft', 'issued', 'paid', 'void']

export default function InvoicesPage() {
  const { t } = useTranslation(['invoicing', 'common'])
  const [search, setSearch] = useSearchParams()
  const filters = {
    partnerId: search.get('partnerId') ?? '',
    year: search.get('year') ?? '',
    month: search.get('month') ?? '',
    status: (search.get('status') ?? '') as InvoiceStatus | '',
  }
  const { data, error, refetch } = useInvoices(filters)
  const partners = usePartnerOptions()

  const setFilter = (key: keyof typeof filters, value: string) => {
    const next = new URLSearchParams(search)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearch(next, { replace: true })
  }
  const anyFilter = Object.values(filters).some(Boolean)

  const thisYear = new Date().getFullYear()
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2]

  const columns = useMemo<Column<InvoiceRow>[]>(
    () => [
      { key: 'number', header: t('table.number'), mono: true, sortable: true, sortValue: (r) => r.invoiceNumber, cell: (r) => <Mono chip={false}>{r.invoiceNumber}</Mono> },
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
      {
        key: 'period',
        header: t('table.period'),
        sortable: true,
        sortValue: (r) => r.periodYear * 100 + r.periodMonth,
        cell: (r) =>
          r.kind === 'adhoc' && r.title ? (
            <span className="line-clamp-1 max-w-[16rem]" title={r.title}>{r.title}</span>
          ) : (
            <span className="font-mono text-sm">{`${r.periodYear}-${String(r.periodMonth).padStart(2, '0')}`}</span>
          ),
      },
      { key: 'kind', header: t('table.kind'), sortable: true, sortValue: (r) => r.kind, hideBelow: 'md', cell: (r) => t(`common:invoiceKind.${r.kind}`) },
      { key: 'status', header: t('common:fields.status'), sortable: true, sortValue: (r) => STATUSES.indexOf(r.status), cell: (r) => <InvoiceStatusCell invoice={r} /> },
      { key: 'currency', header: t('common:fields.currency'), sortable: true, sortValue: (r) => r.currency, hideBelow: 'lg', mono: true, cell: (r) => r.currency },
      { key: 'total', header: t('common:fields.total'), align: 'right', sortable: true, sortValue: (r) => r.total, cell: (r) => <Money amount={r.total} currency={r.currency} /> },
      { key: 'issued', header: t('table.issued'), sortable: true, sortValue: (r) => r.issuedAt ?? '', hideBelow: 'md', cell: (r) => (r.issuedAt ? <DateText value={r.issuedAt} /> : <span className="text-subtle">—</span>) },
      { key: 'paid', header: t('table.paid'), sortable: true, sortValue: (r) => r.paidAt ?? '', hideBelow: 'lg', cell: (r) => (r.paidAt ? <DateText value={r.paidAt} /> : <span className="text-subtle">—</span>) },
    ],
    [t],
  )

  return (
    <div>
      <PageHeader
        eyebrow={t('list.eyebrow')}
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <>
            <Button variant="secondary" icon={<FilePlus2 />} asChild>
              <Link to="/accountant/invoices/new">{t('actions.newAdhoc')}</Link>
            </Button>
            <Button icon={<Wand2 />} asChild>
              <Link to={`/accountant/invoices/generate${filters.partnerId ? `?partnerId=${filters.partnerId}` : ''}`}>{t('actions.generate')}</Link>
            </Button>
          </>
        }
      />
      <FilterBar onClear={anyFilter ? () => setSearch(new URLSearchParams(), { replace: true }) : undefined}>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <NativeSelect
            aria-label={t('common:fields.partner')}
            className="col-span-2 sm:w-56"
            value={filters.partnerId}
            onChange={(e) => setFilter('partnerId', e.target.value)}
            options={[{ value: '', label: t('common:filters.allPartners') }, ...(partners.data ?? []).map((p) => ({ value: p.id, label: p.name }))]}
          />
          <NativeSelect
            aria-label={t('filters.year')}
            className="sm:w-32"
            value={filters.year}
            onChange={(e) => setFilter('year', e.target.value)}
            options={[{ value: '', label: t('filters.anyYear') }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
          />
          <NativeSelect
            aria-label={t('filters.month')}
            className="sm:w-40"
            value={filters.month}
            onChange={(e) => setFilter('month', e.target.value)}
            options={[{ value: '', label: t('filters.anyMonth') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))]}
          />
          <NativeSelect
            aria-label={t('common:fields.status')}
            className="col-span-2 sm:w-40"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            options={[{ value: '', label: t('common:filters.allStatuses') }, ...STATUSES.map((s) => ({ value: s, label: t(`common:invoiceStatus.${s}`) }))]}
          />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.items}
        getRowId={(r) => r.id}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(r) => `/accountant/invoices/${r.id}`}
        initialSort={{ key: 'number', dir: 'desc' }}
        caption={t('list.title')}
        empty={
          <EmptyState
            title={anyFilter ? t('common:states.noResults') : t('list.empty')}
            description={anyFilter ? t('list.emptyFiltered') : undefined}
            action={
              anyFilter ? (
                <Button variant="secondary" onClick={() => setSearch(new URLSearchParams(), { replace: true })}>
                  {t('common:actions.clear')}
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  )
}
