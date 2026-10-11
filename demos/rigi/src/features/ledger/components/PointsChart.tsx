import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatNumber, formatPeriod } from '@/lib/format'

import type { PointsHistoryRow } from '../api'

/** Twelve months of points: free (green) and billable (ochre) stacked, square caps. */
export function PointsChart({ history }: { history: PointsHistoryRow[] }) {
  const { t } = useTranslation(['ledger', 'common'])
  const data = history.map((h) => ({
    key: `${h.year}-${h.month}`,
    label: formatPeriod(h.year, h.month, true),
    free: h.freeUsed,
    billable: Math.max(0, h.billablePoints),
    allowance: h.allowance,
  }))
  const allowance = history[history.length - 1]?.allowance ?? 0

  return (
    <div className="h-56 w-full text-muted" role="img" aria-label={t('points.chart.aria')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--hairline, currentColor)" strokeOpacity={0.5} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: 'currentColor', fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 11 }} />
          {allowance > 0 ? <ReferenceLine y={allowance} stroke="var(--chart-1)" strokeDasharray="4 3" strokeOpacity={0.55} /> : null}
          <Tooltip
            cursor={{ fill: 'var(--chart-4)', fillOpacity: 0.12 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const row = payload[0]?.payload as (typeof data)[number]
              return (
                <div className="rounded-md border border-hairline-strong bg-panel px-3 py-2 text-xs text-ink shadow-md">
                  <p className="eyebrow mb-1">{label}</p>
                  <p className="num">
                    <span className="mr-1.5 inline-block size-2" style={{ background: 'var(--chart-2)' }} />
                    {t('points.chart.free')}: {formatNumber(row.free)}
                  </p>
                  <p className="num">
                    <span className="mr-1.5 inline-block size-2" style={{ background: 'var(--chart-3)' }} />
                    {t('points.chart.billable')}: {formatNumber(row.billable)}
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="free" stackId="pts" fill="var(--chart-2)" radius={0} isAnimationActive={false} />
          <Bar dataKey="billable" stackId="pts" fill="var(--chart-3)" radius={0} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Legend color="var(--chart-2)" label={t('points.chart.free')} />
        <Legend color="var(--chart-3)" label={t('points.chart.billable')} />
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: 'var(--chart-1)' }} />
          {t('points.chart.allowance')}
        </span>
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2" style={{ background: color }} />
      {label}
    </span>
  )
}
