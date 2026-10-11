import { Ban, History, Play, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Banner, Button, Card, CardBody, CardHeader, DateText, Field, Input, ProgressBar, Skeleton, toast } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import type { BackfillState, MailBackfillRun } from '@/types'

import { errorMessage, fieldErrorsOf, useBackfill, useCancelBackfill, useStartBackfill } from '../api'

const TONE: Record<BackfillState, 'info' | 'success' | 'warning' | 'danger'> = { running: 'info', completed: 'success', cancelled: 'warning', failed: 'danger' }

export function BackfillCard() {
  const { t } = useTranslation('ops')
  const query = useBackfill()
  const start = useStartBackfill()
  const cancel = useCancelBackfill()
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | undefined>()

  const run = query.data?.latest ?? null
  const running = run?.state === 'running'

  const onStart = async () => {
    const trimmed = limit.trim()
    if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1 || Number(trimmed) > 10000)) {
      setError(t('backfill.limitInvalid'))
      return
    }
    setError(undefined)
    try {
      await start.mutateAsync(trimmed ? Number(trimmed) : null)
      toast.success(t('backfill.started'))
    } catch (err) {
      const fe = fieldErrorsOf(err).limit
      if (fe) setError(fe)
      else toast.error(errorMessage(err))
    }
  }

  const onCancel = async () => {
    try {
      await cancel.mutateAsync()
      toast.info(t('backfill.cancelRequested'))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('backfill.title')}
        description={t('backfill.description')}
        actions={run ? <Badge tone={TONE[run.state]}>{t(`backfill.state.${run.state}`)}</Badge> : undefined}
      />
      <CardBody className="space-y-4">
        {query.isError ? (
          <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
            {errorMessage(query.error)}
          </Banner>
        ) : query.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (!running) void onStart()
              }}
            >
              <Field label={t('backfill.limit')} hint={t('backfill.limitHint')} htmlFor="bf-limit" error={error}>
                <Input id="bf-limit" type="number" inputMode="numeric" min={1} max={10000} className="w-36" value={limit} invalid={!!error} disabled={running} placeholder="240" onChange={(e) => setLimit(e.target.value)} />
              </Field>
              {running ? (
                <Button type="button" variant="destructive" size="sm" icon={<Ban />} loading={cancel.isPending} disabled={run.cancelRequested} onClick={onCancel}>
                  {run.cancelRequested ? t('backfill.cancelling') : t('backfill.cancel')}
                </Button>
              ) : (
                <Button type="submit" size="sm" icon={run ? <RotateCw /> : <Play />} loading={start.isPending}>
                  {run ? t('backfill.runAgain') : t('backfill.start')}
                </Button>
              )}
            </form>

            {run ? <RunDetails run={run} /> : <p className="text-[13px] text-muted">{t('backfill.never')}</p>}

            {(query.data?.history.length ?? 0) > 1 && (
              <details className="text-[13px]">
                <summary className="inline-flex cursor-pointer items-center gap-1.5 text-muted hover:text-ink">
                  <History className="size-4 stroke-[1.75]" aria-hidden />
                  {t('backfill.history', { count: query.data!.history.length - 1 })}
                </summary>
                <ul className="mt-2 divide-y divide-hairline rounded-md border border-hairline">
                  {query.data!.history.slice(1).map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <Badge tone={TONE[h.state]}>{t(`backfill.state.${h.state}`)}</Badge>
                      <DateText value={h.startedAt} withTime />
                      <span className="num text-muted">
                        {t('backfill.summaryLine', { processed: h.processedCount, total: h.totalCount, ingested: h.ingestedCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

function RunDetails({ run }: { run: MailBackfillRun }) {
  const { t } = useTranslation('ops')
  return (
    <div className="space-y-3">
      <ProgressBar value={run.processedCount} max={Math.max(1, run.totalCount)} tone={run.state === 'failed' ? 'danger' : run.state === 'cancelled' ? 'warning' : run.state === 'completed' ? 'success' : undefined} label={t('backfill.progress')} />
      <div className="num flex items-center justify-between text-[13px] text-muted">
        <span>
          {t('backfill.processed')}: <span className="font-mono text-ink">{formatNumber(run.processedCount)}</span> / <span className="font-mono">{formatNumber(run.totalCount)}</span>
        </span>
        {run.limit !== null && <span>{t('backfill.limitedTo', { limit: run.limit })}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label={t('backfill.ingested')} value={formatNumber(run.ingestedCount)} />
        <Fact label={t('backfill.skipped')} value={formatNumber(run.skippedCount)} />
        <Fact label={t('backfill.errors')} value={formatNumber(run.errorCount)} danger={run.errorCount > 0} />
        <Fact label={t('backfill.startedBy')} value={run.startedByName} />
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted">
        <span>
          {t('backfill.startedAt')}: <DateText value={run.startedAt} withTime />
        </span>
        {run.finishedAt && (
          <span>
            {t('backfill.finishedAt')}: <DateText value={run.finishedAt} withTime />
          </span>
        )}
      </div>
      {run.lastError && (
        <Banner tone="danger" title={t('backfill.lastError')}>
          <span className="font-mono text-[12px]">{run.lastError}</span>
        </Banner>
      )}
    </div>
  )
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border border-hairline bg-sunken/50 px-3 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`num mt-0.5 truncate font-mono text-[15px] ${danger ? 'text-danger' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}
