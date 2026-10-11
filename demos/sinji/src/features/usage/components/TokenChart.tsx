/** Input vs output tokens over time: hourly buckets for short windows, daily otherwise. */
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'

import { chartColors, chartTheme } from '@/components/ui'
import { formatNumber, formatTokens } from '@/lib/format'
import type { UsageBucket } from '../types'

interface Props {
  series: UsageBucket[]
  bucket: 'hour' | 'day'
}

interface TipProps {
  active?: boolean
  payload?: Array<{ payload: UsageBucket }>
  label?: string | number
  bucket: 'hour' | 'day'
}

function useStamp(bucket: 'hour' | 'day') {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const tick = new Intl.DateTimeFormat(lang, bucket === 'hour' ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' })
  const full = new Intl.DateTimeFormat(lang, bucket === 'hour' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { weekday: 'short', day: 'numeric', month: 'long' })
  return { tick: (ts: string) => tick.format(new Date(ts)), full: (ts: string) => full.format(new Date(ts)), lang }
}

function Tip({ active, payload, bucket }: TipProps) {
  const { t } = useTranslation('usage')
  const stamp = useStamp(bucket)
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-ctl border border-line bg-panel px-3 py-2 text-[12px] shadow-pop">
      <div className="mb-1 font-medium text-ink">{stamp.full(point.ts)}</div>
      <div className="flex items-center justify-between gap-6">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <i className="size-2 rounded-full" style={{ background: chartColors.primary }} />
          {t('chart.input')}
        </span>
        <span className="tabular font-mono">{formatNumber(point.input, stamp.lang)}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <i className="size-2 rounded-full" style={{ background: chartColors.accent }} />
          {t('chart.output')}
        </span>
        <span className="tabular font-mono">{formatNumber(point.output, stamp.lang)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-6 border-t border-line pt-1 text-muted">
        <span>{t('chart.calls')}</span>
        <span className="tabular font-mono">{formatNumber(point.calls, stamp.lang)}</span>
      </div>
    </div>
  )
}

export function TokenChart({ series, bucket }: Props) {
  const { t } = useTranslation('usage')
  const stamp = useStamp(bucket)
  const total = series.reduce((s, p) => s + p.input + p.output, 0)
  return (
    <div role="img" aria-label={t('chart.aria', { total: formatNumber(total, stamp.lang), n: series.length })}>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm" style={{ background: chartColors.primary }} />
          {t('chart.input')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm" style={{ background: chartColors.accent }} />
          {t('chart.output')}
        </span>
        <span className="ml-auto">{bucket === 'hour' ? t('chart.hourly') : t('chart.daily')}</span>
      </div>
      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="usage-in" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.32} />
                <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="usage-out" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.4} />
                <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis {...chartTheme.axis} dataKey="ts" tickFormatter={stamp.tick} minTickGap={28} axisLine={{ stroke: 'var(--color-line)' }} />
            <YAxis {...chartTheme.axis} width={44} axisLine={false} tickFormatter={(v: number) => formatTokens(v, stamp.lang)} />
            <Tooltip cursor={chartTheme.tooltip.cursor} content={<Tip bucket={bucket} />} />
            <Area type="monotone" dataKey="input" stackId="tok" stroke={chartColors.primary} strokeWidth={1.75} fill="url(#usage-in)" isAnimationActive={false} />
            <Area type="monotone" dataKey="output" stackId="tok" stroke={chartColors.accent} strokeWidth={1.75} fill="url(#usage-out)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
