import { FileAudio, Plus, Trash2, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, Field, IconButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { useConvertFormats, useLimits } from '../api'
import { isAudioFile } from './AudioSource'
import { BatchView, FormatSelect, useConvertRun } from './ConvertParts'
import { ErrorNote } from './ErrorNote'

export function ConvertPanel() {
  const { t } = useTranslation('voiceTools')
  const formatsQuery = useConvertFormats()
  const limits = useLimits()
  const run = useConvertRun()
  const [files, setFiles] = useState<File[]>([])
  const [format, setFormat] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  if (formatsQuery.isLoading) return <Skeleton className="h-72 w-full rounded-card" />
  if (formatsQuery.isError || !formatsQuery.data) {
    return (
      <Callout tone="danger" title={t('errors.catalog')}>
        <Button size="sm" variant="secondary" onClick={() => void formatsQuery.refetch()}>
          {t('quota.retry')}
        </Button>
      </Callout>
    )
  }

  const { formats, limits: caps } = formatsQuery.data
  const chosen = format || formats[0]?.id || ''
  const remaining = limits.data?.remaining.conversions ?? 1
  const blocked = limits.data ? !limits.data.enabled || !limits.data.features.convert || remaining <= 0 : false
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)

  const add = (incoming: FileList | File[]) => {
    const next = [...files]
    let problem: string | null = null
    for (const file of Array.from(incoming)) {
      if (!isAudioFile(file)) problem = t('convert.errors.notAudio', { name: file.name })
      else if (file.size === 0) problem = t('convert.errors.empty', { name: file.name })
      else if (file.size > caps.max_file_bytes) problem = t('convert.errors.tooBig', { name: file.name, size: formatBytes(caps.max_file_bytes) })
      else if (next.length >= caps.max_files) problem = t('convert.errors.tooMany', { n: caps.max_files })
      else if (next.reduce((s, f) => s + f.size, 0) + file.size > caps.max_batch_bytes) problem = t('convert.errors.batchTooBig', { size: formatBytes(caps.max_batch_bytes) })
      else next.push(file)
    }
    setError(problem)
    setFiles(next)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (!blocked) add(event.dataTransfer.files)
  }

  const reset = () => {
    run.reset()
    setFiles([])
    setError(null)
  }

  if (run.active && run.batch) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <BatchView batch={run.batch} files={run.files} formats={formats} onReset={reset} />
        <Callout tone="info">{t('convert.demoNote')}</Callout>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('convert.lead')}</p>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!blocked) setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-card border border-dashed px-4 py-8 text-center transition-colors',
            over ? 'border-primary bg-primary/6' : 'border-line-strong bg-sunken',
            blocked && 'opacity-60',
          )}
        >
          <Upload className="size-6 text-muted" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">{t('convert.drop')}</p>
            <p className="mt-1 text-xs text-muted">
              {t('convert.dropHint', { files: caps.max_files, file: formatBytes(caps.max_file_bytes), batch: formatBytes(caps.max_batch_bytes) })}
            </p>
          </div>
          <input
            ref={input}
            type="file"
            multiple
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac,.webm,.gsm,.g722"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('convert.choose')}
            onChange={(e) => {
              if (e.target.files) add(e.target.files)
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="secondary" icon={files.length ? <Plus /> : <Upload />} disabled={blocked} onClick={() => input.current?.click()}>
            {files.length ? t('convert.addMore') : t('convert.choose')}
          </Button>
        </div>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

        {files.length ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-ink">
                {t('convert.files', { n: files.length })} <span className="font-normal text-muted">· {formatBytes(totalBytes)}</span>
              </h3>
              <Button size="xs" variant="ghost" icon={<Trash2 />} onClick={() => setFiles([])}>
                {t('convert.clearAll')}
              </Button>
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel">
              {files.map((file, i) => (
                <li key={`${file.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileAudio className="size-4 shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                  <span className="tabular shrink-0 text-xs text-muted">{formatBytes(file.size)}</span>
                  <IconButton label={t('convert.remove', { name: file.name })} icon={<X />} size="sm" onClick={() => setFiles(files.filter((_, j) => j !== i))} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-subtle">{t('convert.empty')}</p>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:pt-10">
        <Field label={t('convert.format')}>
          <FormatSelect formats={formats} value={chosen} onChange={setFormat} />
        </Field>
        <Button size="lg" loading={run.pending} disabled={!files.length || blocked} onClick={() => run.start(files, chosen)}>
          {run.pending ? t('convert.starting') : t('convert.run', { count: files.length })}
        </Button>
        {blocked && limits.data?.enabled && remaining <= 0 ? <p className="text-sm text-danger">{t('quota.exhausted.conversions')}</p> : null}
        <ErrorNote error={run.error} />
        <Callout tone="info">{t('convert.demoNote')}</Callout>
        <p className="text-xs text-subtle">{t('convert.ttl', { days: Math.round(caps.download_ttl_seconds / 86400) })}</p>
      </div>
    </div>
  )
}
