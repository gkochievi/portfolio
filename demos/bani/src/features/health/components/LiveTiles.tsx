import type { ReactNode } from 'react'
import { Activity, Cpu, Gauge, HardDrive, MemoryStick, Timer, ArrowDownToLine, ArrowUpFromLine, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, ErrorState, LiveDot, SectionTitle, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtBytes, fmtNumber, fmtPct, fmtUptime, timeAgo } from '@/lib/format'
import { useLang, useTheme } from '@/shell/state'
import type { HostLiveSample, HostMetricRow } from '@/types'
import { useHostLive, useHostMetrics } from '../api'
import { chartColors, downsample, fmtRate } from '../lib/series'
import { useNow } from '../lib/useNow'

/** Filled line chart in an explicit series colour (the DS Sparkline only takes tones). */
function Spark({ values, color }: { values: readonly number[]; color: string }) {
  const h = 30
  const w = 120
  if (values.length < 2) return <div style={{ height: h }} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 5)).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 block w-full" style={{ height: h }} aria-hidden>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} fillOpacity={0.12} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function MetricTile({
  label,
  icon: Icon,
  value,
  hint,
  spark,
  color,
  alert,
}: {
  label: string
  icon: LucideIcon
  value: ReactNode
  hint?: ReactNode
  spark?: readonly number[]
  color: string
  alert?: 'warning' | 'danger'
}) {
  return (
    <Card className="flex flex-col gap-1.5 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        <Icon size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
      </div>
      <div
        className={cn('font-display text-[26px] font-bold leading-none tabular', alert === 'danger' ? 'text-danger' : alert === 'warning' ? 'text-warning' : 'text-ink')}
        style={{ letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      {hint && <div className="text-[12.5px] text-muted">{hint}</div>}
      {spark && <Spark values={spark} color={color} />}
    </Card>
  )
}

const seriesOf = (rows: readonly HostMetricRow[], pick: (r: HostMetricRow) => number, tail: number): number[] =>
  [...downsample(rows.map(pick), 95), tail]

export function LiveTiles() {
  const { t } = useTranslation('health')
  const lang = useLang()
  const theme = useTheme()
  const metrics = useHostMetrics(24)
  const live = useHostLive()
  const now = useNow(5_000)
  const colors = chartColors(theme)
  const [bronze, pine, brass, steel, sage] = colors as [string, string, string, string, string]

  const rows = metrics.data ?? []
  const l: HostLiveSample | undefined = live.data
  const collectorOn = l?.collectorRunning ?? false

  return (
    <section aria-label={t('live.title')} className="flex flex-col gap-3">
      <SectionTitle
        actions={
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <LiveDot tone={collectorOn ? 'success' : 'neutral'} still={!collectorOn} />
            {collectorOn ? t('collector.running') : t('collector.stopped')}
            {l && <span className="hidden text-faint sm:inline">· {t('collector.sampled', { ago: timeAgo(l.sampledAt, lang, now) })}</span>}
          </span>
        }
      >
        {t('live.title')}
      </SectionTitle>
      {metrics.isError && !metrics.data ? (
        <ErrorState error={metrics.error} onRetry={() => void metrics.refetch()} />
      ) : !l || (metrics.isLoading && !rows.length) ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[118px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label={t('live.cpu')}
            icon={Cpu}
            value={fmtPct(l.cpuPct, 0)}
            hint={t('live.peak', { value: fmtPct(Math.max(0, ...rows.map((r) => r.cpuPctMax)), 0) })}
            spark={seriesOf(rows, (r) => r.cpuPctAvg, l.cpuPct)}
            color={bronze}
            alert={l.cpuPct > 90 ? 'danger' : l.cpuPct > 75 ? 'warning' : undefined}
          />
          <MetricTile
            label={t('live.ram')}
            icon={MemoryStick}
            value={fmtPct((l.memUsedBytes / l.memTotalBytes) * 100, 0)}
            hint={t('live.ofTotal', { used: fmtBytes(l.memUsedBytes), total: fmtBytes(l.memTotalBytes) })}
            spark={seriesOf(rows, (r) => r.memUsedBytesAvg, l.memUsedBytes)}
            color={pine}
            alert={l.memUsedBytes / l.memTotalBytes > 0.9 ? 'warning' : undefined}
          />
          <MetricTile
            label={t('live.disk')}
            icon={HardDrive}
            value={fmtBytes(l.diskFreeBytes)}
            hint={t('live.freeOf', { pct: fmtPct((l.diskFreeBytes / l.diskTotalBytes) * 100, 0), total: fmtBytes(l.diskTotalBytes) })}
            spark={seriesOf(rows, (r) => r.diskFreeBytes, l.diskFreeBytes)}
            color={brass}
            alert={l.diskFreeBytes / l.diskTotalBytes < 0.1 ? 'danger' : l.diskFreeBytes / l.diskTotalBytes < 0.2 ? 'warning' : undefined}
          />
          <MetricTile
            label={t('live.rx')}
            icon={ArrowDownToLine}
            value={fmtRate(l.netRxBytesPerSec)}
            hint={t('live.peak', { value: fmtRate(Math.max(0, ...rows.map((r) => r.netRxBytesPerSecMax))) })}
            spark={seriesOf(rows, (r) => r.netRxBytesPerSecAvg, l.netRxBytesPerSec)}
            color={steel}
          />
          <MetricTile
            label={t('live.tx')}
            icon={ArrowUpFromLine}
            value={fmtRate(l.netTxBytesPerSec)}
            hint={t('live.peak', { value: fmtRate(Math.max(0, ...rows.map((r) => r.netTxBytesPerSecMax))) })}
            spark={seriesOf(rows, (r) => r.netTxBytesPerSecAvg, l.netTxBytesPerSec)}
            color={sage}
          />
          <MetricTile label={t('live.uptime')} icon={Timer} value={fmtUptime(l.uptimeSeconds, lang)} hint={t('live.sinceBoot')} color={pine} />
          <MetricTile
            label={t('live.load')}
            icon={Gauge}
            value={fmtNumber(l.loadAvg1, lang, 2)}
            hint={t('live.loadHint', { five: fmtNumber(l.loadAvg5, lang, 2), fifteen: fmtNumber(l.loadAvg15, lang, 2) })}
            spark={seriesOf(rows, (r) => r.loadAvg1, l.loadAvg1)}
            color={bronze}
          />
          <MetricTile
            label={t('live.processes')}
            icon={Activity}
            value={fmtNumber(l.processCount, lang)}
            spark={seriesOf(rows, (r) => r.processCount, l.processCount)}
            color={brass}
          />
        </div>
      )}
    </section>
  )
}
