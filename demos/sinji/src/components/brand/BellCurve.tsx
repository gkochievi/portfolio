import { cn } from '@/lib/cn'

/**
 * Two-tone line illustration (empty states, hero): the bell curve on a ruled
 * baseline with a measuring rim of fine ticks and a single bronze bead.
 */
export function BellCurve({ className, ticks = 21, bead = 0.5 }: { className?: string; ticks?: number; bead?: number }) {
  const x0 = 12
  const x1 = 188
  const base = 70
  const step = (x1 - x0) / (ticks - 1)
  const beadX = x0 + (x1 - x0) * Math.max(0, Math.min(1, bead))
  return (
    <svg viewBox="0 0 200 96" fill="none" aria-hidden className={cn('h-auto', className)}>
      <path d={`M${x0} ${base} C62 ${base} 70 14 100 14 C130 14 138 ${base} ${x1} ${base} Z`} fill="var(--color-primary)" fillOpacity="0.07" />
      <path d={`M${x0} ${base} C62 ${base} 70 14 100 14 C130 14 138 ${base} ${x1} ${base}`} stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
      <line x1={x0 - 6} y1={base} x2={x1 + 6} y2={base} stroke="var(--color-primary)" strokeWidth="1.25" strokeLinecap="round" />
      {Array.from({ length: ticks }, (_, i) => {
        const x = x0 + i * step
        const major = i % 5 === 0
        return (
          <line
            key={i}
            x1={x}
            y1={base + 4}
            x2={x}
            y2={base + (major ? 11 : 8)}
            stroke={Math.abs(x - beadX) < step / 2 ? 'var(--color-accent)' : 'var(--color-ink)'}
            strokeOpacity={Math.abs(x - beadX) < step / 2 ? 1 : 0.35}
            strokeWidth="1"
            strokeLinecap="round"
          />
        )
      })}
      <circle cx={beadX} cy={base + 18} r="3.5" fill="var(--color-accent)" />
    </svg>
  )
}
