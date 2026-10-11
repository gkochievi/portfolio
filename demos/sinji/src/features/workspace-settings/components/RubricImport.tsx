/**
 * "Import from a document": pick a file, watch the staged progress (upload %,
 * queued, extracting, analysing %), get a canned Georgian draft back.
 * OWNED BY: workspace-settings.
 */
import { Check, FileUp, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Dialog, ProgressBar, Spinner, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useFormat } from '@/lib/format'
import type { RubricImportJob } from '@/types'
import { errorMessage, useRubricImportJob, useStartRubricImport, type RubricDraft } from '../api'

const STAGES: RubricImportJob['stage'][] = ['uploading', 'queued', 'extracting', 'analysing']
const MAX_BYTES = 10 * 1024 * 1024

export default function RubricImport({ onDraft }: { onDraft: (draft: RubricDraft, filename: string) => void }) {
  const { t } = useTranslation('settings')
  const f = useFormat()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const start = useStartRubricImport()
  const job = useRubricImportJob(jobId)
  const current = job.data
  const running = Boolean(jobId) && current?.stage !== 'done' && current?.stage !== 'error'

  const reset = () => {
    setFile(null)
    setJobId(null)
    setStartError(null)
    start.reset()
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  useEffect(() => {
    if (current?.stage === 'done' && current.draft && file) {
      onDraft(current.draft, file.name)
      toast.success(t('import.loaded'))
      setOpen(false)
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.stage])

  const pick = (picked: File | null) => {
    setStartError(null)
    if (!picked) return
    if (picked.size === 0) return setStartError(t('import.empty'))
    if (picked.size > MAX_BYTES) return setStartError(t('import.tooBig'))
    setFile(picked)
  }

  const begin = async () => {
    if (!file) return
    setStartError(null)
    try {
      const created = await start.mutateAsync({ filename: file.name, size: file.size })
      setJobId(created.id)
    } catch (error) {
      setStartError(errorMessage(error, t('import.failed')))
    }
  }

  const stageIndex = current ? STAGES.indexOf(current.stage) : 0
  const failed = current?.stage === 'error' || (Boolean(jobId) && job.isError)

  return (
    <>
      <Button variant="secondary" icon={<Sparkles />} onClick={() => setOpen(true)}>
        {t('import.button')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={close}
        title={t('import.title')}
        description={t('import.description')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              {t('import.cancel')}
            </Button>
            {jobId ? (
              failed ? (
                <Button variant="primary" onClick={reset}>
                  {t('import.retry')}
                </Button>
              ) : null
            ) : (
              <Button variant="primary" disabled={!file} loading={start.isPending} icon={<FileUp />} onClick={() => void begin()}>
                {t('import.start')}
              </Button>
            )}
          </>
        }
      >
        {!jobId ? (
          <div className="space-y-3">
            <input
              ref={input}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.rtf"
              className="sr-only"
              aria-label={t('import.choose')}
              onChange={(e) => {
                pick(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                pick(e.dataTransfer.files[0] ?? null)
              }}
              className="flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-sunken px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <FileUp className="size-6 text-muted" strokeWidth={1.5} aria-hidden />
              {file ? (
                <>
                  <span className="break-all text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted">{f.bytes(file.size)}</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">{t('import.choose')}</span>
                  <span className="text-xs text-muted">{t('import.formats')}</span>
                </>
              )}
            </button>
            {startError ? <Callout tone="danger">{startError}</Callout> : null}
          </div>
        ) : (
          <div className="space-y-4" aria-live="polite">
            <p className="break-all text-sm font-medium">{file?.name}</p>
            <ol className="space-y-3">
              {STAGES.map((stage, index) => {
                const done = failed ? index < stageIndex : index < stageIndex
                const active = !failed && index === stageIndex
                const withBar = stage === 'uploading' || stage === 'analysing'
                return (
                  <li key={stage} className={cn('flex items-start gap-3', !done && !active && 'opacity-50')}>
                    <span
                      className={cn(
                        'mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill border',
                        done ? 'border-success bg-success text-on-primary' : active ? 'border-primary' : 'border-line-strong',
                      )}
                    >
                      {done ? <Check className="size-3" strokeWidth={3} /> : active ? <Spinner size={12} /> : null}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-sm">
                        {t(`import.stage.${stage}`)}
                        {active && withBar && current ? <span className="tabular ml-2 text-muted">{current.progress}%</span> : null}
                      </p>
                      {active && withBar && current ? <ProgressBar value={current.progress} label={t(`import.stage.${stage}`)} /> : null}
                    </div>
                  </li>
                )
              })}
            </ol>
            {failed ? <Callout tone="danger">{current?.error ?? t('import.failed')}</Callout> : null}
            {running ? <p className="text-xs text-muted">{t('import.wait')}</p> : null}
          </div>
        )}
      </Dialog>
    </>
  )
}
