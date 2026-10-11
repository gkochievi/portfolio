/** Section 1: Core Cluster record import. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseZap, FolderSync, RefreshCw, RotateCcw, Trash2, History } from 'lucide-react'

import { errorMessage } from '@/api/client'
import { Banner, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, KpiTile, LiveDot, Skeleton, StatusChip, toast } from '@/components/ui'
import { fmtDateTime, fmtNumber } from '@/lib/format'
import { useLang } from '@/shell/state'
import { useCoreStatus, useCoreSync, useOnFinished, usePurgeArchive, type CoreSyncMode } from '../api'
import { JobStatusChip, PasswordConfirmDialog, TileGrid } from './shared'

type Advanced = 'full' | 'reset' | 'purge' | null

export function CoreImportSection() {
  const { t } = useTranslation('archive')
  const lang = useLang()
  const status = useCoreStatus()
  const sync = useCoreSync()
  const purge = usePurgeArchive()
  const [advanced, setAdvanced] = useState<Advanced>(null)
  const data = status.data

  useOnFinished(data?.isRunning, () => {
    const last = data?.lastSync
    if (last?.status === 'failed') toast.error(t('core.toasts.failed'))
    else toast.success(t('core.toasts.completed', { records: fmtNumber(last?.recordsImported ?? 0, lang) }))
  })

  const start = (mode: CoreSyncMode, toastKey: string) =>
    sync.mutate(mode, {
      onSuccess: () => toast.success(t(toastKey)),
      onError: (err) => toast.error(errorMessage(err)),
    })

  const busy = !!data?.isRunning || sync.isPending
  const empty = !!data && data.totalRecords === 0 && data.totalFiles === 0 && !data.isRunning
  const last = data?.lastSync

  return (
    <Card>
      <CardHeader
        icon={DatabaseZap}
        title={t('core.title')}
        subtitle={t('core.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" icon={FolderSync} loading={busy} disabled={busy} onClick={() => start('local', 'core.toasts.started')}>
              {t('core.actions.syncLocal')}
            </Button>
            <Button size="sm" icon={RefreshCw} disabled={busy} onClick={() => start('reconcile', 'core.toasts.reconcileStarted')}>
              {t('core.actions.reconcile')}
            </Button>
          </div>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {status.isError ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : !data ? (
          <TileGrid cols={5}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[92px] w-full rounded-[10px]" />
            ))}
          </TileGrid>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {data.isRunning ? (
                <StatusChip tone="info" icon={false}>
                  <LiveDot tone="info" className="mr-1" />
                  {t('core.chips.running')}
                </StatusChip>
              ) : (
                <StatusChip tone="neutral">{t('core.chips.idle')}</StatusChip>
              )}
              <StatusChip tone={data.dropListenerRunning ? 'success' : 'warning'}>
                {data.dropListenerRunning ? t('core.chips.listenerOn') : t('core.chips.listenerOff')}
              </StatusChip>
              <StatusChip tone={data.cronRunning ? 'success' : 'warning'}>{data.cronRunning ? t('core.chips.cronOn') : t('core.chips.cronOff')}</StatusChip>
            </div>

            {empty ? (
              <EmptyState compact icon={DatabaseZap} title={t('core.setup.title')} body={t('core.setup.body')} />
            ) : null}

            <TileGrid cols={5}>
              <KpiTile label={t('core.tiles.totalRecords')} value={fmtNumber(data.totalRecords, lang)} />
              <KpiTile label={t('core.tiles.totalFiles')} value={fmtNumber(data.totalFiles, lang)} />
              <KpiTile
                label={t('core.tiles.oldest')}
                value={<span className="text-[17px]">{fmtDateTime(data.oldestRecordAt, lang)}</span>}
              />
              <KpiTile
                label={t('core.tiles.newest')}
                value={<span className="text-[17px]">{fmtDateTime(data.newestRecordAt, lang)}</span>}
              />
              <KpiTile
                label={t('core.tiles.localFiles')}
                value={fmtNumber(data.localFilesAvailable, lang)}
                hint={t('core.tiles.localFilesHint')}
                tone={data.localFilesAvailable > 0 ? 'warning' : undefined}
              />
            </TileGrid>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] border border-line bg-sunken px-4 py-3 text-[13.5px]">
              <span className="eyebrow">{t('core.tiles.lastSync')}</span>
              {data.isRunning ? (
                <>
                  <JobStatusChip status="running" />
                  <span className="text-muted">{t('core.chips.running')}</span>
                </>
              ) : last ? (
                <>
                  <JobStatusChip status={last.status} />
                  <span className="tabular text-ink">{fmtDateTime(last.completedAt, lang, { seconds: true })}</span>
                  <span className="text-muted">
                    {t('core.tiles.lastSyncHint', { files: fmtNumber(last.filesProcessed, lang), records: fmtNumber(last.recordsImported, lang) })}
                  </span>
                </>
              ) : (
                <span className="text-muted">{t('core.tiles.noSync')}</span>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t('core.actions.advanced')}</span>
                <span className="text-[12.5px] text-muted">{t('core.actions.advancedHint')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={History} disabled={busy} onClick={() => setAdvanced('full')}>
                  {t('core.actions.full')}
                </Button>
                <Button size="sm" icon={RotateCcw} disabled={busy} onClick={() => setAdvanced('reset')}>
                  {t('core.actions.reset')}
                </Button>
                <Button size="sm" variant="danger" icon={Trash2} disabled={busy} onClick={() => setAdvanced('purge')}>
                  {t('core.actions.purge')}
                </Button>
              </div>
            </div>
          </>
        )}
        {sync.isError && !status.isError ? <Banner tone="danger">{errorMessage(sync.error)}</Banner> : null}
      </CardBody>

      <PasswordConfirmDialog
        open={advanced === 'full'}
        onOpenChange={(o) => !o && setAdvanced(null)}
        title={t('core.dialogs.full.title')}
        body={t('core.dialogs.full.body')}
        confirmLabel={t('core.dialogs.full.confirm')}
        tone="default"
        onVerified={async () => {
          await sync.mutateAsync('full')
          toast.success(t('core.toasts.fullStarted'))
        }}
      />
      <PasswordConfirmDialog
        open={advanced === 'reset'}
        onOpenChange={(o) => !o && setAdvanced(null)}
        title={t('core.dialogs.reset.title')}
        body={t('core.dialogs.reset.body')}
        confirmLabel={t('core.dialogs.reset.confirm')}
        onVerified={async () => {
          await sync.mutateAsync('reset')
          toast.success(t('core.toasts.resetDone'))
        }}
      />
      <PasswordConfirmDialog
        open={advanced === 'purge'}
        onOpenChange={(o) => !o && setAdvanced(null)}
        title={t('core.dialogs.purge.title')}
        body={t('core.dialogs.purge.body')}
        confirmLabel={t('core.dialogs.purge.confirm')}
        onVerified={async () => {
          const res = await purge.mutateAsync()
          toast.success(t('core.toasts.purged', { records: fmtNumber(res.deleted, lang) }))
        }}
      />
    </Card>
  )
}
