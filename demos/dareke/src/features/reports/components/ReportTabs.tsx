/** The three /reports tabs: agent performance, campaign report, call detail. */
import { BarChart3, Download, Play, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Alert, Avatar, Button, DataTable, EmptyState, Field, Panel, Select, Skeleton, Stat, Toolbar, type Column } from '@/components/ui'
import { errorMessage } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { formatDateTime, formatDuration, formatNumber, formatPercent, maskPhone } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toast } from '@/lib/toast'
import { toneColor } from '@/lib/tone'
import type { AgentPerformanceRow, CallRecordView } from '@/types'

import { useAgentPerformance, useCallDetailReport, useCampaignReport, useReportFilters } from '../api'
import type { CallDetailParams, DateRange } from '../types'
import { DateRangeFields, DispositionBadge, NoRecording, fileStamp, lastDays, toRange, type DateInputs } from './shared'

const ICON = { size: 18, strokeWidth: 1.75 } as const

type RangeErrors = Partial<Record<'from' | 'to', string>>

/** Date inputs + validation -> a generated range (auto-generated once on mount). */
function useGeneratedRange(days: number) {
  const { t } = useTranslation('reports')
  const [inputs, setInputs] = useState<DateInputs>(() => lastDays(days))
  const [errors, setErrors] = useState<RangeErrors>({})
  const [range, setRange] = useState<DateRange | null>(() => {
    const r = toRange(lastDays(days))
    return 'range' in r ? r.range : null
  })
  /** Validates the inputs; `same` = the range did not change (the caller refetches). */
  const generate = (): { range: DateRange; same: boolean } | null => {
    const r = toRange(inputs)
    if ('error' in r) {
      setErrors({ [r.error.field]: t(r.error.key) })
      return null
    }
    setErrors({})
    const same = range != null && range.from === r.range.from && range.to === r.range.to
    setRange(r.range)
    return { range: r.range, same }
  }
  const change = (next: DateInputs) => {
    setInputs(next)
    setErrors({})
  }
  return { inputs, setInputs: change, errors, range, generate }
}

function ErrorAlert({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Alert tone="danger" title={t('states.error')} action={<Button size="sm" onClick={onRetry}>{t('actions.retry')}</Button>}>
      {errorMessage(error)}
    </Alert>
  )
}

/* ------------------------------------------------------ agent performance */

export function AgentPerformanceTab() {
  const { t } = useTranslation('reports')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const { inputs, setInputs, errors, range, generate } = useGeneratedRange(7)
  const query = useAgentPerformance(range)
  const rows = query.data

  const totals = useMemo(() => {
    const list = rows ?? []
    return {
      calls: list.reduce((s, r) => s + r.callsHandled, 0),
      talk: list.reduce((s, r) => s + r.talkTime, 0),
      sales: list.reduce((s, r) => s + r.sales, 0),
    }
  }, [rows])

  const columns: Column<AgentPerformanceRow>[] = [
    {
      key: 'agent',
      header: t('perf.agent'),
      sortValue: (r) => l(r.agentName),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={r.agentName.en} size={26} />
          <span className="truncate font-medium">{l(r.agentName)}</span>
        </span>
      ),
    },
    { key: 'calls', header: t('perf.callsHandled'), align: 'right', sortValue: (r) => r.callsHandled, cell: (r) => <span className="tabular">{r.callsHandled}</span> },
    { key: 'talk', header: t('perf.talkTime'), align: 'right', sortValue: (r) => r.talkTime, cell: (r) => <span className="font-mono tabular">{formatDuration(r.talkTime)}</span> },
    { key: 'avg', header: t('perf.avgDuration'), align: 'right', hideOnMobile: true, sortValue: (r) => r.avgCallDuration, cell: (r) => <span className="font-mono tabular">{formatDuration(r.avgCallDuration)}</span> },
    { key: 'sales', header: t('perf.sales'), align: 'right', sortValue: (r) => r.sales, cell: (r) => <span className="tabular font-semibold text-success">{r.sales}</span> },
    { key: 'callbacks', header: t('perf.callbacks'), align: 'right', hideOnMobile: true, sortValue: (r) => r.callbacks, cell: (r) => <span className="tabular text-info">{r.callbacks}</span> },
    { key: 'ni', header: t('perf.notInterested'), align: 'right', hideOnMobile: true, sortValue: (r) => r.notInterested, cell: (r) => <span className="tabular text-muted">{r.notInterested}</span> },
  ]

  const exportCsv = () => {
    if (!rows?.length) return
    const filename = `agent_performance_${fileStamp()}.csv`
    downloadCsv(filename, [
      [t('perf.agent'), t('perf.callsHandled'), t('perf.talkTimeSec'), t('perf.avgDurationSec'), t('perf.sales'), t('perf.callbacks'), t('perf.notInterested')],
      ...rows.map((r) => [l(r.agentName), r.callsHandled, r.talkTime, r.avgCallDuration, r.sales, r.callbacks, r.notInterested]),
    ])
    toast.success(t('export.done', { count: rows.length, filename }))
  }

  return (
    <div className="space-y-4">
      <Toolbar
        className="items-end"
        end={
          <Button icon={<Download {...ICON} />} onClick={exportCsv} disabled={!rows?.length}>
            {tc('actions.exportCsv')}
          </Button>
        }
      >
        <DateRangeFields value={inputs} onChange={setInputs} errors={errors} />
        <Button variant="dial" icon={<Play {...ICON} />} loading={query.isFetching} onClick={() => generate()?.same && void query.refetch()}>
          {t('actions.generate')}
        </Button>
      </Toolbar>

      {query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {rows && rows.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Stat size="sm" label={t('perf.totalCalls')} value={formatNumber(totals.calls)} />
              <Stat size="sm" label={t('perf.totalTalk')} value={formatDuration(totals.talk)} />
              <Stat size="sm" tone="success" label={t('perf.totalSales')} value={formatNumber(totals.sales)} />
            </div>
          )}
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.agentId}
            loading={query.isLoading}
            initialSort={{ key: 'calls', dir: 'desc' }}
            pageSize={0}
            empty={<EmptyState icon={<Users {...ICON} />} title={t('perf.empty')} description={t('empty.tryRange')} compact />}
          />
        </>
      )}
    </div>
  )
}

/* -------------------------------------------------------- campaign report */

export function CampaignReportTab() {
  const { t } = useTranslation('reports')
  const l = useLocalized()
  const filters = useReportFilters()
  const { inputs, setInputs, errors, range, generate } = useGeneratedRange(30)
  const [campaignId, setCampaignId] = useState<string>('')
  const [campaignError, setCampaignError] = useState<string>()
  const [generatedId, setGeneratedId] = useState<string | null>(null)

  // Pick the first active campaign once the list arrives and show its report.
  useEffect(() => {
    if (campaignId || !filters.data) return
    const first = filters.data.campaigns.find((c) => c.status === 'active') ?? filters.data.campaigns[0]
    if (first) {
      setCampaignId(first.id)
      setGeneratedId(first.id)
    }
  }, [filters.data, campaignId])

  const query = useCampaignReport(generatedId, range)
  const report = query.data

  const onGenerate = () => {
    if (!campaignId) {
      setCampaignError(t('validation.campaignRequired'))
      return
    }
    setCampaignError(undefined)
    const g = generate()
    if (!g) return
    if (g.same && campaignId === generatedId) void query.refetch()
    setGeneratedId(campaignId)
  }

  const options = (filters.data?.campaigns ?? []).map((c) => ({
    value: c.id,
    label: l(c.name),
    description: t(`campaignStatus.${c.status}`, { ns: 'common' }),
  }))
  const chartData = (report?.breakdown ?? []).map((b) => ({ name: l(b.name), value: b.count, fill: toneColor(b.color) }))
  const disposed = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-4">
      <Toolbar className="items-end">
        <Field label={t('filters.campaign')} error={campaignError} className="w-full sm:w-72">
          <Select
            value={campaignId || undefined}
            onValueChange={(v) => {
              setCampaignId(v)
              setCampaignError(undefined)
            }}
            options={options}
            placeholder={filters.isLoading ? t('filters.loading') : t('filters.pickCampaign')}
            invalid={!!campaignError}
            aria-label={t('filters.campaign')}
          />
        </Field>
        <DateRangeFields value={inputs} onChange={setInputs} errors={errors} />
        <Button variant="dial" icon={<Play {...ICON} />} loading={query.isFetching} onClick={onGenerate}>
          {t('actions.generate')}
        </Button>
      </Toolbar>

      {query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : !report ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('campaign.totalDialed')} value={formatNumber(report.totalDialed)} hint={t('campaign.answeredHint', { count: report.answered })} />
            <Stat label={t('campaign.answerRate')} tone="info" value={formatPercent(report.answerRate, 1)} />
            <Stat label={t('campaign.conversionRate')} tone="success" value={formatPercent(report.conversionRate, 1)} hint={t('campaign.conversionHint')} />
            <Stat label={t('campaign.avgTalk')} value={formatDuration(report.avgTalkTime)} />
          </div>
          {disposed === 0 ? (
            <Panel>
              <EmptyState icon={<BarChart3 {...ICON} />} title={t('campaign.empty')} description={t('empty.tryRange')} compact />
            </Panel>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title={t('campaign.pieTitle')} description={t('campaign.pieHint', { count: disposed })}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={1.5} stroke="var(--color-panel)" strokeWidth={2} isAnimationActive={false}>
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTip total={disposed} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  {chartData.map((d) => (
                    <li key={d.name} className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} aria-hidden />
                      <span className="truncate">{d.name}</span>
                      <span className="ml-auto font-mono tabular text-muted">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title={t('campaign.barTitle')} description={t('campaign.barHint')}>
                <div style={{ height: Math.max(220, chartData.length * 38) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: 'var(--color-ink)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'var(--color-hairline)', opacity: 0.4 }} content={<ChartTip total={disposed} />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
                        {chartData.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface TipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: { name: string; value: number; fill: string } }>
  total: number
}

function ChartTip({ active, payload, total }: TipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null
  return (
    <div className="rounded-control border border-hairline bg-panel px-3 py-2 text-xs shadow-pop">
      <div className="flex items-center gap-2 font-medium text-ink">
        <span className="size-2.5 rounded-sm" style={{ background: item.fill }} aria-hidden />
        {item.name}
      </div>
      <div className="mt-1 font-mono tabular text-muted">
        {item.value} · {formatPercent(total ? (item.value / total) * 100 : 0, 1)}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ call detail */

export function CallDetailTab() {
  const { t } = useTranslation('reports')
  const { t: tc } = useTranslation()
  const l = useLocalized()
  const filters = useReportFilters()
  const { inputs, setInputs, errors, range, generate } = useGeneratedRange(7)
  const [campaignId, setCampaignId] = useState('all')
  const [agentId, setAgentId] = useState('all')
  const [params, setParams] = useState<CallDetailParams | null>(() => (range ? { ...range } : null))
  const query = useCallDetailReport(params)
  const rows = query.data

  const onGenerate = () => {
    const g = generate()
    if (!g) return
    const next: CallDetailParams = { ...g.range }
    if (campaignId !== 'all') next.campaignId = campaignId
    if (agentId !== 'all') next.agentId = agentId
    if (JSON.stringify(next) === JSON.stringify(params)) void query.refetch()
    setParams(next)
  }

  const columns: Column<CallRecordView>[] = [
    { key: 'at', header: t('table.dateTime'), sortValue: (r) => r.callInitiatedAt, cell: (r) => <span className="whitespace-nowrap font-mono text-[13px] tabular">{formatDateTime(r.callInitiatedAt)}</span> },
    { key: 'campaign', header: t('table.campaign'), hideOnMobile: true, sortValue: (r) => l(r.campaignName), cell: (r) => <span className="block max-w-56 truncate">{l(r.campaignName)}</span> },
    { key: 'agent', header: t('table.agent'), sortValue: (r) => l(r.agentName), cell: (r) => (r.agentName ? l(r.agentName) : <span className="text-muted">{t('table.noAgent')}</span>) },
    { key: 'phone', header: t('table.phone'), cell: (r) => <span className="whitespace-nowrap font-mono text-[13px]">{maskPhone(r.destinationNumber)}</span> },
    { key: 'duration', header: t('table.duration'), align: 'right', sortValue: (r) => r.totalDuration, cell: (r) => <span className="font-mono tabular">{formatDuration(r.totalDuration)}</span> },
    { key: 'disposition', header: t('table.disposition'), sortValue: (r) => r.dispositionCode ?? '', cell: (r) => <DispositionBadge call={r} /> },
    { key: 'recording', header: t('table.recording'), hideOnMobile: true, cell: () => <NoRecording /> },
  ]

  const exportCsv = () => {
    if (!rows?.length) return
    const filename = `call_detail_${fileStamp()}.csv`
    downloadCsv(filename, [
      [t('table.dateTime'), t('table.campaign'), t('table.agent'), t('table.phone'), t('table.customer'), t('table.durationSec'), t('table.outcome'), t('table.disposition'), t('table.notes')],
      ...rows.map((r) => [
        formatDateTime(r.callInitiatedAt),
        l(r.campaignName),
        l(r.agentName),
        maskPhone(r.destinationNumber),
        l(r.customerName),
        r.totalDuration,
        tc(`callOutcome.${r.outcome}`),
        l(r.dispositionName) || r.dispositionCode || '',
        r.dispositionNote ?? '',
      ]),
    ])
    toast.success(t('export.done', { count: rows.length, filename }))
  }

  const campaignOptions = [{ value: 'all', label: t('filters.allCampaigns') }, ...(filters.data?.campaigns ?? []).map((c) => ({ value: c.id, label: l(c.name) }))]
  const agentOptions = [{ value: 'all', label: t('filters.allAgents') }, ...(filters.data?.agents ?? []).map((a) => ({ value: a.id, label: l(a.name) }))]

  return (
    <div className="space-y-4">
      <Toolbar
        className="items-end"
        end={
          <Button icon={<Download {...ICON} />} onClick={exportCsv} disabled={!rows?.length}>
            {tc('actions.exportCsv')}
          </Button>
        }
      >
        <DateRangeFields value={inputs} onChange={setInputs} errors={errors} />
        <Field label={t('filters.campaign')} className="w-full sm:w-56">
          <Select value={campaignId} onValueChange={setCampaignId} options={campaignOptions} aria-label={t('filters.campaign')} />
        </Field>
        <Field label={t('filters.agent')} className="w-full sm:w-48">
          <Select value={agentId} onValueChange={setAgentId} options={agentOptions} aria-label={t('filters.agent')} />
        </Field>
        <Button variant="dial" icon={<Play {...ICON} />} loading={query.isFetching} onClick={onGenerate}>
          {t('actions.generate')}
        </Button>
      </Toolbar>

      {query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {rows && (
            <p className="text-sm text-muted">
              {t('detail.count', { count: rows.length })} · {tc('demoDataNote')}
            </p>
          )}
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            loading={query.isLoading}
            pageSize={25}
            initialSort={{ key: 'at', dir: 'desc' }}
            empty={<EmptyState title={t('detail.empty')} description={t('empty.tryRange')} compact />}
          />
        </>
      )}
    </div>
  )
}
