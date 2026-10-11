import { Download, Layers, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Panel, ProgressBar, ReadOnlyNote, SegmentedControl, Skeleton, StatusChip, toast } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { useFormat } from '@/lib/format'
import { useCanEdit } from '@/lib/session'
import { downloadText, useExport, useReembedJob, useStartReembed } from '../api'
import { errorText } from '../components/bits'

export default function KbMaintenancePage() {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const canEdit = useCanEdit()
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const exporter = useExport()
  const job = useReembedJob()
  const start = useStartReembed()

  const current = job.data
  const running = current?.state === 'running' || current?.state === 'queued'
  const finished = (current?.done_documents ?? 0) + (current?.failed_documents ?? 0)

  const doExport = async () => {
    try {
      const file = await exporter.mutateAsync(format)
      downloadText(file.filename, file.mime, file.content)
      toast.success(t('maintenance.exported', { name: file.filename }))
    } catch (error) {
      toast.error(errorText(error, t('common.actionError')))
    }
  }

  const doReembed = async () => {
    try {
      await start.mutateAsync()
      toast.success(t('maintenance.started'))
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) toast.warning(t('maintenance.alreadyRunning'))
      else toast.error(errorText(error, t('common.actionError')))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title={t('maintenance.exportTitle')} description={t('maintenance.exportBody')} icon={<Download className="size-4" />}>
        <div className="space-y-4">
          <SegmentedControl
            value={format}
            onValueChange={(v) => setFormat(v as 'json' | 'csv')}
            options={[
              { value: 'json', label: 'JSON' },
              { value: 'csv', label: 'CSV' },
            ]}
          />
          <p className="text-sm text-muted">{t(format === 'json' ? 'maintenance.jsonHint' : 'maintenance.csvHint')}</p>
          <Button variant="primary" loading={exporter.isPending} icon={<Download className="size-4" />} onClick={() => void doExport()}>
            {t('maintenance.exportButton', { format: format.toUpperCase() })}
          </Button>
        </div>
      </Panel>

      <Panel title={t('maintenance.reembedTitle')} description={t('maintenance.reembedBody')} icon={<Layers className="size-4" />}>
        {job.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : job.isError ? (
          <Callout tone="danger">{errorText(job.error, t('common.loadError'))}</Callout>
        ) : (
          <div className="space-y-4">
            {current ? (
              <div className="space-y-3 rounded-ctl border border-line bg-sunken p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={running ? 'info' : current.state === 'failed' ? 'danger' : 'success'} pulse={running}>
                    {t(`maintenance.state.${current.state}`)}
                  </StatusChip>
                  <span className="text-xs text-muted">
                    {running ? t('maintenance.startedAt', { when: f.time(current.created_at) }) : t('maintenance.finishedAt', { when: f.dateTime(current.finished_at ?? current.created_at) })}
                  </span>
                </div>
                <ProgressBar
                  value={current.total_documents ? finished : 0}
                  max={Math.max(1, current.total_documents)}
                  tone={current.state === 'failed' ? 'danger' : 'primary'}
                  label={t('maintenance.progress', { done: finished, total: current.total_documents })}
                />
                {current.failed_documents > 0 ? (
                  <p className="text-xs text-danger">{t('maintenance.failed', { count: current.failed_documents })}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('maintenance.never')}</p>
            )}

            {canEdit ? (
              <Button
                variant="primary"
                disabled={running}
                loading={start.isPending}
                icon={<RefreshCcw className="size-4" />}
                onClick={() => void doReembed()}
              >
                {running ? t('maintenance.running') : t('maintenance.reembedButton')}
              </Button>
            ) : (
              <ReadOnlyNote>{t('maintenance.readOnly')}</ReadOnlyNote>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
