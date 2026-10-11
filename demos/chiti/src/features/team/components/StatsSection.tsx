import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Clock3, Hourglass, MessageSquareText, MessagesSquare, RefreshCw, Star, UserCheck, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardHeader, DateRangePicker, EmptyState, ErrorState, IconButton, KpiTile, SegmentedControl, lastDays, type DateRange } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDuration, formatNumber } from '@/lib/format'
import type { EndCategory, ReleaseReason } from '@/types'

import { useProfileStats } from '../api'

type Preset = 'today' | '7' | '30' | '90' | 'custom'

const END_TONE: Record<EndCategory, string> = {
  operator: 'bg-accent',
  customer: 'bg-info',
  system: 'bg-line-strong',
  missed: 'bg-danger',
}
const TRANSFER_REASONS: ReleaseReason[] = ['response_timeout', 'logout_grace', 'operator_removed', 'reassigned']
const END_CATEGORIES: EndCategory[] = ['operator', 'customer', 'system', 'missed']

function rangeFor(preset: Preset, custom: DateRange): DateRange {
  if (preset === 'custom') return custom
  return lastDays(preset === 'today' ? 1 : Number(preset))
}

function BarList({ rows, total, empty }: { rows: { key: string; label: string; value: number; className: string }[]; total: number; empty: string }) {
  if (total === 0) return <p className="py-4 text-sm text-muted">{empty}</p>
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span>{row.label}</span>
            <span className="tabular font-medium">{row.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${row.label}: ${row.value}`}>
            <div className={cn('h-full rounded-full', row.className)} style={{ width: `${Math.max(row.value > 0 ? 3 : 0, (row.value / total) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StatsSection() {
  const { t, i18n } = useTranslation('team')
  const lang = i18n.language === 'ka' ? 'ka' : 'en'
  const [preset, setPreset] = useState<Preset>('7')
  const [custom, setCustom] = useState<DateRange>(() => lastDays(14))
  const range = useMemo(() => rangeFor(preset, custom), [preset, custom])
  const stats = useProfileStats(range)
  const data = stats.data
  const loading = stats.isLoading

  const chartData = useMemo(
    () => (data?.daily ?? []).map((row) => ({ ...row, label: format(parseISO(row.date), 'd MMM') })),
    [data],
  )
  const endTotal = data ? END_CATEGORIES.reduce((sum, key) => sum + data.endCategories[key], 0) : 0
  const transferTotal = data ? TRANSFER_REASONS.reduce((sum, key) => sum + data.transfersAway[key], 0) : 0
  const tick = { fill: 'var(--c-muted)', fontSize: 11 }

  return (
    <section aria-labelledby="stats-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="stats-title" className="font-display text-lg font-semibold">{t('stats.title')}</h2>
          <p className="text-sm text-muted">{t('stats.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Preset>
            aria-label={t('stats.range')}
            value={preset}
            onChange={setPreset}
            options={[
              { value: 'today', label: t('stats.today') },
              { value: '7', label: t('stats.days', { count: 7 }) },
              { value: '30', label: t('stats.days', { count: 30 }) },
              { value: '90', label: t('stats.days', { count: 90 }) },
              { value: 'custom', label: t('stats.custom') },
            ]}
            size="sm"
          />
          <IconButton
            label={t('stats.refresh')}
            icon={<RefreshCw size={16} strokeWidth={1.75} className={stats.isFetching ? 'animate-spin' : undefined} />}
            variant="outline"
            size="sm"
            onClick={() => void stats.refetch()}
          />
        </div>
      </div>
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={custom} onChange={setCustom} presets={[]} max={lastDays(1).to} maxDays={92} />
          <span className="text-xs text-muted">{t('stats.maxRange')}</span>
        </div>
      ) : null}

      {stats.isError && !data ? (
        <ErrorState title={t('stats.error')} onRetry={() => void stats.refetch()} retryLabel={t('thread.retry')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile loading={loading} label={t('stats.chatsHandled')} value={data ? formatNumber(data.chatsHandled, lang) : '-'} icon={<MessagesSquare size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.chatsEndedByMe')} value={data ? formatNumber(data.chatsEndedByMe, lang) : '-'} icon={<UserCheck size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.activeNow')} value={data ? formatNumber(data.activeNow, lang) : '-'} icon={<Zap size={16} strokeWidth={1.75} />} tone="accent" hint={t('stats.activeNowHint')} />
            <KpiTile loading={loading} label={t('stats.rating')} value={data?.ratingAverage != null ? `${data.ratingAverage.toFixed(1)} / 5` : '-'} hint={data ? t('stats.ratingCount', { count: data.ratingCount }) : undefined} icon={<Star size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.messagesSent')} value={data ? formatNumber(data.messagesSent, lang) : '-'} icon={<MessageSquareText size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.customerMessages')} value={data ? formatNumber(data.customerMessages, lang) : '-'} icon={<MessageSquareText size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.avgFirstResponse')} value={data ? formatDuration(data.avgFirstResponseSeconds) : '-'} icon={<Clock3 size={16} strokeWidth={1.75} />} />
            <KpiTile loading={loading} label={t('stats.avgHandling')} value={data?.avgHandlingMinutes != null ? formatDuration(data.avgHandlingMinutes * 60) : '-'} icon={<Hourglass size={16} strokeWidth={1.75} />} />
          </div>

          <Card padding="md">
            <CardHeader title={t('stats.daily')} description={t('stats.dailyHint')} />
            {chartData.length === 0 || (data && data.chatsHandled === 0 && data.messagesSent === 0) ? (
              <EmptyState title={t('stats.noActivity')} description={t('stats.noActivityHint')} illustration="none" compact />
            ) : (
              <div className="h-60 w-full" role="img" aria-label={t('stats.daily')}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke="var(--c-line)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--c-line)' }} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis yAxisId="chats" tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                    <YAxis yAxisId="messages" orientation="right" tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                    <Tooltip
                      cursor={{ fill: 'var(--c-hover)' }}
                      contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-line)', borderRadius: 10, fontSize: 12, color: 'var(--c-ink)' }}
                      labelStyle={{ color: 'var(--c-ink)', fontWeight: 600 }}
                      formatter={(value, name) => [String(value), name === 'chats' ? t('stats.chatsHandled') : t('stats.messagesSent')]}
                    />
                    <Bar yAxisId="chats" dataKey="chats" fill="var(--c-primary)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                    <Line yAxisId="messages" dataKey="messages" type="monotone" stroke="var(--c-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden />{t('stats.chatsHandled')}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-accent" aria-hidden />{t('stats.messagesSent')}</span>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="md">
              <CardHeader title={t('stats.endings')} description={t('stats.endingsHint')} />
              <BarList
                total={endTotal}
                empty={t('stats.noEndings')}
                rows={END_CATEGORIES.map((key) => ({ key, label: t(`stats.end.${key}`), value: data?.endCategories[key] ?? 0, className: END_TONE[key] }))}
              />
            </Card>
            <Card padding="md">
              <CardHeader title={t('stats.transfers')} description={t('stats.transfersHint')} />
              <BarList
                total={transferTotal}
                empty={t('stats.noTransfers')}
                rows={TRANSFER_REASONS.map((key) => ({ key, label: t(`stats.transfer.${key}`), value: data?.transfersAway[key] ?? 0, className: 'bg-warning' }))}
              />
            </Card>
          </div>
        </>
      )}
    </section>
  )
}
