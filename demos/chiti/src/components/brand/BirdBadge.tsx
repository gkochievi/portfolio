import { cn } from '@/lib/cn'

/** Small yellow bird for AI-bot bubbles; `withLabel` adds the "AI" tag. `flying` plays the handover fly-off once. */
export function BirdBadge({ size = 18, withLabel, flying, className }: { size?: number; withLabel?: boolean; flying?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', flying && 'animate-fly-off', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <circle cx="11" cy="12" r="9" fill="#F2C12E" className="stroke-[#1E1B12] dark:stroke-transparent" strokeWidth={1.2} />
        <path d="M19 9.5 L23.5 12 L19 14.5 Z" fill="#1E1B12" className="dark:fill-[#F3EDDC]" />
        <circle cx="14" cy="9.5" r="1.4" fill="#1E1B12" />
        <rect x="6" y="13" width="8" height="2" rx="1" fill="#4E5C17" />
      </svg>
      {withLabel ? <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold leading-tight text-on-accent">AI</span> : null}
    </span>
  )
}
