import { FileAudio, SlidersHorizontal, Upload, X } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, Callout, Checkbox, Field, IconButton, Input, Panel, ProgressBar, SegmentedControl, Select, Textarea, toast } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'
import { hashString } from '@/demo/lib/text'
import type { ContentLang, Recording, TranscriptionSettings } from '@/types'
import { createTextCall, runAllAtOnce, uploadOne, useTranscriptionDefaults } from '../api'
import { OverrideDialog } from './OverrideDialog'

const MB = 1024 * 1024
const MAX_FILES = 10
const MAX_FILE = 100 * MB
const MAX_TOTAL = 300 * MB
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|amr|wma|webm|mp4|3gp|gsm|g722)$/i
const ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.amr,.wma,.webm,.mp4,.3gp,.gsm,.g722'

interface QueueItem {
  id: string
  file: File
  progress: number
  phase: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  override: Partial<TranscriptionSettings> | null
}

let counter = 0

function summarise(results: Array<{ failed: number }>, t: (k: string, o?: Record<string, unknown>) => string) {
  const failed = results.reduce((n, r) => n + r.failed, 0)
  if (failed === 0) toast.success(t('run.batchDone', { count: results.length }))
  else toast.warning(t('run.batchPartial', { count: results.length, failed }))
}

export function NewAnalysisPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('workbench')
  const navigate = useNavigate()
  const defaults = useTranscriptionDefaults()
  const [mode, setMode] = useState<'audio' | 'text'>('audio')
  const [runAll, setRunAll] = useState(false)

  /* audio */
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  /* text */
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<ContentLang>(i18n.language === 'ka' ? 'ka' : 'en')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const total = queue.reduce((n, i) => n + i.file.size, 0)

  const addFiles = (incoming: FileList | File[]) => {
    const issues: string[] = []
    const next = [...queue]
    let sum = total
    for (const file of Array.from(incoming)) {
      if (next.some((i) => i.file.name === file.name && i.file.size === file.size)) continue
      if (!AUDIO_EXT.test(file.name) && !file.type.startsWith('audio/')) {
        issues.push(t('queue.notAudio', { name: file.name }))
        continue
      }
      if (file.size > MAX_FILE) {
        issues.push(t('queue.tooBig', { name: file.name }))
        continue
      }
      if (next.length >= MAX_FILES) {
        issues.push(t('queue.tooMany', { max: MAX_FILES }))
        break
      }
      if (sum + file.size > MAX_TOTAL) {
        issues.push(t('queue.totalExceeded', { name: file.name }))
        continue
      }
      sum += file.size
      counter += 1
      next.push({ id: `q${counter}`, file, progress: 0, phase: 'queued', override: null })
    }
    setProblems(issues)
    setQueue(next)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!busy && e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }

  const patch = (id: string, change: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.id === id ? { ...i, ...change } : i)))

  const submitAudio = async () => {
    const items = queue.filter((i) => i.phase !== 'done')
    if (items.length === 0) return
    setBusy(true)
    setProblems([])
    // Client-side progress: 0 -> 100% in about a second per file.
    const spans = new Map(items.map((i) => [i.id, 700 + (hashString(i.file.name) % 500)]))
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        const elapsed = performance.now() - started
        let all = true
        setQueue((q) =>
          q.map((i) => {
            const span = spans.get(i.id)
            if (!span) return i
            const progress = Math.min(100, Math.round((elapsed / span) * 100))
            return { ...i, progress, phase: 'uploading' }
          }),
        )
        for (const span of spans.values()) if (elapsed < span) all = false
        if (all) {
          window.clearInterval(timer)
          resolve()
        }
      }, 80)
    })

    const created: Recording[] = []
    for (const item of items) {
      try {
        const rec = await uploadOne({
          file: { name: item.file.name, size: item.file.size, type: item.file.type },
          override: item.override,
        })
        created.push(rec)
        patch(item.id, { phase: 'done', progress: 100 })
      } catch (error) {
        const message = error instanceof ApiError ? (error.fieldErrors.files?.[0] ?? error.message) : t('common:errors.generic')
        patch(item.id, { phase: 'error', error: message })
      }
    }
    setBusy(false)
    if (created.length > 0) {
      const first = created[0]
      toast.success(t('queue.uploaded', { count: created.length }), {
        action: first ? { label: t('queue.open'), onClick: () => navigate(`/workspace/calls/${first.id}`) } : undefined,
      })
      if (runAll) {
        void Promise.all(created.map((r) => runAllAtOnce(r.id).then((res) => ({ failed: res.failed.length })))).then((res) =>
          summarise(res, t),
        )
      }
      window.setTimeout(() => setQueue((q) => q.filter((i) => i.phase === 'error')), 600)
    }
  }

  const submitText = async () => {
    const next: Record<string, string> = {}
    if (!title.trim()) next.title = t('text.titleRequired')
    if (text.trim().length < 10) next.text = t('text.textRequired')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      const rec = await createTextCall({ title: title.trim(), language, text })
      toast.success(t('text.created'))
      if (runAll) void runAllAtOnce(rec.id).then((res) => summarise([{ failed: res.failed.length }], t))
      navigate(`/workspace/calls/${rec.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped: Record<string, string> = {}
        for (const [k, v] of Object.entries(error.fieldErrors)) mapped[k] = v[0] ?? error.message
        setErrors(Object.keys(mapped).length > 0 ? mapped : { text: error.message })
      } else toast.error(t('common:errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  const editingItem = queue.find((i) => i.id === editing)

  return (
    <Panel
      title={t('new.title')}
      description={t('new.description')}
      actions={
        <IconButton label={t('common:actions.close')} icon={<X className="size-4" />} onClick={onClose} />
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          value={mode}
          onValueChange={(v) => setMode(v as 'audio' | 'text')}
          options={[
            { value: 'audio', label: t('new.audio') },
            { value: 'text', label: t('new.text') },
          ]}
        />

        {mode === 'audio' ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex flex-col items-center gap-2 rounded-card border border-dashed p-6 text-center transition-colors',
                dragging ? 'border-primary bg-primary/6' : 'border-line-strong bg-sunken/50',
              )}
            >
              <Upload className="size-6 text-muted" strokeWidth={1.5} />
              <p className="text-sm text-ink">{t('queue.drop')}</p>
              <p className="text-xs text-muted">{t('queue.limits', { files: MAX_FILES, each: 100, total: 300 })}</p>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
                {t('queue.choose')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPT}
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>

            {problems.length > 0 ? (
              <Callout tone="danger">
                <ul className="list-inside list-disc space-y-0.5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            {queue.length > 0 ? (
              <>
                <ul className="divide-y divide-line rounded-card border border-line bg-panel">
                  {queue.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <FileAudio className="size-5 shrink-0 text-muted" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="truncate text-sm font-medium">{item.file.name}</span>
                          <span className="text-xs tabular text-muted">{formatBytes(item.file.size)}</span>
                          {item.override ? <Badge size="sm" tone="accent">{t('queue.custom')}</Badge> : null}
                        </div>
                        {item.phase === 'uploading' || item.phase === 'done' ? (
                          <ProgressBar value={item.progress} tone={item.phase === 'done' ? 'success' : 'primary'} className="mt-1.5" />
                        ) : null}
                        {item.phase === 'error' ? <p className="mt-1 text-xs text-danger">{item.error}</p> : null}
                      </div>
                      <IconButton
                        label={t('queue.options')}
                        icon={<SlidersHorizontal className="size-4" />}
                        disabled={busy || item.phase === 'done'}
                        onClick={() => setEditing(item.id)}
                      />
                      <IconButton
                        label={t('queue.remove')}
                        icon={<X className="size-4" />}
                        disabled={busy}
                        onClick={() => setQueue((q) => q.filter((i) => i.id !== item.id))}
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-xs tabular text-muted">{t('queue.summary', { count: queue.length, max: MAX_FILES, size: formatBytes(total), total: formatBytes(MAX_TOTAL) })}</p>
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Field label={t('text.titleLabel')} error={errors.title}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('text.titlePlaceholder')} />
              </Field>
              <Field label={t('text.language')} error={errors.language}>
                <Select
                  value={language}
                  onValueChange={(v) => setLanguage(v as ContentLang)}
                  options={[
                    { value: 'ka', label: t('lang.ka') },
                    { value: 'en', label: t('lang.en') },
                    { value: 'ru', label: t('lang.ru') },
                  ]}
                />
              </Field>
            </div>
            <Field label={t('text.transcript')} hint={t('text.transcriptHint')} error={errors.text}>
              <Textarea rows={9} mono value={text} onChange={(e) => setText(e.target.value)} placeholder={t('text.placeholder')} />
            </Field>
            <Button variant="link" size="xs" onClick={() => {
                setText(t('text.sample'))
                setLanguage(i18n.language === 'ka' ? 'ka' : 'en')
              }}>
              {t('text.insertSample')}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Checkbox checked={runAll} onCheckedChange={setRunAll} label={t('new.runAll')} description={t('new.runAllHint')} />
          <Button
            variant="primary"
            loading={busy}
            disabled={mode === 'audio' ? queue.filter((i) => i.phase !== 'done').length === 0 : false}
            onClick={() => void (mode === 'audio' ? submitAudio() : submitText())}
            className="min-w-44"
          >
            {mode === 'audio' ? t('new.submitAudio') : t('new.submitText')}
          </Button>
        </div>
      </div>

      {editingItem ? (
        <OverrideDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          fileName={editingItem.file.name}
          defaults={defaults}
          value={editingItem.override}
          multiple={queue.length > 1}
          onSave={(override, all) => {
            setQueue((q) => q.map((i) => (all || i.id === editingItem.id ? { ...i, override } : i)))
          }}
        />
      ) : null}
    </Panel>
  )
}
