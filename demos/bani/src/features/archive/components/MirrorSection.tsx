/** Section 2: Edge PBX mirror (check a range, backfill gaps, sync-run log). */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GitCompareArrows, ScanSearch, Wrench } from 'lucide-react'

import { errorMessage, fieldErrors } from '@/api/client'
import { Button, Card, CardBody, CardHeader, DataTable, ErrorState, KpiTile, SectionTitle, Skeleton, StatusChip, toast, type Column } from '@/components/ui'
import { fmtDate, fmtDateTime, fmtDuration, fmtNumber, timeAgo } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { MirrorSyncRun } from '@/types'
import { useMirrorCheck, useMirrorReconcile, useMirrorRuns, useMirrorStatus, useOnFinished } from '../api'
import { DateRangeFields, JobStatusChip, TileGrid, dayOffset, validateRange, type RangeError } from './shared'

const PAGE_SIZE = 8

export function MirrorSection() {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const status = useMirrorStatus()
  const [page, setPage] = useState(1)
  const runs = useMirrorRuns(page, PAGE_SIZE)
  const check = useMirrorCheck()
  const reconcile = useMirrorReconcile()
  const [from, setFrom] = useState(() => dayOffset(-7))
  const [to, setTo] = useState(() => dayOffset(0))
  const [rangeError, setRangeError] = useState<RangeError>(null)
  const lastDay = dayOffset(0)

  const manualRunning = !!runs.data?.items.some((r) => r.status === 'running' && r.trigger !== 'interval')
  useOnFinished(manualRunning, () => {
    const latest = runs.data?.items.find((r) => r.trigger !== 'interval')
    if (latest?.status === 'completed') toast.success(t('mirror.toasts.reconcileDone', { inserted: fmtNumber(latest.inserted, lang) }))
  })

  const validate = (): boolean => {
    const err = validateRange(from, to, { lastDay })
    setRangeError(err)
    return err === null
  }

  const onCheck = () => {
    if (!validate()) return
    check.mutate(
      { fromDate: from, toDate: to },
      {
        onSuccess: (r) => toast.success(t('mirror.toasts.checked', { missing: fmtNumber(r.missing, lang) })),
        onError: (err) => toast.error(fieldErrors(err).toDate ?? errorMessage(err)),
      },
    )
  }

  const onReconcile = () => {
    if (!validate()) return
    reconcile.mutate(
      { fromDate: from, toDate: to },
      {
        onSuccess: () => {
          setPage(1)
          toast.success(t('mirror.toasts.reconcileStarted'))
        },
        onError: (err) => toast.error(fieldErrors(err).toDate ?? errorMessage(err)),
      },
    )
  }

  const columns = useMemo<Column<MirrorSyncRun>[]>(
    () => [
      { id: 'trigger', header: t('mirror.runs.trigger'), cell: (r) => t(`triggers.${r.trigger}`) },
      {
        id: 'range',
        header: t('mirror.runs.range'),
        hideBelow: 'sm',
        cell: (r) => (r.fromDate && r.toDate ? `${fmtDate(r.fromDate, lang)} – ${fmtDate(r.toDate, lang)}` : '-'),
      },
      {
        id: 'status',
        header: t('mirror.runs.status'),
        cell: (r) => (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <JobStatusChip status={r.status} />
            {r.error ? <span className="max-w-[260px] truncate text-[12px] text-danger" title={r.error}>{r.error}</span> : null}
          </span>
        ),
      },
      { id: 'fetched', header: t('mirror.runs.fetched'), align: 'right', mono: true, cell: (r) => fmtNumber(r.fetched, lang) },
      { id: 'inserted', header: t('mirror.runs.inserted'), align: 'right', mono: true, cell: (r) => fmtNumber(r.inserted, lang) },
      {
        id: 'duration',
        header: t('mirror.runs.duration'),
        align: 'right',
        mono: true,
        hideBelow: 'md',
        cell: (r) => (r.durationMs == null ? '-' : fmtDuration(r.durationMs / 1000)),
      },
      { id: 'started', header: t('mirror.runs.started'), cell: (r) => fmtDateTime(r.startedAt, lang), hideBelow: 'sm' },
    ],
    [t, lang],
  )

  const m = status.data
  const result = m?.lastCheck ?? null

  return (
    <Card>
      <CardHeader icon={GitCompareArrows} title={t('mirror.title')} subtitle={t('mirror.subtitle')} />
      <CardBody className="flex flex-col gap-4">
        {status.isError ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : !m ? (
          <TileGrid cols={4}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] w-full rounded-[10px]" />
            ))}
          </TileGrid>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone={m.enabled ? 'success' : 'warning'}>{m.enabled ? t('mirror.chips.enabled') : t('mirror.chips.disabled')}</StatusChip>
              <StatusChip tone={m.configured ? 'success' : 'warning'}>{m.configured ? t('mirror.chips.configured') : t('mirror.chips.notConfigured')}</StatusChip>
              {m.isRunning ? <StatusChip tone="info">{t('mirror.chips.running')}</StatusChip> : null}
            </div>
            <TileGrid cols={4}>
              <KpiTile label={t('mirror.tiles.totalRecords')} value={fmtNumber(m.totalRecords, lang)} />
              <KpiTile label={t('mirror.tiles.interval')} value={t('mirror.tiles.intervalValue', { minutes: m.syncIntervalMinutes })} />
              <KpiTile label={t('mirror.tiles.oldest')} value={<span className="text-[17px]">{fmtDateTime(m.oldestRecordAt, lang)}</span>} />
              <KpiTile label={t('mirror.tiles.newest')} value={<span className="text-[17px]">{fmtDateTime(m.newestRecordAt, lang)}</span>} />
            </TileGrid>
          </>
        )}

        <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-sunken p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
            <DateRangeFields idPrefix="mirror" from={from} to={to} onFrom={setFrom} onTo={setTo} lastDay={lastDay} error={rangeError} />
            <Button icon={ScanSearch} loading={check.isPending} onClick={onCheck}>
              {t('mirror.check')}
            </Button>
            <Button variant="primary" icon={Wrench} loading={reconcile.isPending} disabled={manualRunning} onClick={onReconcile}>
              {t('mirror.reconcile')}
            </Button>
          </div>

          <div aria-live="polite">
            {result ? (
              <div className="flex flex-col gap-2">
                <p className="text-[12.5px] text-muted">
                  {t('mirror.result.caption', {
                    from: fmtDate(result.fromDate, lang),
                    to: fmtDate(result.toDate, lang),
                    when: timeAgo(result.checkedAt, lang),
                  })}
                </p>
                <TileGrid cols={5}>
                  <KpiTile label={t('mirror.result.total')} value={fmtNumber(result.total, lang)} />
                  <KpiTile label={t('mirror.result.distinct')} value={fmtNumber(result.distinct, lang)} />
                  <KpiTile
                    label={t('mirror.result.duplicates')}
                    value={fmtNumber(result.duplicates, lang)}
                    tone={result.duplicates > 0 ? 'info' : undefined}
                  />
                  <KpiTile label={t('mirror.result.mirror')} value={fmtNumber(result.mirror, lang)} />
                  <KpiTile
                    label={t('mirror.result.missing')}
                    value={fmtNumber(result.missing, lang)}
                    tone={result.missing > 0 ? 'danger' : 'success'}
                    hint={result.missing === 0 ? t('mirror.result.clean') : undefined}
                  />
                </TileGrid>
              </div>
            ) : (
              <p className="text-[13px] text-muted">{t('mirror.result.none')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionTitle>{t('mirror.runs.title')}</SectionTitle>
          {runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
          ) : (
            <DataTable
              compact
              columns={columns}
              rows={runs.data?.items}
              rowKey={(r) => r.id}
              loading={runs.isLoading}
              emptyTitle={t('mirror.runs.empty')}
              paging={{ page, pageSize: PAGE_SIZE, total: runs.data?.total ?? 0, onPageChange: setPage }}
            />
          )}
        </div>
      </CardBody>
    </Card>
  )
}
