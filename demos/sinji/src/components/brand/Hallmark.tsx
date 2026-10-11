import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The final-score cartouche: a clipped-corner rectangle with a 1px bronze
 * hairline and the value in Newsreader 600 with tabular numerals.
 */
export function Hallmark({
  value,
  label,
  suffix,
  size = 'md',
  className,
}: {
  value: ReactNode
  /** Small caption under the value ("Final score"). */
  label?: ReactNode
  /** e.g. "/100" */
  suffix?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: { pad: 'px-2.5 py-1', num: 'text-xl', cap: 'text-[10px]' },
    md: { pad: 'px-4 py-2', num: 'text-[32px]', cap: 'text-[11px]' },
    lg: { pad: 'px-5 py-3', num: 'text-5xl', cap: 'text-xs' },
  }[size]
  return (
    <span className={cn('hallmark-clip inline-block bg-accent p-px', className)}>
      <span className={cn('hallmark-clip flex flex-col items-center bg-panel text-center', sizes.pad)}>
        <span className={cn('tabular font-display font-semibold leading-none text-ink', sizes.num)}>
          {value}
          {suffix ? <span className="ml-0.5 align-baseline text-[0.45em] font-medium text-muted">{suffix}</span> : null}
        </span>
        {label ? <span className={cn('mt-1 font-medium text-accent', sizes.cap)}>{label}</span> : null}
      </span>
    </span>
  )
}
