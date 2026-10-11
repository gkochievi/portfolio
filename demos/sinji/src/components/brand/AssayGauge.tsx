import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { scoreTone } from './ScorePill'

function useCountUp(target: number, ms = 400, run = true): number {
  const [value, setValue] = useState(run ? 0 : target)
  useEffect(() => {
    if (!run || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, run])
  return value
}

/**
 * The assay-rim gauge: a 180-degree arc of 21 fine ticks. Filled ticks are
 * verdigris, the score position carries a bronze bead, and the score sits in
 * the centre (Newsreader, tabular). Ticks fill left to right on reveal.
 */
export function AssayGauge({
  value,
  max = 100,
  size = 200,
  label,
  sublabel,
  animate = true,
  className,
}: {
  /** null renders an empty rim with a dash. */
  value: number | null | undefined
  max?: number
  size?: number
  label?: ReactNode
  sublabel?: ReactNode
  animate?: boolean
  className?: string
}) {
  const ticks = 21
  const has = value != null && Number.isFinite(value)
  const ratio = has ? Math.max(0, Math.min(1, (value as number) / (max || 1))) : 0
  const shown = useCountUp(has ? (value as number) : 0, 400, animate && has)
  const filled = has ? Math.round(ratio * (ticks - 1)) : -1
  const tone = scoreTone(has ? (ratio * 100) : null)
  const cx = 100
  const cy = 100
  const rOuter = 88
  const rInner = 74
  const angleOf = (r: number) => Math.PI - r * Math.PI
  const bead = angleOf(ratio)
  const beadR = rOuter + 7
  return (
    <div className={cn('relative inline-block', className)} style={{ width: size }}>
      <svg viewBox="0 0 200 116" width={size} height={size * 0.58} aria-hidden fill="none">
        <path d={`M ${cx - rOuter - 6} ${cy} A ${rOuter + 6} ${rOuter + 6} 0 0 1 ${cx + rOuter + 6} ${cy}`} stroke="var(--color-line)" strokeWidth="1" />
        {Array.from({ length: ticks }, (_, i) => {
          const a = angleOf(i / (ticks - 1))
          const major = i % 5 === 0
          const r1 = major ? rInner - 4 : rInner
          const on = i <= filled
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * r1}
              y1={cy - Math.sin(a) * r1}
              x2={cx + Math.cos(a) * rOuter}
              y2={cy - Math.sin(a) * rOuter}
              stroke={on ? 'var(--color-primary)' : 'var(--color-ink)'}
              strokeOpacity={on ? 1 : 0.16}
              strokeWidth={major ? 2.25 : 1.75}
              strokeLinecap="round"
              style={animate && has ? { opacity: 0, animation: `fade-in 160ms ease-out ${i * 20}ms both` } : undefined}
            />
          )
        })}
        {has ? (
          <circle
            cx={cx + Math.cos(bead) * beadR}
            cy={cy - Math.sin(bead) * beadR}
            r="4.5"
            fill="var(--color-accent)"
            style={animate ? { animation: `bead-drop 220ms cubic-bezier(.2,.8,.2,1) ${ticks * 20}ms both` } : undefined}
          />
        ) : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span
          className={cn('tabular font-display font-semibold leading-none', has ? `text-${tone === 'muted' ? 'muted' : 'ink'}` : 'text-muted')}
          style={{ fontSize: size * 0.2 }}
        >
          {has ? Math.round(shown) : '-'}
        </span>
        {label ? <span className="mt-1 text-xs font-medium text-muted">{label}</span> : null}
        {sublabel ? <span className="text-[11px] text-subtle">{sublabel}</span> : null}
      </div>
    </div>
  )
}
