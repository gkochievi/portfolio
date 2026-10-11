/**
 * Decorative snowfall: sparse six-spoke flakes, small circles and rounded
 * squares drifting down, plus (optionally) one persimmon disc. Positions are
 * deterministic. Under prefers-reduced-motion they hold still. Place inside a
 * `relative` parent; it fills it and ignores the pointer.
 */
import type { CSSProperties } from 'react'

import { cn } from '@/lib/cn'

export function FlakeGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden fill="none">
      <g stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
        <path d="M12 3v18" />
        <path d="M4.2 7.5l15.6 9" />
        <path d="M19.8 7.5l-15.6 9" />
      </g>
    </svg>
  )
}

function rand(i: number, n: number): number {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
  return x - Math.floor(x)
}

export interface FlakesProps {
  count?: number
  /** Add the single persimmon disc. Default true. */
  persimmon?: boolean
  /** light = white flakes for a primary ground. */
  tone?: 'default' | 'light'
  /** Speed multiplier. */
  speed?: number
  className?: string
}

export function Flakes({ count = 6, persimmon = true, tone = 'default', speed = 1, className }: FlakesProps) {
  const items = Array.from({ length: count }, (_, i) => {
    const duration = (9 + rand(i, 3) * 8) / speed
    return {
      i,
      left: 4 + rand(i, 1) * 90,
      size: 9 + Math.round(rand(i, 2) * 9),
      duration,
      delay: -rand(i, 4) * duration,
      drift: Math.round((rand(i, 5) - 0.5) * 40),
      rest: 8 + rand(i, 6) * 70,
      kind: i % 3,
      ink: i % 4 === 1,
      opacity: 0.35 + rand(i, 7) * 0.35,
    }
  })
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {items.map((f) => {
        const style = {
          left: `${f.left}%`,
          opacity: f.opacity,
          '--flake-duration': `${f.duration.toFixed(2)}s`,
          '--flake-delay': `${f.delay.toFixed(2)}s`,
          '--flake-drift': `${f.drift}px`,
          '--flake-rest': `${f.rest.toFixed(1)}%`,
        } as CSSProperties
        const color = tone === 'light' ? 'text-on-primary' : f.ink ? 'text-ink' : 'text-primary'
        return (
          <span key={f.i} className={cn('tova-flake', color)} style={style}>
            {f.kind === 0 ? (
              <FlakeGlyph size={f.size + 4} />
            ) : f.kind === 1 ? (
              <span className="block rounded-full bg-current" style={{ width: f.size * 0.55, height: f.size * 0.55 }} />
            ) : (
              <span className="block rounded-[3px] bg-current" style={{ width: f.size * 0.6, height: f.size * 0.6 }} />
            )}
          </span>
        )
      })}
      {persimmon && (
        <span
          className="tova-flake"
          style={
            {
              left: '62%',
              '--flake-duration': `${(12 / speed).toFixed(2)}s`,
              '--flake-delay': '-4s',
              '--flake-drift': '-10px',
              '--flake-rest': '46%',
            } as CSSProperties
          }
        >
          <span className="block size-3.5 rounded-full bg-accent" />
        </span>
      )}
    </div>
  )
}
