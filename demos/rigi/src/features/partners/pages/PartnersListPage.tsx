import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { ActiveChip } from '@/components/status'
import {
  Avatar,
  Button,
  DataTable,
  FilterBar,
  SearchInput,
  SegmentedControl,
  type Column,
} from '@/components/ui'
import { PageHeader } from '@/components/ui'
import { formatMoney } from '@/lib/format'

import { usePartners, type PartnerRow, type PartnerStatusFilter } from '../api'

export default function PartnersListPage() {
  const { t } = useTranslation('partners')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PartnerStatusFilter>('all')
  const query = usePartners({ q, status })
  const rows = query.data?.items
  const total = query.data?.total ?? 0
  const filtered = rows?.length ?? 0

  const columns: Column<PartnerRow>[] = [
    {
      key: 'name',
      header: t('list.columns.name'),
      sortable: true,
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.name} size="sm" />
          <span className="truncate font-medium">{r.name}</span>
        </span>
      ),
    },
    {
      key: 'legalName',
      header: t('list.columns.legalName'),
      sortable: true,
      sortValue: (r) => r.legalName,
      hideBelow: 'md',
      cell: (r) => <span className="truncate text-muted">{r.legalName || '-'}</span>,
    },
    { key: 'currency', header: t('list.columns.currency'), sortable: true, sortValue: (r) => r.currency, mono: true, hideBelow: 'sm', cell: (r) => r.currency },
    {
      key: 'rate',
      header: t('list.columns.rate'),
      sortable: true,
      sortValue: (r) => r.ratePerPoint,
      align: 'right',
      cell: (r) => <span className="num">{formatMoney(r.ratePerPoint, r.currency)}</span>,
    },
    {
      key: 'allowance',
      header: t('list.columns.allowance'),
      sortable: true,
      sortValue: (r) => r.freeMonthlyAllowance,
      align: 'right',
      hideBelow: 'lg',
      cell: (r) => <span className="num">{t('list.allowanceValue', { count: r.freeMonthlyAllowance })}</span>,
    },
    {
      key: 'status',
      header: t('list.columns.status'),
      sortable: true,
      sortValue: (r) => (r.isActive ? 0 : 1),
      cell: (r) => <ActiveChip active={r.isActive} />,
    },
  ]

  const isFiltered = q.trim() !== '' || status !== 'all'

  return (
    <div>
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('list.title')}
        description={t('list.description')}
        actions={
          <Button asChild icon={<Plus />}>
            <Link to="/admin/partners/new">{t('list.new')}</Link>
          </Button>
        }
      />
      <FilterBar
        actions={
          <span className="num text-[13px] text-muted" aria-live="polite">
            {t('list.counter', { filtered, total })}
          </span>
        }
        onClear={isFiltered ? () => { setQ(''); setStatus('all') } : undefined}
      >
        <div className="min-w-[220px] flex-1 sm:max-w-sm">
          <SearchInput value={q} onChange={setQ} placeholder={t('list.searchPlaceholder')} />
        </div>
        <SegmentedControl<PartnerStatusFilter>
          aria-label={t('list.columns.status')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('list.segment.all') },
            { value: 'active', label: t('list.segment.active') },
            { value: 'inactive', label: t('list.segment.inactive') },
          ]}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        rowNumbers
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        rowHref={(r) => `/admin/partners/${r.id}`}
        initialSort={{ key: 'name', dir: 'asc' }}
        pageSize={0}
        empty={
          total === 0 && !isFiltered
            ? { title: t('list.noneTitle'), description: t('list.noneDescription') }
            : { title: t('list.emptyTitle'), description: t('list.emptyDescription') }
        }
      />
    </div>
  )
}
