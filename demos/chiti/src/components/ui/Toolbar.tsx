import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** Horizontal filter/action bar: left children wrap, `right` stays at the end. */
export function Toolbar({ children, right, className }: { children?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  )
}
/** Alias used by feature agents. */
export const FilterBar = Toolbar

export interface FilterChipProps {
  active?: boolean
  onClick?: () => void
  count?: number
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/** Toggleable pill filter (status / channel filters). */
export function FilterChip({ active, onClick, count, icon, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:size-4',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-panel text-muted hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      {icon}
      {children}
      {count !== undefined ? <span className="tabular text-xs opacity-80">{count}</span> : null}
    </button>
  )
}
