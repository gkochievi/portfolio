import { Download, Pause, Play, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, IconButton } from '@/components/ui'
import { formatClock } from '@/lib/format'

export interface PlayerSource {
  /** Changes whenever a new clip is loaded (restarts playback). */
  id: string
  url: string
  title: string
  subtitle?: string
  downloadName?: string
  autoplay?: boolean
  duration?: number
}

/** The one shared player of the TTS tab: previews and synthesized clips both play here. */
export function AudioPlayer({ source }: { source: PlayerSource | null }) {
  const { t } = useTranslation('voiceTools')
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setPlaying(false)
    setTime(0)
    setFailed(false)
    setDuration(source?.duration ?? 0)
    const el = ref.current
    if (!el || !source) return
    el.load()
    if (source.autoplay) void el.play().catch(() => setPlaying(false))
  }, [source?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!source) {
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-card border border-dashed border-line-strong bg-sunken px-4 py-5 text-center text-sm text-muted">
        {t('player.empty')}
      </div>
    )
  }

  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setFailed(true))
    else el.pause()
  }

  return (
    <div className="rounded-card border border-line bg-panel p-3 sm:p-4" role="group" aria-label={t('player.label')}>
      <audio
        ref={ref}
        src={source.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setTime(0)
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      <div className="flex items-center gap-3">
        <IconButton
          label={playing ? t('player.pause') : t('player.play')}
          icon={playing ? <Pause /> : <Play />}
          variant="secondary"
          onClick={toggle}
          disabled={failed}
          className="shrink-0 rounded-pill"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{source.title}</p>
          {source.subtitle ? <p className="truncate text-xs text-muted">{source.subtitle}</p> : null}
        </div>
        <span className="tabular shrink-0 font-mono text-xs text-muted" aria-live="off">
          {formatClock(time)} / {formatClock(duration)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.05}
        value={Math.min(time, duration || 0)}
        disabled={failed || !duration}
        onChange={(e) => {
          const next = Number(e.target.value)
          setTime(next)
          if (ref.current) ref.current.currentTime = next
        }}
        aria-label={t('player.seek')}
        className="mt-3 h-1.5 w-full cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed"
      />
      {failed ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warning" role="status">
          <VolumeX className="size-3.5" aria-hidden /> {t('player.missing')}
        </p>
      ) : null}
      {source.downloadName ? (
        <div className="mt-3 flex justify-end">
          <Button asChild size="sm" variant="secondary" disabled={failed}>
            <a href={source.url} download={source.downloadName}>
              <Download aria-hidden />
              {t('player.download')}
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  )
}
