/**
 * The "now serving" motif: a row of graphite squares, the leading one in the
 * signal colour and stepped up. Used by empty states, 404/403 and the login
 * panel. Owner: design-system.
 */
import { cn } from '@/lib/cn'

export interface QueueMotifProps {
  /** Squares in the queue (the last one is the signal). Default 5. */
  count?: number
  /** Square size in px. Default 14. */
  size?: number
  /** Animate the leading square stepping up once on mount. */
  animate?: boolean
  /** Show a ticket stub after the queue. */
  withTicket?: boolean
  className?: string
}

export function QueueMotif({ count = 5, size = 14, animate = true, withTicket = false, className }: QueueMotifProps) {
  const gap = Math.round(size * 0.45)
  const squares = Array.from({ length: count })
  return (
    <div className={cn('inline-flex items-end', className)} style={{ gap }} aria-hidden>
      {squares.map((_, i) => {
        const lead = i === count - 1
        return (
          <span
            key={i}
            className={cn(
              'block rounded-[2px]',
              lead ? 'bg-signal' : 'bg-ink',
              lead && animate && 'motion-safe:animate-[rise_480ms_cubic-bezier(0.2,0,0,1)_both]',
            )}
            style={{
              width: lead ? size * 1.5 : size,
              height: lead ? size * 1.5 : size,
              opacity: lead ? 1 : 0.18 + (0.62 * (i + 1)) / count,
              marginBottom: lead ? size * 0.7 : 0,
            }}
          />
        )
      })}
      {withTicket ? (
        <span
          className="ticket ml-2 block rounded-[3px] border border-hairline-strong bg-panel"
          style={{ width: size * 2.4, height: size * 1.6 }}
        >
          <span className="mt-[30%] block h-px w-full border-t border-dashed border-hairline-strong" />
          <span className="mx-auto mt-[12%] block w-1/3 rounded-[1px] bg-accent" style={{ height: Math.max(2, size * 0.18) }} />
        </span>
      ) : null}
    </div>
  )
}
