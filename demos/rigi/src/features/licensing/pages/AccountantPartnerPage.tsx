/** Partner billing profile. Route: /accountant/partners/:partnerId. Owner: licensing. */
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  DateText,
  EmptyState,
  Money,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  Sparkline,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Column,
} from '@/components/ui'
import { InvoiceDisplayStatusChip, InvoiceStatusChip } from '@/components/status'
import { formatDate, formatMoney, formatNumber, formatPeriod, formatPoints } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import { PartnerDocumentsPanel } from '@/features/partners/components/PartnerDocumentsPanel'

import { LicenseMapperPanel } from '../components/LicenseMapperPanel'
import { PartnerLicensesTab } from '../components/PartnerLicensesTab'
import { SyncedUsersPanel } from '../components/SyncedUsersPanel'
import { useAccountantPartner, type AccountantInvoiceRow } from '../api'
import { errorText } from '../lib/errors'

const TABS = ['invoices', 'seats', 'mapper', 'users', 'documents'] as const
type TabId = (typeof TABS)[number]

export default function AccountantPartnerPage() {
  const { t } = useTranslation('licensing')
  const { partnerId = '' } = useParams()
  const me = useStaffMe()
  const [search, setSearch] = useSearchParams()
  const canEdit = me?.role === 'superadmin' || me?.role === 'accountant'

  // Same endpoint under three roots so changes to partners, invoices or points all refresh this page.
  const profile = useAccountantPartner(partnerId, 'partners')
  const invoicesQ = useAccountantPartner(partnerId, 'invoices')
  const pointsQ = useAccountantPartner(partnerId, 'points')

  const tabParam = search.get('tab')
  const tab: TabId = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as TabId) : 'invoices'

  if (profile.isLoading) return <PageSkeleton />
  if (profile.error || !profile.data) {
    return (
      <>
        <PageHeader title={t('profile.title')} back={{ to: '/accountant', label: t('profile.back') }} />
        <Banner
          tone="danger"
          title={t('errors.loadFailed')}
          action={
            <Button size="sm" variant="secondary" onClick={() => void profile.refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        >
          {profile.error ? errorText(t, profile.error) : t('profile.notFound')}
        </Banner>
      </>
    )
  }

  const p = profile.data
  const currency = p.partner.currency
  const points = (pointsQ.data ?? p).points
  const invoices = (invoicesQ.data ?? p).invoices
  const license = p.license
  const history = p.users.history

  const invoiceColumns: Column<AccountantInvoiceRow>[] = [
    {
      key: 'number',
      header: t('profile.invoices.cols.number'),
      mono: true,
      sortable: true,
      sortValue: (r) => r.invoiceNumber,
      cell: (r) => (
        <Link to={`/accountant/invoices/${r.id}`} className="link font-mono text-xs">
          {r.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'kind',
      header: t('profile.invoices.cols.kind'),
      hideBelow: 'md',
      cell: (r) => (r.kind === 'adhoc' ? r.title || t('common:invoiceKind.adhoc') : t('common:invoiceKind.monthly')),
    },
    {
      key: 'period',
      header: t('profile.invoices.cols.period'),
      sortable: true,
      sortValue: (r) => r.periodYear * 100 + r.periodMonth,
      cell: (r) => formatPeriod(r.periodYear, r.periodMonth),
    },
    {
      key: 'status',
      header: t('profile.invoices.cols.status'),
      cell: (r) => (r.status === 'draft' ? <InvoiceStatusChip status="draft" /> : <InvoiceDisplayStatusChip status={r.displayStatus} />),
    },
    {
      key: 'total',
      header: t('profile.invoices.cols.total'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.total,
      cell: (r) => <Money amount={r.total} currency={r.currency} />,
    },
    { key: 'issued', header: t('profile.invoices.cols.issued'), hideBelow: 'md', cell: (r) => (r.issuedAt ? formatDate(r.issuedAt) : '—') },
    { key: 'due', header: t('profile.invoices.cols.due'), hideBelow: 'lg', cell: (r) => (r.dueAt ? formatDate(r.dueAt) : '—') },
    { key: 'paid', header: t('profile.invoices.cols.paid'), hideBelow: 'lg', cell: (r) => (r.paidAt ? <DateText value={r.paidAt} /> : '—') },
  ]

  const usedPct = points.allowance > 0 ? Math.min(100, Math.round((points.freeUsed / points.allowance) * 100)) : 0
  const over = points.chargeablePoints > 0

  return (
    <>
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        title={p.partner.name}
        description={p.partner.legalName}
        back={{ to: '/accountant', label: t('profile.back') }}
        meta={
          <>
            <Badge tone="outline" dot={false}>
              {p.partner.currency}
            </Badge>
            {!p.partner.isActive ? <Badge tone="neutral">{t('common:active.false')}</Badge> : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {/* Rate card */}
        <Card>
          <CardHeader title={t('profile.rate.title')} />
          <CardBody className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{t('profile.rate.perPoint')}</span>
              <span className="num text-lg font-semibold text-ink">{formatMoney(p.rateCard.ratePerPoint, currency)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{t('profile.rate.allowance')}</span>
              <span className="num font-medium text-ink">{formatPoints(p.rateCard.freeAllowance)}</span>
            </div>
            <p className="text-xs text-subtle">
              {p.rateCard.effectiveFrom ? t('profile.rate.since', { date: formatDate(p.rateCard.effectiveFrom) }) : t('profile.rate.default')}
            </p>
          </CardBody>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader title={t('profile.users.title')} />
          <CardBody className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="num text-3xl font-semibold leading-none text-ink">{p.users.latest === null ? '—' : formatNumber(p.users.latest)}</div>
                <p className="mt-1 text-xs text-subtle">
                  {p.users.day ? t('profile.users.asOf', { date: formatDate(p.users.day) }) : t('profile.users.noData')}
                </p>
              </div>
              {history.length > 1 ? <Sparkline values={history} width={120} height={36} fill /> : null}
            </div>
            <p className="text-xs text-muted">{t('profile.users.sparkLabel')}</p>
            <p className="text-sm text-muted">{t('profile.users.split', { active: p.users.active, billed: p.users.billed })}</p>
          </CardBody>
        </Card>

        {/* Points balance this month */}
        <Card>
          <CardHeader title={t('profile.points.title', { period: formatPeriod(points.year, points.month) })} />
          <CardBody className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{t('profile.points.remaining')}</span>
              <span className="num text-lg font-semibold text-ink">{formatPoints(points.remaining)}</span>
            </div>
            <ProgressBar value={points.freeUsed} max={Math.max(points.allowance, 1)} tone={over ? 'warning' : 'primary'} />
            <p className="text-xs text-muted">{t('profile.points.freeUsed', { used: formatPoints(points.freeUsed), allowance: formatPoints(points.allowance), pct: usedPct })}</p>
            {over ? (
              <p className="text-sm text-warning">
                {t('profile.points.chargeable', {
                  points: formatPoints(points.chargeablePoints),
                  amount: formatMoney(points.chargeableAmount, currency),
                })}
              </p>
            ) : (
              <p className="text-sm text-muted">{t('profile.points.noOverflow')}</p>
            )}
            {points.adjustments !== 0 ? <p className="text-xs text-subtle">{t('profile.points.adjustments', { amount: formatMoney(points.adjustments, currency) })}</p> : null}
          </CardBody>
        </Card>

        {/* License card */}
        <Card>
          <CardHeader title={t('profile.license.title')} />
          <CardBody className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">{t('profile.license.monthly')}</span>
              <span className="num text-lg font-semibold text-ink">{formatMoney(license.totals.monthlyCost, currency)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{t('profile.license.seats')}</span>
              <span className="num text-ink">
                {license.totals.taggedUsers} / {license.totals.perUserSeats}
              </span>
            </div>
            <ul className="space-y-0.5 text-xs text-muted">
              {license.rows.slice(0, 4).map((r) => (
                <li key={r.licenseId} className="flex justify-between gap-2">
                  <span className="truncate">{r.name}</span>
                  <span className="num shrink-0">
                    {r.seats} × {formatMoney(r.unitPrice, currency)}
                  </span>
                </li>
              ))}
            </ul>
            {license.unassignedCount > 0 ? <p className="text-xs text-warning">{t('seats.unassigned', { count: license.unassignedCount })}</p> : null}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = new URLSearchParams(search)
            next.set('tab', v)
            setSearch(next, { replace: true })
          }}
        >
          <TabsList>
            <TabsTrigger value="invoices" count={invoices.length}>
              {t('profile.tabs.invoices')}
            </TabsTrigger>
            <TabsTrigger value="seats">{t('profile.tabs.seats')}</TabsTrigger>
            <TabsTrigger value="mapper">{t('profile.tabs.mapper')}</TabsTrigger>
            <TabsTrigger value="users">{t('profile.tabs.users')}</TabsTrigger>
            <TabsTrigger value="documents">{t('profile.tabs.documents')}</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="pt-4">
            <DataTable
              columns={invoiceColumns}
              rows={invoices}
              getRowId={(r) => r.id}
              rowHref={(r) => `/accountant/invoices/${r.id}`}
              pageSize={10}
              initialSort={{ key: 'period', dir: 'desc' }}
              empty={
                <EmptyState
                  compact
                  title={t('profile.invoices.empty')}
                  description={t('profile.invoices.emptyHint')}
                  action={
                    canEdit ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/accountant/invoices/generate">{t('profile.invoices.generate')}</Link>
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </TabsContent>
          <TabsContent value="seats" className="pt-4">
            <PartnerLicensesTab partnerId={partnerId} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="mapper" className="pt-4">
            <LicenseMapperPanel partnerId={partnerId} canEdit={canEdit} />
          </TabsContent>
          <TabsContent value="users" className="pt-4">
            <SyncedUsersPanel partnerId={partnerId} canEdit={me?.role === 'superadmin'} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <PartnerDocumentsPanel partnerId={partnerId} canUpload canDelete={false} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
