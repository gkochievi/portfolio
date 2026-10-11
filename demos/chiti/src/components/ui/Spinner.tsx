import { cn } from '@/lib/cn'

/** Small ring spinner (inherits currentColor). */
export function Spinner({ size = 16, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} aria-label={label} className={cn('inline-flex', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin-slow" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  )
}

/** Full-area loading state (centered spinner + optional label). */
export function LoadingBlock({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex min-h-40 flex-col items-center justify-center gap-2 text-muted', className)}>
      <Spinner size={22} />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  )
}
