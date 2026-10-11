/**
 * One 30-day bar chart (sign-ups or rounds per day). Single series, so no
 * legend: the card title names it. Glacier bars, persimmon only for today.
 * No gridlines; the peak is called out in the header instead of on every bar.
 */
import { useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'

import { Card, Skeleton } from '@/components/ui'
import { chartTheme, useBrandColors } from '@/lib/brand'
import { formatDate, formatDayMonth, formatNumber } from '@/lib/format'
import type { DayCount } from '@/types'

/** `YYYY-MM-DD` as a local calendar day (never shifted through UTC). */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

const todayKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface DailyBarsProps {
  title: string
  /** Tooltip / table value label, e.g. "Sign-ups". */
  unit: string
  data: DayCount[] | undefined
}

export function DailyBars({ title, unit, data }: DailyBarsProps) {
  const { t, i18n } = useTranslation('insights')
  const colors = useBrandColors()
  const theme = chartTheme(colors)
  const reduce = useReducedMotion()
  const lang = i18n.language
  const today = todayKey()

  const summary = useMemo(() => {
    if (!data) return null
    const total = data.reduce((sum, d) => sum + d.count, 0)
    const peak = data.reduce<DayCount | null>((best, d) => (d.count > (best?.count ?? 0) ? d : best), null)
    return { total, peak }
  }, [data])

  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-semibold text-ink">{title}</h3>
        {summary ? (
          <p className="text-sm text-muted tabular-nums">
            {t('charts.total', { count: summary.total, value: formatNumber(summary.total, lang) })}
            {summary.peak && (
              <>
                {' · '}
                {t('charts.peak', { value: formatNumber(summary.peak.count, lang), day: formatDayMonth(parseDay(summary.peak.date), lang) })}
              </>
            )}
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
      </div>

      {!data ? (
        <Skeleton className="h-[200px] w-full" />
      ) : (
        <>
          <div className="h-[200px] w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDayMonth(parseDay(value), lang)}
                  tick={{ ...theme.axisTick, style: { fontVariantNumeric: 'tabular-nums' } }}
                  axisLine={theme.axisLine}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ ...theme.axisTick, style: { fontVariantNumeric: 'tabular-nums' } }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  cursor={theme.tooltip.cursor}
                  content={(props: TooltipProps<number, string>) => <DayTooltip {...props} unit={unit} lang={lang} today={today} />}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={!reduce}
                  animationDuration={350}
                  minPointSize={0}
                >
                  {data.map((d) => (
                    <Cell key={d.date} fill={d.date === today ? colors.accent : colors.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-block size-2.5 rounded-[3px] bg-accent" aria-hidden="true" />
            {t('charts.todayKey')}
          </p>
          {/* Table view for screen readers. */}
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t('charts.day')}</th>
                <th scope="col">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{formatDate(parseDay(d.date), lang)}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  )
}

function DayTooltip({
  active,
  payload,
  unit,
  lang,
  today,
}: TooltipProps<number, string> & { unit: string; lang: string; today: string }) {
  const { t } = useTranslation('insights')
  const row = payload?.[0]?.payload as DayCount | undefined
  if (!active || !row) return null
  return (
    <div className="rounded-card border-[1.5px] border-line bg-panel px-3 py-2 text-[13px] shadow-pop">
      <div className="font-semibold text-muted">
        {formatDate(parseDay(row.date), lang, { weekday: 'short', day: 'numeric', month: 'short' })}
        {row.date === today && <span className="ms-1.5 text-accent-ink">· {t('charts.today')}</span>}
      </div>
      <div className="mt-0.5 text-ink tabular-nums">
        {unit}: <span className="font-mono font-semibold">{formatNumber(row.count, lang)}</span>
      </div>
    </div>
  )
}
