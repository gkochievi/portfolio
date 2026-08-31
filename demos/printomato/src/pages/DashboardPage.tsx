import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Printer,
  Wallet,
  Wifi,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { useDashboard } from '@/lib/queries'
import { delta, formatCompact, formatDate, formatMoney, formatNumber, formatRelative } from '@/lib/format'
import { ActivityChart } from '@/components/charts/ActivityChart'
import { PaperMeter, ProgressBar, StatTile } from '@/components/charts/indicators'
import { Badge, EmptyState, Panel, PanelHeader, PageHeader, Skeleton } from '@/components/ui/primitives'
import type { AppNotification, Campaign, Device } from '@/types'

const RANGES = [7, 14, 30] as const

export function DashboardPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<number>(14)
  const { data, isPending, isError } = useDashboard(days)

  const analytics = data?.analytics
  const todayDelta = analytics ? delta(analytics.printed_today, analytics.printed_yesterday) : null

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <div className="flex items-center gap-1 rounded-control border border-hairline bg-white/3 p-0.5">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                className={cn(
                  'numeral rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  days === range ? 'bg-gold/15 text-gold' : 'text-ink-faint hover:text-ink-muted',
                )}
              >
                {range}d
              </button>
            ))}
          </div>
        }
      />

      {isError && (
        <Panel className="mb-5 border-danger/25 px-4 py-3">
          <p className="text-sm text-danger">{t('errors.loadFailed')}</p>
        </Panel>
      )}

      {/* ---- KPI row ---- */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label={t('dashboard.printedToday')}
          value={formatNumber(analytics?.printed_today)}
          icon={<Printer className="size-4" />}
          accent
          loading={isPending}
          trend={
            todayDelta
              ? { ...todayDelta, label: t('dashboard.vsYesterday') }
              : undefined
          }
        />
        <StatTile
          label={t('dashboard.totalPrinted')}
          value={formatCompact(analytics?.total_printed)}
          icon={<Layers className="size-4" />}
          loading={isPending}
          hint={t('dashboard.activityRange', { days })}
        />
        <StatTile
          label={t('dashboard.devicesOnline')}
          value={formatNumber(analytics?.online_devices)}
          unit={analytics ? `/ ${analytics.total_devices}` : undefined}
          icon={<Wifi className="size-4" />}
          loading={isPending}
          hint={t('dashboard.lowPaper') + `: ${analytics?.low_paper_devices ?? 0}`}
        />
        <StatTile
          label={t('dashboard.activeCampaigns')}
          value={formatNumber(analytics?.active_campaigns)}
          icon={<Activity className="size-4" />}
          loading={isPending}
          hint={`+${analytics?.upcoming_campaigns ?? 0} ${t('campaigns.upcoming').toLowerCase()}`}
        />
        <StatTile
          label={t('dashboard.revenueToday')}
          value={formatMoney(analytics?.revenue_today ?? 0)}
          icon={<Wallet className="size-4" />}
          loading={isPending}
          hint={`${analytics?.payments_today ?? 0} ${t('payments.total').toLowerCase()}`}
        />
      </section>

      {/* ---- Activity ---- */}
      <Panel className="mt-4 overflow-hidden">
        <PanelHeader
          title={t('dashboard.activity')}
          meta={t('dashboard.activityRange', { days })}
          icon={<Activity className="size-4" />}
        />
        <div className="px-4 py-5 sm:px-5">
          {isPending ? (
            <Skeleton className="h-40 w-full sm:h-48" />
          ) : (
            <ActivityChart data={data?.print_activity ?? []} />
          )}
        </div>
      </Panel>

      {/* ---- Fleet + alerts ---- */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title={t('dashboard.fleet')}
            meta={data ? `${data.devices.length}` : undefined}
            icon={<Printer className="size-4" />}
            action={
              <Link
                to="/devices"
                className="flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-gold-bright"
              >
                {t('nav.devices')}
                <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          {isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.devices.length ? (
            <ul className="divide-y divide-white/5">
              {data.devices.map((device) => (
                <FleetRow key={device.id} device={device} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Printer className="size-5" />} title={t('dashboard.fleetEmpty')} />
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title={t('dashboard.alerts')}
            meta={analytics ? `${analytics.open_notifications}` : undefined}
            icon={<AlertOctagon className="size-4" />}
            action={
              <Link
                to="/notifications"
                className="flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-gold-bright"
              >
                {t('common.all')}
                <ArrowUpRight className="size-3.5" />
              </Link>
            }
          />
          {isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : data?.notifications.length ? (
            <ul className="max-h-[26rem] divide-y divide-white/5 overflow-y-auto">
              {data.notifications.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="size-5 text-online" />}
              title={t('dashboard.alertsEmpty')}
            />
          )}
        </Panel>
      </section>

      {/* ---- Running campaigns ---- */}
      <section className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold tracking-[0.08em] text-ink uppercase">
            {t('dashboard.campaigns')}
          </h2>
          <Link
            to="/campaigns"
            className="flex items-center gap-1 text-xs font-medium text-gold transition-colors hover:text-gold-bright"
          >
            {t('nav.campaigns')}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        ) : data?.campaigns.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.campaigns.map((campaign) => (
              <RunningCampaign key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <Panel>
            <EmptyState icon={<Layers className="size-5" />} title={t('dashboard.campaignsEmpty')} />
          </Panel>
        )}
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ pieces */

function FleetRow({ device }: { device: Device }) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] sm:gap-4 sm:px-5">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          device.is_online ? 'animate-pulse-ring bg-online' : 'bg-offline',
        )}
        title={device.is_online ? t('devices.online') : t('devices.offline')}
      />

      <div className="min-w-0 flex-1">
        <Link
          to={`/devices/${device.id}/photos`}
          className="block truncate text-sm font-medium text-ink transition-colors hover:text-gold"
        >
          {device.name}
        </Link>
        <p className="numeral truncate text-[11px] text-ink-faint">
          {device.device_id}
          {device.location ? ` · ${device.location}` : ''}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 sm:block">
        <PaperMeter
          count={device.paper_count}
          capacity={device.paper_capacity}
          state={device.paper_state}
          size="sm"
          showLabel={false}
        />
        <p className="numeral mt-1 text-[10px] text-ink-faint">
          {device.paper_count}/{device.paper_capacity}
        </p>
      </div>

      <div className="w-16 shrink-0 text-right">
        <p className="numeral text-sm font-semibold text-ink">{formatNumber(device.total_printed)}</p>
        <p className="text-[10px] text-ink-faint">{t('devices.printed')}</p>
      </div>

      {device.has_notifications && (
        <AlertOctagon className="size-4 shrink-0 text-warn" aria-label={t('devices.viewAlerts')} />
      )}
    </li>
  )
}

function AlertRow({ alert }: { alert: AppNotification }) {
  return (
    <li className="flex gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] sm:px-5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-warn/12 text-warn">
        <AlertOctagon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{alert.device?.name ?? '—'}</p>
        <p className="truncate text-xs text-ink-muted">{alert.message_display}</p>
        <p className="mt-0.5 text-[11px] text-ink-faint">{formatRelative(alert.timestamp)}</p>
      </div>
      {alert.status === 2 && <Badge tone="gold">New</Badge>}
    </li>
  )
}

function RunningCampaign({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation()
  return (
    <Panel className="flex flex-col gap-3.5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/campaigns/${campaign.id}/photos`}
            className="block truncate text-sm font-semibold text-ink transition-colors hover:text-gold"
          >
            {campaign.name}
          </Link>
          <p className="mt-0.5 truncate text-xs text-ink-faint">
            {campaign.sponsor}
            {campaign.location ? ` · ${campaign.location}` : ''}
          </p>
        </div>
        <Badge tone="online" dot pulse>
          {t('campaigns.active')}
        </Badge>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-y border-hairline py-3">
        {[
          { label: t('campaigns.printed'), value: formatNumber(campaign.total_printed) },
          { label: t('campaigns.remaining'), value: formatNumber(campaign.photo_quantity) },
          { label: t('campaigns.live'), value: `${campaign.online_devices}/${campaign.total_devices}` },
        ].map((stat) => (
          <div key={stat.label}>
            <dt className="text-[10px] tracking-[0.08em] text-ink-faint uppercase">{stat.label}</dt>
            <dd className="numeral mt-0.5 text-base font-semibold text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="numeral text-ink-faint">{t('campaigns.progress', { gone: campaign.days_gone })}</span>
          <span className="numeral text-ink-faint">{formatDate(campaign.end_time)}</span>
        </div>
        <ProgressBar percent={campaign.days_gone_percentage} />
      </div>
    </Panel>
  )
}
