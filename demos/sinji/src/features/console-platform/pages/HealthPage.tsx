import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  Button,
  Callout,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  SegmentedControl,
  Skeleton,
  StatTile,
  StatusChip,
  chartColors,
  chartTheme,
  toast,
  type Column,
} from '@/components/ui'
import { bus } from '@/demo'
import { useFormat } from '@/lib/format'
import type { HealthRange, HealthSample, HealthSettings, TenantLoad } from '@/types'
import { useErrorText, useHealthOverview, useHealthSeries, useHealthSettingsMutation, useHealthTenants, useTenants } from '../api'
import { parseWhole } from '../components/limits'
import { RANGES, RANGE_SPEC } from '../sim/health'
import { startHealthTicker } from '../sim/ticker'

const GB = 1024

/** Console > Server health: KPI strip, live charts, load by workspace, sampling settings. */
export default function HealthPage() {
  const { t } = useTranslation('consolePlatform')
  const f = useFormat()
  const [range, setRange] = useState<HealthRange>('1h')
  const overview = useHealthOverview()
  const series = useHealthSeries(range)
  const [live, setLive] = useState<HealthSample[]>([])
  const interval = overview.data?.settings.sample_interval_s ?? 15

  // The simulated stream: a new sample on the bus every `interval` seconds while the tab is visible.
  useEffect(() => {
    const stop = startHealthTicker(interval)
    const off = bus.on('health:sample', ({ sample }) => setLive((prev) => [...prev.slice(-400), sample]))
    return () => {
      off()
      stop()
    }
  }, [interval])

  // A refetched history already contains everything up to now.
  useEffect(() => setLive([]), [range, series.dataUpdatedAt])

  const points = useMemo(() => {
    const base = series.data ?? []
    const last = base.length ? Date.parse(base[base.length - 1].ts) : 0
    const { ms, step } = RANGE_SPEC[range]
    const merged = [...base]
    let prev = last
    for (const sample of live) {
      const at = Date.parse(sample.ts)
      if (at - prev >= step * 0.9) {
        merged.push(sample)
        prev = at
      }
    }
    const from = Date.now() - ms
    return merged.filter((s) => Date.parse(s.ts) >= from)
  }, [series.data, live, range])

  const latest = live.length ? live[live.length - 1] : overview.data?.sample
  const previous = overview.data?.previous

  const rows = useMemo(
    () =>
      points.map((s) => ({
        t: Date.parse(s.ts),
        cpu: s.cpu_pct,
        load: s.load1,
        mem: Math.round((s.mem_used_mb / GB) * 10) / 10,
        swap: Math.round((s.swap_used_mb / GB) * 100) / 100,
        read: s.disk_read_mbs,
        write: s.disk_write_mbs,
        netIn: s.net_in_mbs,
        netOut: s.net_out_mbs,
        pool: s.db_pool_used,
        poolSize: s.db_pool_size,
        jobs: s.active_jobs,
        memTotal: Math.round(s.mem_total_mb / GB),
      })),
    [points],
  )

  const fail = overview.isError || series.isError
  if (fail)
    return (
      <Callout
        tone="danger"
        title={t('health.loadFailed')}
        action={
          <Button
            size="sm"
            onClick={() => {
              void overview.refetch()
              void series.refetch()
            }}
          >
            {t('actions.retry')}
          </Button>
        }
      />
    )

  const dayMode = range === '7d' || range === '30d'
  const tick = (v: number) => (dayMode ? f.date(v) : f.time(v))
  const mbs = t('health.units.mbs')
  const axisX = {
    dataKey: 't',
    type: 'number' as const,
    scale: 'time' as const,
    domain: ['dataMin', 'dataMax'] as [string, string],
    tickFormatter: tick,
    minTickGap: 48,
    ...chartTheme.axis,
  }
  const tooltip = { ...chartTheme.tooltip, labelFormatter: (v: unknown) => f.dateTime(Number(v)), isAnimationActive: false }
  const legend = { iconType: 'plainline' as const, wrapperStyle: { fontSize: 12, color: 'var(--color-muted)' } }
  const dur = (s: number) => {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return d ? `${t('health.units.days', { count: d })} ${t('health.units.hours', { count: h })}` : h ? `${t('health.units.hours', { count: h })} ${t('health.units.minutes', { count: m })}` : t('health.units.minutes', { count: m })
  }

  const delta = (now: number | undefined, before: number | undefined, unit = '', good = 'down' as 'down' | 'up') => {
    if (now == null || before == null) return undefined
    const d = Math.round((now - before) * 10) / 10
    const direction = Math.abs(d) < 0.1 ? 'flat' : d > 0 ? 'up' : 'down'
    return { value: `${d > 0 ? '+' : ''}${f.number(d, 1)}${unit}`, direction: direction as 'up' | 'down' | 'flat', good: direction === 'flat' ? undefined : direction === good }
  }

  const fullest = latest ? [...latest.disk].sort((a, b) => b.pct - a.pct)[0] : undefined
  const memPct = latest ? (latest.mem_used_mb / latest.mem_total_mb) * 100 : undefined
  const prevMemPct = previous ? (previous.mem_used_mb / previous.mem_total_mb) * 100 : undefined
  const gb = (mb: number) => `${f.number(mb / GB, 1)} ${t('health.units.gb')}`

  const kpis = latest
    ? [
        { key: 'cpu', label: t('health.kpi.cpu'), value: `${f.number(latest.cpu_pct, 1)}%`, hint: t('health.kpi.load', { value: f.number(latest.load1, 2) }), delta: delta(latest.cpu_pct, previous?.cpu_pct, ' pt'), tone: latest.cpu_pct > 85 ? 'danger' : latest.cpu_pct > 70 ? 'warning' : undefined },
        { key: 'mem', label: t('health.kpi.memory'), value: `${f.number(memPct, 0)}%`, hint: `${gb(latest.mem_used_mb)} ${t('health.kpi.of', { total: gb(latest.mem_total_mb) })}`, delta: delta(memPct, prevMemPct, ' pt'), tone: memPct && memPct > 90 ? 'danger' : undefined },
        { key: 'swap', label: t('health.kpi.swap'), value: `${f.number(latest.swap_used_mb)} ${t('health.units.mb')}` },
        { key: 'disk', label: t('health.kpi.disk'), value: `${f.number(fullest?.pct, 0)}%`, hint: fullest ? t('health.kpi.fullest', { mount: fullest.mount }) : undefined, tone: fullest && fullest.pct > 90 ? 'danger' : fullest && fullest.pct > 75 ? 'warning' : undefined },
        { key: 'io', label: t('health.kpi.diskIo'), value: `${f.number(latest.disk_read_mbs + latest.disk_write_mbs, 1)} ${mbs}`, hint: `${t('health.kpi.read', { value: f.number(latest.disk_read_mbs, 1) })} · ${t('health.kpi.write', { value: f.number(latest.disk_write_mbs, 1) })}` },
        { key: 'net', label: t('health.kpi.network'), value: `${f.number(latest.net_in_mbs + latest.net_out_mbs, 1)} ${mbs}`, hint: `${t('health.kpi.in', { value: f.number(latest.net_in_mbs, 1) })} · ${t('health.kpi.out', { value: f.number(latest.net_out_mbs, 1) })}` },
        { key: 'rss', label: t('health.kpi.apiRss'), value: `${f.number(latest.api_rss_mb)} ${t('health.units.mb')}` },
        { key: 'apicpu', label: t('health.kpi.apiCpu'), value: `${f.number(latest.api_cpu_pct, 1)}%`, delta: delta(latest.api_cpu_pct, previous?.api_cpu_pct, ' pt') },
        { key: 'db', label: t('health.kpi.db'), value: gb(latest.db_size_mb) },
        { key: 'pool', label: t('health.kpi.pool'), value: f.number(latest.db_pool_used), hint: t('health.kpi.poolOf', { size: latest.db_pool_size }) },
        { key: 'jobs', label: t('health.kpi.jobs'), value: f.number(latest.active_jobs) },
        { key: 'up', label: t('health.kpi.uptime'), value: dur(latest.uptime_s) },
      ]
    : []

  const chart = (name: string, body: React.ReactNode) => (
    <Card>
      <h3 className="mb-3 font-display text-base font-semibold text-ink">{name}</h3>
      <div role="img" aria-label={t('health.chartLabel', { name })} className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {body as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  )

  const margin = { top: 4, right: 8, bottom: 0, left: -12 }

  return (
    <div className="animate-panel-in space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{t('health.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('health.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip tone="success" pulse>
            {t('health.live', { seconds: interval })}
          </StatusChip>
          <SegmentedControl
            aria-label={t('health.rangeLabel')}
            size="sm"
            value={range}
            onValueChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: t(`health.ranges.${r}`) }))}
          />
        </div>
      </div>
      <p className="-mt-4 text-xs text-muted">{t('health.livePaused')}</p>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label={t('health.title')}>
        {overview.isLoading || !latest
          ? Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-[104px]" />)
          : kpis.map(({ key, ...kpi }) => <StatTile key={key} {...(kpi as React.ComponentProps<typeof StatTile>)} />)}
      </section>

      {series.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {chart(
            t('health.charts.cpu'),
            <LineChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis yAxisId="cpu" domain={[0, 100]} unit="%" {...chartTheme.axis} />
              <YAxis yAxisId="load" orientation="right" domain={[0, 'auto']} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Legend {...legend} />
              <Line yAxisId="cpu" name={t('health.series.cpu')} dataKey="cpu" stroke={chartColors.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="load" name={t('health.series.load')} dataKey="load" stroke={chartColors.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>,
          )}
          {chart(
            t('health.charts.memory'),
            <ComposedChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis domain={[0, 16]} unit={` ${t('health.units.gb')}`} width={64} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Legend {...legend} />
              <Area name={t('health.series.used')} dataKey="mem" stroke={chartColors.primary} fill={chartColors.primary} fillOpacity={0.14} strokeWidth={2} isAnimationActive={false} />
              <Line name={t('health.series.swap')} dataKey="swap" stroke={chartColors.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </ComposedChart>,
          )}
          {chart(
            t('health.charts.diskIo'),
            <AreaChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis unit={` ${mbs}`} width={72} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Legend {...legend} />
              <Area name={t('health.series.read')} dataKey="read" stroke={chartColors.primary} fill={chartColors.primary} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
              <Area name={t('health.series.write')} dataKey="write" stroke={chartColors.accent} fill={chartColors.accent} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>,
          )}
          {chart(
            t('health.charts.network'),
            <AreaChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis unit={` ${mbs}`} width={72} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Legend {...legend} />
              <Area name={t('health.series.in')} dataKey="netIn" stroke={chartColors.info} fill={chartColors.info} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
              <Area name={t('health.series.out')} dataKey="netOut" stroke={chartColors.success} fill={chartColors.success} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>,
          )}
          {chart(
            t('health.charts.pool'),
            <LineChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis allowDecimals={false} domain={[0, 'auto']} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Legend {...legend} />
              <Line name={t('health.series.poolUsed')} dataKey="pool" type="stepAfter" stroke={chartColors.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name={t('health.series.poolSize')} dataKey="poolSize" stroke={chartColors.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>,
          )}
          {chart(
            t('health.charts.jobs'),
            <AreaChart data={rows} margin={margin}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis {...axisX} />
              <YAxis allowDecimals={false} domain={[0, 'auto']} {...chartTheme.axis} />
              <Tooltip {...tooltip} />
              <Area name={t('health.series.jobs')} dataKey="jobs" type="stepAfter" stroke={chartColors.accent} fill={chartColors.accent} fillOpacity={0.16} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>,
          )}
        </div>
      )}

      <WorkspaceLoad range={range} />
      {overview.data ? <HealthSettingsForm key={`${overview.data.settings.retention_days}:${overview.data.settings.sample_interval_s}`} saved={overview.data.settings} /> : null}
    </div>
  )
}

/* ------------------------------------------------------- load by workspace */

function WorkspaceLoad({ range }: { range: HealthRange }) {
  const { t, i18n } = useTranslation('consolePlatform')
  const f = useFormat()
  const loads = useHealthTenants(range)
  const tenants = useTenants()
  const ka = i18n.language === 'ka'
  const nameOf = (id: string) => {
    const tn = tenants.data?.find((x) => x.id === id)
    return tn ? (ka ? tn.name_ka : tn.name) : id
  }
  const columns: Column<TenantLoad>[] = [
    { key: 'client_id', header: t('health.load.columns.workspace'), sortable: (r) => nameOf(r.client_id).toLowerCase(), cell: (r) => <span className="whitespace-nowrap font-medium text-ink">{nameOf(r.client_id)}</span> },
    { key: 'requests', header: t('health.load.columns.requests'), sortable: true, align: 'right', cell: (r) => <span className="tabular">{f.number(r.requests)}</span> },
    { key: 'errors', header: t('health.load.columns.errors'), sortable: true, align: 'right', hideBelow: 'sm', cell: (r) => <span className={r.errors > 0 ? 'tabular text-warning' : 'tabular'}>{f.number(r.errors)}</span> },
    { key: 'avg_ms', header: t('health.load.columns.avg'), sortable: true, align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular whitespace-nowrap">{f.number(r.avg_ms)} / {f.number(r.max_ms)}</span> },
    { key: 'bytes_in', header: t('health.load.columns.bytes'), sortable: (r) => r.bytes_in + r.bytes_out, align: 'right', hideBelow: 'lg', cell: (r) => <span className="tabular whitespace-nowrap">{f.bytes(r.bytes_in)} / {f.bytes(r.bytes_out)}</span> },
    { key: 'ai_calls', header: t('health.load.columns.aiCalls'), sortable: true, align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular whitespace-nowrap">{f.number(r.ai_calls)} / {f.tokens(r.ai_tokens)}</span> },
    { key: 'audio_jobs', header: t('health.load.columns.audio'), sortable: true, align: 'right', hideBelow: 'md', cell: (r) => <span className="tabular">{f.number(r.audio_jobs)}</span> },
    {
      key: 'load_share_pct',
      header: t('health.load.columns.share'),
      sortable: true,
      width: 150,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={r.load_share_pct} label={`${nameOf(r.client_id)}: ${f.number(r.load_share_pct, 1)}%`} className="flex-1" />
          <span className="tabular w-12 text-right text-[13px]">{f.number(r.load_share_pct, 1)}%</span>
        </div>
      ),
    },
  ]
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-display text-lg font-semibold text-ink">{t('health.load.title')}</h3>
        <p className="mt-0.5 max-w-3xl text-sm text-muted">{t('health.load.description')}</p>
      </div>
      {loads.isError ? (
        <Callout
          tone="danger"
          title={t('health.loadFailed')}
          action={
            <Button size="sm" onClick={() => void loads.refetch()}>
              {t('actions.retry')}
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={loads.data}
          loading={loads.isLoading}
          columns={columns}
          rowKey={(r) => r.client_id}
          pageSize={0}
          defaultSort={{ key: 'load_share_pct', dir: 'desc' }}
          empty={<EmptyState compact title={t('health.load.emptyTitle')} />}
        />
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- settings */

function HealthSettingsForm({ saved }: { saved: HealthSettings }) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const save = useHealthSettingsMutation()
  const [retention, setRetention] = useState(String(saved.retention_days))
  const [interval, setInterval] = useState(String(saved.sample_interval_s))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = retention !== String(saved.retention_days) || interval !== String(saved.sample_interval_s)

  const submit = async () => {
    const r = parseWhole(retention, 1, 365)
    const i = parseWhole(interval, 5, 300)
    const found: Record<string, string> = {}
    if (r === null) found.retention_days = t('errors.range_1_365')
    if (i === null) found.sample_interval_s = t('errors.range_5_300')
    if (r === null || i === null) {
      setErrors(found)
      return
    }
    try {
      await save.mutateAsync({ retention_days: r, sample_interval_s: i })
      setErrors({})
      toast.success(t('toast.saved'))
    } catch (e) {
      const fields = errorText.fields(e)
      setErrors(fields)
      if (!Object.keys(fields).length) toast.error(errorText.text(e))
    }
  }

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-ink">{t('health.settings.title')}</h3>
      <p className="mb-4 mt-0.5 text-sm text-muted">{t('health.settings.description')}</p>
      <form
        noValidate
        className="grid max-w-2xl gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label={t('health.settings.retention')} hint={t('health.settings.retentionHint')} error={errors.retention_days}>
          <Input type="number" inputMode="numeric" min={1} max={365} className="tabular" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </Field>
        <Field label={t('health.settings.interval')} hint={t('health.settings.intervalHint')} error={errors.sample_interval_s}>
          <Input type="number" inputMode="numeric" min={5} max={300} className="tabular" value={interval} onChange={(e) => setInterval(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
            {t('health.settings.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
