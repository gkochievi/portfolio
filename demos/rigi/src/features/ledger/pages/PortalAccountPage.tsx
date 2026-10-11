import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Card, CardBody, CardHeader, DataTable, KpiStrip, KpiTile, Money, PageHeader, SearchInput, Section, type Column } from '@/components/ui'
import { formatMoney, formatNumber } from '@/lib/format'

import { usePortalAccount, type PortalLicenseRow, type PortalRosterRow } from '../api'
import { ErrorPanel } from '../components/ErrorPanel'

const STATUS_TONE: Record<number, 'success' | 'info' | 'warning' | 'neutral' | 'accent'> = {
  0: 'neutral',
  1: 'success',
  2: 'info',
  3: 'accent',
  4: 'warning',
}

export default function PortalAccountPage() {
  const { t } = useTranslation(['ledger', 'common'])
  const { data, error, refetch } = usePortalAccount()
  const [query, setQuery] = useState('')
  const currency = data?.currency ?? 'GEL'

  const licenseColumns = useMemo<Column<PortalLicenseRow>[]>(
    () => [
      { key: 'name', header: t('account.licenses.license'), sortable: true, sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'code', header: t('account.licenses.code'), mono: true, cell: (r) => <span className="font-mono text-xs">{r.code}</span>, hideBelow: 'sm' },
      {
        key: 'unitPrice',
        header: t('account.licenses.unitPrice'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.unitPrice,
        cell: (r) => <Money amount={r.unitPrice} currency={currency} />,
        hideBelow: 'sm',
      },
      { key: 'seats', header: t('account.licenses.seats'), align: 'right', sortable: true, sortValue: (r) => r.seats, cell: (r) => <span className="num">{formatNumber(r.seats)}</span> },
      {
        key: 'users',
        header: t('account.licenses.users'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.users,
        cell: (r) => (r.kind === 'addon' ? <span className="text-subtle">{t('account.licenses.addon')}</span> : <span className="num">{formatNumber(r.users)}</span>),
      },
      {
        key: 'monthlyCost',
        header: t('account.licenses.monthlyCost'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.monthlyCost,
        cell: (r) => <Money amount={r.monthlyCost} currency={currency} />,
      },
    ],
    [t, currency],
  )

  const rosterColumns = useMemo<Column<PortalRosterRow>[]>(
    () => [
      { key: 'username', header: t('account.roster.username'), mono: true, sortable: true, sortValue: (r) => r.username, cell: (r) => <span className="font-mono text-xs">{r.username}</span> },
      { key: 'fullName', header: t('account.roster.fullName'), sortable: true, sortValue: (r) => r.fullName, cell: (r) => <span className="font-medium">{r.fullName}</span> },
      { key: 'role', header: t('account.roster.role'), sortable: true, sortValue: (r) => r.role, cell: (r) => <span className="capitalize text-muted">{r.role}</span>, hideBelow: 'md' },
      {
        key: 'status',
        header: t('account.roster.status'),
        hideBelow: 'sm',
        cell: (r) => <Badge tone={STATUS_TONE[r.statusCode] ?? 'neutral'}>{r.status}</Badge>,
      },
      {
        key: 'license',
        header: t('account.roster.license'),
        sortable: true,
        sortValue: (r) => r.licenseName ?? '',
        cell: (r) => (r.licenseName ? <span>{r.licenseName}</span> : <Badge tone="outline" dot={false}>{t('account.roster.unassigned')}</Badge>),
      },
      {
        key: 'cost',
        header: t('account.roster.cost'),
        align: 'right',
        sortable: true,
        sortValue: (r) => r.cost ?? -1,
        cell: (r) => (r.cost === null ? <span className="text-subtle">—</span> : <Money amount={r.cost} currency={currency} />),
      },
    ],
    [t, currency],
  )

  const rosterRows = useMemo(() => {
    if (!data) return undefined
    const q = query.trim().toLowerCase()
    if (!q) return data.roster
    return data.roster.filter((r) => [r.username, r.fullName, r.role, r.licenseName ?? '', r.licenseCode ?? ''].some((v) => v.toLowerCase().includes(q)))
  }, [data, query])

  return (
    <>
      <PageHeader eyebrow={t('account.eyebrow')} title={t('account.title')} description={t('account.description')} />

      {error ? (
        <ErrorPanel onRetry={() => void refetch()} />
      ) : (
        <>
          <KpiStrip>
            <KpiTile
              index={1}
              label={t('account.kpi.activeUsers')}
              value={data?.kpis.activeUsers ?? 0}
              loading={!data}
              hint={data ? t('account.kpi.licensedHint', { count: data.kpis.licensedUsers }) : undefined}
            />
            <KpiTile
              index={2}
              label={t('account.kpi.licenseTypes')}
              value={data?.kpis.licenseTypes ?? 0}
              loading={!data}
              hint={t('account.kpi.licenseTypesHint')}
            />
            <KpiTile
              index={3}
              label={t('account.kpi.monthlyCost')}
              value={data?.kpis.monthlyCost ?? 0}
              format={(n) => formatMoney(n, currency)}
              loading={!data}
              hint={t('account.kpi.monthlyCostHint')}
            />
          </KpiStrip>

          <Section title={t('account.licenses.title')} description={t('account.licenses.description')}>
            <DataTable
              columns={licenseColumns}
              rows={data?.licenses}
              getRowId={(r) => r.id}
              pageSize={0}
              empty={{ title: t('account.licenses.empty') }}
              footer={
                data && data.licenses.length > 0 ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="eyebrow">{t('account.licenses.total')}</span>
                    <Money amount={data.kpis.monthlyCost} currency={currency} />
                  </div>
                ) : undefined
              }
            />
          </Section>

          <Card>
            <CardHeader
              title={t('account.roster.title')}
              description={t('account.roster.description')}
              actions={<SearchInput value={query} onChange={setQuery} placeholder={t('account.roster.search')} />}
            />
            <CardBody className="p-0">
              <DataTable
                columns={rosterColumns}
                rows={rosterRows}
                getRowId={(r) => r.id}
                pageSize={15}
                initialSort={{ key: 'fullName', dir: 'asc' }}
                empty={query ? { title: t('common:states.noResults') } : { title: t('account.roster.empty') }}
              />
            </CardBody>
          </Card>
        </>
      )}
    </>
  )
}
