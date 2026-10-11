/** Suspense fallback for lazy pages. */
import { Skeleton } from '@/components/ui'

export function PageFallback() {
  return (
    <div className="animate-[dk-fade-in_300ms_ease-out_150ms_both]" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-card" />
    </div>
  )
}
