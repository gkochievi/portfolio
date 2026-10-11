/** Section 3: "Hangup by" backfill. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhoneOff } from 'lucide-react'

import { errorMessage, fieldErrors } from '@/api/client'
import { Banner, Button, Card, CardBody, CardHeader, ErrorState, KpiTile, Skeleton, StatusChip, toast } from '@/components/ui'
import { fmtDate, fmtNumber, timeAgo } from '@/lib/format'
import { useLang } from '@/shell/state'
import { useHangupBackfill, useHangupStatus, useInvalidateCalls, useOnFinished } from '../api'
import { DateRangeFields, TileGrid, dayOffset, validateRange, type RangeError } from './shared'

export function HangupSection() {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const status = useHangupStatus()
  const backfill = useHangupBackfill()
  const invalidateCalls = useInvalidateCalls()
  const [from, setFrom] = useState(() => dayOffset(-7))
  const [to, setTo] = useState(() => dayOffset(0))
  const [rangeError, setRangeError] = useState<RangeError>(null)
  const lastDay = dayOffset(0)
  const data = status.data

  useOnFinished(data?.running, () => {
    invalidateCalls()
    toast.success(t('hangup.toasts.done', { filled: fmtNumber(data?.lastResult?.filled ?? 0, lang) }))
  })

  const run = () => {
    const err = validateRange(from, to, { lastDay })
    setRangeError(err)
    if (err) return
    backfill.mutate(
      { fromDate: from, toDate: to },
      {
        onSuccess: () => toast.success(t('hangup.toasts.started')),
        onError: (e) => toast.error(fieldErrors(e).toDate ?? errorMessage(e)),
      },
    )
  }

  const yesNo = (v: boolean) => (
    <StatusChip tone={v ? 'success' : 'warning'}>{v ? t('hangup.tiles.yes') : t('hangup.tiles.no')}</StatusChip>
  )
  const result = data?.lastResult ?? null

  return (
    <Card>
      <CardHeader icon={PhoneOff} title={t('hangup.title')} subtitle={t('hangup.subtitle')} />
      <CardBody className="flex flex-col gap-4">
        {status.isError ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : !data ? (
          <TileGrid cols={4}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] w-full rounded-[10px]" />
            ))}
          </TileGrid>
        ) : (
          <>
            {!data.eventTablePresent ? <Banner tone="warning">{t('hangup.noTable')}</Banner> : null}
            <TileGrid cols={4}>
              <KpiTile label={t('hangup.tiles.eventTable')} value={yesNo(data.eventTablePresent)} />
              <KpiTile label={t('hangup.tiles.carriesSource')} value={yesNo(data.carriesHangupSource)} />
              <KpiTile label={t('hangup.tiles.withHangup')} value={fmtNumber(data.rowsWithHangupBy, lang)} />
              <KpiTile
                label={t('hangup.tiles.notChecked')}
                value={fmtNumber(data.notYetChecked, lang)}
                tone={data.notYetChecked > 0 ? 'warning' : 'success'}
              />
            </TileGrid>
          </>
        )}

        <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-sunken p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <DateRangeFields idPrefix="hangup" from={from} to={to} onFrom={setFrom} onTo={setTo} lastDay={lastDay} error={rangeError} disabled={data?.running} />
            <Button
              variant="primary"
              loading={backfill.isPending || !!data?.running}
              disabled={!data?.eventTablePresent || !!data?.running}
              onClick={run}
            >
              {data?.running ? t('hangup.running') : t('hangup.backfill')}
            </Button>
          </div>
          <div aria-live="polite">
            {result ? (
              <div className="flex flex-col gap-2">
                <p className="text-[12.5px] text-muted">
                  {t('hangup.result.caption', {
                    from: fmtDate(result.fromDate, lang),
                    to: fmtDate(result.toDate, lang),
                    when: timeAgo(result.completedAt, lang),
                  })}
                </p>
                <TileGrid cols={3}>
                  <KpiTile label={t('hangup.result.scanned')} value={fmtNumber(result.scanned, lang)} />
                  <KpiTile label={t('hangup.result.filled')} value={fmtNumber(result.filled, lang)} tone={result.filled > 0 ? 'success' : undefined} />
                  <KpiTile label={t('hangup.result.noSource')} value={fmtNumber(result.noSource, lang)} tone={result.noSource > 0 ? 'warning' : undefined} />
                </TileGrid>
              </div>
            ) : (
              <p className="text-[13px] text-muted">{t('hangup.result.none')}</p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
