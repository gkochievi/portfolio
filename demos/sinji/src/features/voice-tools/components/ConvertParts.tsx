import { AlertCircle, CheckCircle2, Clock, Download, Loader2, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Callout, ProgressBar, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import type { ConversionBatch, ConvertFormat } from '@/types'
import { useBatch, useStartBatch } from '../api'
import { buildZip, renamedEntries } from '../zip'

/** Start a batch and follow its streamed rows. The picked File objects stay in the browser. */
export function useConvertRun() {
  const start = useStartBatch()
  const [batchId, setBatchId] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [seed, setSeed] = useState<ConversionBatch | null>(null)
  const query = useBatch(batchId)
  const batch = query.data ?? seed

  return {
    batch,
    files,
    pending: start.isPending,
    error: start.error,
    active: batchId !== null,
    start: (picked: File[], format: string) =>
      start.mutate(
        { format, files: picked.map((f) => ({ name: f.name, bytes: f.size })) },
        {
          onSuccess: (created) => {
            setFiles(picked)
            setSeed(created)
            setBatchId(created.id)
          },
        },
      ),
    reset: () => {
      setBatchId(null)
      setSeed(null)
      setFiles([])
      start.reset()
    },
  }
}

export function FormatSelect({
  formats,
  value,
  onChange,
  disabled,
}: {
  formats: ConvertFormat[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const current = formats.find((f) => f.id === value)
  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        options={formats.map((f) => ({ value: f.id, label: f.label }))}
      />
      {current ? <p className="text-xs text-muted">{current.description}</p> : null}
    </div>
  )
}

const FAILURE_KEYS: Record<string, string> = {
  'The file ends before the audio header is complete.': 'header',
  'The audio stream uses a codec this converter cannot read.': 'codec',
  'The file is empty or contains only silence.': 'silent',
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

function useCountdown(expiresAt: string | null): { text: string; expired: boolean } {
  const { t } = useTranslation('voiceTools')
  const now = useNow(expiresAt !== null)
  if (!expiresAt) return { text: '', expired: false }
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return { text: '', expired: true }
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const text = d > 0 ? t('convert.expiry.dh', { d, h }) : h > 0 ? t('convert.expiry.hm', { h, m }) : t('convert.expiry.ms', { m, s: sec })
  return { text, expired: false }
}

/** Rows streaming queued -> converting -> done / failed, then the ZIP download with its expiry. */
export function BatchView({
  batch,
  files,
  formats,
  onReset,
}: {
  batch: ConversionBatch
  files: File[]
  formats: ConvertFormat[]
  onReset: () => void
}) {
  const { t } = useTranslation('voiceTools')
  const [zipping, setZipping] = useState(false)
  const [zipError, setZipError] = useState(false)
  const format = formats.find((f) => f.id === batch.format)
  const finished = batch.rows.filter((r) => r.state === 'done' || r.state === 'failed').length
  const running = batch.state === 'running'
  const countdown = useCountdown(batch.expires_at)

  const download = async () => {
    setZipping(true)
    setZipError(false)
    try {
      const done = batch.rows.filter((r) => r.state === 'done')
      const names = renamedEntries(done.map((r) => r.name), format?.ext ?? 'wav')
      const entries = await Promise.all(
        done.map(async (row, i) => {
          const file = files[row.index]
          return { name: names[i] as string, data: new Uint8Array(file ? await file.arrayBuffer() : new ArrayBuffer(0)) }
        }),
      )
      const url = URL.createObjectURL(buildZip(entries))
      const a = document.createElement('a')
      a.href = url
      a.download = `sinji-converted-${batch.token.slice(-8)}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setZipError(true)
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar
        value={finished}
        max={batch.rows.length}
        tone={running ? 'primary' : batch.failed ? 'warning' : 'success'}
        label={running ? t('convert.progress', { done: finished, total: batch.rows.length }) : t('convert.summary', { ok: batch.ok, failed: batch.failed })}
        showValue
      />
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel" aria-live="polite">
        {batch.rows.map((row) => (
          <li key={row.index} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <StateIcon state={row.state} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">{row.name}</p>
              {row.state === 'failed' && row.error ? (
                <p className="text-xs text-danger">
                  {FAILURE_KEYS[row.error] ? t(`convert.failures.${FAILURE_KEYS[row.error]}`) : row.error}
                </p>
              ) : (
                <p className="text-xs text-subtle">{formatBytes(row.bytes)}</p>
              )}
            </div>
            <span className={cn('shrink-0 text-xs', row.state === 'done' ? 'text-success' : row.state === 'failed' ? 'text-danger' : 'text-muted')}>
              {t(`convert.states.${row.state}`)}
            </span>
          </li>
        ))}
      </ul>

      {batch.state === 'done' ? (
        batch.ok > 0 ? (
          <div className="flex flex-col gap-3 rounded-card border border-line bg-sunken p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<Download />} loading={zipping} disabled={countdown.expired} onClick={() => void download()}>
                {t('convert.download', { n: batch.ok })}
              </Button>
              <span className={cn('flex items-center gap-1.5 text-sm', countdown.expired ? 'text-danger' : 'text-muted')}>
                <Clock className="size-4" aria-hidden />
                {countdown.expired ? t('convert.expired') : t('convert.expires', { time: countdown.text })}
              </span>
            </div>
            <p className="text-xs text-subtle">{t('convert.zipNote', { ext: format?.ext ?? 'wav' })}</p>
            {zipError ? <p role="alert" className="text-sm text-danger">{t('convert.zipFailed')}</p> : null}
          </div>
        ) : (
          <Callout tone="warning">{t('convert.noneOk')}</Callout>
        )
      ) : null}

      {batch.state === 'done' ? (
        <div>
          <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={onReset}>
            {t('convert.newBatch')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function StateIcon({ state }: { state: ConversionBatch['rows'][number]['state'] }) {
  const cls = 'size-4 shrink-0'
  if (state === 'done') return <CheckCircle2 className={cn(cls, 'text-success')} aria-hidden />
  if (state === 'failed') return <AlertCircle className={cn(cls, 'text-danger')} aria-hidden />
  if (state === 'converting') return <Loader2 className={cn(cls, 'animate-spin text-primary')} aria-hidden />
  return <Clock className={cn(cls, 'text-subtle')} aria-hidden />
}
