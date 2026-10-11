import { FilePlus2, Files, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Banner, Button, KpiStrip, KpiTile, PageHeader } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import { useStaffMe } from '@/lib/session'
import { localName } from '@/lib/format'

import { useAccountantDashboard } from '../api'
import { InvoiceQueue } from '../components/InvoiceQueue'
import { errorMessage } from '../lib/errors'

export default function AccountantDashboardPage() {
  const { t } = useTranslation(['invoicing', 'common'])
  const me = useStaffMe()
  const { data, error, refetch, isLoading } = useAccountantDashboard()

  const revenue = data?.revenue.byCurrency ?? []
  const revenueValue =
    revenue.length === 0 ? formatMoney(0, 'GEL') : (
      <span className="inline-flex items-baseline gap-2">
        {formatMoney(revenue[0].amount, revenue[0].currency)}
        {revenue.length > 1 ? (
          <span
            className="text-base font-medium text-muted"
            title={revenue.slice(1).map((r) => formatMoney(r.amount, r.currency)).join(' · ')}
          >
            +{revenue.length - 1}
          </span>
        ) : null}
      </span>
    )

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={me ? t('dashboard.greeting', { name: localName(me).split(' ')[0] }) : t('dashboard.title')}
        description={t('dashboard.description')}
        actions={
          <>
            <Button variant="secondary" icon={<Files />} asChild>
              <Link to="/accountant/invoices">{t('actions.viewInvoices')}</Link>
            </Button>
            <Button variant="secondary" icon={<FilePlus2 />} asChild>
              <Link to="/accountant/invoices/new">{t('actions.newAdhoc')}</Link>
            </Button>
            <Button icon={<Wand2 />} asChild>
              <Link to="/accountant/invoices/generate">{t('actions.generate')}</Link>
            </Button>
          </>
        }
      />

      {error ? (
        <Banner tone="danger" title={errorMessage(t, error)} action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>{t('common:actions.retry')}</Button>} />
      ) : null}

      <KpiStrip>
        <KpiTile
          index={1}
          label={t('dashboard.kpi.activePartners')}
          value={data?.activePartners.value ?? 0}
          trend={data?.activePartners.trend}
          loading={isLoading}
          hint={t('dashboard.kpi.activePartnersHint')}
        />
        <KpiTile
          index={2}
          label={t('dashboard.kpi.drafts')}
          value={data?.drafts.value ?? 0}
          trend={data?.drafts.trend}
          href="/accountant/invoices?status=draft"
          tone="info"
          inverse
          loading={isLoading}
          hint={t('dashboard.kpi.draftsHint')}
        />
        <KpiTile
          index={3}
          label={t('dashboard.kpi.unpaid')}
          value={data?.unpaid.value ?? 0}
          trend={data?.unpaid.trend}
          href="/accountant/invoices?status=issued"
          tone="warning"
          inverse
          loading={isLoading}
          hint={
            data && data.unpaid.byCurrency.length > 0
              ? data.unpaid.byCurrency.map((r) => formatMoney(r.amount, r.currency)).join(' · ')
              : t('dashboard.kpi.unpaidHint')
          }
        />
        <KpiTile
          index={4}
          label={t('dashboard.kpi.revenue')}
          value={revenueValue}
          trend={data?.revenue.trend}
          tone="success"
          loading={isLoading}
          hint={t('dashboard.kpi.revenueHint', { count: data?.revenue.count ?? 0 })}
        />
      </KpiStrip>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <InvoiceQueue
          title={t('dashboard.queues.drafts')}
          description={t('dashboard.queues.draftsHint')}
          rows={data?.queues.drafts}
          dateOf={(r) => r.createdAt}
          dateLabel={t('dashboard.queues.created')}
          viewAll={{ to: '/accountant/invoices?status=draft', label: t('common:actions.showAll'), count: data?.counts.drafts }}
        />
        <InvoiceQueue
          title={t('dashboard.queues.overdue')}
          description={t('dashboard.queues.overdueHint')}
          rows={data?.queues.overdue}
          dateOf={(r) => r.dueAt}
          dateLabel={t('dashboard.queues.due')}
          viewAll={{ to: '/accountant/invoices?status=issued', label: t('common:actions.showAll'), count: data?.counts.overdue }}
        />
        <InvoiceQueue
          title={t('dashboard.queues.recentlyPaid')}
          description={t('dashboard.queues.recentlyPaidHint')}
          rows={data?.queues.recentlyPaid}
          dateOf={(r) => r.paidAt}
          dateLabel={t('dashboard.queues.paid')}
          viewAll={{ to: '/accountant/invoices?status=paid', label: t('common:actions.showAll') }}
        />
      </div>
    </div>
  )
}
