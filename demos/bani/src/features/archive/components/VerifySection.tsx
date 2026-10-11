/** Section 4c: verify a date range (per-day diff of source vs file archive) and backfill what is missing. */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, ListChecks, ShieldCheck, XCircle } from 'lucide-react'

import { errorMessage, fieldErrors } from '@/api/client'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  KpiTile,
  Pagination,
  SectionTitle,
  Select,
  Skeleton,
  StatusChip,
  toast,
  type Column,
} from '@/components/ui'
import { fmtBytes, fmtDate, fmtDuration, fmtNumber } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { MissingFile, VerifyDayRow, VerifyRun } from '@/types'
import {
  sourceBody,
  useBackupRun,
  useCancelVerify,
  useOnFinished,
  useStartVerify,
  useVerifyBackfill,
  useVerifyList,
  useVerifyRun,
  type SourceChoice,
} from '../api'
import { DateRangeFields, JobStatusChip, MAX_RANGE_DAYS, ProgressBar, TileGrid, dayOffset, useSourceLabel, validateRange, type RangeError } from './shared'

const FILES_PER_PAGE = 8

export function VerifySection() {
  const { t } = useTranslation('archive')
  const list = useVerifyList()
  const start = useStartVerify()
  const [source, setSource] = useState<SourceChoice>('all')
  const [from, setFrom] = useState(() => dayOffset(-14))
  const [to, setTo] = useState(() => dayOffset(-1))
  const [rangeError, setRangeError] = useState<RangeError>(null)
  const lastDay = dayOffset(-1)

  const onStart = () => {
    const err = validateRange(from, to, { lastDay })
    setRangeError(err)
    if (err) return
    start.mutate(
      { ...sourceBody(source), fromDate: from, toDate: to },
      {
        onSuccess: (created) => toast.success(t('verify.toasts.started', { count: created.length })),
        onError: (e) => toast.error(fieldErrors(e).toDate ?? fieldErrors(e).flow ?? errorMessage(e)),
      },
    )
  }

  const sourceOptions: { value: SourceChoice; label: string }[] = [
    { value: 'all', label: t('sources.all') },
    { value: 'voice_archive', label: t('sources.voice_archive') },
    { value: 'edge_primary', label: t('sources.edge_primary') },
    { value: 'edge_secondary', label: t('sources.edge_secondary') },
  ]

  // The newest batch: every run created by one Start shares its startedAt.
  const batch = useMemo(() => {
    const runs = list.data ?? []
    const newest = runs[0]?.startedAt
    return newest ? runs.filter((r) => r.startedAt === newest) : []
  }, [list.data])

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title={t('verify.title')} subtitle={t('verify.subtitle')} />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-sunken p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_auto]">
            <Field label={t('form.source')} htmlFor="verify-source">
              <Select<SourceChoice> id="verify-source" value={source} onValueChange={setSource} options={sourceOptions} aria-label={t('form.source')} />
            </Field>
            <DateRangeFields idPrefix="verify" from={from} to={to} onFrom={setFrom} onTo={setTo} lastDay={lastDay} error={rangeError} />
            <Button variant="primary" icon={ListChecks} loading={start.isPending} onClick={onStart}>
              {t('verify.start')}
            </Button>
          </div>
          <p className="text-[12.5px] text-muted">{t('verify.maxHint', { max: MAX_RANGE_DAYS })}</p>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isLoading ? (
          <Skeleton className="h-[160px] w-full rounded-[10px]" />
        ) : batch.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title={t('verify.empty.title')} body={t('verify.empty.body')} />
        ) : (
          batch.map((run) => <VerifyRunPanel key={run.id} summary={run} />)
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------- one run */

function VerifyRunPanel({ summary }: { summary: VerifyRun }) {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const label = useSourceLabel()
  const query = useVerifyRun(summary.id)
  const run = query.data ?? summary
  const cancel = useCancelVerify()
  const backfill = useVerifyBackfill()
  const backup = useBackupRun(run.backfillRunId)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const running = run.status === 'running'
  const bf = backup.data

  useOnFinished(bf ? bf.status === 'running' : undefined, () => {
    if (bf?.status === 'completed') toast.success(t('verify.toasts.backfillDone', { copied: fmtNumber(bf.filesCopied, lang) }))
  })

  const toggle = (date: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  const columns = useMemo<Column<VerifyDayRow>[]>(
    () => [
      {
        id: 'date',
        header: t('verify.days.date'),
        cell: (d) => {
          const open = d.missingFromDest.length + d.missingFromSource.length > 0
          const Icon = expanded.has(d.date) ? ChevronDown : ChevronRight
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {open ? <Icon size={16} strokeWidth={1.75} className="text-muted" aria-hidden /> : <span className="inline-block w-4" />}
              {fmtDate(d.date, lang)}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: t('verify.days.status'),
        cell: (d) => (
          <StatusChip
            size="sm"
            tone={d.status === 'ok' ? 'success' : d.status === 'mismatch' ? 'warning' : d.status === 'failed' ? 'danger' : 'neutral'}
          >
            {t(`verify.days.${d.status}`)}
          </StatusChip>
        ),
      },
      { id: 'source', header: t('verify.days.source'), align: 'right', mono: true, cell: (d) => (d.status === 'pending' ? '-' : fmtNumber(d.sourceCount, lang)) },
      { id: 'dest', header: t('verify.days.dest'), align: 'right', mono: true, cell: (d) => (d.status === 'pending' ? '-' : fmtNumber(d.destCount, lang)) },
      {
        id: 'missingDest',
        header: t('verify.days.missingDest'),
        align: 'right',
        mono: true,
        hideBelow: 'sm',
        cell: (d) => <span className={d.missingFromDest.length ? 'text-warning' : undefined}>{d.status === 'pending' ? '-' : d.missingFromDest.length}</span>,
      },
      {
        id: 'missingSource',
        header: t('verify.days.missingSource'),
        align: 'right',
        mono: true,
        hideBelow: 'md',
        cell: (d) => <span className={d.missingFromSource.length ? 'text-warning' : undefined}>{d.status === 'pending' ? '-' : d.missingFromSource.length}</span>,
      },
      {
        id: 'duration',
        header: t('verify.days.duration'),
        align: 'right',
        mono: true,
        hideBelow: 'lg',
        cell: (d) => (d.durationMs == null ? '-' : fmtDuration(d.durationMs / 1000)),
      },
    ],
    [t, lang, expanded],
  )

  const missingDest = run.missingFromDest
  const bfLine = bf
    ? bf.status === 'running'
      ? t('verify.backfill.running', { copied: fmtNumber(bf.filesCopied, lang), listed: fmtNumber(bf.filesListed, lang) })
      : t(`verify.backfill.${bf.status === 'completed' ? 'done' : bf.status === 'canceled' ? 'canceled' : 'failed'}`, {
          copied: fmtNumber(bf.filesCopied, lang),
          skipped: fmtNumber(bf.filesSkipped, lang),
          failed: fmtNumber(bf.filesFailed, lang),
        })
    : null

  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line p-4" aria-label={label(run.flow, run.sourceKey)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[16px] font-semibold text-ink">{label(run.flow, run.sourceKey)}</h3>
          <JobStatusChip status={run.status} />
          <span className="text-[13px] text-muted">
            {run.fromDate === run.toDate ? fmtDate(run.fromDate, lang) : `${fmtDate(run.fromDate, lang)} – ${fmtDate(run.toDate, lang)}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <Button size="sm" variant="ghost" icon={XCircle} disabled={run.cancelRequested} onClick={() => setConfirmCancel(true)}>
              {t('verify.cancel')}
            </Button>
          ) : null}
          {!running && missingDest > 0 ? (
            <Button
              size="sm"
              variant="primary"
              loading={backfill.isPending || bf?.status === 'running'}
              disabled={bf?.status === 'running'}
              onClick={() =>
                backfill.mutate(run.id, {
                  onSuccess: () => toast.success(t('verify.toasts.backfillStarted')),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {t('verify.backfill.action', { count: missingDest })}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[12.5px] text-muted">
          <span>{t('verify.progress', { done: run.daysCompleted, total: run.daysTotal })}</span>
          <span className="tabular">{run.daysTotal ? Math.round((run.daysCompleted / run.daysTotal) * 100) : 0}%</span>
        </div>
        <ProgressBar value={run.daysCompleted} max={run.daysTotal} tone={run.status === 'completed' ? 'success' : 'primary'} label={t('verify.title')} />
      </div>

      {bf && bfLine ? (
        <div className="flex flex-col gap-1.5 rounded-[8px] bg-sunken px-3 py-2.5" aria-live="polite">
          <p className={bf.status === 'completed' ? 'text-[13.5px] font-medium text-success' : 'text-[13.5px] text-ink'}>{bfLine}</p>
          {bf.status === 'running' ? <ProgressBar value={bf.filesCopied} max={Math.max(1, bf.filesListed)} /> : null}
        </div>
      ) : null}

      <TileGrid cols={7}>
        <KpiTile label={t('verify.tiles.source')} value={fmtNumber(run.sourceCount, lang)} />
        <KpiTile label={t('verify.tiles.dest')} value={fmtNumber(run.destCount, lang)} />
        <KpiTile label={t('verify.tiles.both')} value={fmtNumber(run.presentOnBoth, lang)} />
        <KpiTile label={t('verify.tiles.missingDest')} value={fmtNumber(run.missingFromDest, lang)} tone={run.missingFromDest > 0 ? 'warning' : undefined} />
        <KpiTile label={t('verify.tiles.missingSource')} value={fmtNumber(run.missingFromSource, lang)} tone={run.missingFromSource > 0 ? 'warning' : undefined} />
        <KpiTile label={t('verify.tiles.mismatched')} value={fmtNumber(run.daysWithMismatch, lang)} tone={run.daysWithMismatch > 0 ? 'warning' : undefined} />
        <KpiTile label={t('verify.tiles.failed')} value={fmtNumber(run.daysFailed, lang)} tone={run.daysFailed > 0 ? 'danger' : undefined} />
      </TileGrid>

      <div className="flex flex-col gap-2">
        <SectionTitle>{t('verify.days.title')}</SectionTitle>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <DataTable
            compact
            columns={columns}
            rows={query.data?.days}
            rowKey={(d) => d.date}
            loading={query.isLoading}
            pageSize={10}
            pageSizes={[10, 25, 50]}
            onRowClick={(d) => {
              if (d.missingFromDest.length + d.missingFromSource.length > 0) toggle(d.date)
            }}
            expandedKeys={expanded}
            renderExpanded={(d) => <MissingFiles day={d} />}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('verify.cancelDialog.title')}
        body={t('verify.cancelDialog.body')}
        confirmLabel={t('verify.cancelDialog.confirm')}
        cancelLabel={t('verify.cancelDialog.keep')}
        tone="danger"
        busy={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(run.id, {
            onSuccess: () => toast.success(t('verify.toasts.canceling')),
            onError: (e) => toast.error(errorMessage(e)),
            onSettled: () => setConfirmCancel(false),
          })
        }
      />
    </section>
  )
}

/* ------------------------------------------------------ missing files */

function MissingFiles({ day }: { day: VerifyDayRow }) {
  const { t } = useTranslation('archive')
  return (
    <div className="flex flex-col gap-4 bg-sunken px-4 py-3">
      {day.missingFromDest.length > 0 ? (
        <FileList title={t('verify.missing.fromDest', { count: day.missingFromDest.length })} files={day.missingFromDest} />
      ) : null}
      {day.missingFromSource.length > 0 ? (
        <FileList title={t('verify.missing.fromSource', { count: day.missingFromSource.length })} files={day.missingFromSource} />
      ) : null}
    </div>
  )
}

function FileList({ title, files }: { title: string; files: MissingFile[] }) {
  const { t } = useTranslation('archive')
  const [page, setPage] = useState(1)
  const rows = files.slice((page - 1) * FILES_PER_PAGE, page * FILES_PER_PAGE)
  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
      <div className="overflow-x-auto rounded-[8px] border border-line bg-panel">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="px-3 py-1.5 font-medium">{t('verify.missing.name')}</th>
              <th className="hidden px-3 py-1.5 font-medium md:table-cell">{t('verify.missing.path')}</th>
              <th className="px-3 py-1.5 text-right font-medium">{t('verify.missing.size')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.rawRelativePath} className="border-t border-line">
                <td className="tabular px-3 py-1.5 font-mono">{f.name}</td>
                <td className="hidden px-3 py-1.5 font-mono text-muted md:table-cell">{f.rawRelativePath}</td>
                <td className="tabular px-3 py-1.5 text-right font-mono">{fmtBytes(f.sourceSizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {files.length > FILES_PER_PAGE ? (
        <Pagination page={page} pageSize={FILES_PER_PAGE} total={files.length} onPageChange={setPage} pageSizes={[FILES_PER_PAGE]} />
      ) : null}
    </div>
  )
}
