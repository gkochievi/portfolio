import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { useTheme } from '@/components/shell/theme'
import { layerEnd, layerLength, projectDuration, type Layer } from './dsp'

const LANE_H = 92
const RULER_H = 24
const STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]

export interface Selection {
  a: number
  b: number
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function stamp(t: number, step: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return step < 1 ? `${m}:${s.toFixed(step < 0.1 ? 2 : 1).padStart(step < 0.1 ? 5 : 4, '0')}` : `${m}:${String(Math.floor(s)).padStart(2, '0')}`
}

/** Scrollable multi-lane waveform: click seeks, drag selects, the ruler adapts to the zoom. */
export function EditorCanvas({
  layers,
  activeId,
  pps,
  playhead,
  selection,
  following,
  label,
  onSeek,
  onSelect,
  onPickLayer,
  onViewWidth,
}: {
  layers: Layer[]
  activeId: string | null
  pps: number
  playhead: number
  selection: Selection | null
  following: boolean
  label: string
  onSeek: (t: number) => void
  onSelect: (selection: Selection | null) => void
  onPickLayer: (id: string) => void
  onViewWidth: (width: number) => void
}) {
  const { theme } = useTheme()
  const scroller = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [viewW, setViewW] = useState(800)
  const [scrollLeft, setScrollLeft] = useState(0)
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null)

  const duration = projectDuration(layers)
  const lanes = Math.max(1, layers.length)
  const height = RULER_H + lanes * LANE_H
  const contentW = Math.max(viewW, Math.ceil(duration * pps) + 48)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      setViewW(el.clientWidth)
      onViewWidth(el.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onViewWidth])

  useEffect(() => {
    const el = scroller.current
    if (!el || !following) return
    const x = playhead * pps
    if (x > el.scrollLeft + el.clientWidth - 48 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 48)
  }, [playhead, pps, following])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    el.width = Math.floor(viewW * dpr)
    el.height = Math.floor(height * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const ink = cssVar('--color-ink', theme === 'dark' ? '#ece6d8' : '#2a2620')
    const muted = cssVar('--color-muted', '#7d756a')
    const line = cssVar('--color-line', 'rgba(128,120,108,0.3)')
    const panel = cssVar('--color-panel', theme === 'dark' ? '#1a1815' : '#fffdf8')
    const sunken = cssVar('--color-sunken', theme === 'dark' ? '#14120f' : '#f3eee3')
    const primary = cssVar('--color-primary', '#2f6f62')
    const accent = cssVar('--color-accent', '#a8743a')

    ctx.fillStyle = panel
    ctx.fillRect(0, 0, viewW, height)

    // Ruler.
    const step = STEPS.find((s) => s * pps >= 84) ?? 600
    ctx.fillStyle = sunken
    ctx.fillRect(0, 0, viewW, RULER_H)
    ctx.strokeStyle = line
    ctx.beginPath()
    ctx.moveTo(0, RULER_H - 0.5)
    ctx.lineTo(viewW, RULER_H - 0.5)
    ctx.stroke()
    ctx.fillStyle = muted
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textBaseline = 'middle'
    const first = Math.floor(scrollLeft / pps / step) * step
    for (let t = first; t * pps - scrollLeft < viewW + 60; t += step) {
      const x = Math.round(t * pps - scrollLeft) + 0.5
      ctx.fillRect(x, RULER_H - 7, 1, 7)
      ctx.fillText(stamp(t, step), x + 4, RULER_H / 2 - 1)
    }

    // Lanes.
    layers.forEach((layer, index) => {
      const top = RULER_H + index * LANE_H
      const mid = top + LANE_H / 2
      const active = layer.id === activeId
      const audible = !layer.muted && (!layers.some((l) => l.solo) || layer.solo)
      ctx.fillStyle = active ? sunken : panel
      ctx.fillRect(0, top, viewW, LANE_H)
      ctx.strokeStyle = line
      ctx.beginPath()
      ctx.moveTo(0, top + LANE_H - 0.5)
      ctx.lineTo(viewW, top + LANE_H - 0.5)
      ctx.stroke()
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      ctx.moveTo(0, mid + 0.5)
      ctx.lineTo(viewW, mid + 0.5)
      ctx.stroke()
      ctx.globalAlpha = 1

      const length = layerLength(layer)
      if (!length) return
      const x0 = layer.offset * pps - scrollLeft
      const x1 = layerEnd(layer) * pps - scrollLeft
      // Clip body.
      ctx.fillStyle = active ? primary : muted
      ctx.globalAlpha = audible ? 0.08 : 0.04
      ctx.fillRect(Math.max(0, x0), top + 3, Math.max(0, Math.min(viewW, x1) - Math.max(0, x0)), LANE_H - 6)
      ctx.globalAlpha = audible ? 1 : 0.4
      ctx.strokeStyle = active ? primary : muted
      ctx.lineWidth = 1
      const amp = (LANE_H - 14) / 2
      const g = Math.pow(10, layer.gain / 20)
      const from = Math.max(0, Math.floor(x0))
      const to = Math.min(viewW, Math.ceil(x1))
      ctx.beginPath()
      for (let x = from; x < to; x += 1) {
        const s0 = Math.max(0, Math.floor(((x + scrollLeft) / pps - layer.offset) * layer.sampleRate))
        const s1 = Math.min(length, Math.max(s0 + 1, Math.floor(((x + 1 + scrollLeft) / pps - layer.offset) * layer.sampleRate)))
        const stride = Math.max(1, Math.floor((s1 - s0) / 40))
        let lo = 0
        let hi = 0
        for (const ch of layer.channels) {
          for (let i = s0; i < s1; i += stride) {
            const v = ch[i] as number
            if (v < lo) lo = v
            if (v > hi) hi = v
          }
        }
        const y0 = mid - Math.min(1, hi * g) * amp
        const y1 = mid - Math.max(-1, lo * g) * amp
        ctx.moveTo(x + 0.5, y0)
        ctx.lineTo(x + 0.5, Math.max(y1, y0 + 1))
      }
      ctx.stroke()
      ctx.globalAlpha = 1
      // Name tag.
      ctx.fillStyle = active ? primary : muted
      ctx.font = '11px system-ui, sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(layer.name, Math.max(6, x0 + 6), top + 5)
    })

    // Selection.
    if (selection) {
      const xa = selection.a * pps - scrollLeft
      const xb = selection.b * pps - scrollLeft
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.2
      ctx.fillRect(xa, RULER_H, xb - xa, height - RULER_H)
      ctx.globalAlpha = 0.9
      ctx.fillRect(xa, RULER_H, 1.5, height - RULER_H)
      ctx.fillRect(xb - 1.5, RULER_H, 1.5, height - RULER_H)
      ctx.globalAlpha = 1
    }

    // Playhead.
    const px = playhead * pps - scrollLeft
    if (px >= -2 && px <= viewW + 2) {
      ctx.fillStyle = ink
      ctx.fillRect(Math.round(px) - 0.5, 0, 1.5, height)
      ctx.beginPath()
      ctx.moveTo(px - 5, 0)
      ctx.lineTo(px + 5, 0)
      ctx.lineTo(px, 8)
      ctx.closePath()
      ctx.fill()
    }
  }, [layers, activeId, pps, scrollLeft, viewW, height, playhead, selection, theme])

  const timeAt = (event: PointerEvent): number => {
    const rect = canvas.current?.getBoundingClientRect()
    const x = event.clientX - (rect?.left ?? 0) + scrollLeft
    return Math.max(0, Math.min(duration, x / pps))
  }

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!layers.length) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, t: timeAt(event), moved: false }
    const rect = event.currentTarget.getBoundingClientRect()
    const lane = Math.floor((event.clientY - rect.top - RULER_H) / LANE_H)
    const layer = layers[lane]
    if (layer) onPickLayer(layer.id)
  }
  const onMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(event.clientX - d.x) < 4) return
    d.moved = true
    const t = timeAt(event)
    onSelect({ a: Math.min(d.t, t), b: Math.max(d.t, t) })
  }
  const onUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) {
      onSeek(d.t)
      onSelect(null)
    } else if (d) {
      const t = timeAt(event)
      onSeek(Math.min(d.t, t))
    }
  }
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? 1 : 0.1
    if (event.key === 'ArrowRight') onSeek(Math.min(duration, playhead + delta))
    else if (event.key === 'ArrowLeft') onSeek(Math.max(0, playhead - delta))
    else if (event.key === 'Home') onSeek(0)
    else if (event.key === 'End') onSeek(duration)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
      onKeyDown={onKey}
      tabIndex={0}
      role="application"
      aria-label={label}
      className="scrollbar-thin relative overflow-x-auto overflow-y-hidden rounded-card border border-line bg-panel outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{ height: height + 14 }}
    >
      <div style={{ width: contentW, height }}>
        <canvas
          ref={canvas}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="sticky left-0 top-0 block cursor-crosshair touch-pan-y"
          style={{ width: viewW, height }}
        />
      </div>
    </div>
  )
}
