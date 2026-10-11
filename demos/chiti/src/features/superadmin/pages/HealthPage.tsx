import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowDownToLine, ArrowUpFromLine, Clock, Cpu, Gauge, HardDrive, MemoryStick, Wifi } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'

import { Card, ErrorState, KpiTile, LoadingBlock, PageHeader, SegmentedControl, Select, toast } from '@/components/ui'
import { formatDate, formatNumber, formatTime } from '@/lib/format'
import type { SystemHealthSample } from '@/types'

import { useHealth, useSetRetention, useSuperErrors } from '../api'
import type { HealthRange } from '../types'

type Metric = 'cpu' | 'mem' | 'ping' | 'lag' | 'net'
type Tone = 'default' | 'warning' | 'danger'

const RETENTION = [1, 3, 6, 12, 24]

function tone(value: number, warn: number, danger: number): Tone {
  return value >= danger ? 'danger' : value >= warn ? 'warning' : 'default'
}

function uptime(seconds: number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const days = Math.floor(seconds / 86_400)
  const hours = Math.floor((seconds % 86_400) / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return days > 0 ? t('health.uptimeDays', { d: days, h: hours, m: minutes }) : t('health.uptimeHours', { h: hours, m: minutes })
}

export default function HealthPage() {
  const { t, i18n } = useTranslation('superadmin')
  const lang = i18n.language
  const errors = useSuperErrors()
  const [range, setRange] = useState<HealthRange>('live')
  const [metric, setMetric] = useState<Metric>('cpu')
  const live = useHealth('live')
  const trend = useHealth(range)
  const retention = useSetRetention()

  const data = useMemo(
    () =>
      (trend.data?.samples ?? []).map((sample: SystemHealthSample) => ({
        t: Date.parse(sample.at),
        cpu: sample.cpuPercent,
        mem: sample.memPercent,
        ping: sample.pingMs,
        lag: sample.eventLoopLagMs,
        rx: sample.netRxKbps,
        tx: sample.netTxKbps,
      })),
    [trend.data],
  )

  if (live.isLoading) return <LoadingBlock label={t('common:states.loading')} />
  if (live.isError || !live.data) return <ErrorState title={t('health.error')} onRetry={() => void live.refetch()} retryLabel={t('common:actions.retry')} />

  const cur = live.data.current
  const tick = (ms: number) => (range === '7d' ? formatDate(ms, lang) : range === '24h' ? formatTime(ms) : formatTime(ms))
  const series: { key: string; color: string; name: string }[] =
    metric === 'net'
      ? [
          { key: 'rx', color: 'var(--c-accent)', name: t('health.netDown') },
          { key: 'tx', color: 'var(--c-primary)', name: t('health.netUp') },
        ]
      : [{ key: metric, color: 'var(--c-accent)', name: t(`health.metrics.${metric}`) }]
  const unit = metric === 'cpu' || metric === 'mem' ? '%' : metric === 'net' ? ' kbps' : ' ms'

  const changeRetention = async (value: string) => {
    try {
      await retention.mutateAsync(Number(value))
      toast.success(t('health.retention.saved', { count: Number(value) }))
    } catch (failure) {
      toast.error(errors.text(failure))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('health.title')} description={t('health.description')} />

      <section aria-label={t('health.live')} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile label={t('health.cpu')} value={`${cur.cpuPercent.toFixed(1)}%`} hint={t('health.load', { value: cur.loadAvg1.toFixed(2) })} icon={<Cpu />} tone={tone(cur.cpuPercent, 70, 90)} />
        <KpiTile label={t('health.memory')} value={`${cur.memPercent.toFixed(1)}%`} hint={`${formatNumber(cur.memUsedMb, lang)} / ${formatNumber(cur.memTotalMb, lang)} MB`} icon={<MemoryStick />} tone={tone(cur.memPercent, 80, 92)} />
        <KpiTile label={t('health.storage')} value={`${cur.diskPercent.toFixed(1)}%`} hint={`${cur.diskUsedGb.toFixed(1)} / ${cur.diskTotalGb} GB`} icon={<HardDrive />} tone={tone(cur.diskPercent, 80, 92)} />
        <KpiTile label={t('health.ping')} value={`${cur.pingMs} ms`} icon={<Wifi />} tone={tone(cur.pingMs, 120, 250)} />
        <KpiTile label={t('health.netDown')} value={`${formatNumber(cur.netRxKbps, lang)} kbps`} icon={<ArrowDownToLine />} />
        <KpiTile label={t('health.netUp')} value={`${formatNumber(cur.netTxKbps, lang)} kbps`} icon={<ArrowUpFromLine />} />
        <KpiTile label={t('health.lag')} value={`${cur.eventLoopLagMs.toFixed(1)} ms`} icon={<Gauge />} tone={tone(cur.eventLoopLagMs, 50, 150)} />
        <KpiTile label={t('health.uptime')} value={uptime(cur.uptimeSeconds, t)} icon={<Clock />} />
      </section>

      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink">
            <Activity size={18} strokeWidth={1.75} className="text-accent" aria-hidden />
            {t('health.trends')}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<Metric>
              aria-label={t('health.metric')}
              size="sm"
              value={metric}
              onChange={setMetric}
              options={(['cpu', 'mem', 'ping', 'lag', 'net'] as const).map((value) => ({ value, label: t(`health.metrics.${value}`) }))}
            />
            <SegmentedControl<HealthRange>
              aria-label={t('health.range')}
              size="sm"
              value={range}
              onChange={setRange}
              options={(['live', '1h', '24h', '7d'] as const).map((value) => ({ value, label: t(`health.ranges.${value}`) }))}
            />
          </div>
        </div>

        <div className="h-[300px] w-full" role="img" aria-label={t('health.chartLabel', { metric: t(`health.metrics.${metric}`), range: t(`health.ranges.${range}`) })}>
          {data.length === 0 ? (
            <LoadingBlock label={t('common:states.loading')} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--c-line)" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fill: 'var(--c-muted)', fontSize: 11 }} stroke="var(--c-line)" minTickGap={48} />
                <YAxis tick={{ fill: 'var(--c-muted)', fontSize: 11 }} stroke="var(--c-line)" width={44} domain={metric === 'cpu' || metric === 'mem' ? [0, 100] : [0, 'auto']} />
                <ChartTooltip
                  labelFormatter={(value) => `${formatDate(Number(value), lang)} ${formatTime(Number(value))}`}
                  formatter={(value) => `${value}${unit}`}
                  contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-line)', borderRadius: 10, fontSize: 12, color: 'var(--c-ink)' }}
                />
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {series.map((line) => (
                  <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={line.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-[12px] text-muted">{t(`health.rangeNote.${range}`)}</p>
      </Card>

      <Card padding="md" className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold text-ink">{t('health.retention.title')}</h2>
          <p className="text-[13px] text-muted">{t('health.retention.description')}</p>
        </div>
        <div className="w-44">
          <Select
            aria-label={t('health.retention.title')}
            value={String(live.data.retentionMonths)}
            onValueChange={(value) => void changeRetention(value)}
            disabled={retention.isPending}
            options={RETENTION.concat(RETENTION.includes(live.data.retentionMonths) ? [] : [live.data.retentionMonths])
              .sort((a, b) => a - b)
              .map((months) => ({ value: String(months), label: t('health.retention.months', { count: months }) }))}
          />
        </div>
      </Card>
    </div>
  )
}
