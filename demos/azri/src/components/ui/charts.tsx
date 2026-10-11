/**
 * Small charts in the brand palette: Sparkline, TrendChart (responses bars +
 * average-rating line), DistributionBars (1-5), Meter. Colours come from CSS
 * variables, so they follow light/dark automatically.
 * Owner: design-system agent.
 */
import { Star } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatDateShort, formatNumber, formatPercent, formatRating } from '@/lib/format'
import { asLang, cn } from '@/lib/utils'

/* -------------------------------------------------------------- Sparkline */

export interface SparklineProps {
  /** Values in order; null = gap. */
  values: Array<number | null>
  height?: number
  /** CSS colour (default var(--primary)). */
  color?: string
  /** Fill under the line. Default true. */
  area?: boolean
  className?: string
  /** Accessible summary, e.g. "Responses, last 14 days". */
  label?: string
}

export function Sparkline({ values, height = 36, color = 'var(--primary)', area = true, className, label }: SparklineProps) {
  const gid = useId().replace(/:/g, '')
  const data = values.map((value, index) => ({ index, value }))
  return (
    <div className={cn('w-full', className)} style={{ height }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sg${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={area ? `url(#sg${gid})` : 'transparent'}
            isAnimationActive={false}
            connectNulls
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------- TrendChart */

export interface TrendDatum {
  /** yyyy-MM-dd */
  date: string
  responses: number
  avgRating: number | null
}

export interface TrendChartProps {
  data: TrendDatum[]
  height?: number
  /** Hide the average-rating line. */
  hideRating?: boolean
  className?: string
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number | null }>; label?: string }) {
  const { t, i18n } = useTranslation('common')
  const lang = asLang(i18n.language)
  if (!active || !payload?.length) return null
  const responses = payload.find((p) => p.dataKey === 'responses')?.value
  const rating = payload.find((p) => p.dataKey === 'avgRating')?.value
  return (
    <div className="rounded-xl border border-border bg-panel px-3 py-2 text-xs text-ink shadow-float">
      <div className="mb-1 font-semibold">{formatDateShort(label, lang)}</div>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-sm bg-[var(--primary)] opacity-70" />
        {t('chart.responses')}: <span className="font-semibold tabular">{formatNumber(responses ?? 0, lang)}</span>
      </div>
      {rating !== undefined && (
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-0.5 w-2.5 rounded bg-[var(--accent)]" />
          {t('chart.avgRating')}: <span className="font-semibold tabular">{formatRating(rating, lang)}</span>
        </div>
      )}
    </div>
  )
}

/** Daily responses (bars, left axis) and average rating (line, right axis 1-5). */
export function TrendChart({ data, height = 220, hideRating, className }: TrendChartProps) {
  const { i18n } = useTranslation()
  const lang = asLang(i18n.language)
  const tick = { fill: 'var(--muted)', fontSize: 11 }
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: hideRating ? 4 : 0, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={tick}
            minTickGap={24}
            tickFormatter={(value: string) => formatDateShort(value, lang)}
          />
          <YAxis yAxisId="r" allowDecimals={false} tickLine={false} axisLine={false} tick={tick} width={44} />
          {!hideRating && (
            <YAxis yAxisId="a" orientation="right" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} tick={tick} width={28} />
          )}
          <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'var(--ink)', fillOpacity: 0.04 }} />
          <Bar yAxisId="r" dataKey="responses" fill="var(--primary)" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          {!hideRating && (
            <Line
              yAxisId="a"
              type="monotone"
              dataKey="avgRating"
              stroke="var(--accent)"
              strokeWidth={2.25}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Legend row for TrendChart. */
export function TrendLegend({ hideRating, className }: { hideRating?: boolean; className?: string }) {
  const { t } = useTranslation('common')
  return (
    <div className={cn('flex flex-wrap items-center gap-4 text-xs text-muted', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-primary opacity-75" />
        {t('chart.responses')}
      </span>
      {!hideRating && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded bg-accent" />
          {t('chart.avgRating')}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------- DistributionBars */

export interface DistributionBarsProps {
  /** Counts for ratings 1..5 (index 0 = 1 star). */
  distribution: readonly number[]
  /** Show the percentage after the count. Default true. */
  showPercent?: boolean
  /** Brand-coloured bars inside the respondent frame. */
  barClassName?: string
  className?: string
}

/** Horizontal bars, 5 stars on top. Pure CSS. */
export function DistributionBars({ distribution, showPercent = true, barClassName, className }: DistributionBarsProps) {
  const { t, i18n } = useTranslation('common')
  const lang = asLang(i18n.language)
  const total = distribution.reduce((sum, n) => sum + n, 0)
  const max = Math.max(1, ...distribution)
  return (
    <ul className={cn('flex flex-col gap-2', className)} aria-label={t('chart.distribution')}>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = distribution[rating - 1] ?? 0
        const share = total ? (count / total) * 100 : 0
        return (
          <li key={rating} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-2.5 text-[13px]">
            <span className="inline-flex items-center gap-1 font-semibold tabular text-ink">
              {rating}
              <Star className="size-3.5 fill-current text-primary" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-ink/7" aria-hidden="true">
              <span
                className={cn(
                  'block h-full rounded-full transition-[width] duration-500 ease-azri',
                  rating >= 4 ? 'bg-primary' : rating === 3 ? 'bg-primary/55' : 'bg-primary/30',
                  barClassName,
                )}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="min-w-16 text-right tabular text-muted">
              <span className="font-semibold text-ink">{formatNumber(count, lang)}</span>
              {showPercent && <span className="ml-1.5">{formatPercent(share, lang)}</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ Meter */

export interface MeterProps {
  /** 0..100 */
  value: number | null
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent'
  /** Accessible label. */
  label?: string
  className?: string
}

/** Thin horizontal progress meter (response rate, CSAT share). */
export function Meter({ value, tone = 'primary', label, className }: MeterProps) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', accent: 'bg-mint' }[tone]
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-ink/8', className)}
    >
      <span className={cn('block h-full rounded-full transition-[width] duration-500 ease-azri', color)} style={{ width: `${v}%` }} />
    </span>
  )
}
