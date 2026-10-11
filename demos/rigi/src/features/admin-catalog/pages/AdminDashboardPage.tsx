import type { ReactNode } from 'react'
import { ArrowUpRight, Building2, ClipboardList, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  Badge,
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  KpiStrip,
  KpiTile,
  Mono,
  PageHeader,
  Skeleton,
} from '@/components/ui'
import { TaskStateChip } from '@/components/status'
import { formatDate, formatMoney, formatRelative, formatTaskNumber, localName } from '@/lib/format'
import { useStaffMe } from '@/lib/session'

import { useAdminDashboard } from '../api'

/* ------------------------------------------------------------ queue block */

interface QueueBlockProps {
  title: string
  count?: number
  viewAllTo?: string
  loading: boolean
  emptyText: string
  children: ReactNode
  empty: boolean
}

function QueueBlock({ title, count, viewAllTo, loading, emptyText, children, empty }: QueueBlockProps) {
  const { t } = useTranslation('admin-catalog')
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {title}
            {count !== undefined && count > 0 ? <span className="num rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted">{count}</span> : null}
          </span>
        }
        actions={
          viewAllTo ? (
            <Link to={viewAllTo} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              {t('dashboard.queue.viewAll')}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ) : null
        }
      />
      <CardBody className="flex-1 p-0">
        {loading ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : empty ? (
          <p className="px-4 py-6 text-sm text-muted">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-hairline">{children}</ul>
        )}
      </CardBody>
    </Card>
  )
}

function QueueRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-row-hover">
        {children}
      </Link>
    </li>
  )
}

/* --------------------------------------------------------------- the page */

export default function AdminDashboardPage() {
  const { t } = useTranslation(['admin-catalog', 'common'])
  const me = useStaffMe()
  const { data, error, refetch, isLoading } = useAdminDashboard()
  const k = data?.kpis

  const expiryLabel = (days: number): string => {
    if (days === 0) return t('dashboard.queue.today')
    if (days > 0) return t('dashboard.queue.inDays', { count: days })
    return t('dashboard.queue.expiredAgo', { count: Math.abs(days) })
  }

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title', { name: me ? localName(me).split(' ')[0] : '' })}
        description={t('dashboard.description')}
        meta={data ? <span className="text-xs text-muted">{t('dashboard.updated', { when: formatRelative(data.generatedAt) })}</span> : null}
      />

      {error ? (
        <div className="mb-4">
          <Banner
            tone="danger"
            title={t('errors.generic')}
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                {t('common:actions.retry')}
              </Button>
            }
          />
        </div>
      ) : null}

      <KpiStrip>
        <KpiTile
          index={1}
          label={t('dashboard.kpi.activePartners')}
          value={k?.activePartners.value ?? 0}
          trend={k?.activePartners.trend}
          delta={k?.activePartners.delta}
          deltaLabel={t('dashboard.kpi.vsLastMonth')}
          href="/admin/partners"
          loading={isLoading}
        />
        <KpiTile
          index={2}
          label={t('dashboard.kpi.perUserSeats')}
          value={k?.perUserSeats.value ?? 0}
          trend={k?.perUserSeats.trend}
          delta={k?.perUserSeats.delta}
          deltaLabel={t('dashboard.kpi.vsLastMonth')}
          href="/admin/licenses"
          loading={isLoading}
        />
        <KpiTile
          index={3}
          label={t('dashboard.kpi.syncedUsers')}
          value={k?.syncedUsers.value ?? 0}
          trend={k?.syncedUsers.trend}
          delta={k?.syncedUsers.delta}
          deltaLabel={t('dashboard.kpi.vsLastMonth')}
          href="/admin/partners"
          loading={isLoading}
        />
        <KpiTile
          index={4}
          label={t('dashboard.kpi.unpaidInvoices')}
          value={k?.unpaidInvoices.value ?? 0}
          trend={k?.unpaidInvoices.trend}
          delta={k?.unpaidInvoices.delta}
          deltaLabel={t('dashboard.kpi.vsLastMonth')}
          inverse
          tone="warning"
          href="/accountant/invoices?status=issued"
          loading={isLoading}
        />
      </KpiStrip>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="queue-title" className="min-w-0">
          <div className="mb-3">
            <h2 id="queue-title" className="font-display text-lg font-semibold text-ink">
              {t('dashboard.queue.title')}
            </h2>
            <p className="text-sm text-muted">{t('dashboard.queue.description')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <QueueBlock
              title={t('dashboard.queue.expiring')}
              count={data?.expiring.length}
              viewAllTo="/admin/partners"
              loading={isLoading}
              empty={!data?.expiring.length}
              emptyText={t('dashboard.queue.expiringEmpty')}
            >
              {data?.expiring.map((r) => (
                <QueueRow key={r.partnerId} to={`/admin/partners/${r.partnerId}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.partnerName}</div>
                    <div className="num text-xs text-muted">{formatDate(r.contractEndOn)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={r.daysLeft < 0 ? 'danger' : r.daysLeft <= 14 ? 'warning' : 'info'}>{expiryLabel(r.daysLeft)}</Badge>
                    {!r.isActive ? <span className="text-[11px] text-subtle">{t('dashboard.queue.disabled')}</span> : null}
                  </div>
                </QueueRow>
              ))}
            </QueueBlock>

            <QueueBlock
              title={t('dashboard.queue.overdue')}
              count={data?.overdue.length}
              viewAllTo="/accountant/invoices?status=issued"
              loading={isLoading}
              empty={!data?.overdue.length}
              emptyText={t('dashboard.queue.overdueEmpty')}
            >
              {data?.overdue.map((r) => (
                <QueueRow key={r.id} to={`/accountant/invoices/${r.id}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.partnerName}</div>
                    <Mono chip={false} className="text-xs text-muted">{r.invoiceNumber}</Mono>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-sm font-medium text-ink">{formatMoney(r.total, r.currency)}</span>
                    <span className="text-xs text-danger">{t('dashboard.queue.daysOverdue', { count: r.daysOverdue })}</span>
                  </div>
                </QueueRow>
              ))}
            </QueueBlock>

            <QueueBlock
              title={t('dashboard.queue.tasks')}
              viewAllTo="/l1/tasks"
              loading={isLoading}
              empty={!data?.openTasks.length}
              emptyText={t('dashboard.queue.tasksEmpty')}
            >
              {data?.openTasks.map((r) => (
                <QueueRow key={r.id} to={`/l1/tasks/${r.id}`}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Mono chip={false}>{formatTaskNumber(r.number)}</Mono>
                      <span className="truncate">{r.partnerName ?? t('common:internal')}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <TaskStateChip state={r.state} />
                    {r.pricingPending ? <span className="text-[11px] text-warning">{t('dashboard.queue.pricingPending')}</span> : null}
                  </div>
                </QueueRow>
              ))}
            </QueueBlock>

            <QueueBlock
              title={t('dashboard.queue.audit')}
              viewAllTo="/admin/audit"
              loading={isLoading}
              empty={!data?.audit.length}
              emptyText={t('dashboard.queue.auditEmpty')}
            >
              {data?.audit.map((r) => (
                <QueueRow key={r.id} to="/admin/audit">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{r.actorName}</div>
                    <Mono chip={false} className="text-xs text-muted">{r.action}</Mono>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatRelative(r.createdAt)}</span>
                </QueueRow>
              ))}
            </QueueBlock>
          </div>
        </section>

        <aside className="grid min-w-0 gap-4">
          <Card>
            <CardHeader
              title={t('dashboard.system.title')}
              actions={
                <Link to="/admin/system-health" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
                  {t('dashboard.system.open')}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
            <CardBody className="p-0">
              <Link to="/admin/system-health" className="block transition-colors hover:bg-row-hover" aria-label={t('dashboard.system.open')}>
                <dl className="divide-y divide-hairline text-sm">
                  {(
                    [
                      ['api', 'success'],
                      ['mail', 'info'],
                      ['jobs', 'neutral'],
                      ['storage', 'success'],
                    ] as const
                  ).map(([key, tone]) => (
                    <div key={key} className="flex min-h-10 items-center justify-between gap-3 px-4 py-2">
                      <dt className="text-muted">{t(`dashboard.system.${key}`)}</dt>
                      <dd>
                        <Badge tone={tone}>
                          {key === 'storage' ? t('dashboard.system.storageStatus', { value: '84%' }) : t(`dashboard.system.${key}Status`)}
                        </Badge>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('dashboard.quick.title')} />
            <CardBody className="grid gap-2">
              <Button variant="secondary" className="justify-start" icon={<Building2 />} asChild>
                <Link to="/admin/partners/new">{t('dashboard.quick.newPartner')}</Link>
              </Button>
              <Button variant="secondary" className="justify-start" icon={<ClipboardList />} asChild>
                <Link to="/admin/task-templates/new">{t('dashboard.quick.newTemplate')}</Link>
              </Button>
              <Button variant="secondary" className="justify-start" icon={<UserPlus />} asChild>
                <Link to="/admin/users/new">{t('dashboard.quick.newUser')}</Link>
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  )
}
