/**
 * Supervisor wall (/supervisor: supervisor, admin, super_admin). Defaults to a
 * dark "wall mode" (a `.theme-dark` subtree) with an in-page switch to follow
 * the app theme instead. Everything refetches every 5 s plus bus invalidation.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Monitor } from 'lucide-react'

import { PageHeader, Switch, ToneDot } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/format'
import { useAutoDialer, useWallMetrics } from '../api'
import { CampaignProgressPanel, HourlyChart } from '../components/CampaignCharts'
import { DialerPanel } from '../components/DialerPanel'
import { AgentGrid, KpiStrip } from '../components/Floor'
import { LiveFeed } from '../components/LiveFeed'
import { ICON } from '../components/shared'

export default function SupervisorWallPage() {
  const { t } = useTranslation('wall')
  const [wallMode, setWallMode] = useState(true)
  const metrics = useWallMetrics()
  const dialer = useAutoDialer()

  return (
    <div
      className={cn(
        '-mx-4 -mb-24 -mt-5 min-h-[calc(100dvh-56px)] bg-paper px-4 pb-24 pt-5 text-ink sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        wallMode && 'theme-dark',
      )}
    >
      <div className="mx-auto max-w-[1680px] space-y-4">
        <PageHeader
          eyebrow={t('header.eyebrow')}
          title={
            <span className="inline-flex flex-wrap items-center gap-3">
              {t('pages.SupervisorWallPage')}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                <ToneDot tone="success" pulse />
                {t('header.live')}
              </span>
            </span>
          }
          description={
            metrics.data ? t('header.updated', { time: formatTime(metrics.data.updatedAt, true) }) : t('header.description')
          }
          actions={
            <div className="flex items-center gap-2 rounded-control border border-hairline bg-panel px-3 py-1.5">
              <Monitor {...ICON} className="text-muted" aria-hidden />
              <Switch checked={wallMode} onCheckedChange={setWallMode} label={t('header.wallMode')} aria-label={t('header.wallModeHint')} />
            </div>
          }
        />

        <KpiStrip targetAbandonRate={dialer.data?.targetAbandonRate ?? null} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <AgentGrid className="xl:col-span-2" />
          <LiveFeed />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CampaignProgressPanel />
          <HourlyChart />
        </div>

        <DialerPanel />

        <p className="text-xs text-muted">{t('common:demoDataNote')}</p>
      </div>
    </div>
  )
}
