/** /admin/statistics: range analytics computed in the browser from the session list + CSV export. */
import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Hourglass, MessageCircle, Radio, RefreshCw, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'

import { useMe } from '@/app/session'
import { Avatar, Button, Card, CardHeader, DataTable, DateRangePicker, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, lastDays, toast, type Column, type DateRange } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { formatDateTime, formatDuration, formatNumber, formatPercent, personName, pickText } from '@/lib/format'

import { useExportLog, useStatisticsSessions } from '../api'
import { useLang } from '../shared'
import { buildCsv, computeStats, downloadTextFile, STATS_SESSION_LIMIT, type OperatorRow } from '../stats'

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

interface HourDatum {
  hour: number
  count: number
}

function HourTooltip({ active, payload }: { active?: boolean; payload?: { payload: HourDatum }[] }) {
  const { t } = useTranslation('adminInsights')
  const datum = active ? payload?.[0]?.payload : undefined
  if (!datum) return null
  return (
    <div className="rounded-ui border border-line bg-panel px-3 py-2 text-sm shadow-pop">
      <p className="text-xs text-muted tabular">{`${hourLabel(datum.hour)} - ${hourLabel((datum.hour + 1) % 24)}`}</p>
      <p className="font-medium text-ink tabular">{t('statistics.chatsAt', { count: datum.count })}</p>
    </div>
  )
}

function Histogram({ hourly, peakHour }: { hourly: number[]; peakHour: number | null }) {
  const { t } = useTranslation('adminInsights')
  const [asTable, setAsTable] = useState(false)
  const data: HourDatum[] = hourly.map((count, hour) => ({ hour, count }))
  const peakText = peakHour === null ? t('statistics.noPeak') : t('statistics.peakSummary', { hour: hourLabel(peakHour), count: hourly[peakHour] })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{peakText}</p>
        <Button variant="ghost" size="xs" onClick={() => setAsTable((value) => !value)} aria-pressed={asTable}>
          {asTable ? t('statistics.showChart') : t('statistics.showTable')}
        </Button>
      </div>
      {asTable ? (
        <div className="grid max-h-64 grid-cols-2 gap-x-6 gap-y-1 overflow-y-auto text-sm sm:grid-cols-3 lg:grid-cols-4">
          {data.map((datum) => (
            <div key={datum.hour} className="flex justify-between border-b border-line py-1">
              <span className="text-muted tabular">{hourLabel(datum.hour)}</span>
              <span className="text-ink tabular">{datum.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <div role="img" aria-label={`${t('statistics.histogramLabel')}. ${peakText}`} className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={3}>
              <CartesianGrid vertical={false} stroke="var(--c-line)" strokeDasharray="2 4" />
              <XAxis dataKey="hour" tickFormatter={(hour: number) => String(hour)} tickLine={false} axisLine={{ stroke: 'var(--c-line-strong)' }} tick={{ fill: 'var(--c-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={6} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fill: 'var(--c-muted)', fontSize: 11 }} />
              <ChartTooltip content={<HourTooltip />} cursor={{ fill: 'var(--c-hover)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((datum) => (
                  <Cell key={datum.hour} fill="var(--c-accent)" fillOpacity={datum.hour === peakHour ? 1 : 0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ShareRow({ label, value, total }: { label: string; value: number; total: number }) {
  const { i18n } = useTranslation()
  const share = total ? value / total : 0
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-muted tabular">
          {formatNumber(value, i18n.language as 'en' | 'ka')} · {formatPercent(share, i18n.language as 'en' | 'ka')}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  )
}

export default function StatisticsPage() {
  const { t } = useTranslation('adminInsights')
  const { t: tc } = useTranslation()
  const lang = useLang()
  const me = useMe()
  const canExport = me.data?.account.role === 'admin'
  const [range, setRange] = useState<DateRange>(() => lastDays(7))
  const query = useStatisticsSessions(range)
  const exportLog = useExportLog()
  const sessions = query.data
  const stats = useMemo(() => (sessions ? computeStats(sessions) : null), [sessions])
  const truncated = (sessions?.length ?? 0) >= STATS_SESSION_LIMIT
  const loading = query.isLoading

  const exportCsv = () => {
    if (!sessions) return
    const filename = `chat-statistics-${range.from}-to-${range.to}.csv`
    const csv = buildCsv(
      sessions,
      {
        headers: {
          id: t('csv.id'),
          customer: t('csv.customer'),
          number: t('csv.number'),
          channel: t('csv.channel'),
          operator: t('csv.operator'),
          status: t('csv.status'),
          topic: t('csv.topic'),
          started: t('csv.started'),
          ended: t('csv.ended'),
          duration: t('csv.duration'),
          category: t('csv.category'),
          reason: t('csv.reason'),
          summary: t('csv.summary'),
          messages: t('csv.messages'),
          rating: t('csv.rating'),
        },
        channel: (channel) => tc(`channel.${channel}`),
        status: (status) => tc(`sessionStatus.${status}`),
        category: (category) => tc(`endCategory.${category}`),
        reason: (reason) => tc(`endReason.${reason}`),
        topic: (topic) => tc(`topic.${topic}`),
        operatorName: (operator) => personName(operator.name, lang),
        fieldLabel: (label) => pickText(label, lang),
      },
      lang,
    )
    downloadTextFile(filename, csv)
    exportLog.mutate(
      { from: range.from, to: range.to, rows: sessions.length, filename },
      {
        onSuccess: () => toast.success(t('statistics.exported', { count: sessions.length, filename })),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )
  }

  const columns: Column<OperatorRow>[] = [
    {
      id: 'operator',
      header: t('statistics.columns.operator'),
      sortValue: (row) => (row.operator ? personName(row.operator.name, lang) : ''),
      cell: (row) => (
        <span className="inline-flex min-w-0 items-center gap-2">
          <Avatar name={row.operator ? personName(row.operator.name, lang) : '?'} avatarId={row.operator?.avatarId ?? undefined} avatarUrl={row.operator?.avatarUrl ?? undefined} size="xs" />
          <span className="truncate text-sm font-medium">{row.operator ? personName(row.operator.name, lang) : row.id}</span>
        </span>
      ),
    },
    { id: 'total', header: t('statistics.columns.total'), align: 'right', sortValue: (row) => row.total, cell: (row) => <span className="tabular">{row.total}</span> },
    { id: 'finished', header: t('statistics.columns.finished'), align: 'right', sortValue: (row) => row.finished, cell: (row) => <span className="tabular">{row.finished}</span> },
    {
      id: 'avg',
      header: t('statistics.columns.avgDuration'),
      align: 'right',
      hideBelow: 'sm',
      sortValue: (row) => row.avgDurationSeconds,
      cell: (row) => <span className="tabular">{formatDuration(row.avgDurationSeconds)}</span>,
    },
    {
      id: 'completion',
      header: t('statistics.columns.completion'),
      width: '28%',
      sortValue: (row) => row.completion,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-sunken" role="img" aria-label={formatPercent(row.completion, lang)}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(row.completion * 100)}%` }} />
          </div>
          <span className="w-10 text-right text-sm text-muted tabular">{formatPercent(row.completion, lang)}</span>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('statistics.title')}
        description={t('statistics.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<RefreshCw size={16} strokeWidth={1.75} />} loading={query.isFetching && !loading} onClick={() => void query.refetch()}>
              {tc('actions.refresh')}
            </Button>
            {canExport ? (
              <Button variant="secondary" size="sm" leftIcon={<Download size={16} strokeWidth={1.75} />} disabled={!sessions || sessions.length === 0} loading={exportLog.isPending} onClick={exportCsv}>
                {t('statistics.exportCsv')}
              </Button>
            ) : null}
          </div>
        }
      />

      <DateRangePicker value={range} onChange={setRange} presets={[7, 30, 90]} />

      {truncated ? (
        <div role="alert" className="flex items-start gap-2 rounded-ui border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          <AlertTriangle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <span>{t('statistics.truncated', { count: STATS_SESSION_LIMIT })}</span>
        </div>
      ) : null}

      {query.isError && !sessions ? (
        <ErrorState title={tc('states.error')} description={errorMessage(query.error)} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
      ) : stats && stats.total === 0 ? (
        <Card>
          <EmptyState title={t('statistics.empty.title')} description={t('statistics.empty.description')} illustration="nest" />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('statistics.kpi.total')} value={stats ? formatNumber(stats.total, lang) : '-'} icon={<MessageCircle size={18} strokeWidth={1.75} />} loading={loading} />
            <StatCard label={t('statistics.kpi.live')} value={stats ? formatNumber(stats.liveNow, lang) : '-'} hint={t('statistics.kpi.liveHint')} icon={<Radio size={18} strokeWidth={1.75} />} tone="success" loading={loading} />
            <StatCard label={t('statistics.kpi.avgDuration')} value={stats ? formatDuration(stats.avgDurationSeconds) : '-'} hint={t('statistics.kpi.avgHint')} icon={<Hourglass size={18} strokeWidth={1.75} />} loading={loading} />
            <StatCard label={t('statistics.kpi.abandoned')} value={stats ? formatNumber(stats.abandoned, lang) : '-'} hint={t('statistics.kpi.abandonedHint')} icon={<UserX size={18} strokeWidth={1.75} />} tone={stats && stats.abandoned > 0 ? 'warning' : 'default'} loading={loading} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('statistics.hourly.title')} description={t('statistics.hourly.description')} />
              {stats ? <Histogram hourly={stats.hourly} peakHour={stats.peakHour} /> : <Skeleton className="h-56 w-full" />}
            </Card>
            <Card className="flex flex-col gap-4">
              <CardHeader title={t('statistics.closedBy.title')} description={t('statistics.closedBy.description')} />
              {stats ? (
                <>
                  <ShareRow label={tc('endCategory.operator')} value={stats.closedBy.operator} total={stats.total - stats.liveNow - stats.abandoned} />
                  <ShareRow label={tc('endCategory.customer')} value={stats.closedBy.customer} total={stats.total - stats.liveNow - stats.abandoned} />
                  <ShareRow label={tc('endCategory.system')} value={stats.closedBy.system} total={stats.total - stats.liveNow - stats.abandoned} />
                  <dl className="mt-auto grid gap-2 border-t border-line pt-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted">{t('statistics.firstChat')}</dt>
                      <dd className="text-ink">{stats.first ? `${stats.first.customerName} · ${formatDateTime(stats.first.at, lang)}` : '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">{t('statistics.lastChat')}</dt>
                      <dd className="text-ink">{stats.last ? `${stats.last.customerName} · ${formatDateTime(stats.last.at, lang)}` : '-'}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </Card>
          </div>

          <section aria-labelledby="per-operator" className="flex flex-col gap-2">
            <h2 id="per-operator" className="font-display text-base font-semibold text-ink">
              {t('statistics.perOperator')}
            </h2>
            <DataTable
              columns={columns}
              rows={stats?.perOperator}
              rowKey={(row) => row.id}
              loading={loading}
              pageSize={10}
              initialSort={{ id: 'total', dir: 'desc' }}
              empty={{ title: t('statistics.noOperators') }}
            />
          </section>
        </>
      )}
    </div>
  )
}
