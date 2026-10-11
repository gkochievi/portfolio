import { Download, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CopyButton, SegmentedControl, StatusChip, Tooltip } from '@/components/ui'
import { fmtBytes, fmtDuration } from '@/lib/format'
import type { RecordingResult } from '@/types'
import { useCallLabels } from './useCallLabels'
import { Waveform } from './Waveform'

const mediaUrl = (streamUrl: string): string => `${import.meta.env.BASE_URL}${streamUrl}`

export function RecordingPlayer({ recordings }: { recordings: RecordingResult[] }) {
  const { t } = useCallLabels()
  const [index, setIndex] = useState(0)
  const rec = recordings[Math.min(index, recordings.length - 1)]!
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(rec.durationSec)
  const [failed, setFailed] = useState(false)

  // A different copy: stop and rewind.
  useEffect(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      a.currentTime = 0
    }
    setPlaying(false)
    setCurrent(0)
    setFailed(false)
    setDuration(rec.durationSec)
  }, [rec.id, rec.durationSec])

  useEffect(() => () => audioRef.current?.pause(), [])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play().catch(() => setFailed(true))
    else a.pause()
  }
  const seek = (ratio: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = ratio * duration
    setCurrent(a.currentTime)
  }
  const progress = duration > 0 ? Math.min(1, current / duration) : 0
  const fileName = rec.path.split('/').pop() ?? 'recording.wav'

  return (
    <div className="space-y-3">
      {recordings.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-[12px] text-muted">{t('recording.copies', { count: recordings.length })}</div>
          <SegmentedControl
            size="sm"
            aria-label={t('recording.chooseCopy')}
            value={String(Math.min(index, recordings.length - 1))}
            onChange={(v) => setIndex(Number(v))}
            options={recordings.map((r, i) => ({ value: String(i), label: t(`recording.sources.${r.source}`) }))}
          />
        </div>
      )}

      <div className="rounded-[10px] border border-line bg-sunken/60 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium">{t(`recording.sources.${rec.source}`)}</span>
          {rec.confidence === 'fuzzy' && (
            <Tooltip content={t('recording.fuzzyHint')}>
              <span tabIndex={0}>
                <StatusChip tone="warning" size="sm">
                  {t('recording.fuzzy')}
                </StatusChip>
              </span>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? t('recording.pause') : t('recording.play')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
          </button>
          <div className="min-w-0 flex-1">
            <Waveform
              peaks={rec.peaks}
              progress={progress}
              onSeek={seek}
              label={t('recording.seek')}
              valueText={`${fmtDuration(Math.round(current))} / ${fmtDuration(Math.round(duration))}`}
              duration={duration}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px]">
          <span className="font-mono tabular text-ink">
            {fmtDuration(Math.round(current))} <span className="text-muted">/ {fmtDuration(Math.round(duration))}</span>
          </span>
          <span className="flex items-center gap-2 text-muted">
            <span className="rounded border border-line px-1.5 py-px font-mono text-[11px] uppercase text-ink">{rec.format}</span>
            <span className="font-mono tabular">{fmtBytes(rec.fileSizeBytes)}</span>
            <a
              href={mediaUrl(rec.streamUrl)}
              download={fileName}
              aria-label={t('recording.download')}
              title={t('recording.download')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
            >
              <Download size={17} strokeWidth={1.75} />
            </a>
          </span>
        </div>
        {failed && <p className="mt-2 text-[12.5px] text-danger">{t('recording.playbackFailed')}</p>}
        <audio
          ref={audioRef}
          src={mediaUrl(rec.streamUrl)}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setCurrent(0)
          }}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
          onError={() => setFailed(true)}
        />
      </div>

      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 break-all font-mono text-[11.5px] leading-snug text-muted">
          <span className="font-sans">{t('recording.path')}: </span>
          {rec.path}
        </p>
        <CopyButton value={rec.path} />
      </div>
    </div>
  )
}
