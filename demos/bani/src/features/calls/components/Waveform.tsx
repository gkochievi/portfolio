import { useRef } from 'react'

import { cn } from '@/lib/cn'
import { miniPeaks } from '../lib/recordings'

/** Rounded bars from precomputed peaks: played part bronze, unplayed muted, 2px brass playhead. */
export function Waveform({
  peaks,
  progress,
  onSeek,
  height = 56,
  label,
  valueText,
  duration,
}: {
  peaks: number[]
  progress: number
  onSeek: (ratio: number) => void
  height?: number
  label: string
  valueText: string
  duration: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const seekFrom = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width))))
  }
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(progress * duration)}
      aria-valuetext={valueText}
      className="relative flex w-full cursor-pointer touch-none select-none items-center gap-[2px] rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      style={{ height }}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFrom(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && seekFrom(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = 5 / Math.max(1, duration)
        if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + step))
        else if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - step))
        else if (e.key === 'Home') onSeek(0)
        else if (e.key === 'End') onSeek(1)
        else return
        e.preventDefault()
      }}
    >
      {peaks.map((p, i) => {
        const played = (i + 0.5) / peaks.length <= progress
        return (
          <span
            key={i}
            className={cn('flex-1 rounded-full transition-colors duration-100', played ? 'bg-primary' : 'bg-muted/35')}
            style={{ height: `${Math.max(8, Math.round(p * 100))}%` }}
          />
        )
      })}
      <span className="pointer-events-none absolute inset-y-0 w-[2px] rounded-full bg-brass" style={{ left: `calc(${progress * 100}% - 1px)` }} />
    </div>
  )
}

/** The tiny static waveform shown in a table row. */
export function MiniWave({ peaks, className }: { peaks: number[]; className?: string }) {
  return (
    <span aria-hidden className={cn('flex h-[18px] items-center gap-[1.5px]', className)}>
      {miniPeaks(peaks, 14).map((p, i) => (
        <span key={i} className="w-[2px] rounded-full bg-muted/50" style={{ height: `${Math.max(14, Math.round(p * 100))}%` }} />
      ))}
    </span>
  )
}
