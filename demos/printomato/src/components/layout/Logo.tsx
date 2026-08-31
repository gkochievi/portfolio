import { bootstrap } from '@/lib/bootstrap'
import { cn } from '@/lib/cn'

/** The gold star from the Printomato wordmark, redrawn as a scalable glyph. */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('size-5', className)} aria-hidden>
      <path
        d="M13.9 1.4 12.6 7.2l5.3-1.5-4.1 3.7 4.6 2.3-5.6.2 1.7 5.3-3.6-4.2-3.2 4.4 1-5.5-5.4.5 4.9-2.9L4 6.1l5.4 1.9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * The wordmark ships as a raster asset in Django's static tree — it is the
 * real brand file, not a redrawn approximation.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <img
      src={bootstrap.logoUrl}
      alt="Printomato"
      className={cn('h-[22px] w-auto select-none sm:h-[26px]', className)}
      draggable={false}
    />
  )
}

export function LogoLockup({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Wordmark />
      {!compact && (
        <span className="hidden items-center gap-2 border-l border-hairline pl-2.5 lg:flex">
          <span className="label-caps text-gold/70">Console</span>
        </span>
      )}
    </span>
  )
}
