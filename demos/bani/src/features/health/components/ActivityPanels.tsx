import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Card, DataTable, ErrorState, Select, StatusChip, type Column, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtBytes, fmtDate, fmtDateTime, fmtNumber, timeAgo } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { BackupRun, CcActivityAction, JobStatus, LogLevel, MirrorSyncRun, SyncRun, SyncType } from '@/types'
import { useBackupEvents, useBackupRuns, useCcActivity, useMirrorRuns, useSyncRuns } from '../api'
import { fmtMs } from '../lib/series'

/* ------------------------------------------------------------------ helpers */

const nw = (v: ReactNode) => <span className="whitespace-nowrap">{v}</span>

function usePaging(initial = 25) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initial)
  return { page, pageSize, setPage, setPageSize: (s: number) => (setPageSizeState(s), setPage(1)) }
}

function useExpanded() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  return { open, toggle }
}

const JOB_TONE: Record<JobStatus, Tone> = { completed: 'success', failed: 'danger', running: 'info', canceled: 'neutral' }

function JobChip({ status }: { status: JobStatus }) {
  const { t } = useTranslation('common')
  return (
    <StatusChip tone={JOB_TONE[status]} size="sm">
      {t(`jobStatus.${status}`)}
    </StatusChip>
  )
}

function Chevron({ open, show }: { open: boolean; show: boolean }) {
  if (!show) return <span className="inline-block w-4" />
  return open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />
}

function ErrorLines({ errors }: { errors: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-1 bg-sunken px-5 py-3">
      {errors.map((e, i) => (
        <li key={i} className="break-words font-mono text-[12.5px] text-danger">
          {e}
        </li>
      ))}
    </ul>
  )
}

function ErrorsCount({ n }: { n: number }) {
  return <span className={cn('font-mono tabular', n > 0 ? 'font-medium text-danger' : 'text-faint')}>{n}</span>
}

function Panel({ children }: { children: ReactNode }) {
  return <Card className="overflow-hidden">{children}</Card>
}

const range = (a: string | null, b: string | null, lang: 'en' | 'ka'): string =>
  a && b ? (a === b ? fmtDate(a, lang) : `${fmtDate(a, lang)} - ${fmtDate(b, lang)}`) : '-'

/* --------------------------------------------------------- Core Cluster runs */

export function SyncRunsPanel({ reconcile = false }: { reconcile?: boolean }) {
  const { t } = useTranslation('health')
  const lang = useLang()
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const { open, toggle } = useExpanded()
  const q = useSyncRuns({ page, pageSize, type: reconcile ? 'reconcile' : undefined })
  const summary = q.data?.summary

  const num = (n: number) => fmtNumber(n, lang)
  const expand: Column<SyncRun> = {
    id: 'expand',
    header: <span className="sr-only">{t('activity.errors')}</span>,
    width: 36,
    cell: (r) => <Chevron open={open.has(r.id)} show={r.errors.length > 0} />,
  }
  const status: Column<SyncRun> = { id: 'status', header: t('activity.col.status'), cell: (r) => <JobChip status={r.status} /> }
  const duration: Column<SyncRun> = { id: 'duration', header: t('activity.col.duration'), align: 'right', mono: true, cell: (r) => nw(fmtMs(r.durationMs)) }
  const errors: Column<SyncRun> = { id: 'errors', header: t('activity.col.errors'), align: 'right', cell: (r) => <ErrorsCount n={r.errors.length} /> }

  const columns: Column<SyncRun>[] = reconcile
    ? [
        expand,
        { id: 'ran', header: t('activity.col.ranAt'), cell: (r) => nw(fmtDateTime(r.startedAt, lang, { seconds: true })) },
        { id: 'range', header: t('activity.col.range'), hideBelow: 'sm', cell: (r) => nw(range(r.fromDate, r.toDate, lang)) },
        { id: 'imported', header: t('activity.col.imported'), align: 'right', mono: true, cell: (r) => num(r.recordsImported) },
        { id: 'gapsFound', header: t('activity.col.gapsFound'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => num(r.gapFilesFound) },
        { id: 'gapsFilled', header: t('activity.col.gapsFilled'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => num(r.gapFilesFilled) },
        { ...duration, hideBelow: 'sm' },
        status,
        errors,
      ]
    : [
        expand,
        { id: 'started', header: t('activity.col.started'), cell: (r) => nw(fmtDateTime(r.startedAt, lang, { seconds: true })) },
        { id: 'completed', header: t('activity.col.completed'), hideBelow: 'lg', cell: (r) => nw(r.completedAt ? fmtDateTime(r.completedAt, lang, { seconds: true }) : '-') },
        { id: 'type', header: t('activity.col.type'), hideBelow: 'sm', cell: (r) => <Badge>{t(`activity.syncType.${r.syncType satisfies SyncType}`)}</Badge> },
        { id: 'by', header: t('activity.col.triggeredBy'), hideBelow: 'md', cell: (r) => (r.triggeredBy === 'cron' || r.triggeredBy === 'schedule' ? t('activity.cron') : r.triggeredBy) },
        { id: 'found', header: t('activity.col.filesFound'), align: 'right', mono: true, hideBelow: 'lg', cell: (r) => num(r.filesFound) },
        { id: 'processed', header: t('activity.col.processed'), align: 'right', mono: true, hideBelow: 'lg', cell: (r) => num(r.filesProcessed) },
        { id: 'skipped', header: t('activity.col.skipped'), align: 'right', mono: true, hideBelow: 'lg', cell: (r) => num(r.filesSkipped) },
        { id: 'imported', header: t('activity.col.imported'), align: 'right', mono: true, cell: (r) => num(r.recordsImported) },
        { ...duration, hideBelow: 'md' },
        status,
        errors,
      ]

  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return (
    <div className="flex flex-col gap-3">
      {!reconcile && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryStat label={t('activity.summary.totalRuns')} value={summary ? num(summary.totalRuns) : '-'} />
          <SummaryStat label={t('activity.summary.recordsImported')} value={summary ? num(summary.recordsImported) : '-'} />
          <SummaryStat
            label={t('activity.summary.lastSuccess')}
            value={summary?.lastSuccessAt ? timeAgo(summary.lastSuccessAt, lang) : t('activity.summary.never')}
            hint={summary?.lastSuccessAt ? fmtDateTime(summary.lastSuccessAt, lang, { seconds: true }) : undefined}
          />
        </div>
      )}
      <Panel>
        <DataTable
          columns={columns}
          rows={q.data?.items}
          rowKey={(r) => r.id}
          loading={q.isLoading}
          emptyTitle={t('activity.empty')}
          onRowClick={(r) => r.errors.length && toggle(r.id)}
          expandedKeys={open}
          renderExpanded={(r) => <ErrorLines errors={r.errors} />}
          paging={{ page, pageSize, total: q.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setPageSize }}
        />
      </Panel>
    </div>
  )
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <Card className="px-4 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1.5 font-display text-[22px] font-bold leading-none tabular text-ink" style={{ letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[12.5px] text-muted">{hint}</div>}
    </Card>
  )
}

/* ---------------------------------------------------------- contact centre */

const CC_TONE: Record<CcActivityAction, Tone> = {
  campaign_change: 'bronze',
  campaign_view: 'neutral',
  campaign_error: 'danger',
  skills_update: 'info',
  skills_bulk_update: 'info',
  skills_error: 'danger',
  dedicated_ports_above_limit: 'warning',
}

export function CcActivityPanel() {
  const { t } = useTranslation('health')
  const lang = useLang()
  const { page, pageSize, setPage, setPageSize } = usePaging(50)
  const q = useCcActivity({ page, pageSize })
  const columns: Column<NonNullable<typeof q.data>['items'][number]>[] = [
    { id: 'time', header: t('activity.col.time'), width: 190, cell: (r) => nw(fmtDateTime(r.createdAt, lang, { seconds: true })) },
    { id: 'action', header: t('activity.col.action'), cell: (r) => <StatusChip tone={CC_TONE[r.action]} size="sm">{t(`activity.cc.${r.action}`)}</StatusChip> },
    { id: 'user', header: t('activity.col.user'), hideBelow: 'sm', mono: true, cell: (r) => r.username },
    { id: 'details', header: t('activity.col.details'), cell: (r) => <span className="break-words text-muted">{r.details}</span> },
  ]
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return (
    <Panel>
      <p className="border-b border-line px-4 py-2.5 text-[13px] text-muted">{t('activity.ccNote')}</p>
      <DataTable
        columns={columns}
        rows={q.data?.items}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        emptyTitle={t('activity.empty')}
        paging={{ page, pageSize, total: q.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setPageSize }}
      />
    </Panel>
  )
}

/* ------------------------------------------------------------------ backup */

const LEVEL_TONE: Record<LogLevel, Tone> = { debug: 'neutral', info: 'info', warn: 'warning', error: 'danger' }

function triggerLabel(by: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (by === 'cron') return t('activity.cron')
  if (by.startsWith('manual:')) return t('activity.manualBy', { user: by.slice(7) })
  if (by.startsWith('verify:')) return t('activity.verifyBackfill')
  return by
}

export function BackupPanel() {
  const { t } = useTranslation('health')
  const { t: tc } = useTranslation('common')
  const lang = useLang()
  const { page, pageSize, setPage, setPageSize } = usePaging(10)
  const { open, toggle } = useExpanded()
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const runs = useBackupRuns({ page, pageSize })
  const events = useBackupEvents(level)

  const flowName = (r: BackupRun) =>
    `${r.flow === 'voice_archive' ? tc('sources.voiceArchive') : tc('sources.edge')}${r.sourceKey ? ` · ${t(`activity.sourceKey.${r.sourceKey}`)}` : ''}`

  const runColumns: Column<BackupRun>[] = [
    { id: 'expand', header: <span className="sr-only">{t('activity.errors')}</span>, width: 36, cell: (r) => <Chevron open={open.has(r.id)} show={r.errors.length > 0} /> },
    { id: 'started', header: t('activity.col.started'), cell: (r) => nw(fmtDateTime(r.startedAt, lang, { seconds: true })) },
    { id: 'flow', header: t('activity.col.flow'), cell: (r) => flowName(r) },
    { id: 'by', header: t('activity.col.triggeredBy'), hideBelow: 'md', cell: (r) => triggerLabel(r.triggeredBy, t) },
    { id: 'range', header: t('activity.col.range'), hideBelow: 'lg', cell: (r) => nw(range(r.fromDate, r.toDate, lang)) },
    { id: 'listed', header: t('activity.col.listed'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => fmtNumber(r.filesListed, lang) },
    { id: 'copied', header: t('activity.col.copied'), align: 'right', mono: true, cell: (r) => fmtNumber(r.filesCopied, lang) },
    { id: 'skipped', header: t('activity.col.skipped'), align: 'right', mono: true, hideBelow: 'lg', cell: (r) => fmtNumber(r.filesSkipped, lang) },
    { id: 'failed', header: t('activity.col.failedFiles'), align: 'right', mono: true, cell: (r) => <span className={cn(r.filesFailed > 0 && 'font-medium text-danger')}>{fmtNumber(r.filesFailed, lang)}</span> },
    { id: 'size', header: t('activity.col.size'), align: 'right', mono: true, hideBelow: 'lg', cell: (r) => nw(fmtBytes(r.bytesCopied)) },
    { id: 'duration', header: t('activity.col.duration'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => nw(fmtMs(r.durationMs)) },
    { id: 'status', header: t('activity.col.status'), cell: (r) => <JobChip status={r.status} /> },
  ]

  type Ev = NonNullable<typeof events.data>[number]
  const eventColumns: Column<Ev>[] = [
    { id: 'time', header: t('activity.col.time'), width: 190, cell: (r) => nw(fmtDateTime(r.createdAt, lang, { seconds: true })) },
    { id: 'level', header: t('activity.col.level'), cell: (r) => <StatusChip tone={LEVEL_TONE[r.level]} size="sm" icon={false}>{t(`activity.level.${r.level}`)}</StatusChip> },
    { id: 'flow', header: t('activity.col.flow'), hideBelow: 'md', cell: (r) => (r.flow === 'voice_archive' ? tc('sources.voiceArchive') : tc('sources.edge')) },
    { id: 'event', header: t('activity.col.event'), hideBelow: 'sm', mono: true, cell: (r) => r.event },
    { id: 'message', header: t('activity.col.message'), cell: (r) => <span className="break-words text-muted">{r.message || r.relativePath}</span> },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{t('activity.backup.runs')}</h3>
        {runs.isError && !runs.data ? (
          <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
        ) : (
          <Panel>
            <DataTable
              columns={runColumns}
              rows={runs.data?.items}
              rowKey={(r) => r.id}
              loading={runs.isLoading}
              emptyTitle={t('activity.empty')}
              onRowClick={(r) => r.errors.length && toggle(r.id)}
              expandedKeys={open}
              renderExpanded={(r) => <ErrorLines errors={r.errors} />}
              paging={{ page, pageSize, total: runs.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setPageSize }}
            />
          </Panel>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">{t('activity.backup.events')}</h3>
          <div className="w-44">
            <Select<LogLevel | 'all'>
              size="sm"
              aria-label={t('activity.col.level')}
              value={level}
              onValueChange={setLevel}
              options={[
                { value: 'all', label: t('activity.level.all') },
                { value: 'info', label: t('activity.level.info') },
                { value: 'warn', label: t('activity.level.warn') },
                { value: 'error', label: t('activity.level.error') },
              ]}
            />
          </div>
        </div>
        {events.isError && !events.data ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : (
          <Panel>
            <DataTable
              columns={eventColumns}
              rows={events.data}
              rowKey={(r) => r.id}
              loading={events.isLoading}
              emptyTitle={t('activity.empty')}
              compact
              pageSize={25}
              pageSizes={[25, 50, 100]}
            />
          </Panel>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ Edge PBX mirror */

export function MirrorPanel() {
  const { t } = useTranslation('health')
  const lang = useLang()
  const { page, pageSize, setPage, setPageSize } = usePaging()
  const { open, toggle } = useExpanded()
  const q = useMirrorRuns({ page, pageSize })
  const columns: Column<MirrorSyncRun>[] = [
    { id: 'expand', header: <span className="sr-only">{t('activity.errors')}</span>, width: 36, cell: (r) => <Chevron open={open.has(r.id)} show={!!r.error} /> },
    { id: 'started', header: t('activity.col.started'), cell: (r) => nw(fmtDateTime(r.startedAt, lang, { seconds: true })) },
    { id: 'completed', header: t('activity.col.completed'), hideBelow: 'lg', cell: (r) => nw(r.completedAt ? fmtDateTime(r.completedAt, lang, { seconds: true }) : '-') },
    { id: 'trigger', header: t('activity.col.trigger'), hideBelow: 'sm', cell: (r) => <Badge>{t(`activity.trigger.${r.trigger}`)}</Badge> },
    { id: 'range', header: t('activity.col.range'), hideBelow: 'md', cell: (r) => nw(range(r.fromDate, r.toDate, lang)) },
    { id: 'fetched', header: t('activity.col.fetched'), align: 'right', mono: true, cell: (r) => fmtNumber(r.fetched, lang) },
    { id: 'inserted', header: t('activity.col.inserted'), align: 'right', mono: true, cell: (r) => fmtNumber(r.inserted, lang) },
    { id: 'duration', header: t('activity.col.duration'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => nw(fmtMs(r.durationMs)) },
    { id: 'status', header: t('activity.col.status'), cell: (r) => <JobChip status={r.status} /> },
  ]
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  return (
    <Panel>
      <DataTable
        columns={columns}
        rows={q.data?.items}
        rowKey={(r) => r.id}
        loading={q.isLoading}
        emptyTitle={t('activity.empty')}
        onRowClick={(r) => r.error && toggle(r.id)}
        expandedKeys={open}
        renderExpanded={(r) => <ErrorLines errors={r.error ? [r.error] : []} />}
        paging={{ page, pageSize, total: q.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setPageSize }}
      />
    </Panel>
  )
}
