import { FileAudio, Mic, Sparkles, Square, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatBytes, formatClock } from '@/lib/format'

export interface PickedAudio {
  name: string
  size: number
  origin: 'file' | 'recording' | 'sample'
  blob?: Blob
  /** Canned-transcript index for "use a sample". */
  sample?: number
  canned_id?: string
}

const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|amr|gsm|g722|wma)$/i

export function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || file.type === 'video/webm' || AUDIO_EXT.test(file.name)
}

export interface SampleChoice {
  label: string
  sample?: number
  canned_id?: string
  name: string
  size: number
}

/**
 * Drop zone, file picker, microphone Recorder (a real MediaRecorder) and "use a sample".
 * The audio never leaves the browser; the mock answers with a canned result.
 */
export function AudioSource({
  value,
  onChange,
  maxMb,
  disabled,
  samples,
}: {
  value: PickedAudio | null
  onChange: (next: PickedAudio | null) => void
  maxMb: number
  disabled?: boolean
  samples: SampleChoice[]
}) {
  const { t } = useTranslation('voiceTools')
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const take = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!isAudioFile(file)) return setError(t('source.notAudio'))
      if (file.size > maxMb * 1024 * 1024) return setError(t('source.tooLarge', { mb: maxMb }))
      if (file.size === 0) return setError(t('source.empty'))
      setError(null)
      onChange({ name: file.name, size: file.size, origin: 'file', blob: file })
    },
    [maxMb, onChange, t],
  )

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    if (!disabled) take(event.dataTransfer.files[0])
  }

  if (value) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-line bg-panel p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-primary/10 text-primary">
            <FileAudio className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{value.name}</p>
            <p className="text-xs text-muted">
              {value.origin === 'sample' ? t('source.sampleBadge') : formatBytes(value.size)}
            </p>
          </div>
          <Badge tone={value.origin === 'sample' ? 'accent' : 'neutral'}>{t(`source.origin.${value.origin}`)}</Badge>
          <IconButton label={t('source.remove')} icon={<X />} onClick={() => onChange(null)} disabled={disabled} />
        </div>
        {value.blob ? <Preview blob={value.blob} /> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-3 rounded-card border border-dashed px-4 py-8 text-center transition-colors',
          over ? 'border-primary bg-primary/6' : 'border-line-strong bg-sunken',
          disabled && 'opacity-60',
        )}
      >
        <Upload className="size-6 text-muted" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink">{t('source.drop')}</p>
          <p className="mt-1 text-xs text-muted">{t('source.dropHint', { mb: maxMb })}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.opus,.flac,.webm,.gsm,.g722"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('source.choose')}
          onChange={(e) => {
            take(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" variant="secondary" icon={<Upload />} onClick={() => inputRef.current?.click()} disabled={disabled}>
            {t('source.choose')}
          </Button>
          <Recorder disabled={disabled} onRecorded={(blob, ext) => {
            setError(null)
            onChange({ name: `recording-${new Date().toTimeString().slice(0, 5).replace(':', '')}.${ext}`, size: blob.size, origin: 'recording', blob })
          }} onError={setError} />
        </div>
      </div>
      {samples.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t('source.or')}</span>
          {samples.map((s) => (
            <Button
              key={s.label}
              size="sm"
              variant="subtle"
              icon={<Sparkles />}
              disabled={disabled}
              onClick={() => {
                setError(null)
                onChange({ name: s.name, size: s.size, origin: 'sample', sample: s.sample, canned_id: s.canned_id })
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Preview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  if (!url) return null
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio src={url} controls className="h-9 w-full" />
}

/** A real MediaRecorder; the transcript that follows is canned. */
function Recorder({
  disabled,
  onRecorded,
  onError,
}: {
  disabled?: boolean
  onRecorded: (blob: Blob, ext: string) => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation('voiceTools')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])

  useEffect(
    () => () => {
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
      release()
    },
    [release],
  )

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 200)
    return () => window.clearInterval(id)
  }, [recording])

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return onError(t('source.micUnsupported'))
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      chunks.current = []
      const rec = new MediaRecorder(media)
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm'
        const blob = new Blob(chunks.current, { type })
        release()
        setRecording(false)
        if (blob.size > 0) onRecorded(blob, type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm')
        else onError(t('source.empty'))
      }
      recorder.current = rec
      setElapsed(0)
      rec.start()
      setRecording(true)
    } catch {
      release()
      onError(t('source.micDenied'))
    }
  }

  if (recording) {
    return (
      <Button size="sm" variant="danger" icon={<Square />} onClick={() => recorder.current?.stop()}>
        {t('source.stop', { time: formatClock(elapsed) })}
      </Button>
    )
  }
  return (
    <Button size="sm" variant="secondary" icon={<Mic />} onClick={() => void start()} disabled={disabled}>
      {t('source.record')}
    </Button>
  )
}
