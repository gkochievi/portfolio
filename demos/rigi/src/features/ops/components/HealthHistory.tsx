import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'

import { Banner, Button, Card, CardBody, CardHeader, EmptyState, Field, NativeSelect, SegmentedControl, Skeleton } from '@/components/ui'
import { formatBytes, formatDate, formatDateTime, formatNumber, formatPercent, formatTime } from '@/lib/format'

import { useHealthHistory } from '../api'
import { HEALTH_METRICS, HISTORY_RANGES, metricDef, metricI18nKey, type HistoryRange, type MetricUnit } from '../lib/metrics'

export function formatMetric(unit: MetricUnit | undefined, n: number): string {
  switch (unit) {
    case 'bytes':
      return formatBytes(n)
    case 'ms':
      return `${formatNumber(n, { maximumFractionDigits: n < 10 ? 1 : 0 })} ms`
    case 'load':
      return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'up':
      return formatPercent(n, 0)
    default:
      return formatNumber(n, { maximumFractionDigits: 1 })
  }
}

export function HealthHistory({
  metric,
  range,
  onMetric,
  onRange,
  autoRefresh,
}: {
  metric: string
  range: HistoryRange
  onMetric: (m: string) => void
  onRange: (r: HistoryRange) => void
  autoRefresh: boolean
}) {
  const { t } = useTranslation('ops')
  const query = useHealthHistory(metric, range, autoRefresh)
  const def = metricDef(metric)
  const rangeDef = HISTORY_RANGES.find((r) => r.value === range)!
  const unit = def?.unit

  const data = useMemo(
    () =>
      (query.data ?? []).map((p) => ({
        at: Date.parse(p.bucketAt),
        avg: p.avg,
        min: p.min,
        max: p.max,
        band: [p.min, p.max] as [number, number],
      })),
    [query.data],
  )

  const options = useMemo(() => {
    const list = HEALTH_METRICS.map((m) => ({ value: m.key, label: `${t(`health.metrics.${metricI18nKey(m.key)}`)} (${m.key})` }))
    if (!def && metric) list.unshift({ value: metric, label: `${metric} (${t('health.unknownMetric')})` })
    return list
  }, [def, metric, t])

  const stats = useMemo(() => {
    if (!data.length) return null
    const avg = data.reduce((s, p) => s + p.avg, 0) / data.length
    return { avg, min: Math.min(...data.map((p) => p.min)), max: Math.max(...data.map((p) => p.max)) }
  }, [data])

  const tick = (v: number) => (range === '1h' || range === '24h' ? formatTime(v) : formatDate(v).slice(0, 5))

  return (
    <Card>
      <CardHeader
        title={t('health.history.title')}
        description={t('health.history.description', { bucket: t(`health.bucket.${rangeDef.bucket}`) })}
        actions={<SegmentedControl size="sm" value={range} onChange={(v) => onRange(v as HistoryRange)} options={HISTORY_RANGES.map((r) => ({ value: r.value, label: r.value }))} />}
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-end">
          <Field label={t('health.history.metric')} htmlFor="hh-metric">
            <NativeSelect id="hh-metric" value={metric} onChange={(e) => onMetric(e.target.value)} options={options} />
          </Field>
          {stats && (
            <dl className="num flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              {(['avg', 'min', 'max'] as const).map((k) => (
                <div key={k} className="flex items-baseline gap-1.5">
                  <dt className="text-muted">{t(`health.history.${k}`)}</dt>
                  <dd className="font-mono">{formatMetric(unit, stats[k])}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {query.isError ? (
          <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
            {query.error.message}
          </Banner>
        ) : query.isLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : data.length === 0 ? (
          <EmptyState compact title={t('health.history.emptyTitle')} description={def ? t('health.history.emptyNoData') : t('health.history.emptyUnknown', { metric })} />
        ) : (
          <div className="h-[280px] w-full text-muted" role="img" aria-label={t('health.history.chartLabel', { metric: def ? t(`health.metrics.${metricI18nKey(metric)}`) : metric })}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
                <XAxis dataKey="at" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-hairline)' }} minTickGap={36} />
                <YAxis width={56} domain={unit === 'up' ? [0, 1] : [0, 'auto']} tickFormatter={(v: number) => formatMetric(unit, v)} tick={{ fill: 'currentColor', fontSize: 11 }} tickLine={false} axisLine={false} />
                <ChartTooltip
                  isAnimationActive={false}
                  cursor={{ stroke: 'var(--color-hairline-strong, var(--color-hairline))' }}
                  content={({ active, payload }) => {
                    const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
                    if (!p) return null
                    return (
                      <div className="rounded-md border border-hairline bg-panel px-2.5 py-2 text-[12px] text-ink shadow-md">
                        <div className="num mb-1 text-muted">{formatDateTime(p.at)}</div>
                        <div className="num font-mono">
                          {t('health.history.avg')}: {formatMetric(unit, p.avg)}
                        </div>
                        <div className="num font-mono text-muted">
                          {formatMetric(unit, p.min)} – {formatMetric(unit, p.max)}
                        </div>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="band" stroke="none" fill="var(--chart-2)" fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
                <Line type="monotone" dataKey="avg" stroke="var(--chart-2)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
