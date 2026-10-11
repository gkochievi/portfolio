import { useQueryClient } from '@tanstack/react-query'
import { Activity, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Badge, Banner, Button, Card, CardBody, CardHeader, DataTable, DateText, Field, Input, PageHeader, Section, Skeleton, Sparkline, Switch, toast, type Column } from '@/components/ui'
import { ServiceStatusDot } from '@/components/status'
import { cn } from '@/lib/cn'
import { formatDateTime, formatNumber } from '@/lib/format'

import { errorMessage, fieldErrorsOf, useHealthSnapshot, useIncidents, useSaveHealthRetention } from '../api'
import { HealthHistory } from '../components/HealthHistory'
import { DEFAULT_METRIC, HISTORY_RANGES, type HistoryRange } from '../lib/metrics'
import type { IncidentDto } from '../lib/types'
import type { ServiceHealth, ServiceStatus } from '@/types'

const STATUS_BAR: Record<ServiceStatus, string> = { ok: 'before:bg-success', degraded: 'before:bg-warning', down: 'before:bg-danger' }
const SPARK_TONE: Record<ServiceStatus, 'success' | 'warning' | 'danger'> = { ok: 'success', degraded: 'warning', down: 'danger' }

function useDuration() {
  const { t } = useTranslation('ops')
  return (sec: number) => {
    const s = Math.max(0, Math.round(sec))
    if (s < 60) return t('health.duration.s', { s })
    if (s < 3600) return t('health.duration.ms', { m: Math.floor(s / 60), s: s % 60 })
    if (s < 86400) return t('health.duration.hm', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) })
    return t('health.duration.dh', { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600) })
  }
}

export default function SystemHealthPage() {
  const { t } = useTranslation('ops')
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const snapshot = useHealthSnapshot(autoRefresh)
  const incidents = useIncidents()

  const metric = params.get('metric') ?? DEFAULT_METRIC
  const rangeParam = params.get('range')
  const range: HistoryRange = HISTORY_RANGES.some((r) => r.value === rangeParam) ? (rangeParam as HistoryRange) : '24h'
  const setParam = (key: string, value: string, def: string) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev)
        if (value === def) out.delete(key)
        else out.set(key, value)
        return out
      },
      { replace: true },
    )

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['health'] })
  }

  const data = snapshot.data

  return (
    <>
      <PageHeader
        eyebrow={t('health.eyebrow')}
        title={t('health.title')}
        description={t('health.description')}
        icon={<Activity />}
        actions={
          <>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} label={t('health.autoRefresh')} />
            <Button variant="outline" size="sm" icon={<RefreshCw className={cn(snapshot.isFetching && 'motion-safe:animate-spin')} />} onClick={refresh}>
              {t('common:actions.refresh')}
            </Button>
          </>
        }
      />

      {snapshot.isError && (
        <Banner tone="danger" className="mb-4" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => snapshot.refetch()}>{t('common:actions.retry')}</Button>}>
          {errorMessage(snapshot.error)}
        </Banner>
      )}

      <Section title={t('health.services.title')} description={data ? t('health.services.takenAt', { time: formatDateTime(data.takenAt, true) }) : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data
            ? data.services.map((s) => <ServiceCard key={s.dependency} service={s} />)
            : Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[132px] w-full" />)}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('health.resources.title')}>
          <Card>
            <CardBody>
              {data ? <Resources r={data.resources} /> : <Skeleton className="h-40 w-full" />}
            </CardBody>
          </Card>
        </Section>
        <Section title={t('health.backlog.title')}>
          <Card>
            <CardBody>
              {data ? (
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={t('health.backlog.queuedJobs')} value={data.backlog.queuedJobs} />
                  <Stat label={t('health.backlog.failedJobs24h')} value={data.backlog.failedJobs24h} tone={data.backlog.failedJobs24h > 0 ? 'warning' : undefined} />
                  <Stat label={t('health.backlog.staleSync')} hint={t('health.backlog.staleSyncHint')} value={data.backlog.staleSyncPartners} tone={data.backlog.staleSyncPartners > 0 ? 'warning' : undefined} />
                  <Stat label={t('health.backlog.errors15m')} value={data.backlog.errors15m} tone={data.backlog.errors15m > 0 ? 'danger' : undefined} />
                </div>
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </CardBody>
          </Card>
        </Section>
      </div>

      <Section>
        <HealthHistory metric={metric} range={range} autoRefresh={autoRefresh} onMetric={(m) => setParam('metric', m, DEFAULT_METRIC)} onRange={(r) => setParam('range', r, '24h')} />
      </Section>

      <Section
        title={t('health.incidents.title')}
        description={t('health.incidents.description')}
        actions={
          <Button variant="outline" size="sm" icon={<RefreshCw className={cn(incidents.isFetching && 'motion-safe:animate-spin')} />} onClick={() => incidents.refetch()}>
            {t('common:actions.refresh')}
          </Button>
        }
      >
        <IncidentsTable query={incidents} />
      </Section>

      <RetentionCard days={data?.retentionDays} />
    </>
  )
}

function ServiceCard({ service: s }: { service: ServiceHealth }) {
  const { t } = useTranslation('ops')
  const nums = s.sparkline.filter((v) => v > 0)
  return (
    <Card className={cn('relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px]', STATUS_BAR[s.status])}>
      <CardBody className="space-y-2 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-ink">{t(`common:dependency.${s.dependency}`)}</div>
            <div className="font-mono text-[11px] text-subtle">{s.dependency}</div>
          </div>
          <ServiceStatusDot status={s.status} />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="eyebrow">{t('health.services.latency')}</div>
            <div className="num font-mono text-xl leading-tight text-ink">
              {s.latencyMs === null ? '—' : formatNumber(s.latencyMs, { maximumFractionDigits: s.latencyMs < 10 ? 1 : 0 })}
              {s.latencyMs !== null && <span className="ml-1 text-[12px] text-muted">ms</span>}
            </div>
          </div>
          <Sparkline values={nums.length > 1 ? s.sparkline : [0, 0]} tone={SPARK_TONE[s.status]} width={120} height={32} />
        </div>
        <div className="min-h-[18px] text-[12px] text-muted">
          {s.reason ? <span className={s.status === 'down' ? 'text-danger' : 'text-warning'}>{s.reason}</span> : t('health.services.noIssues')}
        </div>
        <div className="num text-[11px] text-subtle">{t('health.services.lastChecked', { time: formatDateTime(s.lastCheckedAt, true) })}</div>
      </CardBody>
    </Card>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'warning' | 'danger' }) {
  return (
    <div className="rounded-md border border-hairline bg-sunken/50 px-3 py-2">
      <div className="text-[12px] text-muted" title={hint}>
        {label}
      </div>
      <div className={cn('num font-mono text-lg leading-tight', tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger', !tone && 'text-ink')}>{typeof value === 'number' ? formatNumber(value) : value}</div>
    </div>
  )
}

function Resources({ r }: { r: NonNullable<ReturnType<typeof useHealthSnapshot>['data']>['resources'] }) {
  const { t } = useTranslation('ops')
  const dur = useDuration()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label={t('health.resources.cpu')} value={r.cpuLoad.map((n) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).join(' / ')} hint="1 / 5 / 15 min" />
      <Stat label={t('health.resources.eventLoop')} value={`${formatNumber(r.eventLoopP50Ms, { maximumFractionDigits: 1 })} / ${formatNumber(r.eventLoopP99Ms, { maximumFractionDigits: 1 })} ms`} hint="p50 / p99" />
      <Stat label={t('health.resources.rss')} value={`${formatNumber(r.rssMb, { maximumFractionDigits: 0 })} MB`} />
      <Stat label={t('health.resources.disk')} value={`${formatNumber(r.diskFreePct, { maximumFractionDigits: 1 })}%`} />
      <Stat label={t('health.resources.node')} value={r.nodeVersion} />
      <Stat label={t('health.resources.uptime')} value={dur(r.uptimeSec)} />
      <Stat label={t('health.resources.pid')} value={String(r.pid)} />
    </div>
  )
}

function IncidentsTable({ query }: { query: ReturnType<typeof useIncidents> }) {
  const { t } = useTranslation('ops')
  const dur = useDuration()
  const columns: Column<IncidentDto>[] = [
    { key: 'dependency', header: t('health.incidents.dependency'), sortable: true, cell: (r) => t(`common:dependency.${r.dependency}`) },
    { key: 'startedAt', header: t('health.incidents.start'), sortable: true, cell: (r) => <DateText value={r.startedAt} withTime /> },
    {
      key: 'endedAt',
      header: t('health.incidents.end'),
      sortable: true,
      cell: (r) => (r.endedAt ? <DateText value={r.endedAt} withTime /> : <Badge tone="danger">{t('health.incidents.ongoing')}</Badge>),
    },
    {
      key: 'durationSec',
      header: t('health.incidents.duration'),
      align: 'right',
      mono: true,
      sortValue: (r) => r.durationSec ?? Number.MAX_SAFE_INTEGER,
      sortable: true,
      cell: (r) => dur(r.durationSec ?? (Date.now() - Date.parse(r.startedAt)) / 1000),
    },
    { key: 'reason', header: t('health.incidents.reason'), cell: (r) => r.reason, className: 'min-w-[260px]' },
  ]
  return (
    <DataTable<IncidentDto>
      columns={columns}
      rows={query.data}
      getRowId={(r) => r.id}
      loading={query.isLoading}
      error={query.isError ? errorMessage(query.error) : undefined}
      onRetry={() => query.refetch()}
      pageSize={10}
      initialSort={{ key: 'startedAt', dir: 'desc' }}
      empty={{ title: t('health.incidents.empty') }}
      caption={t('health.incidents.title')}
    />
  )
}

function RetentionCard({ days }: { days: number | undefined }) {
  const { t } = useTranslation('ops')
  const save = useSaveHealthRetention()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()
  useEffect(() => {
    if (days !== undefined) setValue(String(days))
  }, [days])
  const dirty = days !== undefined && value !== String(days)

  const onSave = async () => {
    const n = Number(value)
    if (!/^\d+$/.test(value.trim()) || n < 1 || n > 3650) {
      setError(t('validation.retention'))
      return
    }
    setError(undefined)
    try {
      await save.mutateAsync(n)
      toast.success(t('health.retention.saved', { days: n }))
    } catch (err) {
      setError(fieldErrorsOf(err).days ?? errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader title={t('health.retention.title')} description={t('health.retention.description')} />
      <CardBody>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void onSave()
          }}
        >
          <Field label={t('health.retention.label')} htmlFor="health-retention" error={error}>
            <Input id="health-retention" type="number" inputMode="numeric" min={1} max={3650} className="w-32" value={value} invalid={!!error} disabled={days === undefined} onChange={(e) => setValue(e.target.value)} suffix={t('logs.retention.days')} />
          </Field>
          <Button type="submit" size="sm" variant="outline" loading={save.isPending} disabled={!dirty}>
            {t('common:actions.save')}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

