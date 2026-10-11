/** Section 4: recording backup (per-flow cards, manual backfill, recent runs). */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HardDriveDownload, Play, XCircle } from 'lucide-react'

import { errorMessage, fieldErrors } from '@/api/client'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  ErrorState,
  Field,
  Select,
  SectionTitle,
  Skeleton,
  StatusChip,
  toast,
  type Column,
} from '@/components/ui'
import { fmtBytes, fmtDate, fmtDateTime, fmtDuration, fmtNumber, timeAgo } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { BackupRun } from '@/types'
import { sourceBody, useBackupOverview, useBackupRuns, useCancelBackup, useStartBackup, type SourceChoice } from '../api'
import { DateRangeFields, JobStatusChip, TileGrid, dayOffset, useSourceLabel, validateRange, type RangeError } from './shared'

const PAGE_SIZE = 8

export function BackupSection() {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const label = useSourceLabel()
  const overview = useBackupOverview()
  const [page, setPage] = useState(1)
  const runs = useBackupRuns(page, PAGE_SIZE)
  const start = useStartBackup()
  const cancel = useCancelBackup()
  const [source, setSource] = useState<SourceChoice>('all')
  const [from, setFrom] = useState(() => dayOffset(-1))
  const [to, setTo] = useState(() => dayOffset(-1))
  const [rangeError, setRangeError] = useState<RangeError>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const lastDay = dayOffset(0)

  const onStart = () => {
    const err = validateRange(from, to, { lastDay })
    setRangeError(err)
    if (err) return
    start.mutate(
      { ...sourceBody(source), fromDate: from, toDate: to },
      {
        onSuccess: (created) => {
          setPage(1)
          toast.success(t('backup.toasts.started', { count: created.length }))
        },
        onError: (e) => toast.error(fieldErrors(e).toDate ?? fieldErrors(e).flow ?? errorMessage(e)),
      },
    )
  }

  const onCancel = () => {
    if (!cancelId) return
    cancel.mutate(cancelId, {
      onSuccess: () => toast.success(t('backup.toasts.canceling')),
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => setCancelId(null),
    })
  }

  const triggerLabel = (v: string): string => {
    if (v === 'cron') return t('triggers.cron')
    if (v.startsWith('manual:')) return t('triggers.manual', { who: v.slice(7) })
    if (v.startsWith('verify:')) return t('triggers.verify')
    return v
  }

  const columns = useMemo<Column<BackupRun>[]>(
    () => [
      { id: 'source', header: t('backup.runs.source'), cell: (r) => label(r.flow, r.sourceKey) },
      {
        id: 'range',
        header: t('backup.runs.range'),
        hideBelow: 'md',
        cell: (r) => (r.fromDate === r.toDate ? fmtDate(r.fromDate, lang) : `${fmtDate(r.fromDate, lang)} – ${fmtDate(r.toDate, lang)}`),
      },
      { id: 'trigger', header: t('backup.runs.trigger'), hideBelow: 'lg', cell: (r) => <Badge>{triggerLabel(r.triggeredBy)}</Badge> },
      { id: 'status', header: t('backup.runs.status'), cell: (r) => <JobStatusChip status={r.status} /> },
      { id: 'listed', header: t('backup.runs.listed'), align: 'right', mono: true, hideBelow: 'sm', cell: (r) => fmtNumber(r.filesListed, lang) },
      { id: 'copied', header: t('backup.runs.copied'), align: 'right', mono: true, cell: (r) => fmtNumber(r.filesCopied, lang) },
      { id: 'skipped', header: t('backup.runs.skipped'), align: 'right', mono: true, hideBelow: 'md', cell: (r) => fmtNumber(r.filesSkipped, lang) },
      {
        id: 'failed',
        header: t('backup.runs.failed'),
        align: 'right',
        mono: true,
        hideBelow: 'md',
        cell: (r) => <span className={r.filesFailed > 0 ? 'text-danger' : undefined}>{fmtNumber(r.filesFailed, lang)}</span>,
      },
      {
        id: 'duration',
        header: t('backup.runs.duration'),
        align: 'right',
        mono: true,
        hideBelow: 'lg',
        cell: (r) => (r.durationMs == null ? '-' : fmtDuration(r.durationMs / 1000)),
      },
      { id: 'started', header: t('backup.runs.started'), hideBelow: 'sm', cell: (r) => fmtDateTime(r.startedAt, lang) },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (r) =>
          r.status === 'running' ? (
            <Button size="sm" variant="ghost" icon={XCircle} disabled={r.cancelRequested} onClick={() => setCancelId(r.id)}>
              {r.cancelRequested ? t('backup.runs.cancelling') : t('backup.runs.cancel')}
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang, label],
  )

  const sourceOptions: { value: SourceChoice; label: string }[] = [
    { value: 'all', label: t('sources.all') },
    { value: 'voice_archive', label: t('sources.voice_archive') },
    { value: 'edge_primary', label: t('sources.edge_primary') },
    { value: 'edge_secondary', label: t('sources.edge_secondary') },
  ]
  const scheduleTime = /(\d{1,2}:\d{2})/.exec(overview.data?.schedule ?? '')?.[1] ?? '02:00'

  return (
    <Card>
      <CardHeader icon={HardDriveDownload} title={t('backup.title')} subtitle={t('backup.subtitle')} />
      <CardBody className="flex flex-col gap-4">
        {overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        ) : !overview.data ? (
          <TileGrid cols={3}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[190px] w-full rounded-[10px]" />
            ))}
          </TileGrid>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <Badge>{t('backup.schedule', { time: scheduleTime })}</Badge>
              <Badge>{t('backup.retry', { days: overview.data.retryDays })}</Badge>
            </div>
            <TileGrid cols={3}>
              {overview.data.flows.map((f) => (
                <Card key={`${f.flow}-${f.sourceKey}`} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-[15px] font-semibold text-ink">{label(f.flow, f.sourceKey)}</h3>
                    <StatusChip tone={f.cronEnabled ? 'success' : 'neutral'} size="sm">
                      {f.cronEnabled ? t('backup.flow.cronOn') : t('backup.flow.cronOff')}
                    </StatusChip>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
                    <div className="col-span-2">
                      <dt className="eyebrow">{t('backup.flow.lastRun')}</dt>
                      <dd className="mt-1 flex flex-wrap items-center gap-2 text-ink">
                        {f.lastRun ? (
                          <>
                            <JobStatusChip status={f.lastRun.status} />
                            <span className="text-muted">{timeAgo(f.lastRun.startedAt, lang)}</span>
                          </>
                        ) : (
                          <span className="text-muted">{t('backup.flow.noRun')}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">{t('backup.flow.openGaps')}</dt>
                      <dd className="mt-1">
                        <StatusChip tone={f.openGaps > 0 ? 'warning' : 'success'} size="sm">
                          {t('backup.flow.days', { count: f.openGaps })}
                        </StatusChip>
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">{t('backup.flow.filesBackedUp')}</dt>
                      <dd className="tabular mt-1 text-ink">{fmtNumber(f.backedUpTotal, lang)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="eyebrow">{t('backup.flow.totalStored')}</dt>
                      <dd className="tabular mt-1 text-ink">{fmtBytes(f.bytesTotal)}</dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </TileGrid>
          </>
        )}

        <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-sunken p-4">
          <SectionTitle>{t('backup.manual.title')}</SectionTitle>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
            <Field label={t('form.source')} htmlFor="backup-source">
              <Select<SourceChoice> id="backup-source" value={source} onValueChange={setSource} options={sourceOptions} aria-label={t('form.source')} />
            </Field>
            <DateRangeFields idPrefix="backup" from={from} to={to} onFrom={setFrom} onTo={setTo} lastDay={lastDay} error={rangeError} />
            <Button variant="primary" icon={Play} loading={start.isPending} onClick={onStart}>
              {t('backup.manual.start')}
            </Button>
          </div>
          <p className="text-[12.5px] text-muted">{t('backup.manual.hint')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>{t('backup.runs.title')}</SectionTitle>
          {runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
          ) : (
            <DataTable
              compact
              columns={columns}
              rows={runs.data?.items}
              rowKey={(r) => r.id}
              loading={runs.isLoading}
              emptyTitle={t('backup.runs.empty')}
              paging={{ page, pageSize: PAGE_SIZE, total: runs.data?.total ?? 0, onPageChange: setPage }}
            />
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(o) => !o && setCancelId(null)}
        title={t('backup.cancelDialog.title')}
        body={t('backup.cancelDialog.body')}
        confirmLabel={t('backup.cancelDialog.confirm')}
        cancelLabel={t('backup.cancelDialog.keep')}
        tone="danger"
        busy={cancel.isPending}
        onConfirm={onCancel}
      />
    </Card>
  )
}
