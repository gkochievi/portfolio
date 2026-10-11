import { cn } from '@/lib/cn'

/** Static (non-shimmering) placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-md bg-sunken', className)} />
}

/** A few lines of text placeholder. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 rounded bg-sunken" style={{ width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

/** List-row placeholder: avatar + two lines (inbox rows, tables). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex items-center gap-3 py-2', className)}>
      <div className="size-9 shrink-0 rounded-full bg-sunken" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3 w-2/5 rounded bg-sunken" />
        <div className="h-3 w-4/5 rounded bg-sunken" />
      </div>
    </div>
  )
}
