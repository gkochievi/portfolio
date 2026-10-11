import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '@/lib/cn'

export type RibbonSentiment = 'negative' | 'neutral' | 'positive'

export interface RibbonPart {
  /** Seconds. */
  start: number
  end: number
  sentiment: RibbonSentiment
}

const ribbonColor: Record<RibbonSentiment, string> = {
  negative: 'var(--color-ribbon-neg)',
  neutral: 'var(--color-ribbon-neu)',
  positive: 'var(--color-ribbon-pos)',
}

/**
 * Waveform of 2px bars (muted unplayed, primary played) with an optional 4px
 * sentiment ribbon underneath. Click / drag / arrow keys seek.
 */
export function Waveform({
  peaks,
  duration,
  currentTime = 0,
  onSeek,
  ribbon,
  height = 56,
  className,
  label = 'Audio position',
}: {
  /** 0..1 amplitudes (any length; resampled to the width). */
  peaks: readonly number[]
  /** Seconds. */
  duration: number
  /** Seconds. */
  currentTime?: number
  /** Called with a time in seconds. */
  onSeek?: (seconds: number) => void
  ribbon?: readonly RibbonPart[]
  height?: number
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(Math.floor(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const bars = useMemo(() => {
    const count = Math.max(8, Math.floor(width / 3))
    if (peaks.length === 0) return Array.from({ length: count }, () => 0.06)
    return Array.from({ length: count }, (_, i) => {
      const a = Math.floor((i / count) * peaks.length)
      const b = Math.max(a + 1, Math.floor(((i + 1) / count) * peaks.length))
      let m = 0
      for (let j = a; j < b && j < peaks.length; j++) m = Math.max(m, peaks[j] ?? 0)
      return Math.max(0.06, Math.min(1, m))
    })
  }, [peaks, width])

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0
  const playedBars = Math.round(progress * bars.length)
  const dragging = useRef(false)

  const seekAt = (clientX: number) => {
    const el = ref.current
    if (!el || !onSeek || duration <= 0) return
    const rect = el.getBoundingClientRect()
    const r = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(r * duration)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekAt(e.clientX)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return
    if (e.key === 'ArrowRight') onSeek(Math.min(duration, currentTime + 5))
    else if (e.key === 'ArrowLeft') onSeek(Math.max(0, currentTime - 5))
    else if (e.key === 'Home') onSeek(0)
    else if (e.key === 'End') onSeek(duration)
    else return
    e.preventDefault()
  }

  return (
    <div className={cn('w-full select-none', className)}>
      <div
        ref={ref}
        role={onSeek ? 'slider' : 'img'}
        aria-label={label}
        aria-valuemin={onSeek ? 0 : undefined}
        aria-valuemax={onSeek ? Math.round(duration) : undefined}
        aria-valuenow={onSeek ? Math.round(currentTime) : undefined}
        tabIndex={onSeek ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => dragging.current && seekAt(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={onKey}
        className={cn('relative flex items-center gap-px rounded-sm', onSeek && 'cursor-pointer')}
        style={{ height }}
      >
        {bars.map((v, i) => (
          <span
            key={i}
            className={cn('w-[2px] shrink-0 rounded-full', i < playedBars ? 'bg-primary' : 'bg-muted/35')}
            style={{ height: `${Math.round(v * 100)}%` }}
          />
        ))}
        {onSeek ? (
          <span className="pointer-events-none absolute inset-y-0 w-px bg-accent" style={{ left: `${progress * 100}%` }} />
        ) : null}
      </div>
      {ribbon && ribbon.length > 0 && duration > 0 ? (
        <div className="relative mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: ribbonColor.neutral }} aria-hidden>
          {ribbon.map((part, i) => (
            <span
              key={i}
              className="absolute inset-y-0"
              style={{
                left: `${(part.start / duration) * 100}%`,
                width: `${Math.max(0.2, ((part.end - part.start) / duration) * 100)}%`,
                background: ribbonColor[part.sentiment],
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
