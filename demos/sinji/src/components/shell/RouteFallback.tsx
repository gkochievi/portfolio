import { Skeleton, SkeletonText } from '@/components/ui'

/** Suspense fallback while a lazy page loads: a quiet page-shaped skeleton. */
export function RouteFallback() {
  return (
    <div aria-busy="true" className="animate-fade-in">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <SkeletonText lines={5} className="mt-8" />
    </div>
  )
}
