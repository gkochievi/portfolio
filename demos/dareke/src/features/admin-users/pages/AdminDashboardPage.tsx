/** /admin: admin dashboard (admin, super_admin). */
import { ArrowRight, BarChart3, FolderKanban, Megaphone, MonitorPlay, PhoneCall, Plus, Upload, Users, UserRoundCheck, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, EmptyState, PageHeader, Panel, ProgressBar, Skeleton, Stat, ToneDot } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { CampaignWithStats } from '@/types'

import { useAdminDashboard, useLiveStrip } from '../api'
import { CAMPAIGN_TONE, useErrorText } from '../components/shared'

const ICON = { size: 18, strokeWidth: 1.75 } as const

export default function AdminDashboardPage() {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  const errs = useErrorText()
  const dashboard = useAdminDashboard()
  const data = dashboard.data

  const stats = [
    { key: 'totalCampaigns', icon: <FolderKanban {...ICON} />, value: data?.totalCampaigns, tone: undefined },
    { key: 'activeCampaigns', icon: <Megaphone {...ICON} />, value: data?.activeCampaigns, tone: 'success' as const },
    { key: 'totalUsers', icon: <Users {...ICON} />, value: data?.totalUsers, tone: undefined },
    { key: 'activeOperators', icon: <UserRoundCheck {...ICON} />, value: data?.activeOperators, tone: 'info' as const },
    { key: 'callsToday', icon: <PhoneCall {...ICON} />, value: data?.callsToday, tone: 'lime' as const },
  ]

  const upload = data?.uploadCampaign ?? null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('pages.AdminDashboardPage')}
        description={t('dashboard.description')}
        actions={
          <Button variant="dial" icon={<Plus {...ICON} />} asChild>
            <Link to="/admin/campaigns?new=1">{t('dashboard.quick.createCampaign')}</Link>
          </Button>
        }
      />

      <LiveStrip />

      {dashboard.isError && !data ? (
        <Panel>
          <EmptyState
            title={tc('states.error')}
            description={errs.text(errorMessage(dashboard.error))}
            action={
              <Button variant="outline" onClick={() => void dashboard.refetch()}>
                {tc('actions.retry')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <Stat
              key={s.key}
              className={cn(i === stats.length - 1 && 'col-span-2 sm:col-span-1')}
              label={t(`dashboard.stats.${s.key}`)}
              hint={t(`dashboard.statHints.${s.key}`)}
              icon={s.icon}
              tone={s.tone}
              value={s.value == null ? <Skeleton className="h-8 w-16" /> : formatNumber(s.value)}
            />
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title={t('dashboard.recent.title')}
          description={t('dashboard.recent.description')}
          padded={false}
          actions={
            <Button variant="ghost" size="sm" iconRight={<ArrowRight {...ICON} />} asChild>
              <Link to="/admin/campaigns">{tc('actions.viewAll')}</Link>
            </Button>
          }
        >
          {!data ? (
            <ul className="divide-y divide-hairline">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex flex-col gap-2 px-4 py-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-2 w-full" />
                </li>
              ))}
            </ul>
          ) : data.recentCampaigns.length === 0 ? (
            <EmptyState
              compact
              title={t('dashboard.recent.emptyTitle')}
              description={t('dashboard.recent.emptyHint')}
              action={
                <Button variant="dial" size="sm" asChild>
                  <Link to="/admin/campaigns?new=1">{t('dashboard.quick.createCampaign')}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {data.recentCampaigns.map((c) => (
                <RecentCampaign key={c.id} campaign={c} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t('dashboard.quick.title')} icon={<Zap {...ICON} />} padded={false}>
          <ul className="divide-y divide-hairline">
            <QuickAction to="/admin/campaigns?new=1" icon={<Plus {...ICON} />} label={t('dashboard.quick.createCampaign')} hint={t('dashboard.quick.createCampaignHint')} primary />
            <QuickAction
              to={upload ? `/admin/campaigns/${upload.id}?tab=numbers` : null}
              icon={<Upload {...ICON} />}
              label={t('dashboard.quick.uploadNumbers')}
              hint={upload ? t('dashboard.quick.uploadNumbersHint', { name: l(upload.name) }) : data ? t('dashboard.quick.uploadNumbersNone') : ''}
            />
            <QuickAction to="/reports" icon={<BarChart3 {...ICON} />} label={t('dashboard.quick.viewReports')} hint={t('dashboard.quick.viewReportsHint')} />
            <QuickAction to="/supervisor" icon={<MonitorPlay {...ICON} />} label={t('dashboard.quick.openWall')} hint={t('dashboard.quick.openWallHint')} />
            <QuickAction to="/admin/campaigns" icon={<FolderKanban {...ICON} />} label={t('dashboard.quick.viewAll')} hint={t('dashboard.quick.viewAllHint')} />
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function RecentCampaign({ campaign: c }: { campaign: CampaignWithStats }) {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const l = useLocalized()
  return (
    <li>
      <Link to={`/admin/campaigns/${c.id}`} className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1 truncate font-medium text-ink group-hover:underline">{l(c.name)}</span>
          <Badge tone="ink" variant="outline" size="sm">
            {tc(`dialingMode.${c.dialingMode}`)}
          </Badge>
          <Badge tone={CAMPAIGN_TONE[c.status]} variant={c.status === 'active' ? 'solid' : 'soft'}>
            {tc(`campaignStatus.${c.status}`)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
          <span className="truncate">{l(c.clientName)}</span>
          <span aria-hidden>·</span>
          <span>{t('dashboard.recent.agents', { count: c.agentCount })}</span>
        </div>
        <ProgressBar
          value={c.stats.progress}
          tone={c.status === 'active' ? 'success' : 'ink'}
          size="xs"
          label={<span className="tabular">{t('dashboard.recent.dialed', { dialed: formatNumber(c.stats.dialed), total: formatNumber(c.stats.totalNumbers) })}</span>}
          valueLabel={<span className="tabular">{Math.round(c.stats.progress)}%</span>}
        />
      </Link>
    </li>
  )
}

function QuickAction({ to, icon, label, hint, primary }: { to: string | null; icon: ReactNode; label: string; hint: string; primary?: boolean }) {
  const inner = (
    <>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-control', primary ? 'bg-carbon text-on-carbon' : 'border border-hairline bg-sunken text-ink')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
      {to && <ArrowRight size={16} strokeWidth={1.75} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />}
    </>
  )
  return (
    <li>
      {to ? (
        <Link to={to} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none">
          {inner}
        </Link>
      ) : (
        <div className="flex cursor-not-allowed items-center gap-3 px-4 py-3 opacity-60" aria-disabled>
          {inner}
        </div>
      )}
    </li>
  )
}

/** On call / available / paused right now, from the wall's metrics. Renders nothing when unavailable. */
function LiveStrip() {
  const { t } = useTranslation('people')
  const tc = useTranslation().t
  const metrics = useLiveStrip()
  const m = metrics.data
  if (!m || metrics.isError) return null
  const items = [
    { key: 'onCall', tone: 'lime' as const, value: m.agentsOnCall, pulse: m.agentsOnCall > 0 },
    { key: 'available', tone: 'success' as const, value: Math.max(0, m.agentsWorking - m.agentsOnCall), pulse: false },
    { key: 'paused', tone: 'warning' as const, value: m.agentsPaused, pulse: false },
  ]
  return (
    <section aria-label={t('dashboard.live.title')} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-hairline bg-panel px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs font-semibold text-muted">
        <ToneDot tone="success" pulse />
        {t('dashboard.live.title')}
        <span className="sr-only">{tc('states.live')}</span>
      </span>
      {items.map((it) => (
        <span key={it.key} className="flex items-center gap-2 text-sm">
          <ToneDot tone={it.tone} pulse={it.pulse} />
          <span className="font-display text-lg font-extrabold tabular text-ink">{it.value}</span>
          <span className="text-muted">{t(`dashboard.live.${it.key}`)}</span>
        </span>
      ))}
      <Button variant="link" size="sm" className="ms-auto" iconRight={<ArrowRight size={16} strokeWidth={1.75} />} asChild>
        <Link to="/supervisor">{t('dashboard.live.openWall')}</Link>
      </Button>
    </section>
  )
}
