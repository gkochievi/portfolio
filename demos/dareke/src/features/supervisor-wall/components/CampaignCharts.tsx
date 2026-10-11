/** Campaign progress panel and the calls-by-hour chart. */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLine, Target } from 'lucide-react'

import { EmptyState, Panel, ProgressBar, Select, Skeleton, Stat } from '@/components/ui'
import { formatNumber, formatPercent } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toneColor } from '@/lib/tone'
import { useCampaignProgress, useWallCampaigns, useWallHourly } from '../api'
import { ICON, QueryError } from './shared'

export function CampaignProgressPanel() {
  const { t } = useTranslation('wall')
  const l = useLocalized()
  const campaigns = useWallCampaigns()
  const [selected, setSelected] = useState<string | null>(null)
  const list = campaigns.data ?? []
  const current = selected && list.some((campaign) => campaign.id === selected) ? selected : (list[0]?.id ?? null)
  const progress = useCampaignProgress(current)
  const p = progress.data

  useEffect(() => {
    if (selected && campaigns.data && !campaigns.data.some((campaign) => campaign.id === selected)) setSelected(null)
  }, [campaigns.data, selected])

  return (
    <Panel
      title={t('progress.title')}
      description={t('progress.description')}
      icon={<Target {...ICON} />}
      actions={
        list.length > 0 ? (
          <Select
            className="w-full sm:w-64"
            size="sm"
            aria-label={t('progress.select')}
            value={current ?? ''}
            onValueChange={setSelected}
            options={list.map((campaign) => ({
              value: campaign.id,
              label: l(campaign.name),
              description: `${l(campaign.clientName)} · ${t(`common:campaignStatus.${campaign.status}`)} · ${t(`common:dialingMode.${campaign.dialingMode}`)}`,
            }))}
          />
        ) : undefined
      }
    >
      {campaigns.isError && !campaigns.data ? (
        <QueryError error={campaigns.error} onRetry={() => void campaigns.refetch()} />
      ) : !campaigns.data ? (
        <Skeleton className="h-56 rounded-card" />
      ) : list.length === 0 ? (
        <EmptyState compact title={t('progress.empty')} description={t('progress.emptyHint')} />
      ) : progress.isError && !p ? (
        <QueryError error={progress.error} onRetry={() => void progress.refetch()} />
      ) : !p ? (
        <Skeleton className="h-56 rounded-card" />
      ) : (
        <div className="space-y-4">
          <ProgressBar
            size="md"
            tone="lime"
            value={p.progress}
            label={t('progress.dialedOf', { dialed: formatNumber(p.dialed), total: formatNumber(p.totalNumbers) })}
            valueLabel={formatPercent(p.progress, 1)}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat size="sm" label={t('progress.total')} value={formatNumber(p.totalNumbers)} />
            <Stat size="sm" label={t('progress.dialed')} value={formatNumber(p.dialed)} tone="info" />
            <Stat size="sm" label={t('progress.connected')} value={formatNumber(p.connected)} tone="success" />
            <Stat size="sm" label={t('progress.pending')} value={formatNumber(p.pending)} tone="warning" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProgressBar tone="success" value={p.answerRate} label={t('progress.answerRate')} valueLabel={formatPercent(p.answerRate, 1)} />
            <ProgressBar tone="info" value={p.conversionRate} label={t('progress.conversionRate')} valueLabel={formatPercent(p.conversionRate, 1)} />
          </div>
          <p className="text-xs text-muted">{t('progress.footnote', { sales: p.sales, callbacks: p.callbacks, dnc: p.dnc })}</p>
        </div>
      )}
    </Panel>
  )
}

export function HourlyChart() {
  const { t } = useTranslation('wall')
  const hourly = useWallHourly()
  const dialedColor = toneColor('info')
  const connectedColor = toneColor('success')
  const total = (hourly.data ?? []).reduce((sum, bucket) => sum + bucket.dialed, 0)

  return (
    <Panel
      title={t('hourly.title')}
      description={t('hourly.description')}
      icon={<ChartLine {...ICON} />}
      actions={
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-info" aria-hidden />
            {t('hourly.dialed')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-success" aria-hidden />
            {t('hourly.connected')}
          </span>
        </div>
      }
    >
      {hourly.isError && !hourly.data ? (
        <QueryError error={hourly.error} onRetry={() => void hourly.refetch()} />
      ) : !hourly.data ? (
        <Skeleton className="h-60 rounded-card" />
      ) : total === 0 ? (
        <EmptyState compact title={t('hourly.empty')} description={t('hourly.emptyHint')} />
      ) : (
        <div className="h-60 w-full" role="img" aria-label={t('hourly.aria', { total })}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hourly.data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-hairline)' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ stroke: 'var(--color-hairline-strong)' }}
                contentStyle={{
                  background: 'var(--color-panel)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 6,
                  color: 'var(--color-ink)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-muted)' }}
              />
              <Line type="monotone" dataKey="dialed" name={t('hourly.dialed')} stroke={dialedColor} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="connected" name={t('hourly.connected')} stroke={connectedColor} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}
