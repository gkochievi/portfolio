/**
 * Flat two-colour illustrations (mulberry + mint on warm mist): bubble
 * squares with one sharp corner, ascending signal bars, small mint sparks.
 * No people, no photos. Owner: design-system agent.
 */
import { cn } from '@/lib/utils'

export type IllustrationKind = 'thanks' | 'already' | 'expired' | 'invalid' | 'not-found' | 'empty' | 'inbox' | 'error' | 'locked'

export interface IllustrationProps {
  kind: IllustrationKind
  /** Width in px (height follows the 4:3 artboard). */
  size?: number
  /** Play the entrance motion (bars rise, spark pops). */
  animated?: boolean
  className?: string
}

const A = 'fill-[var(--ill-a)]'
const B = 'fill-[var(--ill-b)]'
const P = 'fill-[var(--ill-paper)]'

/** Bubble path at (x, y) with size s (sharp bottom-left). */
function bubble(x: number, y: number, s: number): string {
  const r = s / 4
  return `M${x + r} ${y}H${x + s - r}A${r} ${r} 0 0 1 ${x + s} ${y + r}V${y + s - r}A${r} ${r} 0 0 1 ${x + s - r} ${y + s}H${x}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}

function Bars({ x, y, s, filled = 5, animated, className = B }: { x: number; y: number; s: number; filled?: number; animated?: boolean; className?: string }) {
  const k = s / 48
  return (
    <>
      {[8, 13, 18, 23, 28].map((h, i) => (
        <rect
          key={i}
          x={x + (10 + i * 6.5) * k}
          y={y + (38 - h) * k}
          width={4.5 * k}
          height={h * k}
          rx={2.25 * k}
          className={cn(i < filled ? className : 'fill-[var(--ill-paper)]', animated && 'origin-bars animate-rise')}
          style={animated ? { animationDelay: `${120 + i * 60}ms` } : undefined}
        />
      ))}
    </>
  )
}

function Spark({ cx, cy, r, animated, delay = 520 }: { cx: number; cy: number; r: number; animated?: boolean; delay?: number }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      className={cn(B, animated && 'origin-center animate-pop [transform-box:fill-box]')}
      style={animated ? { animationDelay: `${delay}ms` } : undefined}
    />
  )
}

export function Illustration({ kind, size = 200, animated = false, className }: IllustrationProps) {
  return (
    <svg width={size} height={(size * 3) / 4} viewBox="0 0 160 120" aria-hidden="true" className={cn('shrink-0', className)}>
      {/* ground shadow bubble */}
      <path d={bubble(28, 22, 84)} className={P} transform="translate(14 8)" />
      {kind === 'thanks' && (
        <>
          <path d={bubble(28, 22, 84)} className={A} />
          <Bars x={28} y={22} s={84} animated={animated} />
          <Spark cx={124} cy={20} r={7} animated={animated} delay={460} />
          <Spark cx={138} cy={38} r={3.5} animated={animated} delay={560} />
        </>
      )}
      {kind === 'already' && (
        <>
          <path d={bubble(28, 22, 84)} className={A} />
          <Bars x={28} y={22} s={84} />
          <circle cx={118} cy={28} r={16} className={B} />
          <path d="M110.5 28.5l5 5 9.5-10" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-[var(--ill-a)]" />
        </>
      )}
      {kind === 'expired' && (
        <>
          <path d={bubble(28, 22, 84)} className={A} />
          <Bars x={28} y={22} s={84} filled={2} />
          <circle cx={118} cy={30} r={18} className={B} />
          <path d="M118 20v10.5l7 4.5" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-[var(--ill-a)]" />
        </>
      )}
      {(kind === 'invalid' || kind === 'error') && (
        <>
          <path d={bubble(28, 22, 84)} className={A} />
          <path d="M50 64h18M92 64h18" strokeWidth="7" strokeLinecap="round" className="stroke-[var(--ill-b)]" />
          <path d="M74 54l12 20" strokeWidth="5" strokeLinecap="round" className="stroke-[var(--ill-b)]" />
          <Spark cx={126} cy={24} r={6} animated={animated} />
        </>
      )}
      {kind === 'not-found' && (
        <>
          <path d={bubble(20, 34, 56)} className={B} />
          <path d={bubble(66, 18, 74)} className={A} />
          <circle cx={88} cy={56} r={5} className={B} />
          <circle cx={103} cy={56} r={5} className={B} />
          <circle cx={118} cy={56} r={5} className={B} />
        </>
      )}
      {kind === 'empty' && (
        <>
          <path d={bubble(28, 22, 84)} className={P} />
          <path d={bubble(44, 34, 60)} className="fill-none stroke-[var(--ill-a)]" strokeWidth="3" strokeDasharray="6 7" />
          <Spark cx={110} cy={30} r={6} animated={animated} />
        </>
      )}
      {kind === 'inbox' && (
        <>
          <path d={bubble(22, 30, 70)} className={A} />
          <path d="M36 54h40M36 68h28" strokeWidth="6" strokeLinecap="round" className="stroke-[var(--ill-b)]" />
          <path d={bubble(86, 52, 46)} className={B} />
          <Bars x={86} y={52} s={46} className="fill-[var(--ill-a)]" />
        </>
      )}
      {kind === 'locked' && (
        <>
          <path d={bubble(28, 22, 84)} className={A} />
          <rect x={56} y={58} width={28} height={24} rx={6} className={B} />
          <path d="M62 58v-6a8 8 0 0 1 16 0v6" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-[var(--ill-b)]" />
        </>
      )}
    </svg>
  )
}
