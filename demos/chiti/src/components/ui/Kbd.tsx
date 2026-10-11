import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-sunken px-1 font-mono text-[11px] text-muted', className)}>
      {children}
    </kbd>
  )
}

/** 1px warm hairline. */
export function Divider({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" aria-orientation={vertical ? 'vertical' : 'horizontal'} className={cn(vertical ? 'w-px self-stretch bg-line' : 'h-px w-full bg-line', className)} />
}
