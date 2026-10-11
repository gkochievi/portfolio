/** Settings tab: read-only configuration, the dialing-mode card (with live auto-dialer state) and the script. */
import { Clock3, Hash, ListOrdered, Phone, RotateCcw, Server, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Badge, DescriptionList, Panel, Skeleton, Stat, ToneDot } from '@/components/ui'
import { formatTime } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import type { CampaignWithStats } from '@/types'

import { useAutoDialer } from '../api'

const i18 = { size: 18, strokeWidth: 1.75 } as const

function InfoCard({ icon, label, value, muted }: { icon: ReactNode; label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="rounded-card border border-hairline bg-panel p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <div className={muted ? 'mt-2 text-sm text-muted' : 'mt-2 font-mono text-base text-ink'}>{value}</div>
    </div>
  )
}

export function SettingsTab({ campaign }: { campaign: CampaignWithStats }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const l = useLocalized()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InfoCard icon={<Phone {...i18} />} label={t('settings.callerId')} value={campaign.callerId} />
        <InfoCard
          icon={<Server {...i18} />}
          label={t('settings.queue')}
          value={campaign.queueName ?? t('settings.notConfigured')}
          muted={!campaign.queueName}
        />
        <InfoCard icon={<Clock3 {...i18} />} label={t('settings.hours')} value={`${campaign.workingHoursStart} - ${campaign.workingHoursEnd}`} />
        <InfoCard icon={<Hash {...i18} />} label={t('settings.attempts')} value={campaign.maxAttempts} />
        <InfoCard icon={<RotateCcw {...i18} />} label={t('settings.retryDelay')} value={t('settings.minutes', { count: campaign.retryDelayMinutes })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={t('settings.modeTitle')} icon={<Zap {...i18} />} actions={<Badge tone={campaign.dialingMode === 'AUTO' ? 'lime' : 'muted'}>{tc(`dialingMode.${campaign.dialingMode}`)}</Badge>}>
          {campaign.dialingMode === 'MANUAL' && <p className="text-sm text-muted">{t('settings.manual')}</p>}
          {campaign.dialingMode === 'PREDICTIVE' && <Alert tone="info" title={t('comingSoon')}>{t('settings.predictive')}</Alert>}
          {campaign.dialingMode === 'AUTO' && <AutoMode campaign={campaign} />}
        </Panel>

        <Panel title={t('settings.script')} icon={<ListOrdered {...i18} />} description={t('settings.scriptHint')}>
          {campaign.script.length === 0 ? (
            <p className="text-sm text-muted">{t('settings.noScript')}</p>
          ) : (
            <ol className="space-y-3">
              {campaign.script.map((step, i) => (
                <li key={step.id} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-carbon font-mono text-xs text-on-carbon">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{l(step.title)}</p>
                    <p className="text-sm text-muted">{l(step.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  )
}

function AutoMode({ campaign }: { campaign: CampaignWithStats }) {
  const { t } = useTranslation('campaigns')
  const { t: tc } = useTranslation()
  const auto = useAutoDialer(true)
  const state = auto.data?.campaigns.find((c) => c.campaignId === campaign.id)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const backoff = state?.backoffUntil ? Math.max(0, Math.ceil((Date.parse(state.backoffUntil) - now) / 1000)) : 0
  const running = !!auto.data?.enabled && !!state?.isRunning && campaign.status === 'active'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat size="sm" label={t('settings.ratio')} value={<span className="font-mono">{campaign.dialRatio.toFixed(1)}x</span>} />
        <Stat size="sm" label={t('settings.maxConcurrent')} value={campaign.maxConcurrentCalls} />
        <Stat size="sm" label={t('settings.interval')} value={<span className="font-mono">{campaign.dialIntervalMs}</span>} hint="ms" />
      </div>
      <div className="rounded-card border border-hairline p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">{t('settings.liveTitle')}</p>
          {auto.data && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <ToneDot tone={running ? 'success' : 'muted'} pulse={running} />
              {running ? t('settings.running') : auto.data.enabled ? t('settings.idle') : t('settings.engineOff')}
            </span>
          )}
        </div>
        {auto.isLoading ? (
          <Skeleton className="h-20" />
        ) : auto.isError || !auto.data ? (
          <p className="text-sm text-muted">{t('settings.liveUnavailable')}</p>
        ) : !state ? (
          <p className="text-sm text-muted">{t('settings.liveNone')}</p>
        ) : (
          <>
            <DescriptionList
              columns={2}
              items={[
                { label: t('settings.available'), value: state.availableAgents, mono: true },
                { label: t('settings.target'), value: state.target, mono: true },
                { label: t('settings.inFlight'), value: `${state.inFlight} / ${state.maxConcurrentCalls}`, mono: true },
                { label: t('settings.errors'), value: state.consecutiveErrors, mono: true },
                { label: t('settings.lastDial'), value: state.lastDialAt ? formatTime(state.lastDialAt, true) : tc('time.never'), mono: true },
                { label: t('settings.abandon'), value: `${state.abandonRate.toFixed(1)}% / ${auto.data.targetAbandonRate}%`, mono: true },
              ]}
            />
            {backoff > 0 && (
              <Alert tone="warning" title={t('settings.backoff', { seconds: backoff })} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
